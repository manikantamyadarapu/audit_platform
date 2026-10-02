import { downloadMultiSheetRowsXlsx, downloadRowsXlsx } from './salesReturnXlsxExport';

/** Shared columns for Sales / Purchases / Opening / MR / DC location pivots. */
const PIVOT_COLUMN_DEFS = [
  { header: 'Product', accessor: (row) => row?.product ?? '' },
  { header: 'Sum of Quantity', accessor: (row) => row?.sumOfQuantity ?? '' },
  { header: 'Sum of Gross Amount', accessor: (row) => row?.sumOfGross ?? '' },
];

const TRANSFER_LOCATION_SHEETS = [
  { key: 'jubileeHills', name: 'Jubilee Hills' },
  { key: 'kokapet', name: 'Kokapet' },
  { key: 'internalBasheerbagh', name: 'Internal Basheerbagh' },
];

/**
 * Single-sheet Excel from an existing flat pivot array (Sales, Purchases, Opening).
 * Uses real API response rows — no mock data.
 */
export function downloadFlatPivotXlsx(filename, rows, sheetName) {
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) {
    throw new Error('No pivot rows to download.');
  }
  downloadRowsXlsx(filename, PIVOT_COLUMN_DEFS, list, sheetName);
}

/**
 * Multi-sheet Excel from an existing MR/DC location pivot tree.
 * Uses real API response rows — no mock data.
 */
export function downloadLocationPivotTreeXlsx(filename, tree, sourceLabel) {
  const sheets = TRANSFER_LOCATION_SHEETS.map(({ key, name }) => ({
    name: `${sourceLabel} – ${name}`.slice(0, 31),
    columnDefs: PIVOT_COLUMN_DEFS,
    rows: Array.isArray(tree?.[key]) ? tree[key] : [],
    emptyMessage: `No ${sourceLabel} rows for ${name}.`,
  }));

  const hasAny = sheets.some((sheet) => sheet.rows.length > 0);
  if (!hasAny) {
    throw new Error(`No ${sourceLabel} pivot rows to download.`);
  }

  downloadMultiSheetRowsXlsx(filename, sheets);
}
