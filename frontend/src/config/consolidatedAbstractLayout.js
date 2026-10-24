import { ABSTRACT_AMT_SUBHEADER, ABSTRACT_QTY_SUBHEADER, ABSTRACT_TITLE } from './abstractLayout';

export const CONSOLIDATED_ABSTRACT_SHEET_NAME = 'Abstract';
export const CONSOLIDATED_TSHAPE_SHEET_NAME = 'TShape';
export const CONSOLIDATED_ABSTRACT_TITLE = ABSTRACT_TITLE;
export const CONSOLIDATED_PREVIEW_SHEETS = Object.freeze([
  CONSOLIDATED_ABSTRACT_SHEET_NAME,
  CONSOLIDATED_TSHAPE_SHEET_NAME,
]);

export const CONSOLIDATED_ABSTRACT_QTY_SUBHEADER = ABSTRACT_QTY_SUBHEADER;
export const CONSOLIDATED_ABSTRACT_AMT_SUBHEADER = ABSTRACT_AMT_SUBHEADER;

/** @typedef {'qty_amt' | 'amt_only' | 'none'} ConsolidatedColumnKind */

export const CONSOLIDATED_ABSTRACT_MEASURE_COLUMNS = Object.freeze([
  { heading: 'Opening Stock', kind: 'qty_amt' },
  { heading: 'Purchases - Total', kind: 'qty_amt' },
  { heading: 'Internal Transfer - Total', kind: 'qty_amt' },
  { heading: 'Internal Consumption - Total', kind: 'qty_amt' },
  { heading: 'Making Charges', kind: 'amt_only' },
  { heading: 'Sales - Total', kind: 'qty_amt' },
  { heading: 'Closing Stock - Total', kind: 'qty_amt' },
  { heading: 'Gross Profit', kind: 'amt_only' },
  { heading: 'CY G P %', kind: 'none' },
  { heading: 'GP AY 2025-26', kind: 'amt_only' },
  { heading: 'Deviation', kind: 'amt_only' },
]);

export const CONSOLIDATED_MEASURE_KEYS = Object.freeze(
  CONSOLIDATED_ABSTRACT_MEASURE_COLUMNS.map((column) => column.heading)
);

export function consolidatedAbstractColumnSpan(kind) {
  return kind === 'qty_amt' ? 2 : 1;
}

export function consolidatedAbstractColumnCount() {
  return CONSOLIDATED_ABSTRACT_MEASURE_COLUMNS.reduce(
    (total, column) => total + consolidatedAbstractColumnSpan(column.kind),
    0
  );
}

export const CONSOLIDATED_ABSTRACT_BODY_ROWS = Object.freeze([
  { kind: 'spacer' },
  { kind: 'account', label: 'Gold Account 24K' },
  { kind: 'account', label: 'Gold Account 22K' },
  { kind: 'account', label: 'Gold Account 18K' },
  { kind: 'account', label: 'Gold Account 14K' },
  { kind: 'account', label: 'Platinum Account' },
  { kind: 'account', label: 'Gold Account Jadau' },
  { kind: 'account', label: 'Silver Account' },
  { kind: 'account', label: 'Diamonds Account' },
  { kind: 'account', label: 'Emeralds' },
  { kind: 'account', label: 'Pearls' },
  { kind: 'account', label: 'Rubies' },
  { kind: 'account', label: 'Color Stones Account' },
  { kind: 'spacer' },
  { kind: 'total', label: 'TOTAL' },
  { kind: 'spacer' },
  { kind: 'spacer' },
  { kind: 'group_heading', label: 'DIAMONDS' },
  { kind: 'item', label: 'Diamonds - Black diamonds' },
  { kind: 'item', label: 'Diamonds - Beads' },
  { kind: 'item', label: 'Diamonds Rosecut diamonds' },
  { kind: 'item', label: 'Diamonds - Flat polki' },
  { kind: 'item', label: 'Uncut - diamonds' },
  { kind: 'item', label: 'Diamonds' },
  { kind: 'group_total', label: 'Diamonds total' },
  { kind: 'spacer' },
  { kind: 'group_heading', label: 'COLOR STONES' },
  { kind: 'item', label: 'Precious Stones' },
  { kind: 'item', label: 'Semi Precious' },
  { kind: 'item', label: 'Synthetic Stones' },
  { kind: 'group_total', label: 'TOTAL Colour Stones' },
]);
