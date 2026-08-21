/** Stable module keys used by Watch Demo buttons and admin CRUD. */
export const DEMO_VIDEO_MODULES = [
  { key: 'sales-audit', label: 'Sales Audit' },
  { key: 'purchase-audit', label: 'Purchase Audit' },
  { key: 'cash-ledger', label: 'Cash Ledger' },
  { key: 'tds-audit', label: 'TDS Audit' },
  { key: 'negative-bank', label: 'Negative Bank' },
  { key: 'section44ab', label: 'Section 44AB' },
  { key: 'gold-silver-rates', label: 'Gold & Silver Rates' },
  { key: 'rate-master', label: 'Rate Master' },
  { key: 'vouching', label: 'Vouching' },
];

export function getDemoModuleLabel(key) {
  return DEMO_VIDEO_MODULES.find((m) => m.key === key)?.label || key;
}
