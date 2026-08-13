const PRIMARY_MODEL = "gemini-3.6-flash";
const FALLBACK_MODEL = "gemini-2.5-flash";
const MAX_IMAGES = 10;

const appraisalSchema = {
  type: "object",
  properties: {
    itemTitle: {
      type: "string",
      description:
        "The most specific defensible item identity, including brand, model, variant, era, size, and color when visible.",
    },
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

Your job is to give the seller ONE actionable recommended listing price, not a broad range.

Follow this pricing process:
1. Inspect every supplied photo and identify the exact brand, product line, model, variant, style/SKU, approximate era, size, color, included accessories, and visible condition whenever those details can actually be seen.
2. Never invent a model number, size, signature, material, measurement, authenticity finding, or condition detail that is unreadable or not visible.
3. ${
    liveSearch
      ? "Use Google Search to research the current market. Prioritize publicly available SOLD or completed comparable sales from the last 90 days. Then use exact active listings and current retail only as secondary evidence. Search using the exact model/SKU when available."
      : "Live market search is unavailable for this request. Do not claim that any comparable listing was verified or recently sold. Base the result on general resale knowledge and clearly treat it as provisional."
  }
4. Compare like with like. Do not mix a different model, generation, size category, material, bundle, condition, or new item with a used item unless the difference is explicitly adjusted.
5. Reject obvious outliers. Prefer the median of the closest valid sold comparables. If sold data is scarce, discount realistic active asking prices to account for negotiation and unsold inventory.
6. For footwear, model/style code, men's/women's sizing, exact size, outsole wear, upper condition, odor, insoles, laces, and original box can materially affect price. For every category, apply similarly relevant details.
7. recommendedListPrice must be one marketable listing price. expectedSalePrice must be one realistic transaction price. quickSalePrice must be one lower price likely to move faster. Never put a range in any numeric price field.
8. Do not create false precision. If exact identity or important condition evidence is missing, still provide a provisional single price, lower pricingConfidence appropriately, and name the exact photo or fact needed in missingEvidence.
9. If the exact model/SKU is not verified, identificationConfidence and pricingConfidence must not exceed 60. If there are fewer than three close market comparables, pricingConfidence must not exceed 70.
10. ${
    liveSearch
      ? "Never describe an item as sold unless the source actually indicates a completed sale. Do not fabricate comparable prices or marketplaces."
      : "Set pricingConfidence no higher than 55 and use listingType 'Unverified' for any general reference points."
  }

Return only data matching the supplied JSON schema.`;
}

function imageParts(images) {
  return images.map((image) => ({
    inlineData: {
      data: image.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, ""),
      mimeType: "image/jpeg",
    },
  }));
}

async function requestAppraisal({ apiKey, images, useSearch }) {
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

function validNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function listPrice(value) {
  const number = validNumber(value, 0.99);
  return Math.max(0.01, Math.round(number * 100) / 100);
}

function marketableListPrice(value) {
  const number = validNumber(value, 0.99);

  if (number < 20) {
    return Math.max(0.99, Math.round(number) - 0.01);
  }

  return Math.max(4.99, Math.round(number / 5) * 5 - 0.01);
}

function wholeDollar(value, fallback) {
  return Math.max(1, Math.round(validNumber(value, fallback)));
}

function money(value) {
  return `$${Number(value).toFixed(2)}`;
}

function confidence(value, maximum = 100) {
  return Math.min(maximum, Math.max(0, Math.round(Number(value) || 0)));
}

function median(values) {
  const sorted = values
    .map(Number)
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b);

  if (!sorted.length) return null;

  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function removePriceOutliers(values) {
  if (values.length < 4) return values;

  const center = median(values);
  const deviations = values.map((value) => Math.abs(value - center));
  const medianDeviation = median(deviations);

  if (!medianDeviation) return values;

  const maximumDeviation = Math.max(medianDeviation * 3.5, center * 0.35);
  const filtered = values.filter(
    (value) => Math.abs(value - center) <= maximumDeviation,
  );

  return filtered.length >= 2 ? filtered : values;
}

function comparablePrices(comparables, listingType) {
  const prices = [];

  for (const comparable of comparables) {
    if (comparable?.listingType !== listingType) continue;
    if (!['Exact', 'Close'].includes(comparable?.matchQuality)) continue;

    const price = Number(comparable?.price);
    if (!Number.isFinite(price) || price <= 0) continue;

    prices.push(price);
    if (comparable.matchQuality === 'Exact') prices.push(price);
  }

  return removePriceOutliers(prices);
}

function comparableCount(comparables, listingType) {
  return comparables.filter(
    (comparable) =>
      comparable?.listingType === listingType &&
      ['Exact', 'Close'].includes(comparable?.matchQuality) &&
      Number.isFinite(Number(comparable?.price)) &&
      Number(comparable.price) > 0,
  ).length;
}

function conditionRetailMultiplier(conditionGrade) {
  return {
    New: 0.9,
    'Like New': 0.78,
    Excellent: 0.68,
    Good: 0.56,
    Fair: 0.4,
    Poor: 0.25,
    Unknown: 0.5,
  }[conditionGrade] || 0.5;
}

function derivePrices(raw, grounded) {
  const comparables = Array.isArray(raw.comparableSummary)
    ? raw.comparableSummary
    : [];
  const soldPrices = grounded ? comparablePrices(comparables, 'Sold') : [];
  const activePrices = grounded ? comparablePrices(comparables, 'Active asking') : [];
  const retailPrices = grounded ? comparablePrices(comparables, 'Retail') : [];
  const soldCount = grounded ? comparableCount(comparables, 'Sold') : 0;
  const activeCount = grounded ? comparableCount(comparables, 'Active asking') : 0;
  const retailCount = grounded ? comparableCount(comparables, 'Retail') : 0;

  let expectedSalePrice;
  let recommendedListPrice;
  let quickSalePrice;
  let method;
  let evidenceCap;

  if (soldPrices.length) {
    expectedSalePrice = wholeDollar(median(soldPrices), raw.expectedSalePrice);
    recommendedListPrice = marketableListPrice(expectedSalePrice * 1.1);
    quickSalePrice = wholeDollar(expectedSalePrice * 0.82, raw.quickSalePrice);
    method = `Calculated from the outlier-adjusted, match-weighted median of ${soldCount} exact/close sold comparable${soldCount === 1 ? '' : 's'}.`;
    evidenceCap = soldCount >= 5 ? 92 : soldCount >= 3 ? 85 : 70;
  } else if (activePrices.length) {
    const activeMedian = median(activePrices);
    recommendedListPrice = marketableListPrice(activeMedian);
    expectedSalePrice = wholeDollar(activeMedian * 0.88, raw.expectedSalePrice);
    quickSalePrice = wholeDollar(expectedSalePrice * 0.82, raw.quickSalePrice);
    method = `No usable sold prices were found; calculated from the outlier-adjusted, match-weighted median of ${activeCount} exact/close active asking-price comparable${activeCount === 1 ? '' : 's'} with a sell-through discount.`;
    evidenceCap = activeCount >= 5 ? 68 : 62;
  } else if (retailPrices.length) {
    const retailMedian = median(retailPrices);
    expectedSalePrice = wholeDollar(
      retailMedian * conditionRetailMultiplier(raw.conditionGrade),
      raw.expectedSalePrice,
    );
    recommendedListPrice = marketableListPrice(expectedSalePrice * 1.1);
    quickSalePrice = wholeDollar(expectedSalePrice * 0.82, raw.quickSalePrice);
    method = `No usable resale comparables were found; calculated from ${retailCount} current exact/close retail reference${retailCount === 1 ? '' : 's'} with a ${raw.conditionGrade || 'Unknown'} condition discount.`;
    evidenceCap = 55;
  } else {
    recommendedListPrice = listPrice(raw.recommendedListPrice);
    expectedSalePrice = wholeDollar(raw.expectedSalePrice, recommendedListPrice * 0.9);
    quickSalePrice = wholeDollar(raw.quickSalePrice, expectedSalePrice * 0.82);
    method = grounded
      ? 'No exact or close numeric market comparables were available; the displayed price is provisional.'
      : 'Live market evidence was unavailable; the displayed price is provisional.';
    evidenceCap = grounded ? 55 : 45;
  }

  recommendedListPrice = Math.max(recommendedListPrice, expectedSalePrice);
  expectedSalePrice = Math.min(expectedSalePrice, Math.round(recommendedListPrice));
  quickSalePrice = Math.min(quickSalePrice, expectedSalePrice);

  return {
    recommendedListPrice,
    expectedSalePrice,
    quickSalePrice,
    method,
    evidenceCap,
  };
}

function normalizeAppraisal(raw, grounded) {
  const prices = derivePrices(raw, grounded);
  const missingEvidence = Array.isArray(raw.missingEvidence)
    ? raw.missingEvidence.filter(Boolean).slice(0, 5)
    : [];
  const identityGap = missingEvidence.some((item) =>
    /model|style|sku|serial|label|tag|marking|version|variant/i.test(String(item)),
  );

  const exactIdentity = confidence(raw.identificationConfidence, identityGap ? 60 : 100);
  let confidenceCap = Math.min(grounded ? 100 : 55, prices.evidenceCap);
  if (exactIdentity < 61) confidenceCap = Math.min(confidenceCap, 60);
  if (missingEvidence.length) confidenceCap = Math.min(confidenceCap, 70);

  return {
    ...raw,
    itemTitle: String(raw.itemTitle || "Unidentified resale item").trim(),
    recommendedListPrice: prices.recommendedListPrice,
    expectedSalePrice: prices.expectedSalePrice,
    quickSalePrice: prices.quickSalePrice,
    pricingConfidence: confidence(raw.pricingConfidence, confidenceCap),
    identificationConfidence: exactIdentity,
    conditionGrade: String(raw.conditionGrade || "Unknown"),
    conditionNotes: String(raw.conditionNotes || "Condition could not be fully verified."),
    marketBasis: `${prices.method} ${String(raw.marketBasis || "").trim()}`.trim(),
    comparableSummary: Array.isArray(raw.comparableSummary)
      ? raw.comparableSummary.slice(0, 8)
      : [],
    missingEvidence,
    marketplaceRecommendations: Array.isArray(raw.marketplaceRecommendations)
      ? raw.marketplaceRecommendations.filter(Boolean).slice(0, 6)
      : ["eBay"],
    listingDescription: String(raw.listingDescription || "").trim(),
  };
}

function sourceList(groundingMetadata) {
  const sources = groundingMetadata?.groundingChunks || [];
  const unique = new Map();

  for (const chunk of sources) {
    const title = chunk?.web?.title;
    const url = chunk?.web?.uri;
    if (title && url && !unique.has(url)) {
      unique.set(url, { title, url });
    }
  }

  return [...unique.values()].slice(0, 8);
}

function toMarkdown(appraisal, { grounded, model, sources }) {
  const comparableLines = appraisal.comparableSummary.length
    ? appraisal.comparableSummary.map((item) => {
        const price = Number(item?.price) > 0 ? money(item.price) : "price unavailable";
        return `  - ${item.marketplace}: ${price} — ${item.listingType}, ${item.matchQuality} match. ${item.notes}`;
      })
    : ["  - No sufficiently close public comparables were verified."];

  const missingLines = appraisal.missingEvidence.length
    ? appraisal.missingEvidence.map((item) => `  - ${item}`)
    : ["  - Nothing material was identified as missing from the supplied photos."];

  const sourceLines = sources.length
    ? sources.map((source) => `  - [${source.title}](${source.url})`)
    : ["  - No live source links were returned for this scan."];

  const factors = [
    `- **Recommended list price:** ${money(appraisal.recommendedListPrice)}`,
    `- **Expected sale price:** ${money(appraisal.expectedSalePrice)}`,
    `- **Quick-sale price:** ${money(appraisal.quickSalePrice)}`,
    `- **Pricing confidence:** ${appraisal.pricingConfidence}%`,
    `- **Identification confidence:** ${appraisal.identificationConfidence}%`,
    `- **Condition:** ${appraisal.conditionGrade} — ${appraisal.conditionNotes}`,
    `- **Pricing basis:** ${appraisal.marketBasis}`,
    `- **Live market search:** ${grounded ? "Verified search evidence was returned" : "Unavailable; this price is provisional"}`,
    `- **Comparable evidence:**`,
    ...comparableLines,
    `- **What would improve confidence:**`,
    ...missingLines,
    `- **Market sources:**`,
    ...sourceLines,
    `- **Pricing engine:** ${model}`,
  ].join("\n");

  const channels = appraisal.marketplaceRecommendations
    .map((channel) => `- ${channel}`)
    .join("\n");

  return `[PART_1]
${money(appraisal.recommendedListPrice)}

[PART_2]
${appraisal.itemTitle}

[PART_3]
${factors}

[PART_4]
${channels}

[PART_5]
ASKING PRICE: ${money(appraisal.recommendedListPrice)}

${appraisal.listingDescription}`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "GEMINI_API_KEY is not configured." });
  }

  const images = req.body?.images;
  if (!Array.isArray(images) || images.length === 0) {
    return res.status(400).json({ error: "No images provided for analysis." });
  }

  if (images.length > MAX_IMAGES) {
    return res.status(400).json({ error: `A maximum of ${MAX_IMAGES} images is allowed.` });
  }

  if (images.some((image) => typeof image !== "string" || image.length < 100)) {
    return res.status(400).json({ error: "One or more image files are invalid." });
  }

  try {
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

    return res.status(200).json({
      success: true,
      analysis,
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
    return res.status(500).json({
      success: false,
      error: "MachZero could not complete this appraisal. Please try clearer photos.",
    });
  }
}
