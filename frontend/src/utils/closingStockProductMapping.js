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

function buildLocationIndex(book) {
  const entries = [];
  for (const category of CLOSING_STOCK_CATEGORIES) {
    const section = book[category];
    if (Array.isArray(section)) {
      for (const product of section) {
        entries.push({ product, category, subcategory: null });
      }
    } else if (section && typeof section === 'object') {
      for (const [subcategory, products] of Object.entries(section)) {
        for (const product of products) {
          entries.push({ product, category, subcategory });
        }
      }
    }
  }

  const coreOwners = {};
  for (const entry of entries) {
    const core = coreSkuKey(entry.product);
    if (!core) continue;
    if (!coreOwners[core]) coreOwners[core] = [];
    coreOwners[core].push(entry);
  }

  const index = {};
  for (const entry of entries) {
    const loc = { category: entry.category, subcategory: entry.subcategory };
    for (const key of [normProduct(entry.product), matchKey(entry.product)]) {
      if (key && !index[key]) index[key] = loc;
    }
    const core = coreSkuKey(entry.product);
    if (core && coreOwners[core]?.length === 1 && !index[core]) {
      index[core] = loc;
    }
  }
  return index;
}

function resolveLocation(product, index) {
  for (const key of [normProduct(product), matchKey(product), coreSkuKey(product)]) {
    if (key && index[key]) return index[key];
  }
  return null;
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

/** Write fallback-matched Opening onto layout rows by ruleBookProduct + category/subcategory. */
function applyFallbackOpeningToLayout(byDisplay, rows, book, unmappedRows = []) {
  const displayLocations = {};
  for (const { category, subcategory, product } of iterRuleBookProducts(book)) {
    displayLocations[product] = { category, subcategory };
  }
  const normSub = (name) => (name ? normProduct(name) : null);
  const fallbackQtyNames = new Set();

  for (const row of rows || []) {
    if (row?.status !== 'matched_fallback') continue;
    const target = String(row?.ruleBookProduct || '').trim();
    if (!target || !displayLocations[target]) continue;
    const loc = displayLocations[target];
    if (row?.category && row.category !== loc.category) continue;
    if (
      row?.subcategory != null &&
      normSub(row.subcategory) !== normSub(loc.subcategory)
    ) {
      continue;
    }
    const qty = coerceMeasure(row?.sumOfQuantity);
    const gross = coerceMeasure(row?.sumOfGross);
    if (qty === null && gross === null) continue;
    byDisplay[target] = { sumOfQuantity: qty, sumOfGross: gross };
    fallbackQtyNames.add(String(row?.product || '').trim());
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

function addStockSectionTotals(raw) {
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
  return raw;
}

const ISSUE_QTY_KEYS = [
  'issuesInternalQty',
  'issuesBanjaraHillsQty',
  'issuesKokapetQty',
];

function issuesTotalQty(raw) {
  const existing = coerceMeasure(raw.issuesTotalQty);
  if (existing !== null) return existing;
  const parts = ISSUE_QTY_KEYS.map((key) => coerceMeasure(raw[key]));
  if (parts.every((part) => part === null)) return null;
  return parts.reduce((sum, part) => sum + (part ?? 0), 0);
}

function addClosingStock(raw) {
  const totalQty = coerceMeasure(raw.totalQty);
  const salesQty = coerceMeasure(raw.salesQty);
  const issuesQty = issuesTotalQty(raw);
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

const ISSUE_AMT_KEYS = [
  'issuesInternalAmt',
  'issuesBanjaraHillsAmt',
  'issuesKokapetAmt',
];

function issuesTotalAmt(raw) {
  const existing = coerceMeasure(raw.issuesTotalAmt);
  if (existing !== null) return existing;
  const parts = ISSUE_AMT_KEYS.map((key) => coerceMeasure(raw[key]));
  if (parts.every((part) => part === null)) return null;
  return parts.reduce((sum, part) => sum + (part ?? 0), 0);
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
    totalQty: raw.totalQty ?? null,
    totalAmt: roundClosingStockAmount(raw.totalAmt),
    averageRateAmt: raw.averageRateAmt ?? null,
    issuesInternalAmt: roundClosingStockAmount(raw.issuesInternalAmt),
    issuesBanjaraHillsAmt: roundClosingStockAmount(raw.issuesBanjaraHillsAmt),
    issuesKokapetAmt: roundClosingStockAmount(raw.issuesKokapetAmt),
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
      'totalQty',
      'totalAmt',
      'issuesInternalAmt',
      'issuesBanjaraHillsAmt',
      'issuesKokapetAmt',
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
    for (const product of ruleSection) {
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

/**
 * Map pivots using a Rule Book object from the API (never a bundled static copy).
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
  const book = normalizeRuleBookFromApi(ruleBook);
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
