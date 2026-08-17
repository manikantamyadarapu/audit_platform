import { SALES_FILTER_LABELS } from '../utils/salesRecordFilters';
import {
  exportSalesReturnConsolidated,
  exportSalesReturnRateComparison,
  validateSalesReturnAudit,
} from '../services/salesReturn.service';
import {
  exportPurchaseReturnConsolidated,
  exportPurchaseReturnRateComparison,
  validatePurchaseReturnAudit,
} from '../services/purchaseReturn.service';

/** Shared return-audit workspace settings (Sales Return vs Purchase Return). */

export const SALES_RETURN_AUDIT_CONFIG = {
  sessionKey: 'sales-return-audit',
  exportFilePrefix: 'sales-return',
  successToast: 'Sales return audit complete',
  missingFileToast: 'Upload a Sales Return Audit file first.',
  uploadHint:
    'Upload the Sales Return Audit file only. Average rates are compared against the latest Sales Audit run stored in the database.',
  emptyDescription:
    'Upload the Sales Return Audit Excel file. Ensure a Sales Audit has been run first so product average rates are available in the database.',
  higherRateLabel: 'Higher sales return rate',
  higherRateSheetName: 'Higher Sales Return Rate',
  productPdfTitle: 'Sales return audit — product comparison',
  exceptionPdfTitle: 'Sales return audit — exception report',
  avgReturnHeader: 'Avg_sales_return',
  avgBaselineHeader: 'Avg_sales',
  filterLabels: {
    ...SALES_FILTER_LABELS,
    higherReturnRate: 'Higher sales return rate',
  },
  api: {
    validate: validateSalesReturnAudit,
    exportRateComparison: exportSalesReturnRateComparison,
    exportConsolidated: exportSalesReturnConsolidated,
  },
};

export const PURCHASE_RETURN_AUDIT_CONFIG = {
  sessionKey: 'purchase-return-audit',
  exportFilePrefix: 'purchase-return',
  successToast: 'Purchase return audit complete',
  missingFileToast: 'Upload a Purchase Return Audit file first.',
  uploadHint:
    'Upload either Purchase Return Excel format (with or without Purchase Voucher No). Format is detected automatically. Average rates are compared against the latest Purchase Rate & Ledger run.',
  emptyDescription:
    'Upload a Purchase Return Excel file. Ensure Purchase Rate & Ledger Audit has been run first so product average rates are available in the database.',
  higherRateLabel: 'Higher purchase return rate',
  higherRateSheetName: 'Higher Purchase Return Rate',
  productPdfTitle: 'Purchase return audit — product comparison',
  exceptionPdfTitle: 'Purchase return audit — exception report',
  avgReturnHeader: 'Avg_purchase_return',
  avgBaselineHeader: 'Avg_purchase',
  filterLabels: {
    ...SALES_FILTER_LABELS,
    higherReturnRate: 'Higher purchase return rate',
  },
  api: {
    validate: validatePurchaseReturnAudit,
    exportRateComparison: exportPurchaseReturnRateComparison,
    exportConsolidated: exportPurchaseReturnConsolidated,
  },
};
