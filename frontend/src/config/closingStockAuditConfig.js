import {
  downloadClosingStockTemplate,
  downloadFinancialsPivots,
  processFinancialsPivot,
} from '../services/financials.service';

/**
 * Stock Reconciliation (Financials) audit workspace config.
 * Route/session keys stay stable; visible labels use Stock Reconciliation.
 */
export const CLOSING_STOCK_AUDIT_CONFIG = {
  sessionKey: 'financials-sales-purchases',
  demoModuleKey: 'closing-stock',
  pageTitle: 'Stock Reconciliation',
  pageSubtitle:
    'Reconcile opening stock, purchases, receipts, issues and sales to derive the stock position.',
  processLabel: 'Process',
  processOverlayLabel: 'Building pivots and mapping Opening Stock…',
  badgeLabel: 'Working Paper',
  defaultFinancialYear: 'AY 2025-26',
  fileAccept:
    '.xlsx,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel.sheet.macroEnabled.12',
  fileFormatHint: 'Spreadsheet formats: .xlsx, .xlsm',
  process: processFinancialsPivot,
  downloadPivots: downloadFinancialsPivots,
  downloadClosingStock: downloadClosingStockTemplate,
};
