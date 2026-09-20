export const ABSTRACT_SHEET_NAME = 'Abstract';
export const ABSTRACT_TITLE = 'Trading Account Abstract';
export const ABSTRACT_QTY_SUBHEADER = 'Qty in Gms / Cts';
export const ABSTRACT_AMT_SUBHEADER = 'Amount in Rs';

export const ABSTRACT_MEASURE_GROUPS = Object.freeze([
  'Opening Stock',
  'Purchases',
  'Receipts - Jubilee Hills',
  'Transfer (Receipts)',
  'Issues - Internal Stock Transfer',
  'Issues - Jubilee Hills',
  'Consumption (Issues)',
  'Making Charges',
  'Sales',
  'Closing Stock',
  'Gross Profit',
  'CY GP %',
]);

export const ABSTRACT_AMT_ONLY_GROUPS = Object.freeze(['Gross Profit', 'CY GP %']);

export function abstractColumnSpan(group) {
  return ABSTRACT_AMT_ONLY_GROUPS.includes(group) ? 1 : 2;
}

export function abstractColumnCount() {
  return ABSTRACT_MEASURE_GROUPS.reduce((total, group) => total + abstractColumnSpan(group), 0);
}

export const ABSTRACT_ACCOUNT_ROWS = Object.freeze([
  { label: 'Gold Account 24K', tradingTitle: 'GOLD ACCOUNT - 24K', metal: true },
  { label: 'Gold Account 22K', tradingTitle: 'GOLD ORNAMENTS ACCOUNT - 22K', metal: true },
  { label: 'Gold Account 18K', tradingTitle: 'GOLD ORNAMENTS ACCOUNT - 18K', metal: true },
  { label: 'Gold Account 14K', tradingTitle: 'GOLD ORNAMENTS ACCOUNT - 14K', metal: true },
  { label: 'Silver Account', tradingTitle: 'SILVER ACCOUNT', metal: true },
  { label: 'Diamonds Account', tradingTitle: 'DIAMONDS ACCOUNT', metal: false },
  { label: 'Emeralds', tradingTitle: 'EMERALDS ACCOUNT', metal: false },
  { label: 'Pearls', tradingTitle: 'PEARLS ACCOUNT', metal: false },
  { label: 'Rubies', tradingTitle: 'RUBIES ACCOUNT', metal: false },
  { label: 'Color Stones Account', tradingTitle: 'COLOR STONES ACCOUNT', metal: false },
]);

export const DIAMOND_PRODUCT_ROWS = Object.freeze([
  'Diamonds - Beads',
  'Diamonds Rosecut diamonds',
  'Diamonds - Flat polki',
  'Uncut - diamonds',
  'Diamonds',
]);

export const COLOR_STONE_PRODUCT_ROWS = Object.freeze([
  'Precious Stones',
  'Semi Precious',
  'Synthetic Stones',
]);

/** Grouped Particulars labels only — no values. */
export const ABSTRACT_BODY_ROWS = Object.freeze([
  { kind: 'spacer' },
  { kind: 'account', label: 'Gold Account 24K' },
  { kind: 'account', label: 'Gold Account 22K' },
  { kind: 'account', label: 'Gold Account 18K' },
  { kind: 'account', label: 'Gold Account 14K' },
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
  { kind: 'section_heading', label: 'Particulars' },
  { kind: 'spacer' },
  { kind: 'group_heading', label: 'DIAMONDS' },
  { kind: 'item', label: 'Diamonds - Beads' },
  { kind: 'item', label: 'Diamonds Rosecut diamonds' },
  { kind: 'item', label: 'Diamonds - Flat polki' },
  { kind: 'item', label: 'Uncut - diamonds' },
  { kind: 'item', label: 'Diamonds' },
  { kind: 'group_total', label: 'Total Diamonds' },
  { kind: 'spacer' },
  { kind: 'group_heading', label: 'COLOR STONES' },
  { kind: 'item', label: 'Precious Stones' },
  { kind: 'item', label: 'Semi Precious' },
  { kind: 'item', label: 'Synthetic Stones' },
  { kind: 'group_total', label: 'TOTAL Colour Stones' },
]);
