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

export function normalizeAppraisal(raw, grounded) {
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
    category: String(raw.category || "").trim(),
    brand: String(raw.brand || "").trim(),
    model: String(raw.model || "").trim(),
    variant: String(raw.variant || "").trim(),
    styleSku: String(raw.styleSku || "").trim(),
    size: String(raw.size || "").trim(),
    color: String(raw.color || "").trim(),
    includedAccessories: Array.isArray(raw.includedAccessories) ? raw.includedAccessories.filter(Boolean).slice(0, 8) : [],
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

export function sourceList(groundingMetadata) {
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

export function toMarkdown(appraisal, { grounded, model, sources }) {
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
    `- **Category:** ${appraisal.category || "Not defensibly identified"}`,
    `- **Brand:** ${appraisal.brand || "Not defensibly identified"}`,
    `- **Model:** ${appraisal.model || "Not defensibly identified"}`,
    `- **Variant:** ${appraisal.variant || "Not defensibly identified"}`,
    `- **Style / SKU:** ${appraisal.styleSku || "Not visible"}`,
    `- **Size:** ${appraisal.size || "Not visible"}`,
    `- **Color:** ${appraisal.color || "Not specified"}`,
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
