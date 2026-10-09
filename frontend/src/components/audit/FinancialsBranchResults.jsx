import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChevronRight,
  Download,
  FileSpreadsheet,
  Gem,
  Package,
  ShoppingCart,
  Table2,
} from 'lucide-react';
import { Card, CardBody, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';
import { AuditSummaryWidget } from '../cards/AuditSummaryWidget';
import { AuditSummaryGrid } from './AuditSummaryGrid';
import { ClosingStockPreviewTable } from '../tables/ClosingStockPreviewTable';
import { AbstractPreviewTable } from '../tables/AbstractPreviewTable';
import { TradingAccountPreview } from '../tables/TradingAccountPreview';
import { ABSTRACT_SHEET_NAME } from '../../config/abstractLayout';
import { TRADING_SHEET_NAME } from '../../config/tradingAccountLayout';
import { OpeningStockManualMappingPanel, applyManualOpeningMapping } from './OpeningStockManualMappingPanel';
import { CLOSING_STOCK_CATEGORIES } from '../../config/closingStockLayout';
import { CLOSING_STOCK_AUDIT_CONFIG } from '../../config/closingStockAuditConfig';
import { formatNumber } from '../../utils/format';
import { auditToastError, auditToastSuccess } from '../../utils/auditToast';
import { useClosingStockMapping } from '../../hooks/useClosingStockMapping';
import { useFinancialsBranchView } from '../../hooks/useFinancialsBranchView';
import { buildSalesPurchasesOnlyLayout, mergeRemapIntoResult } from '../../utils/closingStockProductMapping';
import { fetchClosingStockRuleBook, remapClosingStockFromPivots } from '../../services/financials.service';
import { cn } from '../../utils/cn';
import { readSourceAverageRates } from '../../utils/sourceAverageRates';
import { readReceiptRateMappings, saveReceiptRateMapping } from '../../utils/receiptRateMappings';
import { ReceiptRateManualMappingPanel } from './ReceiptRateManualMappingPanel';

const PREVIEW_SHEETS = [...CLOSING_STOCK_CATEGORIES, TRADING_SHEET_NAME, ABSTRACT_SHEET_NAME];

const TRANSFER_PIVOT_LOCATIONS = [
  { key: 'jubileeHills', title: 'Jubilee Hills' },
  { key: 'kokapet', title: 'Kokapet' },
  { key: 'internalBasheerbagh', title: 'Internal / Basheerbagh' },
];

function TransferLocationPivots({ heading, sourceLabel, tree }) {
  return (
    <Card>
      <CardHeader>
        <h3 className="text-base font-bold text-emerald-700">{heading}</h3>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          {sourceLabel} stays separate. Each location is Product, Sum of Quantity, Sum of Gross
          Amount.
        </p>
      </CardHeader>
      <CardBody>
        <div className="grid gap-4 lg:grid-cols-3">
          {TRANSFER_PIVOT_LOCATIONS.map(({ key, title }) => {
            const rows = Array.isArray(tree?.[key]) ? tree[key] : [];
            return (
              <div
                key={`${sourceLabel}-${key}`}
                className="overflow-hidden rounded-xl border border-slate-200/80 bg-white/80 dark:border-slate-700 dark:bg-slate-900/30"
              >
                <div className="border-b border-slate-200/80 px-3 py-2 dark:border-slate-700">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                    {sourceLabel} – {title}
                  </p>
                  <p className="text-xs text-slate-500">{formatNumber(rows.length)} products</p>
                </div>
                <div className="max-h-72 overflow-auto">
                  <table className="min-w-full text-left text-xs">
                    <thead className="sticky top-0 bg-slate-50 dark:bg-slate-900">
                      <tr>
                        <th className="px-3 py-2 font-semibold">Product</th>
                        <th className="px-3 py-2 font-semibold">Sum of Quantity</th>
                        <th className="px-3 py-2 font-semibold">Sum of Gross Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.length ? (
                        rows.map((row) => (
                          <tr
                            key={`${sourceLabel}-${key}-${row.product}`}
                            className="border-t border-slate-100 dark:border-slate-800"
                          >
                            <td className="px-3 py-1.5">{row.product}</td>
                            <td className="px-3 py-1.5 tabular-nums">
                              {formatNumber(row.sumOfQuantity ?? 0, 4)}
                            </td>
                            <td className="px-3 py-1.5 tabular-nums">
                              {formatNumber(row.sumOfGross ?? 0, 2)}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td className="px-3 py-3 text-slate-500" colSpan={3}>
                            No rows for this location.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      </CardBody>
    </Card>
  );
}

const EMPTY_LOCATION_PIVOTS = {
  jubileeHills: [],
  kokapet: [],
  internalBasheerbagh: [],
};

export function FinancialsBranchResults({
  result,
  onResultUpdate,
  resultsId,
  branchHeading,
  financialYear,
  companyName,
  address,
  omitMrDc = false,
  salesPurchasesOnly = false,
  destinationBranch = 'basheerbagh',
}) {
  const [activeCategory, setActiveCategory] = useState(CLOSING_STOCK_CATEGORIES[0]);
  const [exportingPivots, setExportingPivots] = useState(false);
  const [exportingClosing, setExportingClosing] = useState(false);
  const [salesPurchasesRuleBook, setSalesPurchasesRuleBook] = useState(null);

  const sheetResult = useMemo(() => {
    if (!result || !omitMrDc) return result;
    return {
      ...result,
      mrPivots: EMPTY_LOCATION_PIVOTS,
      dcPivots: EMPTY_LOCATION_PIVOTS,
      mrReport: {},
      dcReport: {},
    };
  }, [result, omitMrDc]);

  const handleRuleBookSynced = useCallback(
    (updated) => {
      onResultUpdate?.(updated);
    },
    [onResultUpdate]
  );

  useEffect(() => {
    if (!salesPurchasesOnly) return undefined;
    let cancelled = false;
    fetchClosingStockRuleBook()
      .then((live) => {
        if (!cancelled) setSalesPurchasesRuleBook(live?.ruleBook || null);
      })
      .catch(() => {
        if (!cancelled) setSalesPurchasesRuleBook(null);
      });
    return () => {
      cancelled = true;
    };
  }, [salesPurchasesOnly]);

  const salesPurchasesView = useMemo(
    () =>
      salesPurchasesOnly ? buildSalesPurchasesOnlyLayout(result, salesPurchasesRuleBook) : null,
    [salesPurchasesOnly, result, salesPurchasesRuleBook]
  );
  const { mappedResult, refreshing: remappingRuleBook } = useClosingStockMapping(
    salesPurchasesOnly ? null : sheetResult,
    salesPurchasesOnly ? undefined : handleRuleBookSynced,
    destinationBranch
  );
  const {
    salesPivot,
    purchasesPivot,
    openingPivot,
    mrPivots,
    dcPivots,
    openingStockReport,
    summary,
    productsByCategory,
    layoutByCategory,
    unmappedProducts,
    mappedProductCount,
  } = useFinancialsBranchView(
    salesPurchasesOnly ? null : sheetResult,
    salesPurchasesOnly ? salesPurchasesView : mappedResult
  );

  const activeCategoryProducts = useMemo(
    () =>
      Array.isArray(productsByCategory[activeCategory])
        ? productsByCategory[activeCategory]
        : [],
    [productsByCategory, activeCategory]
  );
  const activeCategoryLayout = useMemo(
    () =>
      Array.isArray(layoutByCategory[activeCategory]) ? layoutByCategory[activeCategory] : [],
    [layoutByCategory, activeCategory]
  );

  const handleDownloadPivots = useCallback(async () => {
    if (!salesPivot.length && !purchasesPivot.length) {
      auditToastError('No pivot rows to download.');
      return;
    }
    setExportingPivots(true);
    try {
      await CLOSING_STOCK_AUDIT_CONFIG.downloadPivots({
        salesPivot,
        purchasesPivot,
      });
      auditToastSuccess('Pivots workbook downloaded');
    } catch (e) {
      auditToastError(e.message || 'Pivot download failed');
    } finally {
      setExportingPivots(false);
    }
  }, [salesPivot, purchasesPivot]);

  const handleDownloadClosingStock = useCallback(async () => {
    if (salesPurchasesOnly || !result) {
      auditToastError('Process all six input files first.');
      return;
    }
    setExportingClosing(true);
    try {
      await CLOSING_STOCK_AUDIT_CONFIG.downloadClosingStock({
        salesPivot,
        purchasesPivot,
        openingPivot,
        mrPivots,
        dcPivots,
        companyName: companyName.trim(),
        address: address.trim(),
        financialYear: financialYear.trim() || CLOSING_STOCK_AUDIT_CONFIG.defaultFinancialYear,
        destinationBranch,
          sourceAverageRates: readSourceAverageRates(),
          receiptRateMappings: readReceiptRateMappings(destinationBranch),
        });
      auditToastSuccess('Closing Stock workbook downloaded');
    } catch (e) {
      auditToastError(e.message || 'Closing Stock download failed');
    } finally {
      setExportingClosing(false);
    }
  }, [salesPurchasesOnly, result, salesPivot, purchasesPivot, openingPivot, mrPivots, dcPivots, companyName, address, financialYear, destinationBranch]);

  const handleConfirmManualOpeningMapping = useCallback(
    (mapping) => {
      onResultUpdate?.((prev) => {
        if (!prev) return prev;
        return applyManualOpeningMapping(prev, mapping);
      });
    },
    [onResultUpdate]
  );

  return (
    <div id={resultsId} className="scroll-mt-24 space-y-8">
      {branchHeading ? (
        <h2 className="text-lg font-bold text-emerald-800 dark:text-emerald-300">{branchHeading}</h2>
      ) : null}
      <ReceiptRateManualMappingPanel
        rows={mappedResult?.receiptAmountReview}
        onConfirmMapping={async (mapping) => {
          try {
            saveReceiptRateMapping(destinationBranch, mapping);
            const remapped = await remapClosingStockFromPivots({
              salesPivot,
              purchasesPivot,
              openingPivot,
              mrPivots,
              dcPivots,
              destinationBranch,
              sourceAverageRates: readSourceAverageRates(),
              receiptRateMappings: readReceiptRateMappings(destinationBranch),
            });
            onResultUpdate?.(mergeRemapIntoResult(result, remapped));
            auditToastSuccess(`Average rate mapped for ${mapping.product}`);
          } catch (error) {
            auditToastError(error.message || 'Could not map the average rate.');
          }
        }}
      />
      <section>
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.14em] text-emerald-700/90">
          Audit intelligence summary
        </h3>
        <AuditSummaryGrid>
          <AuditSummaryWidget
            label="Sales products"
            value={formatNumber(summary.salesProductCount ?? salesPivot.length)}
            icon={Package}
            accent="emerald"
          />
          <AuditSummaryWidget
            label="Sales quantity"
            value={formatNumber(summary.salesTotalQuantity ?? 0, 2)}
            icon={Table2}
            accent="blue"
          />
          <AuditSummaryWidget
            label="Sales gross"
            value={formatNumber(summary.salesTotalGross ?? 0, 2)}
            icon={FileSpreadsheet}
            accent="violet"
          />
          <AuditSummaryWidget
            label="Purchases products"
            value={formatNumber(summary.purchasesProductCount ?? purchasesPivot.length)}
            icon={ShoppingCart}
            accent="amber"
          />
          <AuditSummaryWidget
            label="Purchases quantity"
            value={formatNumber(summary.purchasesTotalQuantity ?? 0, 2)}
            icon={Table2}
            accent="blue"
          />
          <AuditSummaryWidget
            label="Purchases gross"
            value={formatNumber(summary.purchasesTotalGross ?? 0, 2)}
            icon={FileSpreadsheet}
            accent="rose"
          />
          <AuditSummaryWidget
            label="Opening matched"
            value={formatNumber(
              openingStockReport.matchedCount ?? openingStockReport.quantityMatchedCount ?? 0
            )}
            icon={Package}
            accent="emerald"
          />
          <AuditSummaryWidget
            label="Opening unmatched"
            value={formatNumber(
              openingStockReport.unmatchedCount
                ?? openingStockReport.missingFromPreviousYearFileCount
                ?? 0
            )}
            icon={Package}
            accent="rose"
          />
          <AuditSummaryWidget
            label="Opening qty total"
            value={formatNumber(
              openingStockReport.totalOpeningQty ?? summary.openingTotalQuantity ?? 0,
              2
            )}
            icon={Table2}
            accent="amber"
          />
          <AuditSummaryWidget
            label="Opening amount total"
            value={formatNumber(
              openingStockReport.totalOpeningAmount ?? summary.openingTotalAmount ?? 0,
              2
            )}
            icon={FileSpreadsheet}
            accent="violet"
          />
          {!omitMrDc ? (
            <>
          <AuditSummaryWidget
            label="MR classified"
            value={formatNumber(
              summary.mrClassifiedRows
                ?? mappedResult?.mrReport?.classifiedRowCount
                ?? result?.mrReport?.classifiedRowCount
                ?? 0
            )}
            icon={Package}
            accent="emerald"
          />
          <AuditSummaryWidget
            label="MR unclassified"
            value={formatNumber(
              summary.mrUnclassifiedRows
                ?? mappedResult?.mrReport?.unclassifiedCount
                ?? result?.mrReport?.unclassifiedCount
                ?? 0
            )}
            icon={Package}
            accent="rose"
          />
          <AuditSummaryWidget
            label="DC classified"
            value={formatNumber(
              summary.dcClassifiedRows
                ?? mappedResult?.dcReport?.classifiedRowCount
                ?? result?.dcReport?.classifiedRowCount
                ?? 0
            )}
            icon={ShoppingCart}
            accent="amber"
          />
          <AuditSummaryWidget
            label="DC unclassified"
            value={formatNumber(
              summary.dcUnclassifiedRows
                ?? mappedResult?.dcReport?.unclassifiedCount
                ?? result?.dcReport?.unclassifiedCount
                ?? 0
            )}
            icon={ShoppingCart}
            accent="rose"
          />
            </>
          ) : null}
        </AuditSummaryGrid>
      </section>

      {!omitMrDc ? (
        <>
          <TransferLocationPivots heading="MR pivots" sourceLabel="MR" tree={mrPivots} />
          <TransferLocationPivots heading="DC pivots" sourceLabel="DC" tree={dcPivots} />
        </>
      ) : null}

      <Card className="border-sky-200/80 bg-sky-50/40 dark:border-sky-900/40 dark:bg-sky-950/20">
        <CardHeader>
          <h3 className="text-base font-semibold text-sky-950 dark:text-sky-100">
            Opening Stock mapping
          </h3>
          <p className="mt-1 text-sm text-sky-900/80 dark:text-sky-200/80">
            Qty from the Quantity file Opening Balance. Amount from that product&apos;s
            Closing stock Amt on the previous-year Closing Stock sheets (not TOTAL rows).
          </p>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {[
              [
                'Exact matched',
                openingStockReport.exactMatchedCount ?? openingStockReport.matchedCount ?? 0,
              ],
              ['Fallback matched', openingStockReport.fallbackMatchedCount ?? 0],
              [
                'Manual mapping required',
                openingStockReport.manualMappingRequiredCount
                  ?? openingStockReport.previousYearMappingRequiredCount
                  ?? 0,
              ],
              ['Other unmatched', (openingStockReport.unmatched || []).length],
              [
                'Mapped to Closing Stock',
                openingStockReport.mappedToClosingStockCount
                  ?? summary.productsWithOpeningData
                  ?? 0,
              ],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-xl border border-sky-200/70 bg-white/80 px-3 py-2.5 dark:border-sky-900/50 dark:bg-slate-900/40"
              >
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
                <p className="mt-1 text-lg font-bold tabular-nums text-slate-900 dark:text-slate-50">
                  {formatNumber(value)}
                </p>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-slate-700 dark:text-slate-300">
            <span>
              Total Opening Qty:{' '}
              <strong className="tabular-nums">
                {formatNumber(
                  openingStockReport.totalOpeningQty ?? summary.openingTotalQuantity ?? 0,
                  2
                )}
              </strong>
            </span>
            <span>
              Total Opening Amount:{' '}
              <strong className="tabular-nums">
                {formatNumber(
                  openingStockReport.totalOpeningAmount ?? summary.openingTotalAmount ?? 0,
                  2
                )}
              </strong>
            </span>
          </div>
          {(openingStockReport.fallbackMatched || []).length ? (
            <details className="rounded-xl border border-emerald-200/70 bg-emerald-50/50 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/20">
              <summary className="cursor-pointer text-sm font-semibold text-emerald-950 dark:text-emerald-100">
                Fallback matched (
                {formatNumber(openingStockReport.fallbackMatchedCount ?? 0)})
              </summary>
              <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap font-mono text-xs">
                {(openingStockReport.fallbackMatched || [])
                  .map(
                    (row) =>
                      `${row.product} ← [${(row.previousYearProducts || []).join(' + ')}] qty=${row.openingQty} amt=${row.openingAmt}`
                  )
                  .join('\n')}
              </pre>
            </details>
          ) : null}
          <OpeningStockManualMappingPanel
            rows={openingStockReport.manualMappingRequired || []}
            onConfirmMapping={handleConfirmManualOpeningMapping}
          />
          {(openingStockReport.quantityMismatch || []).length ? (
            <details className="rounded-xl border border-rose-200/70 bg-rose-50/50 p-3 dark:border-rose-900/40 dark:bg-rose-950/20">
              <summary className="cursor-pointer text-sm font-semibold text-rose-950 dark:text-rose-100">
                Quantity mismatches (
                {formatNumber(openingStockReport.quantityMismatchCount ?? 0)})
              </summary>
              <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap font-mono text-xs">
                {(openingStockReport.quantityMismatch || [])
                  .map(
                    (row) =>
                      `${row.product}: Opening ${row.openingQty} ≠ Previous ${row.previousClosingQty}`
                  )
                  .join('\n')}
              </pre>
            </details>
          ) : null}
          {(openingStockReport.unmatched || openingStockReport.missingFromPreviousYearFile || [])
            .length ? (
            <details className="rounded-xl border border-amber-200/80 bg-amber-50/60 p-3 dark:border-amber-900/40 dark:bg-amber-950/20">
              <summary className="cursor-pointer text-sm font-semibold text-amber-950 dark:text-amber-100">
                Unmatched products (
                {formatNumber(
                  openingStockReport.unmatchedCount
                    ?? openingStockReport.missingFromPreviousYearFileCount
                    ?? 0
                )}
                )
              </summary>
              <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap font-mono text-xs text-slate-800 dark:text-slate-200">
                {(
                  openingStockReport.unmatched
                  || openingStockReport.missingFromPreviousYearFile
                  || []
                )
                  .map(
                    (row) =>
                      `${row.product}: ${row.reason || 'unmatched'}${
                        row.sheetName ? ` (sheet: ${row.sheetName})` : ''
                      }`
                  )
                  .join('\n')}
              </pre>
            </details>
          ) : null}
        </CardBody>
      </Card>

      {unmappedProducts.length ? (
        <Card className="border-amber-200/80 bg-amber-50/50 dark:border-amber-900/40 dark:bg-amber-950/20">
          <CardHeader>
            <h3 className="text-base font-semibold text-amber-950 dark:text-amber-100">
              Unmapped products ({formatNumber(unmappedProducts.length)})
            </h3>
            <p className="mt-1 text-sm text-amber-900/80 dark:text-amber-200/80">
              These pivot products were not found in the Closing Stock Rule Book and are not shown
              on any sheet. Add them to the Rule Book JSON if they belong in Closing Stock.
            </p>
          </CardHeader>
          <CardBody>
            <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-xl bg-[var(--color-surface-elevated)] p-3 font-mono text-xs text-[var(--color-text-primary)]">
              {unmappedProducts.join('\n')}
            </pre>
          </CardBody>
        </Card>
      ) : null}

      <Card className="border-emerald-200/70 bg-gradient-to-br from-emerald-50/80 to-white shadow-md dark:from-emerald-950/20 dark:to-[var(--color-surface-elevated)]">
        <CardHeader>
          <h3 className="text-base font-bold text-emerald-800 dark:text-emerald-300">
            Downloads
          </h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Download the Closing Stock workbook (five category sheets plus Trading and
            Abstract) or supporting pivot sheets for verification.
          </p>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="flex flex-col gap-3 rounded-xl border border-emerald-200/70 bg-white/80 p-4 dark:border-emerald-900/40 dark:bg-[var(--color-surface-elevated)]/80 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-50">
                Download Closing Stock
              </h4>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                One workbook with sheets: {CLOSING_STOCK_CATEGORIES.join(', ')},{' '}
                {TRADING_SHEET_NAME}, {ABSTRACT_SHEET_NAME}. Products are placed by the Rule Book (
                {formatNumber(mappedProductCount)} mapped particular
                {mappedProductCount === 1 ? '' : 's'}).
              </p>
            </div>
            <Button
              variant="primary"
              size="md"
              loading={exportingClosing}
              disabled={exportingClosing || !result || salesPurchasesOnly}
              onClick={handleDownloadClosingStock}
            >
              <Gem className="h-4 w-4" />
              Download Closing Stock
            </Button>
          </div>

          <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-4 dark:border-slate-700 dark:bg-slate-900/20">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-50">
                  Download Pivots
                </h4>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                  Supporting intermediate data — Excel workbook with two sheets:
                </p>
                <ul className="mt-2 space-y-1 text-xs text-slate-700 dark:text-slate-300">
                  <li className="flex items-center gap-1.5">
                    <ChevronRight className="h-3 w-3 text-emerald-600" />
                    Sales Pivot
                  </li>
                  <li className="flex items-center gap-1.5">
                    <ChevronRight className="h-3 w-3 text-emerald-600" />
                    Purchases Pivot
                  </li>
                </ul>
              </div>
              <Button
                variant="secondary"
                size="md"
                loading={exportingPivots}
                disabled={exportingPivots || (!salesPivot.length && !purchasesPivot.length)}
                onClick={handleDownloadPivots}
              >
                <Download className="h-4 w-4" />
                Download Pivots → Excel Workbook
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <div className="space-y-4">
            <div>
              <h3 className="text-base font-bold text-emerald-700">Closing Stock preview</h3>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                {omitMrDc
                  ? 'Same Closing Stock, Trading, and Abstract sheets as Basheerbagh. Sales, Purchases, and Opening Stock are filled; MR and DC stay blank.'
                  : 'Select a category to inspect its Closing Stock sheet, Trading for the T-account layout, or Abstract for the Trading Account Abstract. Each branch lists only the products in its own Sales, Purchases, and Opening Stock.'}
                {remappingRuleBook ? ' Refreshing Rule Book…' : ''}
              </p>
              {summary.ruleBookProductTotal ? (
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  Rule Book: {formatNumber(summary.ruleBookProductTotal)} products · With
                  Opening: {formatNumber(summary.productsWithOpeningData ?? 0)} · With Sales:{' '}
                  {formatNumber(summary.productsWithSalesData ?? 0)} · With Purchases:{' '}
                  {formatNumber(summary.productsWithPurchaseData ?? 0)} · Displayed:{' '}
                  {formatNumber(summary.productsDisplayed ?? mappedProductCount)}
                </p>
              ) : null}
            </div>
            <div
              className="flex flex-wrap gap-1 rounded-xl border border-slate-200/80 bg-slate-50/80 p-1 dark:border-slate-700 dark:bg-slate-900/30"
              role="tablist"
              aria-label="Closing Stock category"
            >
              {PREVIEW_SHEETS.map((category) => {
                const selected = category === activeCategory;
                const isNonCategory =
                  category === TRADING_SHEET_NAME || category === ABSTRACT_SHEET_NAME;
                const count = Array.isArray(productsByCategory[category])
                  ? productsByCategory[category].length
                  : 0;
                return (
                  <button
                    key={category}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    onClick={() => setActiveCategory(category)}
                    className={cn(
                      'rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors',
                      selected
                        ? 'bg-emerald-700 text-white shadow-sm'
                        : 'text-slate-600 hover:bg-white hover:text-emerald-800 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-emerald-200'
                    )}
                  >
                    {category}
                    {isNonCategory ? null : (
                      <span className={cn('ml-1.5 text-xs font-medium', selected ? 'text-emerald-100' : 'text-slate-400')}>
                        ({count})
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </CardHeader>
        <CardBody>
          {activeCategory === TRADING_SHEET_NAME ? (
            <TradingAccountPreview
              layoutByCategory={layoutByCategory}
              salesPivot={salesPivot}
              purchasesPivot={purchasesPivot}
              openingPivot={openingPivot}
              mrPivots={mrPivots}
              dcPivots={dcPivots}
              blankValues={salesPurchasesOnly}
            />
          ) : activeCategory === ABSTRACT_SHEET_NAME ? (
            <AbstractPreviewTable
              layoutByCategory={layoutByCategory}
              salesPivot={salesPivot}
              purchasesPivot={purchasesPivot}
              openingPivot={openingPivot}
              mrPivots={mrPivots}
              dcPivots={dcPivots}
              blankValues={salesPurchasesOnly}
            />
          ) : (
            <ClosingStockPreviewTable
              category={activeCategory}
              products={activeCategoryProducts}
              layoutRows={activeCategoryLayout}
              financialYear={financialYear || CLOSING_STOCK_AUDIT_CONFIG.defaultFinancialYear}
            />
          )}
        </CardBody>
      </Card>
    </div>
  );
}
