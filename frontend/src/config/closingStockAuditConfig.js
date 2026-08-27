import {
  downloadClosingStockTemplate,
  downloadFinancialsPivots,
  processFinancialsPivot,
} from '../services/financials.service';

/**
 * Closing Stock (Financials) audit workspace config — mirrors ledger audit configs.
 * Measure / Rule Book calculations are intentionally not wired yet.
 */
export const CLOSING_STOCK_AUDIT_CONFIG = {
  sessionKey: 'financials-sales-purchases',
  demoModuleKey: 'closing-stock',
  pageTitle: 'Closing Stock',
  pageSubtitle:
    'Upload Sales and Purchases files. Product pivots are mapped to Diamond, Emerald, Pearls, Rubie, and Precious and Semi Precious sheets using the Closing Stock product Rule Book. Qty/Amt values stay blank until calculations are implemented.',
  processLabel: 'Process',
  processOverlayLabel: 'Building Sales and Purchases pivots…',
  badgeLabel: 'Template stage',
  defaultFinancialYear: 'AY 2025-26',
  process: processFinancialsPivot,
  downloadPivots: downloadFinancialsPivots,
  downloadClosingStock: downloadClosingStockTemplate,
};
