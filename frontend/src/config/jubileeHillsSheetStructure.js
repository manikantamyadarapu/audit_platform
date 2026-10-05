import { CLOSING_STOCK_CATEGORIES } from './closingStockLayout';
import { ABSTRACT_SHEET_NAME } from './abstractLayout';
import { TRADING_SHEET_NAME } from './tradingAccountLayout';

export const JUBILEE_HILLS_PREVIEW_SHEETS = Object.freeze([
  ...CLOSING_STOCK_CATEGORIES,
  TRADING_SHEET_NAME,
  ABSTRACT_SHEET_NAME,
]);

function subcategoryTotalLabel(category, subcategory) {
  if (category === 'Precious and Semi Precious') {
    return `TOTAL - ${String(subcategory || '').trim().toUpperCase()}`;
  }
  return 'TOTAL';
}

/**
 * Section headers and total placeholders only. No product rows and no amounts.
 * @param {Record<string, unknown> | null | undefined} ruleBook
 */
export function blankJubileeHillsLayouts(ruleBook) {
  const book = ruleBook && typeof ruleBook === 'object' ? ruleBook : {};
  const layouts = {};
  for (const category of CLOSING_STOCK_CATEGORIES) {
    const rows = [];
    const section = book[category];
    if (section && typeof section === 'object' && !Array.isArray(section)) {
      for (const subcategory of Object.keys(section)) {
        const label = String(subcategory || '').trim();
        if (!label) continue;
        rows.push({ kind: 'subcategory', label, subcategory: label });
        rows.push({
          kind: 'subcategory_total',
          label: subcategoryTotalLabel(category, label),
          subcategory: label,
        });
      }
    }
    rows.push({ kind: 'grand_total', label: 'GRAND TOTAL' });
    layouts[category] = rows;
  }
  return layouts;
}
