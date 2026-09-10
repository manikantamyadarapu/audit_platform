import { useMemo } from 'react';
import { formatClosingStockMeasure } from '../../config/closingStockLayout';
import {
  TRADING_ACCOUNTS,
  TRADING_METAL_ACCOUNTS,
  TRADING_ACCOUNT_SOURCE_CATEGORY,
  grandTotalFromLayout,
  metalTradingAccountRows,
  metalTradingLineValues,
  tradingAccountRows,
  tradingLineValues,
} from '../../config/tradingAccountLayout';
import { aggregateMetalTradingTotals } from '../../utils/metalTradingTotals';
import { cn } from '../../utils/cn';

const HEADER_CELL =
  'border border-slate-300/80 bg-emerald-800 px-2 py-1.5 text-center text-[10px] font-semibold uppercase tracking-wide text-white';
const BODY_CELL =
  'border border-slate-200 px-2 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:text-slate-100';
const QTY_CELL = cn(BODY_CELL, 'w-28 text-center tabular-nums font-semibold');
const AMT_CELL = cn(BODY_CELL, 'w-32 text-center tabular-nums font-semibold');
const LABEL_CELL = cn(BODY_CELL, 'text-left font-medium');

function displayMeasure(value) {
  if (value === null || value === undefined) return '';
  return formatClosingStockMeasure(value).replace(/\u00a0/g, '').trim();
}

function SideTable({ qtyHeader, rows, side, grandTotal, sourceLinesOnly = false, account }) {
  return (
    <table className="w-full min-w-[18rem] border-collapse bg-white dark:bg-slate-950">
      <thead>
        <tr>
          <th className={HEADER_CELL}>Particulars</th>
          <th className={HEADER_CELL}>{qtyHeader}</th>
          <th className={HEADER_CELL}>Amount</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, idx) => {
          const label = side === 'left' ? row.left : row.right;
          const isGp = label === 'To Gross Profit';
          const isTotal = label === 'Total';
          const values = sourceLinesOnly
            ? metalTradingLineValues(label, grandTotal, side, account)
            : tradingLineValues(label, grandTotal, side);
          return (
            <tr
              key={`${side}-${idx}`}
              className={isTotal ? 'bg-amber-50 dark:bg-amber-950/20' : undefined}
            >
              <td className={cn(LABEL_CELL, isTotal && 'font-bold text-amber-950 dark:text-amber-100')}>
                {label}
              </td>
              <td className={cn(QTY_CELL, isGp && 'bg-slate-50 dark:bg-slate-900/40')}>
                {isGp ? '' : displayMeasure(values.qty)}
              </td>
              <td className={AMT_CELL}>{displayMeasure(values.amt)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/**
 * On-screen preview of the Trading T-account sheet.
 * Opening/Purchases/Sales/Closing/HO transfer copy GRAND TOTAL from the category sheet.
 * @param {{
 *   layoutByCategory?: Record<string, object[]>,
 *   salesPivot?: object[],
 *   purchasesPivot?: object[],
 *   openingPivot?: object[],
 * }} props
 */
export function TradingAccountPreview({
  layoutByCategory = {},
  salesPivot = [],
  purchasesPivot = [],
  openingPivot = [],
  mrPivots = {},
  dcPivots = {},
}) {
  const metalTotals = useMemo(
    () =>
      aggregateMetalTradingTotals({
        salesPivot,
        purchasesPivot,
        openingPivot,
        mrPivots,
        dcPivots,
      }),
    [salesPivot, purchasesPivot, openingPivot, mrPivots, dcPivots]
  );
  return (
    <div className="space-y-8 overflow-x-auto">
      {TRADING_METAL_ACCOUNTS.map((account) => {
        const rows = metalTradingAccountRows(account);
        const totals = metalTotals[account.title];
        return (
          <section key={account.title} className="space-y-2">
            <h4 className="rounded-lg bg-emerald-50 px-3 py-2 text-center text-sm font-bold text-emerald-950 dark:bg-emerald-950/30 dark:text-emerald-100">
              {account.title}
            </h4>
            <div className="grid gap-4 lg:grid-cols-[1fr_auto_1fr] lg:items-stretch">
              <SideTable
                qtyHeader={account.qtyHeader}
                rows={rows}
                side="left"
                grandTotal={totals}
                sourceLinesOnly
                account={account}
              />
              <div
                className="hidden w-px bg-slate-800 dark:bg-slate-200 lg:block"
                aria-hidden="true"
              />
              <SideTable
                qtyHeader={account.qtyHeader}
                rows={rows}
                side="right"
                grandTotal={totals}
                sourceLinesOnly
                account={account}
              />
            </div>
          </section>
        );
      })}
      {TRADING_ACCOUNTS.map((account) => {
        const category = TRADING_ACCOUNT_SOURCE_CATEGORY[account.title];
        const grandTotal = grandTotalFromLayout(layoutByCategory?.[category]);
        const rows = tradingAccountRows(account, grandTotal);
        return (
          <section key={account.title} className="space-y-2">
            <h4 className="rounded-lg bg-emerald-50 px-3 py-2 text-center text-sm font-bold text-emerald-950 dark:bg-emerald-950/30 dark:text-emerald-100">
              {account.title}
            </h4>
            <div className="grid gap-4 lg:grid-cols-[1fr_auto_1fr] lg:items-stretch">
              <SideTable
                qtyHeader={account.qtyHeader}
                rows={rows}
                side="left"
                grandTotal={grandTotal}
              />
              <div
                className="hidden w-px bg-slate-800 dark:bg-slate-200 lg:block"
                aria-hidden="true"
              />
              <SideTable
                qtyHeader={account.qtyHeader}
                rows={rows}
                side="right"
                grandTotal={grandTotal}
              />
            </div>
          </section>
        );
      })}
    </div>
  );
}
