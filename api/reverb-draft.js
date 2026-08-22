import { getRedis, installIdFromRequest } from "./_billing.js";
import { verifyAppraisalToken } from "./_security.js";

const REVERB_RATE_LIMIT_PER_HOUR = 10;
const MAX_DESCRIPTION_CHARS = 12000;
const MAX_IMAGES = 6;
const MAX_TOTAL_IMAGE_CHARS = 4_000_000;

const CONDITION_UUIDS = {
  New: "df268ad1-c462-4ba6-b6db-e007e23922ea",
  "Like New": "df268ad1-c462-4ba6-b6db-e007e23922ea",
  Excellent: "df268ad1-c462-4ba6-b6db-e007e23922ea",
  Good: "f7a3f48c-972a-44c6-b01a-0cd27488d3f6",
  Fair: "98777886-76d0-44c8-865e-bb40e669e934",
  Poor: "6a9dfcad-600b-46c8-9e08-ce6e5057921e",
};

function clientIp(req) {
  const forwarded = String(req.headers?.["x-forwarded-for"] || "");
  return forwarded.split(",")[0].trim() || String(req.socket?.remoteAddress || "unknown");
}

async function enforceRateLimit(req, installId) {
  const redis = getRedis();
  if (!redis) return true;
  const hourBucket = Math.floor(Date.now() / 3_600_000);
  const keys = [
    `machzero:reverb:ip:${clientIp(req)}:${hourBucket}`,
    `machzero:reverb:install:${installId}:${hourBucket}`,
  ];
  for (const key of keys) {
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, 3700);
    if (count > REVERB_RATE_LIMIT_PER_HOUR) return false;
  }
  return true;
}

function sanitizeText(value, fallback = "") {
  return String(value || fallback)
    .replace(/\[\/?PART_[0-9]\]/g, "")
    .replace(/\*\*/g, "")
    .replace(/\\n/g, "\n")
    .trim();
}

function numericPrice(value) {
  const parsed = Number(String(value ?? "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed.toFixed(2) : null;
}

function detectGear(title) {
  const lowerTitle = title.toLowerCase();
  let make = "Other";
  let model = title;
  let productType = null;

  const brandList = [
    "Gibson",
    "Ibanez",
    "Fender",
    "Epiphone",
    "Martin",
    "Taylor",
    "PRS",
    "Yamaha",
    "Gretsch",
    "Squier",
  ];
  const foundBrand = brandList.find((brand) => lowerTitle.includes(brand.toLowerCase()));
  if (foundBrand) {
    make = foundBrand;
    model = title.replace(new RegExp(foundBrand, "gi"), "").trim() || title;
  }

  if (lowerTitle.includes("electric") && lowerTitle.includes("guitar")) productType = "electric-guitars";
  else if (lowerTitle.includes("acoustic") && lowerTitle.includes("guitar")) productType = "acoustic-guitars";
  else if (lowerTitle.includes("guitar")) productType = "electric-guitars";
  else if (lowerTitle.includes("bass")) productType = "bass-guitars";
  else if (lowerTitle.includes("amplifier") || /\bamp\b/.test(lowerTitle)) productType = "amps";
  else if (lowerTitle.includes("pedal") || lowerTitle.includes("effects")) productType = "effects-and-pedals";
  else if (lowerTitle.includes("synth") || lowerTitle.includes("keyboard")) productType = "keyboards-and-synths";

  return { make, model, productType };
}

function draftIdempotencyKey(installId, scanId) {
  return `machzero:reverb:draft:${installId}:${scanId}`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed. Use POST." });

  const reverbToken = String(process.env.REVERB_TOKEN || "").trim();
  if (!reverbToken) {
    return res.status(503).json({ error: "Reverb draft creation is not configured yet." });
  }

  const installId = installIdFromRequest(req);
  if (!installId) return res.status(400).json({ error: "MachZero could not identify this installation." });

  const tokenResult = verifyAppraisalToken(req.body?.appraisalToken);
  if (!tokenResult.valid) {
    const status = tokenResult.code === "SIGNING_NOT_CONFIGURED" ? 503 : 403;
    return res.status(status).json({
      error: tokenResult.code === "TOKEN_EXPIRED"
        ? "This appraisal authorization expired. Run the appraisal again before creating a Reverb draft."
        : "MachZero could not verify this appraisal for Reverb draft creation.",
    });
  }
  if (tokenResult.installId !== installId) {
    return res.status(403).json({ error: "This appraisal belongs to another MachZero installation." });
  }

  if (!(await enforceRateLimit(req, installId))) {
    return res.status(429).json({ error: "Too many Reverb draft requests. Try again later." });
  }

  const redis = getRedis();
  const onceKey = draftIdempotencyKey(installId, tokenResult.scanId);
  if (redis) {
    const existingListingId = await redis.get(onceKey);
    if (existingListingId) {
      return res.status(200).json({ success: true, listingId: existingListingId, duplicate: true });
    }
  }

  try {
    const cleanTitle = sanitizeText(tokenResult.itemTitle, "Musical Instrument").substring(0, 80);
    const cleanDescription = sanitizeText(
      req.body?.description,
      "See photos and listing details for product condition information.",
    ).slice(0, MAX_DESCRIPTION_CHARS);
    const cleanPrice = numericPrice(tokenResult.price);
    const conditionGrade = tokenResult.conditionGrade;

    if (!cleanPrice) return res.status(400).json({ error: "The verified appraisal does not contain a valid listing price." });

    const conditionUuid = CONDITION_UUIDS[conditionGrade];
    if (!conditionUuid) {
      return res.status(422).json({ error: "MachZero needs a verified condition grade before creating a Reverb draft." });
    }

    const { make, model, productType } = detectGear(cleanTitle);
    if (!productType) {
      return res.status(422).json({ error: "This appraisal was not identified as supported music gear, so MachZero did not create a Reverb draft." });
    }

    const photoList = Array.isArray(req.body?.images) ? req.body.images.slice(0, MAX_IMAGES) : [];
    const totalChars = photoList.reduce((sum, image) => sum + String(image || "").length, 0);
    if (totalChars > MAX_TOTAL_IMAGE_CHARS) {
      return res.status(413).json({ error: "The Reverb draft photos are too large to upload together." });
    }

    const reverbResponse = await fetch("https://api.reverb.com/api/listings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${reverbToken}`,
        "Content-Type": "application/hal+json",
        Accept: "application/hal+json",
        "Accept-Version": "3.0",
      },
      body: JSON.stringify({
        make,
        model,
        product_type: productType,
        condition: { uuid: conditionUuid },
        title: cleanTitle,
        description: cleanDescription,
        price: { amount: cleanPrice, currency: "USD" },
        location: { country_code: "US" },
        has_inventory: false,
        inventory: 1,
        publish: false,
      }),
    });

    if (!reverbResponse.ok) {
      const details = await reverbResponse.json().catch(() => ({}));
      console.warn("Reverb draft rejected:", reverbResponse.status, details?.message || details?.error || "unknown");
      return res.status(reverbResponse.status).json({ error: "Reverb rejected the draft data. Review the appraisal and try again." });
    }

    const listingData = await reverbResponse.json();
    const listingId = listingData?.id || null;
    const imageUploadEndpoint =
      listingData?._links?.["reverb:listing_images"]?.href ||
      (listingId ? `https://api.reverb.com/api/listings/${listingId}/images` : null);

    if (imageUploadEndpoint && photoList.length) {
      for (const image of photoList) {
        const dataUrl = String(image).startsWith("data:image/") ? String(image) : `data:image/jpeg;base64,${image}`;
        try {
          const uploadResponse = await fetch(imageUploadEndpoint, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${reverbToken}`,
              "Content-Type": "application/json",
              Accept: "application/hal+json",
              "Accept-Version": "3.0",
            },
            body: JSON.stringify({ file: dataUrl }),
          });
          if (!uploadResponse.ok) console.warn("Reverb image upload rejected with status", uploadResponse.status);
        } catch (imageError) {
          console.warn("Reverb image upload failed:", imageError.message);
        }
      }
    }

    if (redis && listingId) await redis.set(onceKey, String(listingId), { ex: 60 * 60 * 24 * 7 });
    return res.status(200).json({ success: true, listingId });
  } catch (error) {
    console.error("MachZero Reverb draft error:", error);
    return res.status(500).json({ error: "Reverb draft creation failed. Try again later." });
  }
}
