const NOTIFICATION_TYPES = {
  AUDIT_COMPLETED: 'AUDIT_COMPLETED',
  AUDIT_FAILED: 'AUDIT_FAILED',
  HIGH_EXCEPTION_COUNT: 'HIGH_EXCEPTION_COUNT',
  SESSION_EXPIRING_SOON: 'SESSION_EXPIRING_SOON',
  MISSING_PREREQUISITE: 'MISSING_PREREQUISITE',
};

const AUDIT_KEYS = {
  PAN: 'PAN',
  GROSS_WEIGHT: 'GROSS_WEIGHT',
  SALES: 'SALES',
  PURCHASE: 'PURCHASE',
  SALES_RETURN: 'SALES_RETURN',
  PURCHASE_RETURN: 'PURCHASE_RETURN',
  CASH_LEDGER: 'CASH_LEDGER',
  NEGATIVE_BANK: 'NEGATIVE_BANK',
  PARTY_WISE_TDS: 'PARTY_WISE_TDS',
  TDS_01: 'TDS_01',
  SECTION44AB: 'SECTION44AB',
};

const AUDIT_LABELS = {
  [AUDIT_KEYS.PAN]: 'ID Proof',
  [AUDIT_KEYS.GROSS_WEIGHT]: 'Gross Weight',
  [AUDIT_KEYS.SALES]: 'Rate & Ledger',
  [AUDIT_KEYS.PURCHASE]: 'Purchase Rate & Ledger',
  [AUDIT_KEYS.SALES_RETURN]: 'Sales Return',
  [AUDIT_KEYS.PURCHASE_RETURN]: 'Purchase Return',
  [AUDIT_KEYS.CASH_LEDGER]: 'Cash Ledger',
  [AUDIT_KEYS.NEGATIVE_BANK]: 'Negative Bank',
  [AUDIT_KEYS.PARTY_WISE_TDS]: 'Party Wise TDS Summary',
  [AUDIT_KEYS.TDS_01]: 'TDS @ 0.1%',
  [AUDIT_KEYS.SECTION44AB]: 'Section 44AB',
};

const AUDIT_ROUTES = {
  [AUDIT_KEYS.PAN]: '/scrutiny/pan',
  [AUDIT_KEYS.GROSS_WEIGHT]: '/scrutiny/gross-weight',
  [AUDIT_KEYS.SALES]: '/scrutiny/sales-ledger',
  [AUDIT_KEYS.PURCHASE]: '/scrutiny/purchase/rate-ledger',
  [AUDIT_KEYS.SALES_RETURN]: '/scrutiny/sales-return-rate',
  [AUDIT_KEYS.PURCHASE_RETURN]: '/scrutiny/purchase/return-rate',
  [AUDIT_KEYS.CASH_LEDGER]: '/scrutiny/cash-ledger',
  [AUDIT_KEYS.NEGATIVE_BANK]: '/scrutiny/negative-bank',
  [AUDIT_KEYS.PARTY_WISE_TDS]: '/scrutiny/tds/party-wise-summary',
  [AUDIT_KEYS.TDS_01]: '/scrutiny/tds/rate-0.1',
  [AUDIT_KEYS.SECTION44AB]: '/scrutiny/section44ab',
};

/** Min exception rows OR percent of total rows to trigger HIGH_EXCEPTION_COUNT */
const HIGH_EXCEPTION_MIN_ROWS = 50;
const HIGH_EXCEPTION_MIN_TOTAL = 10;
const HIGH_EXCEPTION_PERCENT = 0.1;

/** Notify when audit session expires within this many hours */
const SESSION_EXPIRING_HOURS = 24;

module.exports = {
  NOTIFICATION_TYPES,
  AUDIT_KEYS,
  AUDIT_LABELS,
  AUDIT_ROUTES,
  HIGH_EXCEPTION_MIN_ROWS,
  HIGH_EXCEPTION_MIN_TOTAL,
  HIGH_EXCEPTION_PERCENT,
  SESSION_EXPIRING_HOURS,
};
