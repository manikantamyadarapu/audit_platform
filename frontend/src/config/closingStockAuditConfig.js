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
    'Upload Sales, Purchases, Current Year Opening Quantity, and Previous Year Closing Stock (Dia/Eme/…). Opening Qty from Opening Balance; Opening Amount from each product’s Closing stock Amt — then Rule Book places them on Closing Stock.',
  processLabel: 'Process',
  processOverlayLabel: 'Building pivots and mapping Opening Stock…',
  badgeLabel: 'Opening Stock + Pivots',
  defaultFinancialYear: 'AY 2025-26',
  process: processFinancialsPivot,
  downloadPivots: downloadFinancialsPivots,
  downloadClosingStock: downloadClosingStockTemplate,
};
