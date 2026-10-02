/**
 * Closing Stock mapping helpers — Rule Book always loaded from the Python service API.
 * Do not bundle a static Rule Book JSON in the frontend.
 */

import { CLOSING_STOCK_CATEGORIES, TRANSFER_QTY_FIELDS } from '../config/closingStockLayout';

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

const CATEGORY_PREFIXES = [
  'emeralds ',
  'emerald ',
  'rubies ',
  'ruby ',
  'pearls ',
  'pearl ',
  'diamonds ',
  'diamond ',
  'semi precious ',
  'semiprecious ',
  'precious ',
  'synthetic ',
  'synthetics ',
  'sythetic ',
  'sythetics ',
  'precious stones ',
];

function stripCategoryPrefix(normName) {
  for (const prefix of CATEGORY_PREFIXES) {
    if (normName.startsWith(prefix)) {
      return normName.slice(prefix.length).trim();
    }
  }
  return normName;
}

/** Opening Stock name keys — mirrors Python product_sheet_lookup_keys (no Rule Book). */
function openingProductLookupKeys(product) {
  const name = String(product || '').trim();
  const keys = [];
  const seen = new Set();
  const add = (key) => {
    if (key && !seen.has(key)) {
      seen.add(key);
      keys.push(key);
    }
  };

  const primary = normProduct(name);
  add(primary);
  add(matchKey(name));

  const stripped = stripCategoryPrefix(primary);
  if (stripped !== primary) {
    add(stripped);
    add(matchKey(stripped));
  }

  const truncated = name.slice(0, 31);
  add(normProduct(truncated));
  add(matchKey(truncated));
  return keys;
}

/** Map Opening pivot onto layout labels by product name keys only (no Rule Book). */
function aggregateOpeningByNameMatch(rows, layoutProductNames) {
  const skuOwners = {};
  for (const layoutName of layoutProductNames || []) {
    const display = String(layoutName || '').trim();
    const sku = coreSkuKey(display);
    if (!sku) continue;
    if (!skuOwners[sku]) skuOwners[sku] = [];
    skuOwners[sku].push(display);
  }
  const uniqueSkus = new Set(
    Object.entries(skuOwners)
      .filter(([, owners]) => owners.length === 1)
      .map(([sku]) => sku)
  );

  const keysFor = (name) => {
    const keys = openingProductLookupKeys(name);
    const sku = coreSkuKey(name);
    if (sku && uniqueSkus.has(sku) && !keys.includes(sku)) keys.push(sku);
    return keys;
  };

  const pivotIndex = {};
  const pivotProducts = [];

  for (const row of rows || []) {
    const product = String(row?.product || '').trim();
    if (!product) continue;
    const measures = {
      sumOfQuantity: coerceMeasure(row?.sumOfQuantity),
      sumOfGross: coerceMeasure(row?.sumOfGross),
    };
    const aliasNames = [product];
    const ruleBookProduct = String(row?.ruleBookProduct || '').trim();
    if (ruleBookProduct && !aliasNames.includes(ruleBookProduct)) {
      aliasNames.push(ruleBookProduct);
    }
    const keys = [];
    for (const alias of aliasNames) {
      for (const key of keysFor(alias)) {
        if (!keys.includes(key)) keys.push(key);
      }
    }
    pivotProducts.push({ product, keys });
    for (const key of keys) {
      if (!pivotIndex[key]) pivotIndex[key] = measures;
    }
  }

  const byDisplay = {};
  const claimedKeys = new Set();
  for (const layoutName of layoutProductNames || []) {
    const display = String(layoutName || '').trim();
    if (!display) continue;
    for (const key of keysFor(display)) {
      if (pivotIndex[key]) {
        byDisplay[display] = pivotIndex[key];
        claimedKeys.add(key);
        break;
      }
    }
  }

  const unmappedRows = [];
  for (const { product, keys } of pivotProducts) {
    if (keys.some((key) => claimedKeys.has(key))) continue;
    unmappedRows.push({
      product,
      sumOfQuantity: keys.length ? pivotIndex[keys[0]]?.sumOfQuantity ?? null : null,
      sumOfGross: keys.length ? pivotIndex[keys[0]]?.sumOfGross ?? null : null,
    });
  }

  return { byDisplay, unmappedRows };
}

/** Write a confirmed manual/fallback Opening amount onto the mapped layout product. */
function applyFallbackOpeningToLayout(byDisplay, rows, book, unmappedRows = []) {
  const displayLocations = {};
  for (const { category, subcategory, product } of iterRuleBookProducts(book)) {
    displayLocations[product] = { category, subcategory };
  }
  const layoutLookup = buildRuleBookMatchLookup(book);
  const layoutDisplayFor = (name) => {
    const text = String(name || '').trim();
    if (!text) return null;
    if (displayLocations[text]) return text;
    return resolveRuleBookDisplayName(text, layoutLookup);
  };
  const fallbackQtyNames = new Set();

  for (const row of rows || []) {
    if (row?.status !== 'matched_fallback') continue;
    const ruleName = String(row?.ruleBookProduct || '').trim();
    const qtyName = String(row?.product || '').trim();
    const target = layoutDisplayFor(ruleName) || layoutDisplayFor(qtyName);
    if (!target) continue;
    const qty = coerceMeasure(
      row?.sumOfQuantity != null ? row.sumOfQuantity : row?.openingQty
    );
    const gross = coerceMeasure(row?.sumOfGross != null ? row.sumOfGross : row?.openingAmt);
    if (qty === null && gross === null) continue;
    byDisplay[target] = { sumOfQuantity: qty, sumOfGross: gross };
    if (qtyName) fallbackQtyNames.add(qtyName);
  }

  const filteredUnmapped =
    fallbackQtyNames.size > 0
      ? unmappedRows.filter((row) => !fallbackQtyNames.has(String(row?.product || '').trim()))
      : unmappedRows;
  return { byDisplay, unmappedRows: filteredUnmapped };
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

function emptyTransferQty() {
  return Object.fromEntries(TRANSFER_QTY_FIELDS.map((key) => [key, null]));
}

const LOCATION_NET_FIELDS = [
  ['jubileeHills', 'receiptsJubileeHillsQty', 'issuesBanjaraHillsQty'],
  ['kokapet', 'receiptsKokapetQty', 'issuesKokapetQty'],
  ['internalBasheerbagh', 'receiptsInternalQty', 'issuesInternalQty'],
];

function exactRuleBookLookup(book) {
  const lookup = {};
  for (const { product: displayName } of iterRuleBookProducts(book)) {
    const key = normProduct(displayName);
    if (key && !lookup[key]) lookup[key] = displayName;
  }
  return lookup;
}

function qtyByNorm(rows) {
  const totals = {};
  for (const row of rows || []) {
    const productName = String(row?.product || '').trim();
    if (!productName) continue;
    const key = normProduct(productName);
    if (!key) continue;
    const qty = coerceMeasure(row?.sumOfQuantity) ?? 0;
    totals[key] = (totals[key] ?? 0) + qty;
  }
  return totals;
}

/** Net = MR Qty − DC Qty per branch; exact normalized product match only. */
function mapMrDcQtyToRuleBook(mrPivots, dcPivots, book) {
  const lookup = exactRuleBookLookup(book);
  const byDisplay = {};
  const mrTree = mrPivots && typeof mrPivots === 'object' ? mrPivots : {};
  const dcTree = dcPivots && typeof dcPivots === 'object' ? dcPivots : {};

  for (const [location, receiptsKey, issuesKey] of LOCATION_NET_FIELDS) {
    const mrQty = qtyByNorm(mrTree[location]);
    const dcQty = qtyByNorm(dcTree[location]);
    const keys = new Set([...Object.keys(mrQty), ...Object.keys(dcQty)]);
    for (const key of keys) {
      const net = (mrQty[key] ?? 0) - (dcQty[key] ?? 0);
      if (Math.abs(net) < 1e-12) continue;
      const displayName = lookup[key];
      if (!displayName) continue;
      if (!byDisplay[displayName]) byDisplay[displayName] = {};
      if (net > 0) {
        byDisplay[displayName][receiptsKey] = (byDisplay[displayName][receiptsKey] ?? 0) + net;
      } else {
        byDisplay[displayName][issuesKey] = (byDisplay[displayName][issuesKey] ?? 0) + Math.abs(net);
      }
    }
  }
  return byDisplay;
}

function rawProductMeasures(
  ruleBookProduct,
  salesByDisplay,
  purchasesByDisplay,
  openingByDisplay = {},
  transferQtyByDisplay = {}
) {
  const sales = salesByDisplay[ruleBookProduct] || {};
  const purchases = purchasesByDisplay[ruleBookProduct] || {};
  const opening = openingByDisplay[ruleBookProduct] || {};
  const transfer = transferQtyByDisplay[ruleBookProduct] || {};
  const raw = {
    openingQty: opening.sumOfQuantity ?? null,
    openingAmt: opening.sumOfGross ?? null,
    purchasesQty: purchases.sumOfQuantity ?? null,
    purchasesAmt: purchases.sumOfGross ?? null,
    salesQty: sales.sumOfQuantity ?? null,
    salesAmt: sales.sumOfGross ?? null,
    receiptsQty: null,
    receiptsAmt: null,
    ...emptyTransferQty(),
    ...Object.fromEntries(
      TRANSFER_QTY_FIELDS.map((key) => [key, transfer[key] ?? null])
    ),
  };
  return addStockSectionTotals(raw);
}

const RECEIPT_QTY_KEYS = [
  'receiptsInternalQty',
  'receiptsJubileeHillsQty',
  'receiptsKokapetQty',
];

const ISSUE_QTY_KEYS = [
  'issuesInternalQty',
  'issuesBanjaraHillsQty',
  'issuesKokapetQty',
];

const ISSUE_AMT_KEYS = [
  'issuesInternalAmt',
  'issuesBanjaraHillsAmt',
  'issuesKokapetAmt',
];

function sumQtyParts(raw, keys) {
  const parts = keys.map((key) => coerceMeasure(raw[key]));
  if (parts.every((part) => part === null)) return null;
  return parts.reduce((sum, part) => sum + (part ?? 0), 0);
}

function addStockSectionTotals(raw) {
  const receiptsFromBranches = sumQtyParts(raw, RECEIPT_QTY_KEYS);
  if (receiptsFromBranches !== null) {
    raw.receiptsQty = receiptsFromBranches;
  }
  const openingQty = coerceMeasure(raw.openingQty);
  const purchasesQty = coerceMeasure(raw.purchasesQty);
  const receiptsQty = coerceMeasure(raw.receiptsQty);
  const openingAmt = coerceMeasure(raw.openingAmt);
  const purchasesAmt = coerceMeasure(raw.purchasesAmt);
  const receiptsAmt = coerceMeasure(raw.receiptsAmt);

  if (openingQty === null && purchasesQty === null && receiptsQty === null) {
    raw.totalQty = null;
  } else {
    raw.totalQty = (openingQty ?? 0) + (purchasesQty ?? 0) + (receiptsQty ?? 0);
  }
  if (openingAmt === null && purchasesAmt === null && receiptsAmt === null) {
    raw.totalAmt = null;
  } else {
    raw.totalAmt = (openingAmt ?? 0) + (purchasesAmt ?? 0) + (receiptsAmt ?? 0);
  }
  return addGrossProfitPct(addGrossProfit(addClosingStock(addIssuesAmounts(addAverageRate(raw)))));
}

function addAverageRate(raw) {
  const totalQty = coerceMeasure(raw.totalQty);
  const totalAmt = coerceMeasure(raw.totalAmt);
  if (totalQty === null && totalAmt === null) {
    raw.averageRateAmt = null;
    return raw;
  }
  if (totalQty === null || totalQty === 0) {
    raw.averageRateAmt = 0;
    return raw;
  }
  raw.averageRateAmt = (totalAmt ?? 0) / totalQty;
  return raw;
}

const ISSUE_AMT_BY_QTY = [
  ['issuesInternalQty', 'issuesInternalAmt'],
  ['issuesBanjaraHillsQty', 'issuesBanjaraHillsAmt'],
  ['issuesKokapetQty', 'issuesKokapetAmt'],
];

function addIssuesAmounts(raw) {
  const rate = coerceMeasure(raw.averageRateAmt);
  for (const [qtyKey, amtKey] of ISSUE_AMT_BY_QTY) {
    const qty = coerceMeasure(raw[qtyKey]);
    if (qty === null) {
      raw[amtKey] = null;
      continue;
    }
    if (qty === 0) {
      raw[amtKey] = 0;
      continue;
    }
    raw[amtKey] = qty * (rate ?? 0);
  }
  raw.issuesTotalAmt = sumQtyParts(raw, ISSUE_AMT_KEYS);
  return raw;
}

function issuesTotalQty(raw) {
  return sumQtyParts(raw, ISSUE_QTY_KEYS);
}

function addClosingStock(raw) {
  const totalQty = coerceMeasure(raw.totalQty);
  const salesQty = coerceMeasure(raw.salesQty);
  const issuesQty = issuesTotalQty(raw);
  raw.issuesTotalQty = issuesQty;
  if (totalQty === null && salesQty === null && issuesQty === null) {
    raw.closingStockQty = null;
    raw.closingStockAmt = null;
    return raw;
  }
  const qty = (totalQty ?? 0) - (salesQty ?? 0) - (issuesQty ?? 0);
  raw.closingStockQty = qty;
  const rate = coerceMeasure(raw.averageRateAmt);
  raw.closingStockAmt = qty * (rate ?? 0);
  return raw;
}

function issuesTotalAmt(raw) {
  return sumQtyParts(raw, ISSUE_AMT_KEYS);
}

function addGrossProfit(raw) {
  const closingAmt = coerceMeasure(raw.closingStockAmt);
  const salesAmt = coerceMeasure(raw.salesAmt);
  const issuesAmt = issuesTotalAmt(raw);
  const totalAmt = coerceMeasure(raw.totalAmt);
  if (
    closingAmt === null &&
    salesAmt === null &&
    issuesAmt === null &&
    totalAmt === null
  ) {
    raw.grossProfitAmt = null;
    return raw;
  }
  raw.grossProfitAmt = (closingAmt ?? 0) + (salesAmt ?? 0) + (issuesAmt ?? 0) - (totalAmt ?? 0);
  return raw;
}

function addGrossProfitPct(raw) {
  const gpAmt = coerceMeasure(raw.grossProfitAmt);
  if (gpAmt === null) {
    raw.grossProfitPct = null;
    return raw;
  }
  const salesAmt = coerceMeasure(raw.salesAmt);
  if (gpAmt > 0 && salesAmt !== null && salesAmt !== 0) {
    raw.grossProfitPct = gpAmt / salesAmt;
    return raw;
  }
  raw.grossProfitPct = 0;
  return raw;
}

function displayProductMeasures(raw) {
  const display = {
    openingQty: raw.openingQty ?? null,
    openingAmt: roundClosingStockAmount(raw.openingAmt),
    purchasesQty: raw.purchasesQty ?? null,
    purchasesAmt: roundClosingStockAmount(raw.purchasesAmt),
    salesQty: raw.salesQty ?? null,
    salesAmt: roundClosingStockAmount(raw.salesAmt),
    receiptsQty: raw.receiptsQty ?? null,
    receiptsAmt: roundClosingStockAmount(raw.receiptsAmt),
    receiptsInternalAmt: roundClosingStockAmount(raw.receiptsInternalAmt),
    receiptsJubileeHillsAmt: roundClosingStockAmount(raw.receiptsJubileeHillsAmt),
    receiptsKokapetAmt: roundClosingStockAmount(raw.receiptsKokapetAmt),
    totalQty: raw.totalQty ?? null,
    totalAmt: roundClosingStockAmount(raw.totalAmt),
    averageRateAmt: raw.averageRateAmt ?? null,
    issuesInternalAmt: roundClosingStockAmount(raw.issuesInternalAmt),
    issuesBanjaraHillsAmt: roundClosingStockAmount(raw.issuesBanjaraHillsAmt),
    issuesKokapetAmt: roundClosingStockAmount(raw.issuesKokapetAmt),
    issuesTotalQty: raw.issuesTotalQty ?? null,
    issuesTotalAmt: roundClosingStockAmount(raw.issuesTotalAmt),
    closingStockQty: raw.closingStockQty ?? null,
    closingStockAmt: roundClosingStockAmount(raw.closingStockAmt),
    grossProfitAmt: roundClosingStockAmount(raw.grossProfitAmt),
    grossProfitPct: raw.grossProfitPct ?? null,
  };
  for (const key of TRANSFER_QTY_FIELDS) {
    display[key] = raw[key] ?? null;
  }
  return display;
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
      'receiptsQty',
      'receiptsAmt',
      'receiptsInternalAmt',
      'receiptsJubileeHillsAmt',
      'receiptsKokapetAmt',
      'totalQty',
      'totalAmt',
      'issuesInternalAmt',
      'issuesBanjaraHillsAmt',
      'issuesKokapetAmt',
      'issuesTotalQty',
      'issuesTotalAmt',
      'closingStockQty',
      'closingStockAmt',
      'grossProfitAmt',
      ...TRANSFER_QTY_FIELDS,
    ]) {
      const value = coerceMeasure(raw?.[key]);
      if (value === null) continue;
      totals[key] = (totals[key] ?? 0) + value;
      present.add(key);
    }
  }
  const rounded = {
    openingQty: present.has('openingQty') ? totals.openingQty : null,
    openingAmt: present.has('openingAmt') ? roundClosingStockAmount(totals.openingAmt) : null,
    purchasesQty: present.has('purchasesQty') ? totals.purchasesQty : null,
    purchasesAmt: present.has('purchasesAmt') ? roundClosingStockAmount(totals.purchasesAmt) : null,
    salesQty: present.has('salesQty') ? totals.salesQty : null,
    salesAmt: present.has('salesAmt') ? roundClosingStockAmount(totals.salesAmt) : null,
    receiptsQty: present.has('receiptsQty') ? totals.receiptsQty : null,
    receiptsAmt: present.has('receiptsAmt') ? roundClosingStockAmount(totals.receiptsAmt) : null,
    receiptsInternalAmt: present.has('receiptsInternalAmt')
      ? roundClosingStockAmount(totals.receiptsInternalAmt)
      : null,
    receiptsJubileeHillsAmt: present.has('receiptsJubileeHillsAmt')
      ? roundClosingStockAmount(totals.receiptsJubileeHillsAmt)
      : null,
    receiptsKokapetAmt: present.has('receiptsKokapetAmt')
      ? roundClosingStockAmount(totals.receiptsKokapetAmt)
      : null,
    totalQty: present.has('totalQty') ? totals.totalQty : null,
    totalAmt: present.has('totalAmt') ? roundClosingStockAmount(totals.totalAmt) : null,
    issuesInternalAmt: present.has('issuesInternalAmt')
      ? roundClosingStockAmount(totals.issuesInternalAmt)
      : null,
    issuesBanjaraHillsAmt: present.has('issuesBanjaraHillsAmt')
      ? roundClosingStockAmount(totals.issuesBanjaraHillsAmt)
      : null,
    issuesKokapetAmt: present.has('issuesKokapetAmt')
      ? roundClosingStockAmount(totals.issuesKokapetAmt)
      : null,
    issuesTotalQty: present.has('issuesTotalQty') ? totals.issuesTotalQty : null,
    issuesTotalAmt: present.has('issuesTotalAmt')
      ? roundClosingStockAmount(totals.issuesTotalAmt)
      : null,
    closingStockQty: present.has('closingStockQty') ? totals.closingStockQty : null,
    closingStockAmt: present.has('closingStockAmt')
      ? roundClosingStockAmount(totals.closingStockAmt)
      : null,
    grossProfitAmt: present.has('grossProfitAmt')
      ? roundClosingStockAmount(totals.grossProfitAmt)
      : null,
  };
  for (const key of TRANSFER_QTY_FIELDS) {
    rounded[key] = present.has(key) ? totals[key] : null;
  }
  return addGrossProfitPct(addAverageRate(rounded));
}

function buildLayoutFromRuleBook(
  category,
  ruleSection,
  salesByDisplay,
  purchasesByDisplay,
  openingByDisplay = {},
  transferQtyByDisplay = {}
) {
  const layout = [];
  const flatProducts = [];
  const sheetRaw = [];

  if (ruleSection && typeof ruleSection === 'object' && !Array.isArray(ruleSection)) {
    for (const [subcategory, ruleProducts] of Object.entries(ruleSection).sort((a, b) =>
      compareProductNames(a[0], b[0])
    )) {
      const products = (Array.isArray(ruleProducts) ? ruleProducts : [])
        .slice()
        .sort(compareProductNames);
      if (!products.length) continue;
      if (String(subcategory || '').trim()) {
        layout.push({ kind: 'subcategory', label: subcategory, subcategory });
      }
      const subcategoryRaw = [];
      for (const product of products) {
        const raw = rawProductMeasures(
          product,
          salesByDisplay,
          purchasesByDisplay,
          openingByDisplay,
          transferQtyByDisplay
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
    for (const product of ruleSection.slice().sort(compareProductNames)) {
      const raw = rawProductMeasures(
        product,
        salesByDisplay,
        purchasesByDisplay,
        openingByDisplay,
        transferQtyByDisplay
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

function ruleBookFromActivityLayout(layoutByCategory) {
  const book = {};
  for (const category of CLOSING_STOCK_CATEGORIES) {
    const layout = Array.isArray(layoutByCategory?.[category]) ? layoutByCategory[category] : [];
    const groups = new Map();
    const plain = [];
    for (const row of layout) {
      if (row?.kind !== 'product') continue;
      const label = String(row.label || '').trim();
      if (!label) continue;
      const subcategory = String(row.subcategory || '').trim();
      if (!subcategory) {
        plain.push(label);
        continue;
      }
      if (!groups.has(subcategory)) groups.set(subcategory, []);
      groups.get(subcategory).push(label);
    }
    if (groups.size && plain.length) {
      book[category] = Object.fromEntries(groups);
      book[category][''] = plain;
    } else if (groups.size) {
      book[category] = Object.fromEntries(groups);
    } else {
      book[category] = plain;
    }
  }
  return book;
}

function compareProductNames(left, right) {
  const chunks = (name) =>
    String(name || '')
      .toLowerCase()
      .split(/(\d+)/)
      .filter(Boolean)
      .map((part) => (/^\d+$/.test(part) ? { type: 'num', value: Number(part) } : { type: 'text', value: part }));
  const a = chunks(left);
  const b = chunks(right);
  const count = Math.max(a.length, b.length);
  for (let i = 0; i < count; i += 1) {
    if (!a[i]) return -1;
    if (!b[i]) return 1;
    if (a[i].type !== b[i].type) return a[i].type === 'num' ? -1 : 1;
    if (a[i].value !== b[i].value) {
      if (a[i].type === 'num') return a[i].value - b[i].value;
      return a[i].value < b[i].value ? -1 : 1;
    }
  }
  return 0;
}

function activityNameKeys(name) {
  const text = String(name || '').trim();
  if (!text) return [];
  return [normProduct(text), matchKey(text), coreSkuKey(text)].filter(Boolean);
}

/**
 * Keep only product rows that belong to this branch's Sales, Purchases, or Opening Stock.
 * Subcategory and grand-total rows stay when at least one of those products remains.
 */
export function filterSheetsToBranchActivity(
  productsByCategory,
  layoutByCategory,
  { salesPivot = [], purchasesPivot = [], openingPivot = [] } = {}
) {
  const allowed = new Set();
  const salesPurchaseKeys = new Set();
  const add = (name, target = allowed) => {
    for (const key of activityNameKeys(name)) target.add(key);
  };
  for (const row of salesPivot || []) {
    add(row?.product);
    add(row?.product, salesPurchaseKeys);
  }
  for (const row of purchasesPivot || []) {
    add(row?.product);
    add(row?.product, salesPurchaseKeys);
  }
  for (const row of openingPivot || []) {
    const names = [row?.product, row?.ruleBookProduct];
    const onSalesOrPurchases = names.some((name) =>
      activityNameKeys(name).some((key) => salesPurchaseKeys.has(key))
    );
    const openingQty = coerceMeasure(row?.sumOfQuantity ?? row?.openingQty);
    if (!onSalesOrPurchases && (openingQty === null || openingQty === 0)) continue;
    add(row?.product);
    add(row?.ruleBookProduct);
  }

  const allows = (label) => activityNameKeys(label).some((key) => allowed.has(key));
  const nextProducts = {};
  const nextLayout = {};

  for (const category of CLOSING_STOCK_CATEGORIES) {
    const products = Array.isArray(productsByCategory?.[category]) ? productsByCategory[category] : [];
    nextProducts[category] = products.filter((name) => allows(name));

    const layout = Array.isArray(layoutByCategory?.[category]) ? layoutByCategory[category] : [];
    const kept = [];
    let header = null;
    let groupProducts = [];
    let groupTotal = null;
    const flush = () => {
      if (groupProducts.length) {
        if (header) kept.push(header);
        kept.push(...groupProducts);
        if (groupTotal) kept.push(groupTotal);
      }
      header = null;
      groupProducts = [];
      groupTotal = null;
    };
    let grand = null;
    for (const row of layout) {
      const kind = row?.kind || 'product';
      if (kind === 'subcategory') {
        flush();
        header = row;
      } else if (kind === 'subcategory_total') {
        groupTotal = row;
        flush();
      } else if (kind === 'grand_total') {
        grand = row;
      } else if (kind === 'product' && allows(row?.label)) {
        groupProducts.push(row);
      }
    }
    flush();
    if (grand && kept.some((row) => row.kind === 'product')) kept.push(grand);
    nextLayout[category] = kept;
  }

  return { productsByCategory: nextProducts, layoutByCategory: nextLayout };
}

/**
 * Map pivots using a Rule Book object from the API (never a bundled static copy).
 * Sheet rows are only products present in Sales, Purchases, or Opening Stock.
 */
export function mapPivotsWithRuleBook({
  salesPivot = [],
  purchasesPivot = [],
  openingPivot = [],
  mrPivots = {},
  dcPivots = {},
  ruleBook,
  ruleBookMeta = {},
}) {
  const activity = buildSalesPurchasesOnlyLayout(
    { salesPivot, purchasesPivot, openingPivot },
    ruleBook
  );
  const book = ruleBookFromActivityLayout(activity.layoutByCategory);
  const matchLookup = buildRuleBookMatchLookup(book);
  const { byDisplay: salesByDisplay, unmappedRows: unmappedSalesRows } = aggregatePivotByRuleBook(
    salesPivot,
    matchLookup
  );
  const { byDisplay: purchasesByDisplay, unmappedRows: unmappedPurchasesRows } =
    aggregatePivotByRuleBook(purchasesPivot, matchLookup);
  const layoutProductNames = iterRuleBookProducts(book).map((row) => row.product);
  let { byDisplay: openingByDisplay, unmappedRows: unmappedOpeningRows } =
    aggregateOpeningByNameMatch(openingPivot, layoutProductNames);
  ({ byDisplay: openingByDisplay, unmappedRows: unmappedOpeningRows } =
    applyFallbackOpeningToLayout(openingByDisplay, openingPivot, book, unmappedOpeningRows));

  const transferQtyByDisplay = mapMrDcQtyToRuleBook(mrPivots, dcPivots, book);

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
      openingByDisplay,
      transferQtyByDisplay
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

const FILE_SHEET_NORM_ALIASES = {
  diamond: 'Diamond',
  diamonds: 'Diamond',
  dia: 'Diamond',
  emerald: 'Emerald',
  emeralds: 'Emerald',
  eme: 'Emerald',
  pearls: 'Pearls',
  pearl: 'Pearls',
  prls: 'Pearls',
  rubie: 'Rubie',
  rubies: 'Rubie',
  ruby: 'Rubie',
  rubi: 'Rubie',
  'precious and semi precious': 'Precious and Semi Precious',
  precious: 'Precious and Semi Precious',
  prec: 'Precious and Semi Precious',
};

function resolveFileCategorySheet(label) {
  const text = String(label || '').trim();
  if (!text) return null;
  if (CLOSING_STOCK_CATEGORIES.includes(text)) return text;
  const aliased = SHEET_KEY_ALIASES[text];
  if (aliased && CLOSING_STOCK_CATEGORIES.includes(aliased)) return aliased;
  return FILE_SHEET_NORM_ALIASES[normProduct(text)] || null;
}

function emptySalesPurchasesMeasures() {
  return { qty: null, amt: null };
}

function addSalesPurchasesMeasure(bucket, qty, amt) {
  if (qty !== null) bucket.qty = (bucket.qty ?? 0) + qty;
  if (amt !== null) bucket.amt = (bucket.amt ?? 0) + amt;
}

function sheetMeasureFields(sales, purchases, opening = emptySalesPurchasesMeasures()) {
  const fields = {
    openingQty: opening.qty,
    openingAmt: roundClosingStockAmount(opening.amt),
    purchasesQty: purchases.qty,
    purchasesAmt: roundClosingStockAmount(purchases.amt),
    salesQty: sales.qty,
    salesAmt: roundClosingStockAmount(sales.amt),
    receiptsQty: null,
    receiptsAmt: null,
    receiptsInternalAmt: null,
    receiptsJubileeHillsAmt: null,
    receiptsKokapetAmt: null,
    totalQty: null,
    totalAmt: null,
    averageRateAmt: null,
    issuesInternalAmt: null,
    issuesBanjaraHillsAmt: null,
    issuesKokapetAmt: null,
    issuesTotalQty: null,
    issuesTotalAmt: null,
    closingStockQty: null,
    closingStockAmt: null,
    grossProfitAmt: null,
    grossProfitPct: null,
  };
  for (const key of TRANSFER_QTY_FIELDS) {
    fields[key] = null;
  }
  return fields;
}

function salesPurchasesLookup(entries) {
  const lookup = new Map();
  const coreOwners = new Map();
  for (const entry of entries) {
    for (const key of [normProduct(entry.display), matchKey(entry.display)]) {
      if (key && !lookup.has(key)) lookup.set(key, entry.display);
    }
    const core = coreSkuKey(entry.display);
    if (!core) continue;
    if (!coreOwners.has(core)) coreOwners.set(core, new Set());
    coreOwners.get(core).add(entry.display);
  }
  for (const [core, owners] of coreOwners) {
    if (owners.size === 1 && !lookup.has(core)) lookup.set(core, [...owners][0]);
  }
  return lookup;
}

function resolveSalesPurchasesProduct(product, entries) {
  const lookup = salesPurchasesLookup(entries);
  for (const key of [normProduct(product), matchKey(product), coreSkuKey(product)]) {
    if (key && lookup.has(key)) {
      const display = lookup.get(key);
      return entries.find((entry) => entry.display === display) || null;
    }
  }
  return null;
}

function productFamilyKey(name) {
  const tokens = normProduct(name)
    .replace(/\./g, ' ')
    .split(/\s+/)
    .map((token) => token.replace(/[^a-z0-9]+/g, ''))
    .filter(Boolean);
  while (tokens.length && /^\d+$/.test(tokens[tokens.length - 1])) tokens.pop();
  return tokens.join('');
}

function uniqueBookLocation(hits) {
  const keys = new Set(hits.map((hit) => `${hit.category}\0${hit.subcategory || ''}`));
  if (keys.size !== 1 || !hits.length) return null;
  return { category: hits[0].category, subcategory: hits[0].subcategory || null };
}

function locationFromProductFamily(product, bookEntries) {
  const family = productFamilyKey(product);
  if (family.length < 3) return null;
  return uniqueBookLocation(bookEntries.filter((entry) => productFamilyKey(entry.product) === family));
}

function locationFromNamePrefix(product, bookEntries) {
  const norm = normProduct(product);
  if (!norm) return null;
  let bestLength = 0;
  let hits = [];
  for (const entry of bookEntries) {
    const label = normProduct(entry.product);
    if (!label || !(norm === label || norm.startsWith(`${label} `))) continue;
    if (label.length > bestLength) {
      bestLength = label.length;
      hits = [entry];
    } else if (label.length === bestLength) {
      hits.push(entry);
    }
  }
  return uniqueBookLocation(hits);
}

function ruleBookProductEntries(ruleBook) {
  if (!ruleBook) return [];
  const book = normalizeRuleBookFromApi(ruleBook);
  const entries = [];
  for (const category of CLOSING_STOCK_CATEGORIES) {
    const section = book[category];
    if (Array.isArray(section)) {
      for (const product of section) entries.push({ product, category, subcategory: null });
    } else if (section && typeof section === 'object') {
      for (const [subcategory, products] of Object.entries(section)) {
        for (const product of products || []) {
          entries.push({ product, category, subcategory });
        }
      }
    }
  }
  return entries;
}

function locateSalesPurchasesSheet(row, bookIndex, bookEntries) {
  const fileSheet = resolveFileCategorySheet(row?.category);
  if (fileSheet) {
    return {
      category: fileSheet,
      subcategory: String(row?.subcategory || '').trim() || null,
    };
  }
  if (!bookIndex) return null;
  const product = String(row?.product || '').trim();
  return (
    resolveLocation(product, bookIndex)
    || locationFromProductFamily(product, bookEntries)
    || locationFromNamePrefix(product, bookEntries)
  );
}

function pivotSideTotals(rows) {
  const bucket = emptySalesPurchasesMeasures();
  for (const row of rows || []) {
    addSalesPurchasesMeasure(bucket, coerceMeasure(row?.sumOfQuantity), coerceMeasure(row?.sumOfGross));
  }
  return bucket;
}

/**
 * Kokapet Financials rows from Sales and Purchases pivots only.
 * File category wins when it names a sheet. Otherwise the product is placed on the
 * sheet already used by that same product or product line.
 * Sales and Purchase columns are the only measures filled.
 * @param {{ salesPivot?: object[], purchasesPivot?: object[] }|null|undefined} result
 * @param {object|null|undefined} [ruleBook]
 */
export function buildSalesPurchasesOnlyLayout(result, ruleBook) {
  const salesPivot = Array.isArray(result?.salesPivot) ? result.salesPivot : [];
  const purchasesPivot = Array.isArray(result?.purchasesPivot) ? result.purchasesPivot : [];
  const bookEntries = ruleBookProductEntries(ruleBook);
  const bookIndex = bookEntries.length ? buildLocationIndex(normalizeRuleBookFromApi(ruleBook)) : null;
  const entries = [];
  const unmappedProducts = [];
  const unmappedSeen = new Set();

  function rememberUnmapped(product) {
    const name = String(product || '').trim();
    const key = normProduct(name);
    if (!name || !key || unmappedSeen.has(key)) return;
    unmappedSeen.add(key);
    unmappedProducts.push(name);
  }

  function placeRow(row, side) {
    const product = String(row?.product || '').trim();
    if (!product) return;
    const qty = coerceMeasure(row?.sumOfQuantity);
    const amt = coerceMeasure(row?.sumOfGross);
    const existing = resolveSalesPurchasesProduct(product, entries);
    if (existing) {
      addSalesPurchasesMeasure(existing[side], qty, amt);
      return;
    }
    const located = locateSalesPurchasesSheet(row, bookIndex, bookEntries);
    if (!located?.category) {
      rememberUnmapped(product);
      return;
    }
    const { category } = located;
    const subcategory = located.subcategory || null;
    const entry = {
      display: product,
      category,
      subcategory,
      sales: emptySalesPurchasesMeasures(),
      purchases: emptySalesPurchasesMeasures(),
      opening: emptySalesPurchasesMeasures(),
    };
    addSalesPurchasesMeasure(entry[side], qty, amt);
    entries.push(entry);
  }

  for (const row of salesPivot) placeRow(row, 'sales');
  for (const row of purchasesPivot) placeRow(row, 'purchases');

  const openingPivot = Array.isArray(result?.openingPivot) ? result.openingPivot : [];
  for (const row of openingPivot) {
    const qty = coerceMeasure(row?.sumOfQuantity ?? row?.openingQty);
    const amt = coerceMeasure(row?.sumOfGross ?? row?.openingAmt);
    if (qty === null && amt === null) continue;
    const sourceName = String(row?.product || '').trim();
    const mappedName =
      row?.status === 'matched_fallback' ? String(row?.ruleBookProduct || '').trim() : '';
    const targetName = mappedName || sourceName;
    if (!targetName) continue;
    const existing =
      resolveSalesPurchasesProduct(targetName, entries) ||
      (sourceName && sourceName !== targetName
        ? resolveSalesPurchasesProduct(sourceName, entries)
        : null);
    if (!existing && (qty === null || qty === 0)) continue;
    if (existing) {
      addSalesPurchasesMeasure(existing.opening, qty, amt);
      continue;
    }
    const located = locateSalesPurchasesSheet(
      {
        product: targetName,
        category: row?.category || row?.sheetName,
        subcategory: row?.subcategory,
      },
      bookIndex,
      bookEntries
    );
    if (!located?.category) {
      rememberUnmapped(targetName);
      continue;
    }
    const entry = {
      display: targetName,
      category: located.category,
      subcategory: located.subcategory || null,
      sales: emptySalesPurchasesMeasures(),
      purchases: emptySalesPurchasesMeasures(),
      opening: emptySalesPurchasesMeasures(),
    };
    addSalesPurchasesMeasure(entry.opening, qty, amt);
    entries.push(entry);
  }

  const productsByCategory = {};
  const layoutByCategory = {};
  for (const category of CLOSING_STOCK_CATEGORIES) {
    const sourceEntries = entries.filter((entry) => entry.category === category);
    const layout = [];
    const groups = [];
    const plain = [];
    for (const entry of sourceEntries) {
      if (!entry.subcategory) {
        plain.push(entry);
        continue;
      }
      let group = groups.find((item) => item.subcategory === entry.subcategory);
      if (!group) {
        group = { subcategory: entry.subcategory, entries: [] };
        groups.push(group);
      }
      group.entries.push(entry);
    }
    groups.sort((a, b) => compareProductNames(a.subcategory, b.subcategory));
    for (const group of groups) {
      group.entries.sort((a, b) => compareProductNames(a.display, b.display));
    }
    plain.sort((a, b) => compareProductNames(a.display, b.display));
    const categoryEntries = [...groups.flatMap((group) => group.entries), ...plain];
    productsByCategory[category] = categoryEntries.map((entry) => entry.display);
    const pushProducts = (productEntries, subcategory) => {
      for (const entry of productEntries) {
        layout.push({
          kind: 'product',
          label: entry.display,
          subcategory,
          ...sheetMeasureFields(entry.sales, entry.purchases, entry.opening),
        });
      }
    };
    const summed = (productEntries) => {
      const sales = emptySalesPurchasesMeasures();
      const purchases = emptySalesPurchasesMeasures();
      const opening = emptySalesPurchasesMeasures();
      for (const entry of productEntries) {
        addSalesPurchasesMeasure(sales, entry.sales.qty, entry.sales.amt);
        addSalesPurchasesMeasure(purchases, entry.purchases.qty, entry.purchases.amt);
        addSalesPurchasesMeasure(opening, entry.opening?.qty, entry.opening?.amt);
      }
      return sheetMeasureFields(sales, purchases, opening);
    };
    for (const group of groups) {
      layout.push({ kind: 'subcategory', label: group.subcategory, subcategory: group.subcategory });
      pushProducts(group.entries, group.subcategory);
      layout.push({
        kind: 'subcategory_total',
        label: subcategoryTotalLabel(category, group.subcategory),
        subcategory: group.subcategory,
        ...summed(group.entries),
      });
    }
    pushProducts(plain, null);
    if (categoryEntries.length) {
      layout.push({
        kind: 'grand_total',
        label: 'GRAND TOTAL',
        subcategory: null,
        ...summed(categoryEntries),
      });
    }
    layoutByCategory[category] = layout;
  }

  const salesTotals = pivotSideTotals(salesPivot);
  const purchasesTotals = pivotSideTotals(purchasesPivot);
  const openingReport = result?.openingStockReport || {};
  const withSales = entries.filter((entry) => entry.sales.qty !== null || entry.sales.amt !== null).length;
  const withPurchases = entries.filter(
    (entry) => entry.purchases.qty !== null || entry.purchases.amt !== null
  ).length;

  return {
    productsByCategory,
    layoutByCategory,
    unmappedProducts,
    summary: {
      salesProductCount: salesPivot.length,
      purchasesProductCount: purchasesPivot.length,
      salesTotalQuantity: salesTotals.qty ?? 0,
      salesTotalGross: salesTotals.amt ?? 0,
      purchasesTotalQuantity: purchasesTotals.qty ?? 0,
      purchasesTotalGross: purchasesTotals.amt ?? 0,
      productsDisplayed: entries.length,
      mappedProductCount: entries.length,
      productsWithSalesData: withSales,
      productsWithPurchaseData: withPurchases,
      productsWithOpeningData: entries.filter(
        (entry) => entry.opening?.qty !== null || entry.opening?.amt !== null
      ).length,
      openingProductCount: openingPivot.length,
      openingTotalQuantity: openingReport.totalOpeningQty ?? 0,
      openingTotalAmount: openingReport.totalOpeningAmount ?? 0,
      unmappedProductCount: unmappedProducts.length,
    },
    openingStockReport: openingReport,
  };
}
