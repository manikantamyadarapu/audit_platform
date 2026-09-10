/** Allowed demo video module keys (stable identifiers for frontend wiring). */
const DEMO_VIDEO_MODULES = [
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

const DEMO_VIDEO_MODULE_KEYS = DEMO_VIDEO_MODULES.map((m) => m.key);

function isValidDemoModule(module) {
  return DEMO_VIDEO_MODULE_KEYS.includes(String(module || '').trim());
}

module.exports = {
  DEMO_VIDEO_MODULES,
  DEMO_VIDEO_MODULE_KEYS,
  isValidDemoModule,
};
