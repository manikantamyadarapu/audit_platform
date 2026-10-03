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
  [['Receipts', 'Receipts', 'Qty'], '11'],
  [['Receipts', 'Receipts', 'Amt.'], '12'],
  [['Total', null, 'Qty'], '13'],
  [['Total', null, 'Amt.'], '14'],
  [['Average Rate', null, 'Amt.'], '15'],
  [['Issues', 'Internal Stock Transfer', 'Qty'], '16'],
  [['Issues', 'Internal Stock Transfer', 'Amt.'], '17'],
  [['Issues', 'Banjara Hills', 'Qty'], '18'],
  [['Issues', 'Banjara Hills', 'Amt.'], '19'],
  [['Issues', 'Kokapet', 'Qty'], '20'],
  [['Issues', 'Kokapet', 'Amt.'], '21'],
  [['Issues', 'Total', 'Qty'], '22'],
  [['Issues', 'Total', 'Amt.'], '23'],
  [['Sales', null, 'Qty'], '24'],
  [['Sales', null, 'Amt.'], '25'],
  [['Closing Stock', null, 'Qty'], '26'],
  [['Closing Stock', null, 'Amt.'], '27'],
  [['Gross Profit', null, 'Amt.'], '28'],
  [['Gross Profit', null, '%'], '29'],
  [['GP AY 2025-26', null, 'Qty'], '30'],
  [['GP AY 2025-26', null, 'Amt.'], '31'],
  [['Deviation', null, 'Qty'], '32'],
  [['Deviation', null, 'Amt.'], '33'],
  [['Deviation', null, '%'], '34'],
]);

/** Semantic measure keys → header path [level1, level2, leaf]. */
export const CLOSING_STOCK_MEASURE_PATHS = Object.freeze({
  openingQty: ['Opening Stock', null, 'Qty'],
  openingAmt: ['Opening Stock', null, 'Amt.'],
  purchasesQty: ['Purchases', null, 'Qty'],
  purchasesAmt: ['Purchases', null, 'Amt.'],
  receiptsInternalQty: ['Receipts', 'Internal Stock Transfer', 'Qty'],
  receiptsInternalAmt: ['Receipts', 'Internal Stock Transfer', 'Amt.'],
  receiptsJubileeHillsQty: ['Receipts', 'Jubilee Hills', 'Qty'],
  receiptsJubileeHillsAmt: ['Receipts', 'Jubilee Hills', 'Amt.'],
  receiptsKokapetQty: ['Receipts', 'Kokapet', 'Qty'],
  receiptsKokapetAmt: ['Receipts', 'Kokapet', 'Amt.'],
  receiptsQty: ['Receipts', 'Receipts', 'Qty'],
  receiptsAmt: ['Receipts', 'Receipts', 'Amt.'],
  totalQty: ['Total', null, 'Qty'],
  totalAmt: ['Total', null, 'Amt.'],
  averageRateAmt: ['Average Rate', null, 'Amt.'],
  issuesInternalQty: ['Issues', 'Internal Stock Transfer', 'Qty'],
  issuesInternalAmt: ['Issues', 'Internal Stock Transfer', 'Amt.'],
  issuesBanjaraHillsQty: ['Issues', 'Banjara Hills', 'Qty'],
  issuesBanjaraHillsAmt: ['Issues', 'Banjara Hills', 'Amt.'],
  issuesKokapetQty: ['Issues', 'Kokapet', 'Qty'],
  issuesKokapetAmt: ['Issues', 'Kokapet', 'Amt.'],
  issuesTotalQty: ['Issues', 'Total', 'Qty'],
  issuesTotalAmt: ['Issues', 'Total', 'Amt.'],
  salesQty: ['Sales', null, 'Qty'],
  salesAmt: ['Sales', null, 'Amt.'],
  closingStockQty: ['Closing Stock', null, 'Qty'],
  closingStockAmt: ['Closing Stock', null, 'Amt.'],
  grossProfitAmt: ['Gross Profit', null, 'Amt.'],
  grossProfitPct: ['Gross Profit', null, '%'],
});

/**
 * Explains a stored working-paper cell. Does not recalculate it.
 * Excel letters are derived from the leaf index when the trace is built.
 *
 * kind:
 * - source: value comes from an uploaded file or MR/DC net
 * - calculated: product-row formula (operands are other fields on the same row)
 * - blank: column is intentionally not calculated
 */
export const CLOSING_STOCK_FORMULA_CATALOG = Object.freeze({
  openingQty: { kind: 'source', name: 'Opening Qty', source: 'Opening Quantity file' },
  openingAmt: { kind: 'source', name: 'Opening Amt', source: 'Previous Year Closing' },
  purchasesQty: { kind: 'source', name: 'Purchases Qty', source: 'Purchases pivot' },
  purchasesAmt: { kind: 'source', name: 'Purchases Amt', source: 'Purchases pivot' },
  receiptsInternalQty: {
    kind: 'source',
    name: 'Receipts Internal Qty',
    source: 'MR/DC netting — Internal / Basheerbagh (receipt when net > 0)',
  },
  receiptsInternalAmt: { kind: 'blank', name: 'Receipts Internal Amt.' },
  receiptsJubileeHillsQty: {
    kind: 'source',
    name: 'Receipts Jubilee Hills Qty',
    source: 'MR/DC netting — Jubilee Hills (receipt when net > 0)',
  },
  receiptsJubileeHillsAmt: { kind: 'blank', name: 'Receipts Jubilee Hills Amt.' },
  receiptsKokapetQty: {
    kind: 'source',
    name: 'Receipts Kokapet Qty',
    source: 'MR/DC netting — Kokapet (receipt when net > 0)',
  },
  receiptsKokapetAmt: { kind: 'blank', name: 'Receipts Kokapet Amt.' },
  receiptsQty: {
    kind: 'calculated',
    name: 'Receipts Qty',
    description: 'Internal Qty + Jubilee Hills Qty + Kokapet Qty',
    operands: [
      { field: 'receiptsInternalQty' },
      { field: 'receiptsJubileeHillsQty', op: '+' },
      { field: 'receiptsKokapetQty', op: '+' },
    ],
  },
  receiptsAmt: { kind: 'blank', name: 'Receipts Amt.' },
  totalQty: {
    kind: 'calculated',
    name: 'Total Qty',
    description: 'Opening Qty + Purchases Qty + Receipts Qty',
    operands: [
      { field: 'openingQty' },
      { field: 'purchasesQty', op: '+' },
      { field: 'receiptsQty', op: '+' },
    ],
  },
  totalAmt: {
    kind: 'calculated',
    name: 'Total Amt',
    description: 'Opening Amt + Purchases Amt + Receipts Amt',
    operands: [
      { field: 'openingAmt' },
      { field: 'purchasesAmt', op: '+' },
      { field: 'receiptsAmt', op: '+' },
    ],
  },
  averageRateAmt: {
    kind: 'calculated',
    name: 'Average Rate',
    description: 'Total Amt / Total Qty',
    operands: [
      { field: 'totalAmt' },
      { field: 'totalQty', op: '/' },
    ],
  },
  issuesInternalQty: {
    kind: 'source',
    name: 'Issues Internal Qty',
    source: 'MR/DC netting — Internal / Basheerbagh (issue when net < 0)',
  },
  issuesInternalAmt: {
    kind: 'calculated',
    name: 'Issues Internal Amt',
    description: 'Issues Internal Qty × Average Rate',
    operands: [
      { field: 'issuesInternalQty' },
      { field: 'averageRateAmt', op: '×' },
    ],
  },
  issuesBanjaraHillsQty: {
    kind: 'source',
    name: 'Issues Banjara Hills Qty',
    source: 'MR/DC netting — Jubilee Hills (issue when net < 0)',
  },
  issuesBanjaraHillsAmt: {
    kind: 'calculated',
    name: 'Issues Banjara Hills Amt',
    description: 'Issues Banjara Hills Qty × Average Rate',
    operands: [
      { field: 'issuesBanjaraHillsQty' },
      { field: 'averageRateAmt', op: '×' },
    ],
  },
  issuesKokapetQty: {
    kind: 'source',
    name: 'Issues Kokapet Qty',
    source: 'MR/DC netting — Kokapet (issue when net < 0)',
  },
  issuesKokapetAmt: {
    kind: 'calculated',
    name: 'Issues Kokapet Amt',
    description: 'Issues Kokapet Qty × Average Rate',
    operands: [
      { field: 'issuesKokapetQty' },
      { field: 'averageRateAmt', op: '×' },
    ],
  },
  issuesTotalQty: {
    kind: 'calculated',
    name: 'Issues Total Qty',
    description: 'Issues Internal Qty + Issues Banjara Hills Qty + Issues Kokapet Qty',
    operands: [
      { field: 'issuesInternalQty' },
      { field: 'issuesBanjaraHillsQty', op: '+' },
      { field: 'issuesKokapetQty', op: '+' },
    ],
  },
  issuesTotalAmt: {
    kind: 'calculated',
    name: 'Issues Total Amt',
    description: 'Issues Internal Amt + Issues Banjara Hills Amt + Issues Kokapet Amt',
    operands: [
      { field: 'issuesInternalAmt' },
      { field: 'issuesBanjaraHillsAmt', op: '+' },
      { field: 'issuesKokapetAmt', op: '+' },
    ],
  },
  salesQty: { kind: 'source', name: 'Sales Qty', source: 'Sales pivot' },
  salesAmt: { kind: 'source', name: 'Sales Amt', source: 'Sales pivot' },
  closingStockQty: {
    kind: 'calculated',
    name: 'Closing Qty',
    description: 'Total Qty − Sales Qty − Issues Total Qty',
    operands: [
      { field: 'totalQty' },
      { field: 'salesQty', op: '−' },
      { field: 'issuesTotalQty', op: '−' },
    ],
  },
  closingStockAmt: {
    kind: 'calculated',
    name: 'Closing Amt',
    description: 'Closing Qty × Average Rate',
    operands: [
      { field: 'closingStockQty' },
      { field: 'averageRateAmt', op: '×' },
    ],
  },
  grossProfitAmt: {
    kind: 'calculated',
    name: 'Gross Profit Amt',
    description: 'Closing Amt + Sales Amt + Issues Total Amt − Total Amt',
    operands: [
      { field: 'closingStockAmt' },
      { field: 'salesAmt', op: '+' },
      { field: 'issuesTotalAmt', op: '+' },
      { field: 'totalAmt', op: '−' },
    ],
  },
  grossProfitPct: {
    kind: 'calculated',
    name: 'Gross Profit %',
    description: 'GP Amt / Sales Amt',
    condition: 'GP Amt > 0 and Sales Amt ≠ 0; otherwise the stored result is 0',
    operands: [
      { field: 'grossProfitAmt' },
      { field: 'salesAmt', op: '/' },
    ],
  },
});

const NOT_CALCULATED = 'Not calculated / no source value';

/** Human operator → Excel operator. Letters are never stored here. */
const EXCEL_OPERATOR = Object.freeze({
  '+': '+',
  '−': '-',
  '×': '*',
  '/': '/',
});

/** Fields whose TOTAL / GRAND TOTAL row is a ratio of that same row, not a SUM. */
const TOTAL_RATIO_FIELDS = new Set(['averageRateAmt', 'grossProfitPct']);

export const TRANSFER_QTY_FIELDS = Object.freeze([
  'receiptsInternalQty',
  'receiptsJubileeHillsQty',
  'receiptsKokapetQty',
  'issuesInternalQty',
  'issuesBanjaraHillsQty',
  'issuesKokapetQty',
]);

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
 * @param {number|null|undefined} value ratio (0.8 → 80%)
 * @returns {string}
 */
export function formatClosingStockPercent(value) {
  if (value === null || value === undefined || value === '') {
    return '\u00a0';
  }
  const num = Number(value);
  if (!Number.isFinite(num)) return '\u00a0';
  const pct = formatIndianNumber(num * 100, { minDecimals: 0, maxDecimals: 2, fallback: '\u00a0' });
  if (pct === '\u00a0') return '\u00a0';
  return `${pct}%`;
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
          openingQty: row?.openingQty ?? null,
          openingAmt: row?.openingAmt ?? null,
          purchasesQty: row?.purchasesQty ?? null,
          purchasesAmt: row?.purchasesAmt ?? null,
          receiptsQty: row?.receiptsQty ?? null,
          receiptsAmt: row?.receiptsAmt ?? null,
          totalQty: row?.totalQty ?? null,
          totalAmt: row?.totalAmt ?? null,
          averageRateAmt: row?.averageRateAmt ?? null,
          receiptsInternalQty: row?.receiptsInternalQty ?? null,
          receiptsInternalAmt: row?.receiptsInternalAmt ?? null,
          receiptsJubileeHillsQty: row?.receiptsJubileeHillsQty ?? null,
          receiptsJubileeHillsAmt: row?.receiptsJubileeHillsAmt ?? null,
          receiptsKokapetQty: row?.receiptsKokapetQty ?? null,
          receiptsKokapetAmt: row?.receiptsKokapetAmt ?? null,
          issuesInternalQty: row?.issuesInternalQty ?? null,
          issuesInternalAmt: row?.issuesInternalAmt ?? null,
          issuesBanjaraHillsQty: row?.issuesBanjaraHillsQty ?? null,
          issuesBanjaraHillsAmt: row?.issuesBanjaraHillsAmt ?? null,
          issuesKokapetQty: row?.issuesKokapetQty ?? null,
          issuesKokapetAmt: row?.issuesKokapetAmt ?? null,
          issuesTotalQty: row?.issuesTotalQty ?? null,
          issuesTotalAmt: row?.issuesTotalAmt ?? null,
          salesQty: row?.salesQty ?? null,
          salesAmt: row?.salesAmt ?? null,
          closingStockQty: row?.closingStockQty ?? null,
          closingStockAmt: row?.closingStockAmt ?? null,
          grossProfitAmt: row?.grossProfitAmt ?? null,
          grossProfitPct: row?.grossProfitPct ?? null,
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
          openingQty: row?.openingQty ?? null,
          openingAmt: row?.openingAmt ?? null,
          purchasesQty: row?.purchasesQty ?? null,
          purchasesAmt: row?.purchasesAmt ?? null,
          receiptsQty: row?.receiptsQty ?? null,
          receiptsAmt: row?.receiptsAmt ?? null,
          totalQty: row?.totalQty ?? null,
          totalAmt: row?.totalAmt ?? null,
          averageRateAmt: row?.averageRateAmt ?? null,
          receiptsInternalQty: row?.receiptsInternalQty ?? null,
          receiptsInternalAmt: row?.receiptsInternalAmt ?? null,
          receiptsJubileeHillsQty: row?.receiptsJubileeHillsQty ?? null,
          receiptsJubileeHillsAmt: row?.receiptsJubileeHillsAmt ?? null,
          receiptsKokapetQty: row?.receiptsKokapetQty ?? null,
          receiptsKokapetAmt: row?.receiptsKokapetAmt ?? null,
          issuesInternalQty: row?.issuesInternalQty ?? null,
          issuesInternalAmt: row?.issuesInternalAmt ?? null,
          issuesBanjaraHillsQty: row?.issuesBanjaraHillsQty ?? null,
          issuesBanjaraHillsAmt: row?.issuesBanjaraHillsAmt ?? null,
          issuesKokapetQty: row?.issuesKokapetQty ?? null,
          issuesKokapetAmt: row?.issuesKokapetAmt ?? null,
          issuesTotalQty: row?.issuesTotalQty ?? null,
          issuesTotalAmt: row?.issuesTotalAmt ?? null,
          salesQty: row?.salesQty ?? null,
          salesAmt: row?.salesAmt ?? null,
          closingStockQty: row?.closingStockQty ?? null,
          closingStockAmt: row?.closingStockAmt ?? null,
          grossProfitAmt: row?.grossProfitAmt ?? null,
          grossProfitPct: row?.grossProfitPct ?? null,
        });
        subcategoryProducts = [];
        continue;
      }
      if (kind === 'grand_total') {
        enriched.push({
          kind: 'grand_total',
          label: String(row?.label || 'GRAND TOTAL'),
          openingQty: row?.openingQty ?? null,
          openingAmt: row?.openingAmt ?? null,
          purchasesQty: row?.purchasesQty ?? null,
          purchasesAmt: row?.purchasesAmt ?? null,
          receiptsQty: row?.receiptsQty ?? null,
          receiptsAmt: row?.receiptsAmt ?? null,
          totalQty: row?.totalQty ?? null,
          totalAmt: row?.totalAmt ?? null,
          averageRateAmt: row?.averageRateAmt ?? null,
          receiptsInternalQty: row?.receiptsInternalQty ?? null,
          receiptsInternalAmt: row?.receiptsInternalAmt ?? null,
          receiptsJubileeHillsQty: row?.receiptsJubileeHillsQty ?? null,
          receiptsJubileeHillsAmt: row?.receiptsJubileeHillsAmt ?? null,
          receiptsKokapetQty: row?.receiptsKokapetQty ?? null,
          receiptsKokapetAmt: row?.receiptsKokapetAmt ?? null,
          issuesInternalQty: row?.issuesInternalQty ?? null,
          issuesInternalAmt: row?.issuesInternalAmt ?? null,
          issuesBanjaraHillsQty: row?.issuesBanjaraHillsQty ?? null,
          issuesBanjaraHillsAmt: row?.issuesBanjaraHillsAmt ?? null,
          issuesKokapetQty: row?.issuesKokapetQty ?? null,
          issuesKokapetAmt: row?.issuesKokapetAmt ?? null,
          issuesTotalQty: row?.issuesTotalQty ?? null,
          issuesTotalAmt: row?.issuesTotalAmt ?? null,
          salesQty: row?.salesQty ?? null,
          salesAmt: row?.salesAmt ?? null,
          closingStockQty: row?.closingStockQty ?? null,
          closingStockAmt: row?.closingStockAmt ?? null,
          grossProfitAmt: row?.grossProfitAmt ?? null,
          grossProfitPct: row?.grossProfitPct ?? null,
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
  const leaf = CLOSING_STOCK_LEAF_COLUMNS[leafIndex]?.[0]?.[2];
  if (leaf === '%') {
    return formatClosingStockPercent(row[field]);
  }
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

/**
 * Excel column for a measure leaf. Column A is Particulars, so the first leaf is B.
 * Excel column number = leafIndex + 2.
 * @param {number} leafIndex
 * @returns {string}
 */
export function excelColumnLetterFromLeafIndex(leafIndex) {
  let n = Number(leafIndex) + 2;
  if (!Number.isInteger(n) || n < 1) return '';
  let letters = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    letters = String.fromCharCode(65 + rem) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
}

/**
 * Excel row for a preview body row. Title and header rows occupy 1–9.
 * Excel row = 10 + previewRowIndex.
 * @param {number} previewRowIndex
 * @returns {number}
 */
export function excelRowFromPreviewIndex(previewRowIndex) {
  return 10 + Number(previewRowIndex);
}

/**
 * @param {number} leafIndex
 * @param {number} previewRowIndex
 * @returns {string}
 */
export function excelCellRef(leafIndex, previewRowIndex) {
  return `${excelColumnLetterFromLeafIndex(leafIndex)}${excelRowFromPreviewIndex(previewRowIndex)}`;
}

/**
 * @param {number|null|undefined} value
 * @returns {string}
 */
export function rawClosingStockValue(value) {
  if (value === null || value === undefined || value === '') return '—';
  const num = Number(value);
  if (!Number.isFinite(num)) return '—';
  return String(value);
}

/**
 * @param {number} leafIndex
 * @returns {string}
 */
export function closingStockHeaderPath(leafIndex) {
  const path = CLOSING_STOCK_LEAF_COLUMNS[leafIndex]?.[0];
  if (!path) return '';
  return path.filter(Boolean).join(' · ');
}

/**
 * @param {number} leafIndex
 * @returns {string}
 */
export function closingStockBusinessColumn(leafIndex) {
  return CLOSING_STOCK_LEAF_COLUMNS[leafIndex]?.[1] || '';
}

/**
 * Labeled product rows only — matches the Excel SUM set (blank labels are skipped).
 * @param {Array<{ kind?: string, label?: string }>} rows
 * @param {number} from
 * @param {number} to
 * @returns {number[]}
 */
function labeledProductIndexes(rows, from, to) {
  const indexes = [];
  const start = Math.max(0, from);
  const end = Math.min(rows.length - 1, to);
  for (let i = start; i <= end; i += 1) {
    const row = rows[i];
    if (row?.kind === 'product' && String(row.label || '').trim()) indexes.push(i);
  }
  return indexes;
}

/**
 * Product rows that a TOTAL or GRAND TOTAL sums, from the preview structure.
 * @param {Array<{ kind?: string, label?: string }>} rows
 * @param {number} rowIndex
 * @param {string} kind
 * @returns {number[]}
 */
export function productRowsForTotal(rows, rowIndex, kind) {
  if (kind === 'grand_total') {
    return labeledProductIndexes(rows, 0, rowIndex - 1);
  }
  let start = 0;
  for (let i = rowIndex - 1; i >= 0; i -= 1) {
    const previous = rows[i]?.kind;
    if (previous === 'subcategory' || previous === 'subcategory_total' || previous === 'grand_total') {
      start = i + 1;
      break;
    }
  }
  return labeledProductIndexes(rows, start, rowIndex - 1);
}

/**
 * @param {number} leafIndex
 * @param {number[]} previewIndexes
 * @returns {string}
 */
export function excelSumFormula(leafIndex, previewIndexes) {
  if (!previewIndexes.length) return '=SUM()';
  const letter = excelColumnLetterFromLeafIndex(leafIndex);
  const excelRows = previewIndexes.map((index) => excelRowFromPreviewIndex(index));
  const parts = [];
  let rangeStart = excelRows[0];
  let previous = excelRows[0];
  for (let i = 1; i < excelRows.length; i += 1) {
    if (excelRows[i] === previous + 1) {
      previous = excelRows[i];
      continue;
    }
    parts.push(rangeStart === previous ? `${letter}${rangeStart}` : `${letter}${rangeStart}:${letter}${previous}`);
    rangeStart = excelRows[i];
    previous = excelRows[i];
  }
  parts.push(rangeStart === previous ? `${letter}${rangeStart}` : `${letter}${rangeStart}:${letter}${previous}`);
  return `=SUM(${parts.join(',')})`;
}

/**
 * @param {Array<{ field: string, op?: string }>} operands
 * @param {number} previewRowIndex
 * @returns {string}
 */
function excelArithmeticFormula(operands, previewRowIndex) {
  const body = operands
    .map((operand, index) => {
      const ref = excelCellRef(leafIndexForMeasure(operand.field), previewRowIndex);
      if (index === 0) return ref;
      const op = EXCEL_OPERATOR[operand.op] || operand.op || '+';
      return `${op}${ref}`;
    })
    .join('');
  return `=${body}`;
}

/**
 * @param {object} row
 * @param {Array<{ field: string, op?: string }>} operands
 * @param {number} previewRowIndex
 * @returns {Array<{ label: string, excelRef: string, raw: string }>}
 */
function operandTrace(row, operands, previewRowIndex) {
  return operands.map((operand) => ({
    label: CLOSING_STOCK_FORMULA_CATALOG[operand.field]?.name || operand.field,
    excelRef: excelCellRef(leafIndexForMeasure(operand.field), previewRowIndex),
    raw: rawClosingStockValue(row?.[operand.field]),
  }));
}

/**
 * Trace for one preview cell. Reads stored row fields only.
 * @param {{
 *   rows: Array<{ kind?: string, label?: string }>,
 *   rowIndex: number,
 *   leafIndex: number,
 * }} params
 */
export function describeClosingStockCell({ rows, rowIndex, leafIndex }) {
  const row = rows?.[rowIndex];
  const field = MEASURE_FIELD_BY_LEAF[leafIndex];
  const entry = field ? CLOSING_STOCK_FORMULA_CATALOG[field] : null;
  const headerPath = closingStockHeaderPath(leafIndex);
  const businessColumn = closingStockBusinessColumn(leafIndex);
  const excelRef = excelCellRef(leafIndex, rowIndex);
  const storedRaw = field ? rawClosingStockValue(row?.[field]) : '—';
  const base = {
    productName: String(row?.label || '').trim() || '—',
    headerPath,
    businessColumn,
    excelRef,
    storedRaw,
    formulaText: '',
    excelFormula: '',
    condition: '',
    sourceText: '',
    operands: [],
    mode: 'blank',
  };

  if (!row || row.kind === 'subcategory') {
    return {
      ...base,
      mode: 'heading',
      sourceText: 'Subcategory heading. This cell is not calculated.',
    };
  }

  if (!field || !entry || entry.kind === 'blank') {
    return {
      ...base,
      mode: 'blank',
      sourceText: NOT_CALCULATED,
    };
  }

  const isTotal = row.kind === 'subcategory_total' || row.kind === 'grand_total';
  if (isTotal && TOTAL_RATIO_FIELDS.has(field)) {
    const description =
      field === 'averageRateAmt' ? 'Total Amount / Total Qty' : 'GP Amount / Sales Amount';
    return {
      ...base,
      mode: 'ratio',
      formulaText: description,
      excelFormula: excelArithmeticFormula(entry.operands, rowIndex),
      condition: entry.condition || '',
      operands: operandTrace(row, entry.operands, rowIndex),
    };
  }

  if (isTotal) {
    const productIndexes = productRowsForTotal(rows, rowIndex, row.kind);
    const scope =
      row.kind === 'grand_total'
        ? 'every product row on this sheet'
        : 'the product rows in this group';
    return {
      ...base,
      mode: 'sum',
      formulaText: `Sum of ${entry.name} on ${scope}`,
      excelFormula: excelSumFormula(leafIndex, productIndexes),
      sourceText: productIndexes.length
        ? 'Stored total from the Financials engine. This view does not re-sum the sheet.'
        : 'No labeled product rows in this group.',
    };
  }

  if (entry.kind === 'source') {
    return {
      ...base,
      mode: 'source',
      sourceText: entry.source,
    };
  }

  return {
    ...base,
    mode: 'calculated',
    formulaText: entry.description,
    excelFormula: excelArithmeticFormula(entry.operands, rowIndex),
    condition: entry.condition || '',
    operands: operandTrace(row, entry.operands, rowIndex),
  };
}
