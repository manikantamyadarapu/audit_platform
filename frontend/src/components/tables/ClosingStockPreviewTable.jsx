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

/** Match python closing_stock_template fills / fonts as closely as CSS allows. */
const EXCEL_FONT = "font-['Calibri','Candara','Segoe_UI',Tahoma,sans-serif]";
const CELL_BORDER = 'border border-[#a6a6a6]';
/** Stronger divider after each major level-1 group (Opening / Purchases / Receipts / …). */
const GROUP_EDGE = 'border-r-[2px] border-r-[#595959]';

const HEADER_CELL = cn(
  CELL_BORDER,
  'bg-[#0F766E] px-1 py-1 text-center text-[9px] font-bold leading-tight text-white align-middle'
);
const SUBHEADER_CELL = cn(
  CELL_BORDER,
  'bg-[#115E59] px-0.5 py-1 text-center text-[8px] font-bold leading-tight text-white align-middle'
);
const LEAF_CELL = cn(
  CELL_BORDER,
  'bg-[#134E4A] px-0.5 py-0.5 text-center text-[8px] font-bold leading-tight text-white align-middle'
);
const NUMBER_CELL = cn(
  CELL_BORDER,
  'bg-[#ECFDF5] px-0.5 py-0.5 text-center text-[8px] font-bold leading-none text-[#0F766E] align-middle'
);
const BODY_CELL = cn(
  CELL_BORDER,
  'px-1 py-[3px] text-right text-[10px] tabular-nums leading-tight text-[#0F172A] align-middle whitespace-nowrap'
);
const PRODUCT_CELL = cn(
  CELL_BORDER,
  'sticky left-0 z-[2] min-w-[14rem] w-[14rem] max-w-[16rem] bg-white px-2 py-[3px] text-left text-[10px] font-medium leading-tight text-[#0F172A] align-middle'
);

const MEASURE_COL =
  'min-w-[3.75rem] w-[3.75rem] max-w-[4.5rem]';

/** Header row sticky offsets (compact Excel-like header band). */
const STICKY_TOP = {
  l1: 'top-0',
  l2: 'top-[1.65rem]',
  leaf: 'top-[3.3rem]',
  num: 'top-[4.7rem]',
};

/**
 * Leaf indices (0-based) that end a level-1 group — for thicker vertical rules.
 * @param {{ colSpan: number }[]} level1Cells
 */
function groupEndLeafIndices(level1Cells) {
  const ends = new Set();
  let cursor = 0;
  for (const cell of level1Cells) {
    cursor += cell.colSpan;
    ends.add(cursor - 1);
  }
  return ends;
}

function HeaderRow({ cells, className, stickyTop, cellGroupEnds }) {
  return (
    <tr>
      {cells.map((cell, idx) => (
        <th
          key={`${cell.label || 'blank'}-${idx}`}
          colSpan={cell.colSpan}
          className={cn(
            className,
            stickyTop,
            'sticky z-[3]',
            cellGroupEnds[idx] && GROUP_EDGE,
            !cell.label && 'font-normal'
          )}
        >
          {cell.label ? (
            <span className="block whitespace-normal break-words px-0.5">{cell.label}</span>
          ) : (
            '\u00a0'
          )}
        </th>
      ))}
    </tr>
  );
}

/**
 * @param {{ colSpan: number }[]} cells
 * @param {Set<number>} groupEnds
 * @returns {boolean[]}
 */
function cellEndsAtGroupBoundary(cells, groupEnds) {
  const flags = [];
  let leafCursor = 0;
  for (const cell of cells) {
    const leafEnd = leafCursor + cell.colSpan - 1;
    flags.push(groupEnds.has(leafEnd));
    leafCursor = leafEnd + 1;
  }
  return flags;
}

/**
 * Zebra only among product rows (subcategory / totals keep solid fills).
 * @param {Array<{ kind?: string }>} rows
 * @returns {boolean[]}
 */
function productZebraFlags(rows) {
  let productCount = 0;
  return rows.map((row) => {
    if (row.kind !== 'product') return false;
    productCount += 1;
    return productCount % 2 === 0;
  });
}

function rowStyles(kind, zebra) {
  if (kind === 'subcategory') {
    return {
      tr: '',
      label: cn(PRODUCT_CELL, 'bg-[#CCFBF1] font-bold text-[#0F766E]'),
      cell: cn(BODY_CELL, 'bg-[#CCFBF1]'),
    };
  }
  if (kind === 'subcategory_total') {
    return {
      tr: '',
      label: cn(PRODUCT_CELL, 'bg-[#FEF3C7] font-bold text-[#92400E]'),
      cell: cn(BODY_CELL, 'bg-[#FEF3C7] font-bold text-[#92400E]'),
    };
  }
  if (kind === 'grand_total') {
    return {
      tr: '',
      label: cn(PRODUCT_CELL, 'bg-[#FDE68A] font-bold text-[#78350F]'),
      cell: cn(BODY_CELL, 'bg-[#FDE68A] font-bold text-[#78350F]'),
    };
  }
  const bg = zebra ? 'bg-[#F8FAFC]' : 'bg-white';
  return {
    tr: '',
    label: cn(PRODUCT_CELL, bg),
    cell: cn(BODY_CELL, bg),
  };
}

/**
 * On-screen preview of one Closing Stock category sheet.
 * Visual styling only — layout/header definitions come from closingStockLayout.js.
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
  const groupEnds = groupEndLeafIndices(level1Cells);
  const level2GroupEnds = cellEndsAtGroupBoundary(level2Cells, groupEnds);
  const zebraByRow = productZebraFlags(rows);

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
    <div className={cn(EXCEL_FONT, 'space-y-2')}>
      <div className="text-center leading-snug text-[#0F172A]">
        {companyName ? (
          <p className="text-[13px] font-bold tracking-tight">{companyName}</p>
        ) : null}
        {address ? <p className="text-[11px] text-[#334155]">{address}</p> : null}
        <p className="text-[11px] text-[#334155]">Financial Year: {financialYear}</p>
        <h4 className="mt-1.5 text-[12px] font-bold tracking-wide text-[#0F766E]">{reportTitle}</h4>
      </div>

      <div className="max-h-[min(70vh,760px)] overflow-auto border border-[#7f7f7f] bg-white shadow-none dark:border-slate-600">
        <table className="w-max min-w-full border-collapse table-fixed text-[10px]">
          <colgroup>
            <col className="w-[14rem]" />
            {leaves.map((_, idx) => (
              <col key={`col-${idx}`} className="w-[3.75rem]" />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th
                rowSpan={4}
                className={cn(
                  HEADER_CELL,
                  'sticky left-0 top-0 z-[5] min-w-[14rem] w-[14rem] max-w-[16rem]',
                  GROUP_EDGE
                )}
              >
                <span className="block px-1 whitespace-normal">Particulars / Product</span>
              </th>
              {level1Cells.map((cell, idx) => (
                <th
                  key={`l1-${cell.label}-${idx}`}
                  colSpan={cell.colSpan}
                  className={cn(HEADER_CELL, 'sticky z-[4]', STICKY_TOP.l1, GROUP_EDGE)}
                >
                  <span className="block whitespace-normal break-words px-0.5">{cell.label}</span>
                </th>
              ))}
            </tr>
            <HeaderRow
              cells={level2Cells}
              className={SUBHEADER_CELL}
              stickyTop={STICKY_TOP.l2}
              cellGroupEnds={level2GroupEnds}
            />
            <tr>
              {leaves.map((leaf, idx) => (
                <th
                  key={`leaf-${idx}`}
                  className={cn(
                    LEAF_CELL,
                    MEASURE_COL,
                    'sticky z-[4]',
                    STICKY_TOP.leaf,
                    groupEnds.has(idx) && GROUP_EDGE
                  )}
                >
                  {leaf}
                </th>
              ))}
            </tr>
            <tr>
              {numbers.map((num, idx) => (
                <th
                  key={`num-${idx}`}
                  className={cn(
                    NUMBER_CELL,
                    MEASURE_COL,
                    'sticky z-[4]',
                    STICKY_TOP.num,
                    groupEnds.has(idx) && GROUP_EDGE
                  )}
                >
                  {num}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIdx) => {
              const styles = rowStyles(row.kind, zebraByRow[rowIdx]);
              return (
                <tr key={`${row.kind}-${row.label}-${rowIdx}`} className={styles.tr}>
                  <td className={cn(styles.label, GROUP_EDGE)} title={row.label}>
                    <span className="line-clamp-2 break-words">{row.label}</span>
                  </td>
                  {numbers.map((num, leafIdx) => (
                    <td
                      key={`${rowIdx}-${num}`}
                      className={cn(
                        styles.cell,
                        MEASURE_COL,
                        groupEnds.has(leafIdx) && GROUP_EDGE
                      )}
                    >
                      {closingStockCellValue(row, leafIdx)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] leading-snug text-[#64748B]">
        Working-paper preview (read-only). Layout mirrors the Excel export. Every Rule Book product
        stays on the sheet even when columns are blank. TOTAL / GRAND TOTAL rows sum filled measures.
      </p>
    </div>
  );
}
