import {
  installIdFromRequest,
  markScanFailure,
  markScanSuccess,
  releaseScanCredit,
  reserveScanCredit,
  scanIdFromRequest,
  usageSnapshot,
} from "./_billing.js";
import { cactusByteVipFromRequest, cactusByteVipUser } from "./_cactusbyte-vip.js";
import { createAppraisalToken } from "./_security.js";
import { MAX_IMAGES, MAX_TOTAL_IMAGE_CHARS, enforceScanRateLimit, publicError, requestAppraisal } from "./_analyze-gemini.js";
import { normalizeAppraisal, sourceList, toMarkdown } from "./_analyze-pricing.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "GEMINI_API_KEY is not configured." });
  }

  const rateLimit = await enforceScanRateLimit(req);
  if (!rateLimit.allowed) {
    return res.status(429).json({
      success: false,
      code: "SCAN_RATE_LIMIT",
      error: "Too many scans were requested from this connection. Try again in a little while.",
    });
  }
  if (rateLimit.remaining !== null) {
    res.setHeader("X-MachZero-Scans-Remaining", String(rateLimit.remaining));
  }

  const installId = installIdFromRequest(req);
  const scanId = scanIdFromRequest(req);
  if (!installId || !scanId) {
    return res.status(400).json({ success: false, code: "SCAN_SESSION_MISSING", error: "MachZero could not identify this scan session. Refresh the app and try again." });
  }

  const images = req.body?.images;
  if (!Array.isArray(images) || images.length === 0) {
    return res.status(400).json({ success: false, code: "NO_IMAGES", error: "Add at least one photo before scanning." });
  }

  if (images.length > MAX_IMAGES) {
    return res.status(400).json({ success: false, code: "TOO_MANY_IMAGES", error: `A maximum of ${MAX_IMAGES} photos is allowed per appraisal.` });
  }

  if (images.some((image) => typeof image !== "string" || image.length < 100)) {
    return res.status(400).json({ success: false, code: "INVALID_IMAGE", error: "One or more photos could not be read." });
  }

  const totalImageChars = images.reduce((total, image) => total + image.length, 0);
  if (totalImageChars > MAX_TOTAL_IMAGE_CHARS) {
    return res.status(413).json({ success: false, code: "PHOTOS_TOO_LARGE", error: "Those photos are still too large to send together. Remove one photo or retake the largest image." });
  }

  const cactusByteVip = cactusByteVipFromRequest(req);
  const vipUser = cactusByteVip ? cactusByteVipUser(installId) : null;
  let reservation = null;
  try {
    reservation = cactusByteVip
      ? { allowed: true, newReservation: false, source: "cactusbyte_vip", snapshot: { user: vipUser } }
      : await reserveScanCredit(installId, scanId);
    if (!reservation.allowed) {
      if (reservation.code === "BILLING_UNAVAILABLE" || reservation.source === "billing_unavailable") {
        return res.status(503).json({
          success: false,
          code: "BILLING_UNAVAILABLE",
          error: "MachZero billing is temporarily unavailable, so this scan was not charged. Try again shortly.",
          usage: reservation.snapshot?.user || null,
        });
      }
      return res.status(402).json({
        success: false,
        code: "SCAN_LIMIT_REACHED",
        error: "You've used the scans included with your current MachZero plan.",
        usage: reservation.snapshot?.user || null,
      });
    }

    let result;
    let grounded = false;

    try {
      result = await requestAppraisal({ apiKey, images, useSearch: true });
      grounded = Boolean(result.groundingMetadata?.groundingChunks?.length);
      if (!grounded) {
        throw new Error("Google Search returned no verifiable market sources.");
      }
    } catch (searchError) {
      console.warn("MachZero grounded pricing unavailable; using safe fallback:", searchError.message);
      result = await requestAppraisal({ apiKey, images, useSearch: false });
    }

    const appraisal = normalizeAppraisal(result.appraisal, grounded);
    const sources = sourceList(result.groundingMetadata);
    const analysis = toMarkdown(appraisal, {
      grounded,
      model: result.model,
      sources,
    });

    const nextPhotoRequest =
      appraisal.missingEvidence.length &&
      (appraisal.identificationConfidence < 85 || appraisal.pricingConfidence < 80)
        ? appraisal.missingEvidence[0]
        : null;

    const draftToken = createAppraisalToken({
      installId,
      scanId,
      itemTitle: appraisal.itemTitle,
      price: appraisal.recommendedListPrice,
      conditionGrade: appraisal.conditionGrade,
    });

    const billingPromise = cactusByteVip ? Promise.resolve({ user: vipUser }) : usageSnapshot(installId);
    const metricPromise = reservation?.newReservation
      ? markScanSuccess(reservation.snapshot?.user?.plan || "unknown")
      : Promise.resolve();
    const [billing] = await Promise.all([billingPromise, metricPromise]);

    return res.status(200).json({
      success: true,
      analysis,
      usage: billing.user,
      draftToken,
      appraisal: {
        itemTitle: appraisal.itemTitle,
        category: appraisal.category,
        brand: appraisal.brand,
        model: appraisal.model,
        variant: appraisal.variant,
        styleSku: appraisal.styleSku,
        size: appraisal.size,
        color: appraisal.color,
        includedAccessories: appraisal.includedAccessories,
        recommendedListPrice: appraisal.recommendedListPrice,
        expectedSalePrice: appraisal.expectedSalePrice,
        quickSalePrice: appraisal.quickSalePrice,
        pricingConfidence: appraisal.pricingConfidence,
        identificationConfidence: appraisal.identificationConfidence,
        conditionGrade: appraisal.conditionGrade,
        conditionNotes: appraisal.conditionNotes,
        marketBasis: appraisal.marketBasis,
        comparableSummary: appraisal.comparableSummary,
        missingEvidence: appraisal.missingEvidence,
        nextPhotoRequest,
        marketplaceRecommendations: appraisal.marketplaceRecommendations,
        listingDescription: appraisal.listingDescription,
        grounded,
        sources,
        model: result.model,
        draftToken,
      },
      pricing: {
        recommendedListPrice: appraisal.recommendedListPrice,
        expectedSalePrice: appraisal.expectedSalePrice,
        quickSalePrice: appraisal.quickSalePrice,
        pricingConfidence: appraisal.pricingConfidence,
        identificationConfidence: appraisal.identificationConfidence,
        grounded,
        sources,
      },
    });
  } catch (error) {
    console.error("Backend MachZero pricing error:", error);
    if (reservation?.newReservation) {
      await releaseScanCredit(installId, scanId, reservation.source).catch(() => null);
      await markScanFailure(reservation.snapshot?.user?.plan || "unknown");
    }
    const safe = publicError(error);
    return res.status(safe.status).json({
      success: false,
      code: safe.code,
      error: safe.error,
    });
  }
}
