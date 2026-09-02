/** Shared Closing Stock layout — mirrors python closing_stock_template. */

import { formatIndianNumber } from '../utils/format';

export const CLOSING_STOCK_CATEGORIES = Object.freeze([
  'Diamond',
  'Emerald',
  'Pearls',
  'Rubie',
  'Precious and Semi Precious',
]);

/**
 * @param {string} category
 * @returns {string}
 */
export function closingStockReportTitle(category) {
  return `DETAILS OF JEWELS CLOSING STOCK - ${String(category || '').trim().toUpperCase()}`;
}

/** @deprecated Prefer closingStockReportTitle(category) */
export const CLOSING_STOCK_REPORT_TITLE = closingStockReportTitle('Diamond');

export const CLOSING_STOCK_LEAF_COLUMNS = Object.freeze([
  [['Opening Stock', null, 'Qty'], '1'],
  [['Opening Stock', null, 'Amt.'], '2'],
  [['Purchases', null, 'Qty'], '3'],
  [['Purchases', null, 'Amt.'], '4'],
  [['Receipts', 'Internal Stock Transfer', 'Qty'], '5'],
  [['Receipts', 'Internal Stock Transfer', 'Amt.'], '6'],
  [['Receipts', 'Jubilee Hills', 'Qty'], '7'],
  [['Receipts', 'Jubilee Hills', 'Amt.'], '8'],
  [['Receipts', 'Kokapet', 'Qty'], '9'],
  [['Receipts', 'Kokapet', 'Amt.'], '10'],
  [['Receipts', 'Total', 'Qty'], '11'],
  [['Receipts', 'Total', 'Amt.'], '12'],
  [['Average Rate', null, 'Amt.'], '13'],
  [['Issues', 'Internal Stock Transfer', 'Qty'], '14'],
  [['Issues', 'Internal Stock Transfer', 'Amt.'], '15'],
  [['Issues', 'Banjara Hills', 'Qty'], '16'],
  [['Issues', 'Banjara Hills', 'Amt.'], '17'],
  [['Issues', 'Kokapet', 'Qty'], '18'],
  [['Issues', 'Kokapet', 'Amt.'], '19'],
  [['Issues', 'Total', 'Qty'], '20'],
  [['Issues', 'Total', 'Amt.'], '21'],
  [['Sales', null, 'Qty'], '22'],
  [['Sales', null, 'Amt.'], '23'],
  [['Closing Stock', null, 'Qty'], '24'],
  [['Closing Stock', null, 'Amt.'], '25'],
  [['Gross Profit', null, 'Amt.'], '26'],
  [['GP AY 2025-26', null, 'Qty'], '27'],
  [['GP AY 2025-26', null, 'Amt.'], '28'],
  [['Deviation', null, 'Qty'], '29'],
  [['Deviation', null, 'Amt.'], '30'],
  [['Deviation', null, '%'], '31'],
]);

/** Semantic measure keys → header path [level1, level2, leaf]. */
export const CLOSING_STOCK_MEASURE_PATHS = Object.freeze({
  openingQty: ['Opening Stock', null, 'Qty'],
  openingAmt: ['Opening Stock', null, 'Amt.'],
  purchasesQty: ['Purchases', null, 'Qty'],
  purchasesAmt: ['Purchases', null, 'Amt.'],
  receiptsIstQty: ['Receipts', 'Internal Stock Transfer', 'Qty'],
  receiptsIstAmt: ['Receipts', 'Internal Stock Transfer', 'Amt.'],
  receiptsJubileeQty: ['Receipts', 'Jubilee Hills', 'Qty'],
  receiptsJubileeAmt: ['Receipts', 'Jubilee Hills', 'Amt.'],
  receiptsKokapetQty: ['Receipts', 'Kokapet', 'Qty'],
  receiptsKokapetAmt: ['Receipts', 'Kokapet', 'Amt.'],
  receiptsTotalQty: ['Receipts', 'Total', 'Qty'],
  receiptsTotalAmt: ['Receipts', 'Total', 'Amt.'],
  issuesIstQty: ['Issues', 'Internal Stock Transfer', 'Qty'],
  issuesIstAmt: ['Issues', 'Internal Stock Transfer', 'Amt.'],
  issuesBanjaraQty: ['Issues', 'Banjara Hills', 'Qty'],
  issuesBanjaraAmt: ['Issues', 'Banjara Hills', 'Amt.'],
  issuesKokapetQty: ['Issues', 'Kokapet', 'Qty'],
  issuesKokapetAmt: ['Issues', 'Kokapet', 'Amt.'],
  issuesTotalQty: ['Issues', 'Total', 'Qty'],
  issuesTotalAmt: ['Issues', 'Total', 'Amt.'],
  salesQty: ['Sales', null, 'Qty'],
  salesAmt: ['Sales', null, 'Amt.'],
});

export const RECEIPTS_ISSUES_MEASURE_KEYS = Object.freeze([
  'receiptsIstQty',
  'receiptsIstAmt',
  'receiptsJubileeQty',
  'receiptsJubileeAmt',
  'receiptsKokapetQty',
  'receiptsKokapetAmt',
  'receiptsTotalQty',
  'receiptsTotalAmt',
  'issuesIstQty',
  'issuesIstAmt',
  'issuesBanjaraQty',
  'issuesBanjaraAmt',
  'issuesKokapetQty',
  'issuesKokapetAmt',
  'issuesTotalQty',
  'issuesTotalAmt',
]);

const ALL_MEASURE_KEYS = Object.freeze([
  'openingQty',
  'openingAmt',
  'purchasesQty',
  'purchasesAmt',
  ...RECEIPTS_ISSUES_MEASURE_KEYS,
  'salesQty',
  'salesAmt',
]);

function pickMeasureFields(row) {
  const out = {};
  for (const key of ALL_MEASURE_KEYS) {
    out[key] = row?.[key] ?? null;
  }
  return out;
}

function pathsEqual(a, b) {
  return a[0] === b[0] && (a[1] ?? null) === (b[1] ?? null) && a[2] === b[2];
}

/** @param {keyof typeof CLOSING_STOCK_MEASURE_PATHS} measureKey */
export function leafIndexForMeasure(measureKey) {
  const target = CLOSING_STOCK_MEASURE_PATHS[measureKey];
  const idx = CLOSING_STOCK_LEAF_COLUMNS.findIndex(([path]) => pathsEqual(path, target));
  if (idx < 0) {
    throw new Error(`Closing Stock column not found for measure ${measureKey}`);
  }
  return idx;
}

/** @type {Readonly<Record<number, keyof typeof CLOSING_STOCK_MEASURE_PATHS>>} */
export const MEASURE_FIELD_BY_LEAF = Object.freeze(
  Object.fromEntries(
    Object.keys(CLOSING_STOCK_MEASURE_PATHS).map((measureKey) => [
      leafIndexForMeasure(measureKey),
      measureKey,
    ])
  )
);

/** @deprecated Use leafIndexForMeasure — kept for callers that referenced numeric indices. */
export const CLOSING_STOCK_FILLED_LEAF_INDICES = Object.freeze({
  openingQty: leafIndexForMeasure('openingQty'),
  openingAmt: leafIndexForMeasure('openingAmt'),
  purchasesQty: leafIndexForMeasure('purchasesQty'),
  purchasesAmt: leafIndexForMeasure('purchasesAmt'),
  salesQty: leafIndexForMeasure('salesQty'),
  salesAmt: leafIndexForMeasure('salesAmt'),
});

const MEASURE_FIELD_BY_LEAF_LOCAL = MEASURE_FIELD_BY_LEAF;

/**
 * @param {number|null|undefined} value
 * @returns {string}
 */
export function formatClosingStockMeasure(value) {
  if (value === null || value === undefined || value === '') {
    return '\u00a0';
  }
  const num = Number(value);
  if (!Number.isFinite(num)) return '\u00a0';
  // Indian grouping — Qty may keep decimals; Amounts are whole numbers.
  return formatIndianNumber(num, { minDecimals: 0, maxDecimals: 4, fallback: '\u00a0' });
}

/**
 * @param {Array<{ kind?: string, label?: string }>|null|undefined} layoutRows
 * @param {string[]} products
 * @returns {Array<{ kind: string, label: string, purchasesQty?: number|null, purchasesAmt?: number|null, salesQty?: number|null, salesAmt?: number|null }>}
 */
export function buildClosingStockPreviewRows(layoutRows, products = []) {
  if (Array.isArray(layoutRows) && layoutRows.length) {
    const enriched = [];
    const sheetProducts = [];
    let subcategoryProducts = [];

    for (const row of layoutRows) {
      const kind = row?.kind || 'product';
      if (kind === 'product') {
        const productRow = {
          kind: 'product',
          label: String(row?.label || ''),
          ...pickMeasureFields(row),
        };
        enriched.push(productRow);
        if (productRow.label.trim()) {
          sheetProducts.push(productRow);
          subcategoryProducts.push(productRow);
        }
        continue;
      }
      if (kind === 'subcategory_total') {
        // Prefer server TOTAL = ROUND(SUM(unrounded)); never re-sum rounded product cells.
        enriched.push({
          kind: 'subcategory_total',
          label: String(row?.label || 'TOTAL'),
          ...pickMeasureFields(row),
        });
        subcategoryProducts = [];
        continue;
      }
      if (kind === 'grand_total') {
        enriched.push({
          kind: 'grand_total',
          label: String(row?.label || 'GRAND TOTAL'),
          ...pickMeasureFields(row),
        });
        continue;
      }
      enriched.push({
        kind,
        label: String(row?.label || ''),
      });
      if (kind === 'subcategory') {
        subcategoryProducts = [];
      }
    }
    return enriched;
  }
  const productRows = (products || [])
    .map((p) => String(p || '').trim())
    .filter(Boolean)
    .map((label) => ({ kind: 'product', label }));
  if (!productRows.length) {
    return [{ kind: 'product', label: '' }];
  }
  return [...productRows, { kind: 'grand_total', label: 'GRAND TOTAL' }];
}

/**
 * @param {object|null|undefined} row
 * @param {number} leafIndex
 * @returns {string}
 */
export function closingStockCellValue(row, leafIndex) {
  const field = MEASURE_FIELD_BY_LEAF_LOCAL[leafIndex];
  if (!field || !row) return '\u00a0';
  return formatClosingStockMeasure(row[field]);
}

/**
 * Merge consecutive equal non-empty labels (matches Excel template grouping).
 * @param {string[]} values
 * @returns {{ label: string, colSpan: number }[]}
 */
export function buildGroupedHeaderCells(values) {
  const cells = [];
  let i = 0;
  while (i < values.length) {
    const label = values[i] || '';
    if (!label) {
      cells.push({ label: '', colSpan: 1 });
      i += 1;
      continue;
    }
    let j = i;
    while (j + 1 < values.length && (values[j + 1] || '') === label) {
      j += 1;
    }
    cells.push({ label, colSpan: j - i + 1 });
    i = j + 1;
  }
  return cells;
}

/** @returns {{ level1: string[], level2: string[], leaves: string[], numbers: string[] }} */
export function getClosingStockHeaderRows() {
  const level1 = CLOSING_STOCK_LEAF_COLUMNS.map(([path]) => path[0] || '');
  const level2 = CLOSING_STOCK_LEAF_COLUMNS.map(([path]) => path[1] || '');
  const leaves = CLOSING_STOCK_LEAF_COLUMNS.map(([path]) => path[2]);
  const numbers = CLOSING_STOCK_LEAF_COLUMNS.map(([, num]) => num);
  return { level1, level2, leaves, numbers };
}

/** @deprecated Use buildClosingStockPreviewRows — kept for backwards compatibility */
export function buildClosingStockPreviewRowsLegacy(layoutRows, products = []) {
  return buildClosingStockPreviewRows(layoutRows, products);
}
