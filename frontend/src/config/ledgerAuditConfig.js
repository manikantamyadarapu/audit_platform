import { SALES_FILTER_LABELS } from '../utils/salesRecordFilters';
import { validateSalesExcel } from '../services/sales.service';
import { validatePurchaseLedgerExcel } from '../services/purchase.service';

export const SALES_LEDGER_AUDIT_CONFIG = {
  sessionKey: 'sales-ledger',
  demoModuleKey: 'sales-audit',
  rateRulesReturnTo: '/scrutiny/sales-ledger',
  productAveragesPath: '/sales-audit/product-average-rates',
  exportFilePrefix: 'sales-ledger-exceptions',
  pdfTitle: 'Rate and ledger audit — exception report',
  successToast: 'Sales validation complete',
  filterLabels: SALES_FILTER_LABELS,
  ledgerMismatchLabel: 'Sales ledger mismatch',
  validate: validateSalesExcel,
};

export const PURCHASE_LEDGER_AUDIT_CONFIG = {
  sessionKey: 'purchase-ledger',
  demoModuleKey: 'purchase-audit',
  rateRulesReturnTo: '/scrutiny/purchase/rate-ledger',
  productAveragesPath: '/sales-audit/product-average-rates',
  exportFilePrefix: 'purchase-ledger-exceptions',
  pdfTitle: 'Purchase rate and ledger audit — exception report',
  successToast: 'Purchase validation complete',
  filterLabels: {
    ...SALES_FILTER_LABELS,
    accountVsProduct: 'Purchase ledger mismatch',
  },
  ledgerMismatchLabel: 'Purchase ledger mismatch',
  validate: validatePurchaseLedgerExcel,
};
