import { TSHAPE_BRANCH_COLUMNS, TSHAPE_LEFT_ROWS, TSHAPE_RIGHT_ROWS } from '../../config/consolidatedTShapeLayout';
import { formatClosingStockMeasure } from '../../config/closingStockLayout';
import { tshapeSideTotal } from '../../utils/consolidatedTShapeValues';
import { cn } from '../../utils/cn';

const TITLE_CELL =
  'border border-slate-300/80 bg-emerald-50 px-3 py-2 text-center text-sm font-bold text-emerald-950 dark:border-slate-600 dark:bg-emerald-950/30 dark:text-emerald-100';
const HEADER_CELL =
  'border border-slate-300/80 bg-emerald-800 px-2 py-1.5 text-center text-[10px] font-semibold uppercase tracking-wide text-white';
const BODY_CELL =
  'border border-slate-200 px-2 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:text-slate-100';
const AMT_CELL = cn(BODY_CELL, 'text-center tabular-nums');
const TOTAL_ROW = 'bg-amber-50 font-bold text-amber-950 dark:bg-amber-950/30 dark:text-amber-100';

function displayAmt(value) {
  if (value == null) return '';
  return formatClosingStockMeasure(value).replace(/\u00a0/g, '').trim();
}

function amountKeys(values) {
  return [...TSHAPE_BRANCH_COLUMNS.map((column) => column.key), 'total'];
}

function AmountCells({ label, values, sideLabels, divider }) {
  const keys = amountKeys();
  const isTotal = label === 'Total';
  const bodyLabels = sideLabels.slice(0, -1);
  return keys.map((key, index) => {
    const column = values?.[key] || {};
    const amount = isTotal ? tshapeSideTotal(column, bodyLabels) : label ? column[label] : null;
    return (
      <td
        key={`${label || 'blank'}-${key}`}
        className={cn(AMT_CELL, isTotal && TOTAL_ROW, divider && index === keys.length - 1 && 'border-r-2 border-r-slate-800')}
      >
        {displayAmt(amount)}
      </td>
    );
  });
}

/** Consolidated TShape preview: branch columns plus Total, left and right T. */
export function TShapePreview({ values = {}, className }) {
  const rightPadded = [
    ...TSHAPE_RIGHT_ROWS.slice(0, -1),
    ...Array(TSHAPE_LEFT_ROWS.length - TSHAPE_RIGHT_ROWS.length).fill(null),
    TSHAPE_RIGHT_ROWS[TSHAPE_RIGHT_ROWS.length - 1],
  ];
  const colCount = 1 + TSHAPE_BRANCH_COLUMNS.length + 1;
  return (
    <div className={cn('overflow-auto scrollbar-thin', className)}>
      <table className="min-w-max border-collapse bg-white dark:bg-slate-950">
        <thead className="sticky top-0 z-20">
          <tr>
            <th colSpan={colCount * 2 + 1} className={TITLE_CELL}>
              TShape
            </th>
          </tr>
          <tr>
            <th className={HEADER_CELL}>Particulars</th>
            {TSHAPE_BRANCH_COLUMNS.map((column) => (
              <th key={`l-${column.key}`} className={HEADER_CELL}>
                {column.label}
              </th>
            ))}
            <th className={cn(HEADER_CELL, 'border-r-2 border-r-slate-800')}>Total</th>
            <th className={cn(HEADER_CELL, 'w-6 bg-slate-200 text-slate-500 dark:bg-slate-800')} aria-hidden="true">
              {' '}
            </th>
            <th className={HEADER_CELL}>Particulars</th>
            {TSHAPE_BRANCH_COLUMNS.map((column) => (
              <th key={`r-${column.key}`} className={HEADER_CELL}>
                {column.label}
              </th>
            ))}
            <th className={HEADER_CELL}>Total</th>
          </tr>
        </thead>
        <tbody>
          {TSHAPE_LEFT_ROWS.map((leftLabel, index) => {
            const rightLabel = rightPadded[index];
            const isTotal = leftLabel === 'Total';
            return (
              <tr key={leftLabel} className={isTotal ? TOTAL_ROW : undefined}>
                <td className={cn(BODY_CELL, 'text-left font-medium', isTotal && TOTAL_ROW)}>{leftLabel}</td>
                <AmountCells label={leftLabel} values={values} sideLabels={TSHAPE_LEFT_ROWS} divider />
                <td className="border-0 bg-transparent p-0" aria-hidden="true" />
                <td className={cn(BODY_CELL, 'text-left font-medium', isTotal && TOTAL_ROW)}>{rightLabel}</td>
                <AmountCells label={rightLabel} values={values} sideLabels={TSHAPE_RIGHT_ROWS} />
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
