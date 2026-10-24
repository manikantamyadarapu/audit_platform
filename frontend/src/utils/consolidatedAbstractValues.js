import {
  ABSTRACT_ACCOUNT_ROWS,
  ABSTRACT_MEASURE_GROUPS,
  COLOR_STONE_PRODUCT_ROWS,
} from '../config/abstractLayout';
import { CONSOLIDATED_MEASURE_KEYS } from '../config/consolidatedAbstractLayout';
import {
  TRADING_ACCOUNT_SOURCE_CATEGORY,
  TRADING_METAL_ACCOUNTS,
  grandTotalFromLayout,
} from '../config/tradingAccountLayout';
import { abstractMeasuresFromTradingSource } from './abstractTradingValues';
import { aggregateMetalTradingTotals, metalGrossProfitAmt } from './metalTradingTotals';

const BRANCH_KEYS = ['basheerbagh', 'kokapet', 'jubileeHills'];
const BRANCH_ALIASES = {
  basheerbagh: 'basheerbagh',
  kokapet: 'kokapet',
  jubileehills: 'jubileeHills',
  'jubilee-hills': 'jubileeHills',
  jubilee_hills: 'jubileeHills',
  jubileeHills: 'jubileeHills',
};

const RECEIPT_QTY_KEYS = ['receiptsInternalQty', 'receiptsJubileeHillsQty', 'receiptsKokapetQty'];
const RECEIPT_AMT_KEYS = ['receiptsInternalAmt', 'receiptsJubileeHillsAmt', 'receiptsKokapetAmt'];
const ISSUE_QTY_KEYS = ['issuesInternalQty', 'issuesBanjaraHillsQty', 'issuesKokapetQty'];
const ISSUE_AMT_KEYS = ['issuesInternalAmt', 'issuesBanjaraHillsAmt', 'issuesKokapetAmt'];

const DIAMOND_ALIASES = {
  'Diamonds - Black diamonds': ['Diamonds - Black diamonds', 'Diamonds - Black Diamonds'],
  'Diamonds - Beads': ['Diamonds - Beads'],
  'Diamonds Rosecut diamonds': ['Diamonds Rosecut diamonds', 'Diamonds - Rosecut Diamonds'],
  'Diamonds - Flat polki': ['Diamonds - Flat polki', 'Diamonds - Flat Polki'],
  'Uncut - diamonds': ['Uncut - diamonds', 'Uncut - Diamonds'],
  Diamonds: ['Diamonds'],
};

const ACCOUNT_SECTION_LABELS = [
  'Gold Account 24K',
  'Gold Account 22K',
  'Gold Account 18K',
  'Gold Account 14K',
  'Platinum Account',
  'Gold Account Jadau',
  'Silver Account',
  'Diamonds Account',
  'Emeralds',
  'Pearls',
  'Rubies',
  'Color Stones Account',
];

const DIAMOND_ITEM_LABELS = [
  'Diamonds - Black diamonds',
  'Diamonds - Beads',
  'Diamonds Rosecut diamonds',
  'Diamonds - Flat polki',
  'Uncut - diamonds',
  'Diamonds',
];

const METAL_BY_TITLE = Object.fromEntries(TRADING_METAL_ACCOUNTS.map((account) => [account.title, account]));

function emptyAbstractMeasures() {
  return Object.fromEntries(ABSTRACT_MEASURE_GROUPS.map((group) => [group, { qty: null, amt: null }]));
}

export function emptyConsolidatedMeasures() {
  return Object.fromEntries(CONSOLIDATED_MEASURE_KEYS.map((key) => [key, { qty: null, amt: null }]));
}

function cyGpPct(gpAmt, salesAmt) {
  if (gpAmt == null || salesAmt == null) return null;
  const sales = Number(salesAmt);
  if (sales === 0) return 0;
  return (Number(gpAmt) / sales) * 100;
}

export function addNum(current, incoming) {
  if (incoming == null || incoming === '') return current;
  const number = Number(incoming);
  if (!Number.isFinite(number)) return current;
  return current == null ? number : current + number;
}

function sumPresent(...parts) {
  if (parts.every((part) => part == null)) return null;
  return parts.reduce((total, part) => total + Number(part || 0), 0);
}

export function eliminate(left, right) {
  if (left == null && right == null) return [null, null];
  const a = Number(left || 0);
  const b = Number(right || 0);
  const overlap = Math.min(a, b);
  return [a - overlap, b - overlap];
}

function sumKeysAcross(rows, keys) {
  let total = null;
  rows.forEach((row) => {
    keys.forEach((key) => {
      total = addNum(total, row?.[key]);
    });
  });
  return total;
}

function normLabel(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/_/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .join(' ');
}

function branchHasSources(payload) {
  if (payload?.layoutByCategory && Object.keys(payload.layoutByCategory).length) return true;
  return Boolean(payload?.salesPivot?.length || payload?.purchasesPivot?.length || payload?.openingPivot?.length);
}

export function normalizeBranches(branches) {
  const out = {};
  Object.entries(branches || {}).forEach(([rawName, payload]) => {
    const key = BRANCH_ALIASES[String(rawName).trim()] || BRANCH_ALIASES[String(rawName).trim().toLowerCase()];
    if (!key || !payload || typeof payload !== 'object' || !branchHasSources(payload)) return;
    out[key] = {
      layoutByCategory: payload.layoutByCategory || {},
      salesPivot: payload.salesPivot || [],
      purchasesPivot: payload.purchasesPivot || [],
      openingPivot: payload.openingPivot || [],
      mrPivots: payload.mrPivots || {},
      dcPivots: payload.dcPivots || {},
    };
  });
  return out;
}

export function accountTotals(snapshot, tradingTitle, isMetal) {
  if (isMetal) {
    const metalTotals = aggregateMetalTradingTotals({
      salesPivot: snapshot.salesPivot,
      purchasesPivot: snapshot.purchasesPivot,
      openingPivot: snapshot.openingPivot,
      mrPivots: snapshot.mrPivots,
      dcPivots: snapshot.dcPivots,
    });
    return metalTotals[tradingTitle] || {};
  }
  const category = TRADING_ACCOUNT_SOURCE_CATEGORY[tradingTitle];
  return grandTotalFromLayout(snapshot.layoutByCategory?.[category]) || {};
}

function subcategoryTotals(layoutByCategory, category, aliases) {
  const wanted = new Set(aliases.map(normLabel));
  const rows = Array.isArray(layoutByCategory?.[category]) ? layoutByCategory[category] : [];
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    if (String(row?.kind || '') !== 'subcategory_total') continue;
    const names = [row.subcategory, row.label];
    if (names.some((name) => name && wanted.has(normLabel(name)))) return row;
  }
  return {};
}

function addAbstractMaps(left, right) {
  const out = emptyAbstractMeasures();
  ABSTRACT_MEASURE_GROUPS.forEach((group) => {
    if (group === 'CY GP %') return;
    out[group] = {
      qty: addNum(left?.[group]?.qty, right?.[group]?.qty),
      amt: addNum(left?.[group]?.amt, right?.[group]?.amt),
    };
  });
  out['CY GP %'] = { qty: null, amt: cyGpPct(out['Gross Profit']?.amt, out.Sales?.amt) };
  return out;
}

function gemGrossProfitAmt({ openingAmt, purchasesAmt, receiptsAmt, salesAmt, closingAmt, issuesAmt }) {
  const parts = [openingAmt, purchasesAmt, receiptsAmt, salesAmt, closingAmt, issuesAmt];
  if (parts.every((part) => part == null)) return null;
  const totalAmt = Number(openingAmt || 0) + Number(purchasesAmt || 0) + Number(receiptsAmt || 0);
  return Number(closingAmt || 0) + Number(salesAmt || 0) + Number(issuesAmt || 0) - totalAmt;
}

function consolidateFromTotals(totalsList, { metal = false, metalAccount = null } = {}) {
  const present = (totalsList || []).map((row) => row || {}).filter((row) => Object.keys(row).length);
  if (!present.length) return emptyConsolidatedMeasures();

  let summedTrading = emptyAbstractMeasures();
  present.forEach((totals) => {
    summedTrading = addAbstractMaps(
      summedTrading,
      abstractMeasuresFromTradingSource(totals, { metal, metalAccount })
    );
  });

  const receiptsQty = sumKeysAcross(present, RECEIPT_QTY_KEYS);
  const receiptsAmt = sumKeysAcross(present, RECEIPT_AMT_KEYS);
  const issuesQty = sumKeysAcross(present, ISSUE_QTY_KEYS);
  const issuesAmt = sumKeysAcross(present, ISSUE_AMT_KEYS);
  const [transferQty, consumptionQty] = eliminate(receiptsQty, issuesQty);
  const [transferAmt, consumptionAmt] = eliminate(receiptsAmt, issuesAmt);

  const opening = summedTrading['Opening Stock'];
  const purchases = summedTrading.Purchases;
  const sales = summedTrading.Sales;
  const closing = summedTrading['Closing Stock'];
  const making = summedTrading['Making Charges'];

  const gpAmt = metal
    ? metalGrossProfitAmt(
        {
          openingAmt: opening?.amt,
          netPurchasesAmt: purchases?.amt,
          makingChargesAmt: making?.amt,
        },
        sumPresent(sales?.amt, closing?.amt, consumptionAmt)
      )
    : gemGrossProfitAmt({
        openingAmt: opening?.amt,
        purchasesAmt: purchases?.amt,
        receiptsAmt: transferAmt,
        salesAmt: sales?.amt,
        closingAmt: closing?.amt,
        issuesAmt: consumptionAmt,
      });

  const out = emptyConsolidatedMeasures();
  out['Opening Stock'] = opening;
  out['Purchases - Total'] = purchases;
  out['Internal Transfer - Total'] = { qty: transferQty, amt: transferAmt };
  out['Internal Consumption - Total'] = { qty: consumptionQty, amt: consumptionAmt };
  out['Making Charges'] = { qty: null, amt: making?.amt ?? null };
  out['Sales - Total'] = sales;
  out['Closing Stock - Total'] = closing;
  out['Gross Profit'] = { qty: null, amt: gpAmt };
  out['CY G P %'] = { qty: null, amt: cyGpPct(gpAmt, sales?.amt) };
  return out;
}

function sumConsolidatedMeasures(rows) {
  const summed = emptyConsolidatedMeasures();
  const skip = new Set(['CY G P %', 'GP AY 2025-26', 'Deviation']);
  CONSOLIDATED_MEASURE_KEYS.forEach((key) => {
    if (skip.has(key)) return;
    let qty = null;
    let amt = null;
    rows.forEach((row) => {
      qty = addNum(qty, row?.[key]?.qty);
      amt = addNum(amt, row?.[key]?.amt);
    });
    summed[key] = { qty, amt };
  });
  summed['CY G P %'] = {
    qty: null,
    amt: cyGpPct(summed['Gross Profit']?.amt, summed['Sales - Total']?.amt),
  };
  return summed;
}

export function buildConsolidatedAbstractRowMeasures(branches) {
  const snapshots = normalizeBranches(branches);
  const contributing = BRANCH_KEYS.filter((name) => snapshots[name]);
  if (contributing.length < BRANCH_KEYS.length) {
    return { byLabel: {}, contributing, unresolved: [] };
  }

  const byLabel = {};
  ABSTRACT_ACCOUNT_ROWS.forEach(({ label, tradingTitle, metal }) => {
    byLabel[label] = consolidateFromTotals(
      contributing.map((name) => accountTotals(snapshots[name], tradingTitle, metal)),
      { metal, metalAccount: METAL_BY_TITLE[tradingTitle] }
    );
  });
  byLabel['Platinum Account'] = emptyConsolidatedMeasures();
  byLabel['Gold Account Jadau'] = emptyConsolidatedMeasures();
  byLabel.TOTAL = sumConsolidatedMeasures(ACCOUNT_SECTION_LABELS.map((label) => byLabel[label]));

  const diamondRows = DIAMOND_ITEM_LABELS.map((label) => {
    const measures = consolidateFromTotals(
      contributing.map((name) =>
        subcategoryTotals(snapshots[name].layoutByCategory, 'Diamond', DIAMOND_ALIASES[label])
      )
    );
    byLabel[label] = measures;
    return measures;
  });
  byLabel['Diamonds total'] = sumConsolidatedMeasures(diamondRows);

  const colorRows = COLOR_STONE_PRODUCT_ROWS.map((product) => {
    const measures = consolidateFromTotals(
      contributing.map((name) =>
        subcategoryTotals(snapshots[name].layoutByCategory, 'Precious and Semi Precious', [product])
      )
    );
    byLabel[product] = measures;
    return measures;
  });
  byLabel['TOTAL Colour Stones'] = sumConsolidatedMeasures(colorRows);

  return { byLabel, contributing, unresolved: [] };
}
