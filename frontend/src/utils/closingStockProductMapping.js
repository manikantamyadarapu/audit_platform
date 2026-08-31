/**
 * Closing Stock mapping helpers — Rule Book always loaded from the Python service API.
 * Do not bundle a static Rule Book JSON in the frontend.
 */

import { CLOSING_STOCK_CATEGORIES } from '../config/closingStockLayout';

const SHEET_KEY_ALIASES = {
  Precious: 'Precious and Semi Precious',
};

const UNICODE_WS = /[\u00a0\u1680\u2000-\u200b\u202f\u205f\u3000\ufeff]+/g;

function normProduct(name) {
  let text = String(name || '');
  text = text.normalize('NFKC');
  text = text.replace(UNICODE_WS, ' ').trim().toLowerCase();
  return text.split(/\s+/).filter(Boolean).join(' ');
}

function matchKey(name) {
  return normProduct(name).replace(/[^a-z0-9]+/g, '');
}

function coreSkuKey(name) {
  const tokens = normProduct(name)
    .replace(/\./g, ' ')
    .split(/\s+/)
    .map((t) => t.replace(/[^a-z0-9]+/g, ''))
    .filter(Boolean);
  if (!tokens.length) return '';
  let digitIdx = -1;
  for (let i = tokens.length - 1; i >= 0; i -= 1) {
    if (/\d/.test(tokens[i])) {
      digitIdx = i;
      break;
    }
  }
  if (digitIdx < 0) return tokens.join('');
  let start = digitIdx;
  if (start > 0 && /^[a-z]+$/.test(tokens[start - 1])) {
    start -= 1;
  }
  return tokens.slice(start).join('');
}

function coerceMeasure(value) {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

/** Round Closing Stock Amount values only (half up). Quantity is never rounded. */
function roundClosingStockAmount(value) {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return Math.round(num);
}

function normalizeRuleBookRaw(ruleBookRaw) {
  const normalized = {};
  for (const [key, value] of Object.entries(ruleBookRaw || {})) {
    const sheet = SHEET_KEY_ALIASES[key] || key;
    if (normalized[sheet] && key !== sheet) continue;
    normalized[sheet] = value;
  }
  return normalized;
}

function cleanProductList(entries) {
  const cleaned = [];
  const seen = new Set();
  for (const item of entries || []) {
    const name = String(item || '').trim();
    if (!name) continue;
    const key = normProduct(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    cleaned.push(name);
  }
  return cleaned;
}

/** Build normalized book keyed by sheet name from API Rule Book payload. */
export function normalizeRuleBookFromApi(ruleBookRaw) {
  const normalized = normalizeRuleBookRaw(ruleBookRaw);
  const book = {};
  for (const category of CLOSING_STOCK_CATEGORIES) {
    const entries = normalized[category];
    if (Array.isArray(entries)) {
      book[category] = cleanProductList(entries);
    } else if (entries && typeof entries === 'object') {
      const subcats = {};
      for (const [subName, products] of Object.entries(entries)) {
        const label = String(subName || '').trim();
        if (!label) continue;
        subcats[label] = cleanProductList(products);
      }
      book[category] = subcats;
    } else {
      book[category] = [];
    }
  }
  return book;
}

function subcategoryTotalLabel(category, subcategory) {
  if (category === 'Precious and Semi Precious') {
    return `TOTAL - ${String(subcategory || '').trim().toUpperCase()}`;
  }
  return 'TOTAL';
}

function emptyMeasures() {
  return { sumOfQuantity: null, sumOfGross: null };
}

function accumulateMeasures(entry, { qty, gross }) {
  if (qty !== null) entry.sumOfQuantity = (entry.sumOfQuantity ?? 0) + qty;
  if (gross !== null) entry.sumOfGross = (entry.sumOfGross ?? 0) + gross;
}

function iterRuleBookProducts(book) {
  const rows = [];
  for (const category of CLOSING_STOCK_CATEGORIES) {
    const section = book[category];
    if (Array.isArray(section)) {
      for (const product of section) rows.push({ category, subcategory: null, product });
    } else if (section && typeof section === 'object') {
      for (const [subcategory, products] of Object.entries(section)) {
        for (const product of products) {
          rows.push({ category, subcategory, product });
        }
      }
    }
  }
  return rows;
}

/** Map normalized pivot keys → Rule Book display name (one claim per pivot row). */
function buildRuleBookMatchLookup(book) {
  const products = iterRuleBookProducts(book);
  const coreOwners = {};
  for (const { product: displayName } of products) {
    const core = coreSkuKey(displayName);
    if (!core) continue;
    if (!coreOwners[core]) coreOwners[core] = [];
    coreOwners[core].push(displayName);
  }

  const lookup = {};
  for (const { product: displayName } of products) {
    for (const key of [normProduct(displayName), matchKey(displayName)]) {
      if (key && !lookup[key]) lookup[key] = displayName;
    }
    const core = coreSkuKey(displayName);
    if (core && coreOwners[core]?.length === 1 && !lookup[core]) {
      lookup[core] = displayName;
    }
  }
  return lookup;
}

function resolveRuleBookDisplayName(pivotProduct, lookup) {
  for (const key of [
    normProduct(pivotProduct),
    matchKey(pivotProduct),
    coreSkuKey(pivotProduct),
  ]) {
    if (key && lookup[key]) return lookup[key];
  }
  return null;
}

/** Claim each pivot row once and SUM onto the matching Rule Book display name. */
function aggregatePivotByRuleBook(rows, lookup) {
  const byDisplay = {};
  const unmappedRows = [];

  for (const row of rows || []) {
    const productName = String(row?.product || '').trim();
    if (!productName) continue;
    const qty = coerceMeasure(row?.sumOfQuantity);
    const gross = coerceMeasure(row?.sumOfGross);
    const displayName = resolveRuleBookDisplayName(productName, lookup);
    if (!displayName) {
      unmappedRows.push({ product: productName, sumOfQuantity: qty, sumOfGross: gross });
      continue;
    }
    const entry = byDisplay[displayName] || emptyMeasures();
    accumulateMeasures(entry, { qty, gross });
    byDisplay[displayName] = entry;
  }

  return { byDisplay, unmappedRows };
}

function rawProductMeasures(ruleBookProduct, salesByDisplay, purchasesByDisplay, openingByDisplay = {}) {
  const sales = salesByDisplay[ruleBookProduct] || {};
  const purchases = purchasesByDisplay[ruleBookProduct] || {};
  const opening = openingByDisplay[ruleBookProduct] || {};
  return {
    openingQty: opening.sumOfQuantity ?? null,
    openingAmt: opening.sumOfGross ?? null,
    purchasesQty: purchases.sumOfQuantity ?? null,
    purchasesAmt: purchases.sumOfGross ?? null,
    salesQty: sales.sumOfQuantity ?? null,
    salesAmt: sales.sumOfGross ?? null,
  };
}

function displayProductMeasures(raw) {
  return {
    openingQty: raw.openingQty ?? null,
    openingAmt: roundClosingStockAmount(raw.openingAmt),
    purchasesQty: raw.purchasesQty ?? null,
    purchasesAmt: roundClosingStockAmount(raw.purchasesAmt),
    salesQty: raw.salesQty ?? null,
    salesAmt: roundClosingStockAmount(raw.salesAmt),
  };
}

/** TOTAL from unrounded originals: Amt = ROUND(SUM); Qty = SUM with no rounding. */
function totalMeasuresFromRaw(rawRows) {
  const totals = {};
  const present = new Set();
  for (const raw of rawRows || []) {
    for (const key of [
      'openingQty',
      'openingAmt',
      'purchasesQty',
      'purchasesAmt',
      'salesQty',
      'salesAmt',
    ]) {
      const value = coerceMeasure(raw?.[key]);
      if (value === null) continue;
      totals[key] = (totals[key] ?? 0) + value;
      present.add(key);
    }
  }
  return {
    openingQty: present.has('openingQty') ? totals.openingQty : null,
    openingAmt: present.has('openingAmt') ? roundClosingStockAmount(totals.openingAmt) : null,
    purchasesQty: present.has('purchasesQty') ? totals.purchasesQty : null,
    purchasesAmt: present.has('purchasesAmt') ? roundClosingStockAmount(totals.purchasesAmt) : null,
    salesQty: present.has('salesQty') ? totals.salesQty : null,
    salesAmt: present.has('salesAmt') ? roundClosingStockAmount(totals.salesAmt) : null,
  };
}

function buildLayoutFromRuleBook(
  category,
  ruleSection,
  salesByDisplay,
  purchasesByDisplay,
  openingByDisplay = {}
) {
  const layout = [];
  const flatProducts = [];
  const sheetRaw = [];

  if (ruleSection && typeof ruleSection === 'object' && !Array.isArray(ruleSection)) {
    for (const [subcategory, ruleProducts] of Object.entries(ruleSection)) {
      const products = Array.isArray(ruleProducts) ? ruleProducts : [];
      if (!products.length) continue;
      layout.push({ kind: 'subcategory', label: subcategory, subcategory });
      const subcategoryRaw = [];
      for (const product of products) {
        const raw = rawProductMeasures(
          product,
          salesByDisplay,
          purchasesByDisplay,
          openingByDisplay
        );
        const display = displayProductMeasures(raw);
        layout.push({
          kind: 'product',
          label: product,
          subcategory,
          ...display,
        });
        flatProducts.push(product);
        subcategoryRaw.push(raw);
        sheetRaw.push(raw);
      }
      layout.push({
        kind: 'subcategory_total',
        label: subcategoryTotalLabel(category, subcategory),
        subcategory,
        ...totalMeasuresFromRaw(subcategoryRaw),
      });
    }
  } else if (Array.isArray(ruleSection)) {
    for (const product of ruleSection) {
      const raw = rawProductMeasures(
        product,
        salesByDisplay,
        purchasesByDisplay,
        openingByDisplay
      );
      const display = displayProductMeasures(raw);
      layout.push({
        kind: 'product',
        label: product,
        subcategory: null,
        ...display,
      });
      flatProducts.push(product);
      sheetRaw.push(raw);
    }
  }

  if (flatProducts.length) {
    layout.push({
      kind: 'grand_total',
      label: 'GRAND TOTAL',
      subcategory: null,
      ...totalMeasuresFromRaw(sheetRaw),
    });
  }
  return { layout, flatProducts };
}

/**
 * Map pivots using a Rule Book object from the API (never a bundled static copy).
 */
export function mapPivotsWithRuleBook({
  salesPivot = [],
  purchasesPivot = [],
  openingPivot = [],
  ruleBook,
  ruleBookMeta = {},
}) {
  const book = normalizeRuleBookFromApi(ruleBook);
  const matchLookup = buildRuleBookMatchLookup(book);
  const { byDisplay: salesByDisplay, unmappedRows: unmappedSalesRows } = aggregatePivotByRuleBook(
    salesPivot,
    matchLookup
  );
  const { byDisplay: purchasesByDisplay, unmappedRows: unmappedPurchasesRows } =
    aggregatePivotByRuleBook(purchasesPivot, matchLookup);
  const { byDisplay: openingByDisplay, unmappedRows: unmappedOpeningRows } =
    aggregatePivotByRuleBook(openingPivot, matchLookup);

  const unmappedProducts = [];
  const unmappedProductDetails = [];
  const unmappedSeen = new Set();

  for (const [rows, source] of [
    [unmappedSalesRows, 'Sales'],
    [unmappedPurchasesRows, 'Purchases'],
    [unmappedOpeningRows, 'Opening'],
  ]) {
    for (const row of rows || []) {
      const productName = String(row?.product || '').trim();
      if (!productName) continue;
      const key = normProduct(productName);
      if (unmappedSeen.has(key)) continue;
      unmappedSeen.add(key);
      unmappedProducts.push(productName);
      unmappedProductDetails.push({ product: productName, source });
    }
  }

  const productsByCategory = {};
  const layoutByCategory = {};
  for (const category of CLOSING_STOCK_CATEGORIES) {
    const { layout, flatProducts } = buildLayoutFromRuleBook(
      category,
      book[category],
      salesByDisplay,
      purchasesByDisplay,
      openingByDisplay
    );
    layoutByCategory[category] = layout;
    productsByCategory[category] = flatProducts;
  }

  const productsDisplayed = CLOSING_STOCK_CATEGORIES.reduce(
    (total, category) => total + (productsByCategory[category]?.length || 0),
    0
  );

  const mappedOpeningProducts = Object.entries(openingByDisplay).map(([name, measures]) => ({
    product: name,
    openingQty: measures?.sumOfQuantity ?? null,
    openingAmt: measures?.sumOfGross ?? null,
  }));
  const productsWithOpeningData = mappedOpeningProducts.filter(
    (row) => row.openingQty != null || row.openingAmt != null
  ).length;
  const productsWithSalesData = Object.keys(salesByDisplay).length;
  const productsWithPurchaseData = Object.keys(purchasesByDisplay).length;

  return {
    productsByCategory,
    layoutByCategory,
    unmappedProducts,
    unmappedProductDetails,
    mappedOpeningProducts,
    unmappedOpeningProducts: unmappedOpeningRows.map((row) => String(row?.product || '').trim()).filter(Boolean),
    ruleBookFingerprint: ruleBookMeta.ruleBookFingerprint ?? null,
    ruleBookProductCounts: ruleBookMeta.ruleBookProductCounts ?? {},
    ruleBookProductTotal: ruleBookMeta.ruleBookProductTotal ?? productsDisplayed,
    productsDisplayed,
    productsWithOpeningData,
    productsWithSalesData,
    productsWithPurchaseData,
    closingStockCategories: [...CLOSING_STOCK_CATEGORIES],
  };
}

/** @param {object|null|undefined} result */
export function resultRuleBookFingerprint(result) {
  if (!result) return null;
  return result.ruleBookFingerprint ?? result.summary?.ruleBookFingerprint ?? null;
}

/** Merge server remap payload into an existing process result (keeps pivots). */
export function mergeRemapIntoResult(result, remapPayload) {
  if (!result || !remapPayload) return result;
  const mappedOpening =
    remapPayload.mappedOpeningProducts ?? result.mappedOpeningProducts ?? [];
  const openingReport = {
    ...(result.openingStockReport || result.summary?.openingStockReport || {}),
    mappedToClosingStock: mappedOpening,
    mappedToClosingStockCount: Array.isArray(mappedOpening) ? mappedOpening.length : 0,
  };
  return {
    ...result,
    // Replace mapping fields entirely — never keep stale product/layout lists.
    productsByCategory: remapPayload.productsByCategory,
    layoutByCategory: remapPayload.layoutByCategory,
    salesByCategory: remapPayload.salesByCategory ?? result.salesByCategory,
    purchasesByCategory: remapPayload.purchasesByCategory ?? result.purchasesByCategory,
    unmappedProducts: remapPayload.unmappedProducts,
    unmappedProductDetails: remapPayload.unmappedProductDetails,
    mappedOpeningProducts: mappedOpening,
    unmappedOpeningProducts:
      remapPayload.unmappedOpeningProducts ?? result.unmappedOpeningProducts,
    openingStockReport: openingReport,
    ruleBookFingerprint: remapPayload.ruleBookFingerprint,
    ruleBookProductCounts: remapPayload.ruleBookProductCounts,
    ruleBookProductTotal: remapPayload.ruleBookProductTotal,
    productsDisplayed:
      remapPayload.productsDisplayed ?? remapPayload.summary?.productsDisplayed,
    closingStockCategories: remapPayload.closingStockCategories,
    summary: {
      ...(result.summary || {}),
      ...(remapPayload.summary || {}),
      openingStockReport: {
        ...(result.summary?.openingStockReport || {}),
        ...openingReport,
      },
      productsWithOpeningData:
        remapPayload.summary?.productsWithOpeningData ??
        result.summary?.productsWithOpeningData,
      mappedProductCount:
        remapPayload.summary?.productsDisplayed ??
        remapPayload.productsDisplayed ??
        result.summary?.mappedProductCount,
      productsDisplayed:
        remapPayload.summary?.productsDisplayed ??
        remapPayload.productsDisplayed ??
        result.summary?.productsDisplayed,
      ruleBookFingerprint: remapPayload.ruleBookFingerprint,
      ruleBookProductCounts: remapPayload.ruleBookProductCounts,
      ruleBookProductTotal: remapPayload.ruleBookProductTotal,
      unmappedProductCount: Array.isArray(remapPayload.unmappedProducts)
        ? remapPayload.unmappedProducts.length
        : remapPayload.summary?.unmappedProductCount,
    },
  };
}
