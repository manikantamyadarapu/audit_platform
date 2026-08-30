import { useEffect } from 'react';
import {
  CLOSING_STOCK_CATEGORIES,
  buildClosingStockPreviewRows,
  buildGroupedHeaderCells,
  closingStockCellValue,
  closingStockReportTitle,
  getClosingStockHeaderRows,
} from '../../config/closingStockLayout';
import { cn } from '../../utils/cn';

const HEADER_CELL =
  'border border-slate-300/80 bg-emerald-800 px-1.5 py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-white dark:border-slate-600';
const SUBHEADER_CELL =
  'border border-slate-300/80 bg-emerald-900/90 px-1.5 py-2 text-center text-[10px] font-semibold text-white dark:border-slate-600';
const LEAF_CELL =
  'border border-slate-300/80 bg-emerald-950/80 px-1 py-1.5 text-center text-[9px] font-semibold text-emerald-50 dark:border-slate-600';
const NUMBER_CELL =
  'border border-emerald-200/80 bg-emerald-50 px-1 py-1 text-center text-[9px] font-bold text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200';
const BODY_CELL =
  'border border-slate-200/90 px-2 py-1.5 text-center text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300';
const PRODUCT_CELL =
  'sticky left-0 z-[1] border border-slate-200/90 bg-[var(--color-surface-elevated)] px-3 py-1.5 text-left text-xs font-medium text-slate-800 dark:border-slate-700 dark:text-slate-100';

function HeaderRow({ cells, className }) {
  return (
    <tr>
      {cells.map((cell, idx) => (
        <th key={`${cell.label}-${idx}`} colSpan={cell.colSpan} className={className}>
          {cell.label}
        </th>
      ))}
    </tr>
  );
}

function rowStyles(kind) {
  if (kind === 'subcategory') {
    return {
      tr: 'bg-emerald-50/90 dark:bg-emerald-950/30',
      label: cn(PRODUCT_CELL, 'font-bold text-emerald-800 dark:text-emerald-200'),
      cell: cn(BODY_CELL, 'bg-emerald-50/90 dark:bg-emerald-950/30'),
    };
  }
  if (kind === 'subcategory_total') {
    return {
      tr: 'bg-amber-50 dark:bg-amber-950/20',
      label: cn(PRODUCT_CELL, 'font-bold text-amber-900 dark:text-amber-200'),
      cell: cn(BODY_CELL, 'bg-amber-50 dark:bg-amber-950/20'),
    };
  }
  if (kind === 'grand_total') {
    return {
      tr: 'bg-amber-100/90 dark:bg-amber-900/30',
      label: cn(PRODUCT_CELL, 'font-bold text-amber-950 dark:text-amber-100'),
      cell: cn(BODY_CELL, 'bg-amber-100/90 dark:bg-amber-900/30'),
    };
  }
  return {
    tr: 'odd:bg-white even:bg-slate-50/60 dark:odd:bg-[var(--color-surface-elevated)] dark:even:bg-slate-900/20',
    label: PRODUCT_CELL,
    cell: BODY_CELL,
  };
}

/**
 * On-screen preview of one Closing Stock category sheet.
 * @param {{
 *   category?: string,
 *   products?: string[],
 *   layoutRows?: Array<{ kind?: string, label?: string }>,
 *   financialYear?: string,
 *   companyName?: string,
 *   address?: string,
 * }} props
 */
export function ClosingStockPreviewTable({
  category = CLOSING_STOCK_CATEGORIES[0],
  products = [],
  layoutRows = null,
  financialYear = 'AY 2025-26',
  companyName = '',
  address = '',
}) {
  const { level1, level2, leaves, numbers } = getClosingStockHeaderRows();
  const level1Cells = buildGroupedHeaderCells(level1);
  const level2Cells = buildGroupedHeaderCells(level2);
  const rows = buildClosingStockPreviewRows(layoutRows, products);
  const reportTitle = closingStockReportTitle(category);

  // TEMP debug: confirm Opening/Sales/Purchases values reach product rows.
  useEffect(() => {
    const previewRows = buildClosingStockPreviewRows(layoutRows, products);
    const sample = previewRows.find(
      (row) =>
        row.kind === 'product' &&
        (row.openingQty != null ||
          row.openingAmt != null ||
          row.salesQty != null ||
          row.salesAmt != null ||
          row.purchasesQty != null ||
          row.purchasesAmt != null)
    );
    // eslint-disable-next-line no-console
    console.debug('[ClosingStockPreview]', {
      category,
      sample: sample
        ? {
            label: sample.label,
            openingQty: sample.openingQty,
            openingAmt: sample.openingAmt,
            col3: closingStockCellValue(sample, 2),
            col4: closingStockCellValue(sample, 3),
            col22: closingStockCellValue(sample, 21),
            col23: closingStockCellValue(sample, 22),
            openingQtyCell: closingStockCellValue(sample, 0),
            openingAmtCell: closingStockCellValue(sample, 1),
          }
        : null,
    });
  }, [category, layoutRows, products]);

  return (
    <div className="space-y-3">
      <div className="text-center">
        {companyName ? (
          <p className="text-sm font-bold text-slate-900 dark:text-slate-50">{companyName}</p>
        ) : null}
        {address ? <p className="text-xs text-slate-600 dark:text-slate-400">{address}</p> : null}
        <p className="text-xs text-slate-600 dark:text-slate-400">
          Financial Year: {financialYear}
        </p>
        <h4 className="mt-2 text-sm font-bold tracking-wide text-emerald-800 dark:text-emerald-300">
          {reportTitle}
        </h4>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200/80 shadow-sm dark:border-slate-700">
        <table className="min-w-max w-full border-collapse text-xs">
          <thead>
            <tr>
              <th rowSpan={4} className={`${HEADER_CELL} sticky left-0 z-[2] min-w-[11rem]`}>
                Particulars / Product
              </th>
              {level1Cells.map((cell, idx) => (
                <th key={`l1-${cell.label}-${idx}`} colSpan={cell.colSpan} className={HEADER_CELL}>
                  {cell.label}
                </th>
              ))}
            </tr>
            <HeaderRow cells={level2Cells} className={SUBHEADER_CELL} />
            <tr>
              {leaves.map((leaf, idx) => (
                <th key={`leaf-${idx}`} className={LEAF_CELL}>
                  {leaf}
                </th>
              ))}
            </tr>
            <tr>
              {numbers.map((num, idx) => (
                <th key={`num-${idx}`} className={NUMBER_CELL}>
                  {num}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIdx) => {
              const styles = rowStyles(row.kind);
              return (
                <tr key={`${row.kind}-${row.label}-${rowIdx}`} className={styles.tr}>
                  <td className={styles.label}>{row.label}</td>
                  {numbers.map((num, leafIdx) => (
                    <td key={`${rowIdx}-${num}`} className={styles.cell}>
                      {closingStockCellValue(row, leafIdx)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500">
        Every Rule Book product stays in the sheet even when all columns are blank. Purchases
        (cols 3–4) and Sales (cols 22–23) fill from pivots when matched; other columns stay blank
        until calculations are added. TOTAL / GRAND TOTAL rows sum filled measures.
      </p>
    </div>
  );
}
