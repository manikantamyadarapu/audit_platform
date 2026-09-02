import {
  downloadClosingStockTemplate,
  downloadFinancialsPivots,
  processFinancialsPivot,
} from '../services/financials.service';

/**
 * Closing Stock (Financials) audit workspace config.
 */
export const CLOSING_STOCK_AUDIT_CONFIG = {
  sessionKey: 'financials-sales-purchases',
  demoModuleKey: 'closing-stock',
  pageTitle: 'Closing Stock',
  pageSubtitle:
    'Upload Sales, Purchases, Opening Quantity, Previous Year Closing, plus Material Receipts (MR) and Delivery Challans (DC). Opening, Purchases, Receipts, Issues, and Sales map onto the Closing Stock Rule Book layout.',
  processLabel: 'Process',
  processOverlayLabel: 'Building pivots, Opening Stock, and Receipts/Issues…',
  badgeLabel: 'Opening + MR/DC + Pivots',
  defaultFinancialYear: 'AY 2025-26',
  fileAccept:
    '.xlsx,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel.sheet.macroEnabled.12',
  fileFormatHint: 'Spreadsheet formats: .xlsx, .xlsm',
  process: processFinancialsPivot,
  downloadPivots: downloadFinancialsPivots,
  downloadClosingStock: downloadClosingStockTemplate,
};
