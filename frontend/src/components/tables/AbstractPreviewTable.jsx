import { useMemo } from 'react';
import {
  ABSTRACT_AMT_SUBHEADER,
  ABSTRACT_BODY_ROWS,
  ABSTRACT_MEASURE_GROUPS,
  ABSTRACT_QTY_SUBHEADER,
  ABSTRACT_TITLE,
  abstractColumnCount,
  abstractColumnSpan,
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

function displayMeasure(value) {
  if (value === null || value === undefined) return '';
  return formatClosingStockMeasure(value).replace(/\u00a0/g, '').trim();
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
}) {
  const lastCol = 1 + abstractColumnCount();
  const byLabel = useMemo(
    () =>
      buildAbstractRowMeasures({
        layoutByCategory,
        salesPivot,
        purchasesPivot,
        openingPivot,
        mrPivots,
        dcPivots,
      }),
    [layoutByCategory, salesPivot, purchasesPivot, openingPivot, mrPivots, dcPivots]
  );
  return (
    <div className="overflow-x-auto">
      <table className="min-w-max border-collapse bg-white dark:bg-slate-950">
        <thead>
          <tr>
            <th colSpan={lastCol} className={TITLE_CELL}>
              {ABSTRACT_TITLE}
            </th>
          </tr>
          <tr>
            <th rowSpan={2} className={cn(HEADER_CELL, STICKY_LABEL)}>
              Particulars
            </th>
            {ABSTRACT_MEASURE_GROUPS.map((group) => (
              <th key={group} colSpan={abstractColumnSpan(group)} rowSpan={abstractColumnSpan(group) === 1 ? 2 : 1} className={HEADER_CELL}>
                {group}
              </th>
            ))}
          </tr>
          <tr>
            {ABSTRACT_MEASURE_GROUPS.flatMap((group) =>
              abstractColumnSpan(group) === 1
                ? []
                : [
                    <th key={`${group}-qty`} className={SUBHEADER_CELL}>
                      {ABSTRACT_QTY_SUBHEADER}
                    </th>,
                    <th key={`${group}-amt`} className={SUBHEADER_CELL}>
                      {ABSTRACT_AMT_SUBHEADER}
                    </th>,
                  ]
            )}
          </tr>
        </thead>
        <tbody>
          {ABSTRACT_BODY_ROWS.map((row, index) => {
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
              kind === 'section_heading' || kind === 'group_heading'
                ? null
                : byLabel[label];
            return (
              <tr key={`${kind}-${label}-${index}`} className={rowClass(kind)}>
                <td
                  className={cn(
                    BODY_CELL,
                    STICKY_LABEL,
                    rowClass(kind),
                    kind === 'item' && 'pl-8 font-medium'
                  )}
                >
                  {label}
                </td>
                {ABSTRACT_MEASURE_GROUPS.flatMap((group) =>
                  abstractColumnSpan(group) === 1
                    ? [
                        <td key={`${index}-${group}-amt`} className={cn(VALUE_CELL, rowClass(kind))}>
                          {displayMeasure(fill?.[group]?.amt)}
                        </td>,
                      ]
                    : [
                        <td key={`${index}-${group}-qty`} className={cn(VALUE_CELL, rowClass(kind))}>
                          {displayMeasure(fill?.[group]?.qty)}
                        </td>,
                        <td key={`${index}-${group}-amt`} className={cn(VALUE_CELL, rowClass(kind))}>
                          {displayMeasure(fill?.[group]?.amt)}
                        </td>,
                      ]
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
