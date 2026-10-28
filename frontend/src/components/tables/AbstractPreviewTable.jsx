import { useMemo } from 'react';
import {
  ABSTRACT_AMT_SUBHEADER,
  ABSTRACT_BODY_ROWS,
  ABSTRACT_MEASURE_GROUPS,
  ABSTRACT_PERCENT_GROUPS,
  ABSTRACT_QTY_SUBHEADER,
  ABSTRACT_TITLE,
  abstractColumnCount,
  abstractColumnSpan,
  formatAbstractAmount,
} from '../../config/abstractLayout';
import { formatClosingStockMeasure } from '../../config/closingStockLayout';
import { buildAbstractRowMeasures } from '../../utils/abstractTradingValues';
import { cn } from '../../utils/cn';

const TITLE_CELL =
  'border border-slate-300/80 bg-emerald-50 px-3 py-2 text-center text-sm font-bold text-emerald-950 dark:border-slate-600 dark:bg-emerald-950/30 dark:text-emerald-100';
const HEADER_CELL =
  'border border-slate-300/80 bg-emerald-800 px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-white dark:border-slate-600';
const SUBHEADER_CELL =
  'border border-slate-300/80 bg-emerald-900/90 px-1.5 py-2 text-center text-[10px] font-semibold text-white dark:border-slate-600';
const STICKY_LABEL =
  'sticky left-0 z-[1] min-w-[14rem] whitespace-nowrap text-left';
const BODY_CELL =
  'border border-slate-200/90 px-2 py-1.5 text-xs dark:border-slate-700';
const VALUE_CELL = cn(BODY_CELL, 'text-center tabular-nums');

function defaultMeasureColumns() {
  return ABSTRACT_MEASURE_GROUPS.map((heading) => ({
    heading,
    kind: abstractColumnSpan(heading) === 1 ? 'none' : 'qty_amt',
  }));
}

function columnSpan(column) {
  return column.kind === 'qty_amt' ? 2 : 1;
}

function rowClass(kind) {
  if (kind === 'spacer') return 'h-3';
  if (kind === 'section_heading') {
    return 'bg-emerald-100 font-bold text-emerald-950 dark:bg-emerald-950/40 dark:text-emerald-100';
  }
  if (kind === 'group_heading') {
    return 'bg-emerald-800 font-bold uppercase tracking-wide text-white';
  }
  if (kind === 'item') {
    return 'bg-white text-slate-700 dark:bg-slate-950 dark:text-slate-200';
  }
  if (kind === 'total' || kind === 'group_total') {
    return 'bg-amber-50 font-bold text-amber-950 dark:bg-amber-950/30 dark:text-amber-100';
  }
  return 'bg-white text-slate-800 dark:bg-slate-950 dark:text-slate-100';
}

function displayQty(value) {
  if (value === null || value === undefined) return '';
  return formatClosingStockMeasure(value).replace(/\u00a0/g, '').trim();
}

function displayAmount(value, heading) {
  if (value === null || value === undefined) return '';
  if (ABSTRACT_PERCENT_GROUPS.includes(heading)) {
    return displayQty(value);
  }
  return formatAbstractAmount(value);
}

function headerCells(column) {
  if (column.kind === 'qty_amt') {
    return [
      <th key={`${column.heading}-qty`} className={SUBHEADER_CELL}>
        {ABSTRACT_QTY_SUBHEADER}
      </th>,
      <th key={`${column.heading}-amt`} className={SUBHEADER_CELL}>
        {ABSTRACT_AMT_SUBHEADER}
      </th>,
    ];
  }
  if (column.kind === 'amt_only') {
    return [
      <th key={`${column.heading}-amt`} className={SUBHEADER_CELL}>
        {ABSTRACT_AMT_SUBHEADER}
      </th>,
    ];
  }
  return [];
}

function valueCells(column, fill, index, kindClass) {
  const pair = fill?.[column.heading];
  if (column.kind === 'qty_amt') {
    return [
      <td key={`${index}-${column.heading}-qty`} className={cn(VALUE_CELL, kindClass)}>
        {displayQty(pair?.qty)}
      </td>,
      <td key={`${index}-${column.heading}-amt`} className={cn(VALUE_CELL, kindClass)}>
        {displayAmount(pair?.amt, column.heading)}
      </td>,
    ];
  }
  return [
    <td key={`${index}-${column.heading}-amt`} className={cn(VALUE_CELL, kindClass)}>
      {displayAmount(pair?.amt, column.heading)}
    </td>,
  ];
}

/**
 * On-screen preview of the Abstract sheet, filled from Trading sources.
 */
export function AbstractPreviewTable({
  layoutByCategory = {},
  salesPivot = [],
  purchasesPivot = [],
  openingPivot = [],
  mrPivots = {},
  dcPivots = {},
  blankValues = false,
  title = ABSTRACT_TITLE,
  bodyRows = ABSTRACT_BODY_ROWS,
  measureColumns,
  byLabel: byLabelProp,
  className,
}) {
  const columns = measureColumns ?? defaultMeasureColumns();
  const lastCol = measureColumns
    ? 1 + columns.reduce((total, column) => total + columnSpan(column), 0)
    : 1 + abstractColumnCount();
  const computedByLabel = useMemo(
    () =>
      byLabelProp ||
      (blankValues
        ? {}
        : buildAbstractRowMeasures({
            layoutByCategory,
            salesPivot,
            purchasesPivot,
            openingPivot,
            mrPivots,
            dcPivots,
          })),
    [
      byLabelProp,
      blankValues,
      layoutByCategory,
      salesPivot,
      purchasesPivot,
      openingPivot,
      mrPivots,
      dcPivots,
    ]
  );
  return (
    <div className={cn('overflow-auto scrollbar-thin', className)}>
      <table className="min-w-max border-collapse bg-white dark:bg-slate-950">
        <thead className="sticky top-0 z-20">
          <tr>
            <th colSpan={lastCol} className={TITLE_CELL}>
              {title}
            </th>
          </tr>
          <tr>
            <th rowSpan={2} className={cn(HEADER_CELL, STICKY_LABEL, 'z-30')}>
              Particulars
            </th>
            {columns.map((column) => (
              <th
                key={column.heading}
                colSpan={columnSpan(column)}
                rowSpan={column.kind === 'none' ? 2 : 1}
                className={HEADER_CELL}
              >
                {column.heading}
              </th>
            ))}
          </tr>
          <tr>{columns.flatMap((column) => headerCells(column))}</tr>
        </thead>
        <tbody>
          {bodyRows.map((row, index) => {
            const kind = row.kind;
            const label = row.label ?? '';
            if (kind === 'spacer') {
              return (
                <tr key={`spacer-${index}`} aria-hidden="true">
                  <td colSpan={lastCol} className="h-3 border-0 bg-transparent p-0" />
                </tr>
              );
            }
            const fill =
              kind === 'section_heading' || kind === 'group_heading' ? null : computedByLabel[label];
            const kindClass = rowClass(kind);
            return (
              <tr key={`${kind}-${label}-${index}`} className={kindClass}>
                <td
                  className={cn(
                    BODY_CELL,
                    STICKY_LABEL,
                    kindClass,
                    kind === 'item' && 'pl-8 font-medium'
                  )}
                >
                  {label}
                </td>
                {columns.flatMap((column) => valueCells(column, fill, index, kindClass))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
