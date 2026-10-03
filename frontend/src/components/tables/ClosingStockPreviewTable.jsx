import { useEffect, useRef, useState } from 'react';
import {
  CLOSING_STOCK_CATEGORIES,
  buildClosingStockPreviewRows,
  buildGroupedHeaderCells,
  closingStockCellValue,
  closingStockReportTitle,
  describeClosingStockCell,
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

function CellTracePanel({ trace, onClose }) {
  if (!trace) return null;
  return (
    <aside className="overflow-hidden rounded-xl border border-slate-200/80 bg-white text-xs leading-snug text-slate-800 shadow-sm dark:border-slate-700 dark:bg-[var(--color-surface-elevated)] dark:text-slate-100">
      <div className="flex items-start justify-between gap-3 bg-emerald-800 px-3 py-2 text-white">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-100">Calculation</p>
          <p className="text-sm font-bold">{trace.headerPath || 'Column'}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 border border-white/40 px-2 py-0.5 text-[10px] font-bold tracking-wide hover:bg-white/10"
        >
          Close
        </button>
      </div>
      <dl className="grid gap-x-4 gap-y-1 px-3 py-2 sm:grid-cols-2">
        <div>
          <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Product</dt>
          <dd className="font-medium">{trace.productName}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Excel cell</dt>
          <dd className="font-mono font-bold text-emerald-800 dark:text-emerald-300">{trace.excelRef}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Column</dt>
          <dd>{trace.businessColumn || '—'}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Stored result</dt>
          <dd className="font-mono">{trace.storedRaw}</dd>
        </div>
      </dl>
      <div className="space-y-2 border-t border-slate-200 px-3 py-2 dark:border-slate-700">
        {trace.formulaText ? <p>{trace.formulaText}</p> : null}
        {trace.excelFormula ? (
          <p className="font-mono text-xs font-bold text-emerald-900 dark:text-emerald-200">{trace.excelFormula}</p>
        ) : null}
        {trace.condition ? <p className="text-slate-500">{trace.condition}</p> : null}
        {trace.sourceText ? <p>{trace.sourceText}</p> : null}
        {trace.operands.length ? (
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wide text-slate-500">
                <th className="py-1 pr-2 font-bold">Operand</th>
                <th className="py-1 pr-2 font-bold">Cell</th>
                <th className="py-1 font-bold">Raw value</th>
              </tr>
            </thead>
            <tbody>
              {trace.operands.map((operand) => (
                <tr key={`${operand.label}-${operand.excelRef}`} className="border-t border-slate-200 dark:border-slate-700">
                  <td className="py-1 pr-2">{operand.label}</td>
                  <td className="py-1 pr-2 font-mono">{operand.excelRef}</td>
                  <td className="py-1 font-mono">{operand.raw}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </div>
    </aside>
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
 *   showLegend?: boolean,
 * }} props
 */
export function ClosingStockPreviewTable({
  category = CLOSING_STOCK_CATEGORIES[0],
  products = [],
  layoutRows = null,
  financialYear = 'AY 2025-26',
  companyName = '',
  address = '',
  showLegend = true,
}) {
  const { level1, level2, leaves, numbers } = getClosingStockHeaderRows();
  const level1Cells = buildGroupedHeaderCells(level1);
  const level2Cells = buildGroupedHeaderCells(level2);
  const rows = buildClosingStockPreviewRows(layoutRows, products);
  const reportTitle = closingStockReportTitle(category);
  const rootRef = useRef(null);
  const [selection, setSelection] = useState(null);

  useEffect(() => {
    setSelection(null);
  }, [layoutRows, products, category]);

  useEffect(() => {
    if (!selection) return undefined;
    function onPointerDown(event) {
      if (!rootRef.current?.contains(event.target)) setSelection(null);
    }
    function onKeyDown(event) {
      if (event.key === 'Escape') setSelection(null);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [selection]);

  const trace = selection
    ? describeClosingStockCell({
        rows,
        rowIndex: selection.rowIndex,
        leafIndex: selection.leafIndex,
      })
    : null;

  function selectCell(rowIndex, leafIndex) {
    setSelection((current) =>
      current?.rowIndex === rowIndex && current?.leafIndex === leafIndex ? null : { rowIndex, leafIndex }
    );
  }

  return (
    <div ref={rootRef} className="space-y-3">
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
                  <td className={styles.label} title={row.label}>
                    {row.label}
                  </td>
                  {numbers.map((num, leafIdx) => {
                    const selected =
                      selection?.rowIndex === rowIdx && selection?.leafIndex === leafIdx;
                    return (
                      <td
                        key={`${rowIdx}-${num}`}
                        aria-pressed={selected}
                        onClick={() => selectCell(rowIdx, leafIdx)}
                        className={cn(
                          styles.cell,
                          'cursor-pointer',
                          selected && 'shadow-[inset_0_0_0_2px_#B45309]'
                        )}
                      >
                        {closingStockCellValue(row, leafIdx)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <CellTracePanel trace={trace} onClose={() => setSelection(null)} />
      <p className="text-xs text-slate-500">
        Select a cell to see its source or formula. The stored result comes from the Financials engine.
      </p>
      {showLegend ? (
        <p className="text-xs text-slate-500">
          Only products from this branch’s Sales, Purchases, and Opening Stock are listed.
          TOTAL / GRAND TOTAL rows sum those products.
        </p>
      ) : null}
    </div>
  );
}
