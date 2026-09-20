/**
 * Gold/Silver Trading Account totals from Financials pivots.
 * Uses the same product matching as Financials (normalized / alnum / unique core SKU).
 */

import { RULE_BOOK_PRODUCTS } from '../constants/metalRateRuleBook';

const UNICODE_WS = /[\u00a0\u1680\u2000-\u200b\u202f\u205f\u3000\ufeff]+/g;
const QTY_EPS = 1e-12;

export const GOLD_24K = 'GOLD ACCOUNT - 24K';
export const GOLD_22K = 'GOLD ORNAMENTS ACCOUNT - 22K';
export const GOLD_18K = 'GOLD ORNAMENTS ACCOUNT - 18K';
export const GOLD_14K = 'GOLD ORNAMENTS ACCOUNT - 14K';
export const SILVER = 'SILVER ACCOUNT';

export const METAL_TRADING_ACCOUNT_TITLES = Object.freeze([
  GOLD_24K,
  GOLD_22K,
  GOLD_18K,
  GOLD_14K,
  SILVER,
]);

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

function accountFromMetalName(name) {
  const key = matchKey(name);
  if (!key || key.includes('jadau')) return null;
  if (key.includes('silver')) return SILVER;
  if (key.includes('24k')) return GOLD_24K;
  if (key.includes('22k')) return GOLD_22K;
  if (key.includes('18k')) return GOLD_18K;
  if (key.includes('14k')) return GOLD_14K;
  return null;
}

function catalogNames() {
  return RULE_BOOK_PRODUCTS.filter((name) => accountFromMetalName(name));
}

function buildMetalMatchLookup(catalog) {
  const coreOwners = {};
  catalog.forEach((displayName) => {
    const core = coreSkuKey(displayName);
    if (core) {
      coreOwners[core] = coreOwners[core] || [];
      coreOwners[core].push(displayName);
    }
  });
  const lookup = {};
  catalog.forEach((displayName) => {
    [normProduct(displayName), matchKey(displayName)].forEach((key) => {
      if (key && lookup[key] == null) lookup[key] = displayName;
    });
    const core = coreSkuKey(displayName);
    if (core && (coreOwners[core] || []).length === 1 && lookup[core] == null) {
      lookup[core] = displayName;
    }
  });
  return lookup;
}

const METAL_LOOKUP = buildMetalMatchLookup(catalogNames());

function resolveDisplayName(product) {
  const keys = [normProduct(product), matchKey(product), coreSkuKey(product)];
  for (const key of keys) {
    if (key && METAL_LOOKUP[key]) return METAL_LOOKUP[key];
  }
  return null;
}

export function resolveMetalTradingAccount(product) {
  const name = String(product || '').trim();
  if (!name) return null;
  const display = resolveDisplayName(name);
  if (display) return accountFromMetalName(display);
  return accountFromMetalName(name);
}

function coerceMeasure(value) {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function rowQtyAmt(row) {
  const qty = coerceMeasure(row?.sumOfQuantity) ?? coerceMeasure(row?.openingQty);
  const amt = coerceMeasure(row?.sumOfGross) ?? coerceMeasure(row?.openingAmt);
  return { qty, amt };
}

function addMeasure(current, incoming) {
  if (incoming == null) return current;
  if (current == null) return incoming;
  return current + incoming;
}

export function fromHeadOfficeQty(entry) {
  const qty =
    (entry?.receiptsJubileeHillsQty || 0) - (entry?.issuesBanjaraHillsQty || 0);
  if (!Number.isFinite(qty) || qty <= QTY_EPS) return null;
  return qty;
}

export function toHeadOfficeQty(entry) {
  const qty =
    (entry?.issuesBanjaraHillsQty || 0) - (entry?.receiptsJubileeHillsQty || 0);
  if (!Number.isFinite(qty) || qty <= QTY_EPS) return null;
  return qty;
}

export function metalClosingQty(entry) {
  const parts = [
    entry?.openingQty,
    entry?.netPurchasesQty,
    fromHeadOfficeQty(entry),
    entry?.makingChargesQty,
    entry?.grossProfitQty,
    entry?.netSalesQty,
    toHeadOfficeQty(entry),
  ];
  if (parts.every((part) => part == null)) return null;
  return (
    (entry.openingQty || 0) +
    (entry.netPurchasesQty || 0) +
    (fromHeadOfficeQty(entry) || 0) +
    (entry.makingChargesQty || 0) +
    (entry.grossProfitQty || 0) -
    ((entry.netSalesQty || 0) + (toHeadOfficeQty(entry) || 0))
  );
}

function netMeasure(base, less) {
  if (base == null && less == null) return null;
  return (base || 0) - (less || 0);
}

function emptyBucket() {
  return {
    openingQty: null,
    openingAmt: null,
    purchasesQty: null,
    purchasesAmt: null,
    salesQty: null,
    salesAmt: null,
    purchaseReturnsQty: null,
    purchaseReturnsAmt: null,
    salesReturnsQty: null,
    salesReturnsAmt: null,
    netPurchasesQty: null,
    netPurchasesAmt: null,
    netSalesQty: null,
    netSalesAmt: null,
    receiptsInternalQty: null,
    receiptsJubileeHillsQty: null,
    receiptsJubileeHillsAmt: null,
    receiptsKokapetQty: null,
    issuesInternalQty: null,
    issuesBanjaraHillsQty: null,
    issuesBanjaraHillsAmt: null,
    issuesKokapetQty: null,
    makingChargesQty: null,
    makingChargesAmt: null,
    grossProfitQty: null,
    averageRateAmt: null,
    closingStockQty: null,
    closingStockAmt: null,
  };
}

function accumulate(buckets, rows, qtyKey, amtKey) {
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const product = String(row?.product || '').trim();
    if (!product) return;
    const account = resolveMetalTradingAccount(product);
    if (!account) return;
    const { qty, amt } = rowQtyAmt(row);
    if (qty == null && amt == null) return;
    const entry = buckets[account];
    entry[qtyKey] = addMeasure(entry[qtyKey], qty);
    entry[amtKey] = addMeasure(entry[amtKey], amt);
  });
}

const LOCATION_NET_FIELDS = [
  ['jubileeHills', 'receiptsJubileeHillsQty', 'issuesBanjaraHillsQty'],
  ['kokapet', 'receiptsKokapetQty', 'issuesKokapetQty'],
  ['internalBasheerbagh', 'receiptsInternalQty', 'issuesInternalQty'],
];

function qtyByMetalAccount(rows) {
  const totals = {};
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const product = String(row?.product || '').trim();
    if (!product) return;
    const account = resolveMetalTradingAccount(product);
    if (!account) return;
    const qty = coerceMeasure(row?.sumOfQuantity);
    if (qty == null) return;
    totals[account] = (totals[account] || 0) + qty;
  });
  return totals;
}

function applyMrDcNets(buckets, mrPivots, dcPivots) {
  const mrTree = mrPivots && typeof mrPivots === 'object' ? mrPivots : {};
  const dcTree = dcPivots && typeof dcPivots === 'object' ? dcPivots : {};
  LOCATION_NET_FIELDS.forEach(([location, receiptsKey, issuesKey]) => {
    const mrQty = qtyByMetalAccount(mrTree[location]);
    const dcQty = qtyByMetalAccount(dcTree[location]);
    const accounts = new Set([...Object.keys(mrQty), ...Object.keys(dcQty)]);
    accounts.forEach((account) => {
      const net = (mrQty[account] || 0) - (dcQty[account] || 0);
      if (!Number.isFinite(net) || Math.abs(net) <= QTY_EPS) return;
      const entry = buckets[account];
      if (!entry) return;
      if (net > 0) entry[receiptsKey] = addMeasure(entry[receiptsKey], net);
      else entry[issuesKey] = addMeasure(entry[issuesKey], Math.abs(net));
    });
  });
}

function sumPresent(...parts) {
  if (parts.every((part) => part == null)) return null;
  return parts.reduce((sum, part) => sum + (part || 0), 0);
}

function metalAverageRate(entry) {
  const fromHo = fromHeadOfficeQty(entry);
  const qty = sumPresent(
    entry.openingQty,
    entry.netPurchasesQty,
    fromHo,
    entry.makingChargesQty
  );
  const amt = sumPresent(
    entry.openingAmt,
    entry.netPurchasesAmt,
    entry.makingChargesAmt
  );
  if (qty == null && amt == null) return null;
  if (qty == null || qty === 0) return 0;
  return amt / qty;
}

function qtyTimesRate(qty, rate) {
  if (qty == null) return null;
  if (qty === 0) return 0;
  return qty * (rate || 0);
}

export function toHeadOfficeAmt(entry) {
  const rate =
    entry?.averageRateAmt != null ? entry.averageRateAmt : metalAverageRate(entry);
  return qtyTimesRate(toHeadOfficeQty(entry), rate);
}

export function metalClosingAmt(entry) {
  const rate =
    entry?.averageRateAmt != null ? entry.averageRateAmt : metalAverageRate(entry);
  return qtyTimesRate(metalClosingQty(entry), rate);
}

export function metalGrossProfitAmt(entry, rightAmt) {
  const credit = rightAmt != null ? rightAmt : sumPresent(entry?.netSalesAmt, metalClosingAmt(entry));
  const debit = sumPresent(
    entry?.openingAmt,
    entry?.netPurchasesAmt,
    entry?.makingChargesAmt
  );
  if (credit == null && debit == null) return null;
  return (credit || 0) - (debit || 0);
}

function applyHeadOfficeIssueAmounts(entry) {
  entry.averageRateAmt = metalAverageRate(entry);
  entry.receiptsJubileeHillsAmt = null;
  entry.issuesBanjaraHillsAmt = toHeadOfficeAmt(entry);
}

/**
 * @param {{
 *   salesPivot?: object[],
 *   purchasesPivot?: object[],
 *   openingPivot?: object[],
 *   mrPivots?: object,
 *   dcPivots?: object,
 * }} pivots
 */
export function aggregateMetalTradingTotals({
  salesPivot = [],
  purchasesPivot = [],
  openingPivot = [],
  mrPivots = {},
  dcPivots = {},
} = {}) {
  const buckets = Object.fromEntries(METAL_TRADING_ACCOUNT_TITLES.map((title) => [title, emptyBucket()]));
  accumulate(buckets, openingPivot, 'openingQty', 'openingAmt');
  accumulate(buckets, purchasesPivot, 'purchasesQty', 'purchasesAmt');
  accumulate(buckets, salesPivot, 'salesQty', 'salesAmt');
  applyMrDcNets(buckets, mrPivots, dcPivots);
  Object.values(buckets).forEach((entry) => {
    entry.netPurchasesQty = netMeasure(entry.purchasesQty, entry.purchaseReturnsQty);
    entry.netPurchasesAmt = netMeasure(entry.purchasesAmt, entry.purchaseReturnsAmt);
    entry.netSalesQty = netMeasure(entry.salesQty, entry.salesReturnsQty);
    entry.netSalesAmt = netMeasure(entry.salesAmt, entry.salesReturnsAmt);
    applyHeadOfficeIssueAmounts(entry);
    entry.closingStockQty = metalClosingQty(entry);
    entry.closingStockAmt = metalClosingAmt(entry);
  });
  return buckets;
}
