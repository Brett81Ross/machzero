const PRIMARY_MODEL = "gemini-3.6-flash";
const FALLBACK_MODEL = "gemini-2.5-flash";
export const MAX_IMAGES = 6;
export const MAX_TOTAL_IMAGE_CHARS = 4_000_000;
const SCAN_RATE_LIMIT_PER_HOUR = 40;

const appraisalSchema = {
  type: "object",
  properties: {
    itemTitle: {
      type: "string",
      description:
        "The most specific defensible item identity, including brand, model, variant, era, size, and color when visible.",
    },
    category: { type: "string", description: "Plain-language product category inferred from the photos." },
    brand: { type: "string", description: "Brand visible or defensibly identified from the photos; empty string if not defensible." },
    model: { type: "string", description: "Exact model or product line when defensible; empty string when not verified." },
    variant: { type: "string", description: "Variant, generation, edition, gender, width, configuration, or other model-defining variation when visible; otherwise empty." },
    styleSku: { type: "string", description: "Visible style code, SKU, model number, serial family, part number, or other useful identifier. Never invent it; empty when unreadable." },
    size: { type: "string", description: "Visible size or dimensions when explicitly readable or visually defensible; otherwise empty." },
    color: { type: "string", description: "Visible primary color/colorway when useful; otherwise empty." },
    includedAccessories: { type: "array", maxItems: 8, items: { type: "string" }, description: "Accessories, box, case, cables, manuals, or components visibly included in the photos." },
    recommendedListPrice: {
      type: "number",
      minimum: 0.01,
      description:
        "One recommended US listing price before shipping. This must be a single number, never a range.",
    },
    expectedSalePrice: {
      type: "number",
      minimum: 0.01,
      description:
        "One realistic price the seller is likely to receive before fees and shipping.",
    },
    quickSalePrice: {
      type: "number",
      minimum: 0.01,
      description:
        "One price intended to attract a buyer quickly, before fees and shipping.",
    },
    pricingConfidence: {
      type: "integer",
      minimum: 0,
      maximum: 100,
      description:
        "Confidence in the price based on exact identification, visible condition, and quality of comparable market evidence.",
    },
    identificationConfidence: {
      type: "integer",
      minimum: 0,
      maximum: 100,
      description: "Confidence that the exact model or variant was identified.",
    },
    conditionGrade: {
      type: "string",
      enum: ["New", "Like New", "Excellent", "Good", "Fair", "Poor", "Unknown"],
    },
    conditionNotes: {
      type: "string",
      description: "Visible condition evidence and any condition details that cannot be verified.",
    },
    marketBasis: {
      type: "string",
      description:
        "A concise explanation of how the exact prices were calculated, clearly distinguishing sold evidence from active asking prices and retail prices.",
    },
    comparableSummary: {
      type: "array",
      maxItems: 8,
      items: {
        type: "object",
        properties: {
          marketplace: { type: "string" },
          listingType: {
            type: "string",
            enum: ["Sold", "Active asking", "Retail", "Price guide", "Unverified"],
          },
          price: { type: "number", minimum: 0 },
          matchQuality: {
            type: "string",
            enum: ["Exact", "Close", "Broad"],
          },
          notes: { type: "string" },
        },
        required: ["marketplace", "listingType", "price", "matchQuality", "notes"],
      },
    },
    missingEvidence: {
      type: "array",
      maxItems: 5,
      items: { type: "string" },
      description:
        "Specific additional photos or facts that would materially improve the price. Empty when nothing important is missing.",
    },
    marketplaceRecommendations: {
      type: "array",
      minItems: 1,
      maxItems: 6,
      items: { type: "string" },
    },
    listingDescription: {
      type: "string",
      description:
        "A polished, honest, ready-to-paste sale listing. Do not state uncertain details as facts.",
    },
  },
  required: [
    "itemTitle",
    "category",
    "brand",
    "model",
    "variant",
    "styleSku",
    "size",
    "color",
    "includedAccessories",
    "recommendedListPrice",
    "expectedSalePrice",
    "quickSalePrice",
    "pricingConfidence",
    "identificationConfidence",
    "conditionGrade",
    "conditionNotes",
    "marketBasis",
    "comparableSummary",
    "missingEvidence",
    "marketplaceRecommendations",
    "listingDescription",
  ],
};

function buildPrompt({ liveSearch }) {
  const today = new Date().toISOString().slice(0, 10);

  return `You are MachZero's evidence-first resale pricing engine for the United States market.
Today's date is ${today}. All prices must be in USD and exclude sales tax, seller fees, and shipping.

Your job is to perform a zero-input appraisal from the photos alone. The user should not have to choose a category, type a brand, select a condition, enter a model, or fill out an appraisal form. Infer every defensible field from visual evidence, then give the seller ONE actionable recommended listing price, not a broad range.

Follow this pricing process:
1. Inspect every supplied photo as evidence. Automatically determine the product category and identify the exact brand, product line, model, variant, style/SKU, approximate era, size, color, included accessories, and visible condition whenever those details can actually be seen.
2. Never invent a model number, size, signature, material, measurement, authenticity finding, ownership history, purchase price, or condition detail that is unreadable or not visible. Use an empty string for identity fields that cannot be defended from the photos instead of making the user fill them in.
3. ${
    liveSearch
      ? "Use Google Search to research the current market. Prioritize publicly available SOLD or completed comparable sales from the last 90 days. Then use exact active listings and current retail only as secondary evidence. Search using the exact model/SKU when available."
      : "Live market search is unavailable for this request. Do not claim that any comparable listing was verified or recently sold. Base the result on general resale knowledge and clearly treat it as provisional."
  }
4. Compare like with like. Do not mix a different model, generation, size category, material, bundle, condition, or new item with a used item unless the difference is explicitly adjusted.
5. Reject obvious outliers. Prefer the median of the closest valid sold comparables. If sold data is scarce, discount realistic active asking prices to account for negotiation and unsold inventory.
6. For footwear, model/style code, men's/women's sizing, exact size, outsole wear, upper condition, odor, insoles, laces, and original box can materially affect price. For every category, apply similarly relevant details.
7. recommendedListPrice must be one marketable listing price. expectedSalePrice must be one realistic transaction price. quickSalePrice must be one lower price likely to move faster. Never put a range in any numeric price field.
8. Do not create false precision. If exact identity or important condition evidence is missing, still provide a provisional single price, lower pricingConfidence appropriately, and use missingEvidence to request ONE highly specific next photo whenever a photo can solve the uncertainty. Prefer requests such as “photograph the style/SKU tag inside the tongue” over generic instructions such as “take more photos.” Do not ask the user to fill out a form.
9. If the exact model/SKU is not verified, identificationConfidence and pricingConfidence must not exceed 60. If there are fewer than three close market comparables, pricingConfidence must not exceed 70.
10. ${
    liveSearch
      ? "Never describe an item as sold unless the source actually indicates a completed sale. Do not fabricate comparable prices or marketplaces."
      : "Set pricingConfidence no higher than 55 and use listingType 'Unverified' for any general reference points."
  }

Return only data matching the supplied JSON schema.`;
}

function imageParts(images) {
  return images.map((image) => {
    const match = String(image).match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/s);
    return {
      inlineData: {
        data: match ? match[2] : String(image),
        mimeType: match ? match[1] : "image/jpeg",
      },
    };
  });
}

function clientIp(req) {
  const forwarded = String(req.headers?.["x-forwarded-for"] || "");
  return forwarded.split(",")[0].trim() || String(req.socket?.remoteAddress || "unknown");
}

export async function enforceScanRateLimit(req) {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return { allowed: true, remaining: null };
  }

  try {
    const { Redis } = await import("@upstash/redis");
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
    const hourBucket = Math.floor(Date.now() / 3_600_000);
    const key = `machzero:scan:${clientIp(req)}:${hourBucket}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, 3700);
    return {
      allowed: count <= SCAN_RATE_LIMIT_PER_HOUR,
      remaining: Math.max(0, SCAN_RATE_LIMIT_PER_HOUR - count),
    };
  } catch (error) {
    console.warn("MachZero rate limiter unavailable; allowing request:", error.message);
    return { allowed: true, remaining: null };
  }
}

export function publicError(error) {
  const status = Number(error?.status || 0);
  const message = String(error?.message || "");

  if (status === 429 || /rate.?limit|quota|resource exhausted/i.test(message)) {
    return {
      status: 429,
      code: "AI_RATE_LIMIT",
      error: "The pricing engine is temporarily busy. Wait a moment and try this scan again.",
    };
  }
  if (status === 400 || /image|mime|payload|request/i.test(message)) {
    return {
      status: 400,
      code: "IMAGE_REQUEST",
      error: "One of the photos could not be processed. Try the scan again with a clear JPG, PNG, HEIC, or WebP photo.",
    };
  }
  if (status === 401 || status === 403 || /api key|permission|unauthorized|forbidden/i.test(message)) {
    return {
      status: 503,
      code: "AI_CONFIGURATION",
      error: "MachZero's pricing service needs configuration attention. The photos are not the problem.",
    };
  }
  if (/JSON|appraisal text|response/i.test(message)) {
    return {
      status: 502,
      code: "INCOMPLETE_RESPONSE",
      error: "The pricing engine returned an incomplete appraisal. Try the same photos again.",
    };
  }
  return {
    status: 502,
    code: "AI_UPSTREAM",
    error: "The visual pricing engine did not complete this scan. Your photos were kept on this device, so you can retry without starting over.",
  };
}

export async function requestAppraisal({ apiKey, images, useSearch }) {
  const model = useSearch ? PRIMARY_MODEL : FALLBACK_MODEL;
  const generationConfig = useSearch
    ? {
        responseFormat: {
          text: {
            mimeType: "APPLICATION_JSON",
            schema: appraisalSchema,
          },
        },
      }
    : {
        responseMimeType: "application/json",
        responseSchema: appraisalSchema,
      };

  const payload = {
    contents: [
      {
        role: "user",
        parts: [...imageParts(images), { text: buildPrompt({ liveSearch: useSearch }) }],
      },
    ],
    generationConfig,
  };

  if (useSearch) {
    payload.tools = [{ googleSearch: {} }];
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(payload),
    },
  );

  const responseBody = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      responseBody?.error?.message || `Gemini request failed with status ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  const text = responseBody?.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || "")
    .join("")
    .trim();

  if (!text) {
    throw new Error("Gemini returned no appraisal text.");
  }

  const cleanJson = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  return {
    appraisal: JSON.parse(cleanJson),
    groundingMetadata: responseBody?.candidates?.[0]?.groundingMetadata || null,
    model,
  };
}
