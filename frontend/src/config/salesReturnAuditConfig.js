import { SALES_FILTER_LABELS } from '../utils/salesRecordFilters';

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
  filterLabels: {
    ...SALES_FILTER_LABELS,
    higherReturnRate: 'Higher sales return rate',
  },
};

export const PURCHASE_RETURN_AUDIT_CONFIG = {
  sessionKey: 'purchase-return-audit',
  exportFilePrefix: 'purchase-return',
  successToast: 'Purchase return audit complete',
  missingFileToast: 'Upload a Purchase Return Audit file first.',
  uploadHint:
    'Upload either Purchase Return Excel format. Format is detected automatically. Average rates are compared against the latest Sales Audit run stored in the database.',
  emptyDescription:
    'Upload a Purchase Return Excel file (with or without Purchase Voucher No). Ensure a Sales Audit has been run first so product average rates are available.',
  higherRateLabel: 'Higher purchase return rate',
  higherRateSheetName: 'Higher Purchase Return Rate',
  productPdfTitle: 'Purchase return audit — product comparison',
  exceptionPdfTitle: 'Purchase return audit — exception report',
  filterLabels: {
    ...SALES_FILTER_LABELS,
    higherReturnRate: 'Higher purchase return rate',
  },
};
