/** Shared Closing Stock layout — mirrors python closing_stock_template. */

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

/**
 * header_path: [level1, level2|null, leaf Qty/Amt/%]
 * @type {ReadonlyArray<readonly [readonly [string | null, string | null, string], string]>}
 */
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

/**
 * Build preview Particulars rows from API layout (or flat products fallback).
 * @param {Array<{ kind?: string, label?: string }>|null|undefined} layoutRows
 * @param {string[]} products
 * @returns {Array<{ kind: string, label: string }>}
 */
export function buildClosingStockPreviewRows(layoutRows, products = []) {
  if (Array.isArray(layoutRows) && layoutRows.length) {
    return layoutRows.map((row) => ({
      kind: row?.kind || 'product',
      label: String(row?.label || ''),
    }));
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
