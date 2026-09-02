import { useCallback, useMemo, useState } from 'react';
import {
  ChevronRight,
  Download,
  FileSpreadsheet,
  Gem,
  Package,
  ShoppingCart,
  Table2,
} from 'lucide-react';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { AuditValidationOverlay } from '../components/ui/AuditValidationOverlay';
import { FileUploadZone } from '../components/upload/FileUploadZone';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { AuditSummaryWidget } from '../components/cards/AuditSummaryWidget';
import { AuditSummaryGrid } from '../components/audit/AuditSummaryGrid';
import { EmptyState } from '../components/ui/EmptyState';
import { ClosingStockPreviewTable } from '../components/tables/ClosingStockPreviewTable';
import { AuditSessionBanner } from '../components/audit/AuditSessionBanner';
import { WatchDemoButton } from '../components/demo/WatchDemoButton';
import { Input } from '../components/ui/Input';
import { CLOSING_STOCK_CATEGORIES } from '../config/closingStockLayout';
import { CLOSING_STOCK_AUDIT_CONFIG } from '../config/closingStockAuditConfig';
import { formatNumber } from '../utils/format';
import { formatProcessingErrorHuman } from '../utils/processingErrorUtils';
import { auditToastError, auditToastSuccess } from '../utils/auditToast';
import { useAuditSessionPersistence } from '../hooks/useAuditSessionPersistence';
import { useClosingStockMapping } from '../hooks/useClosingStockMapping';
import { bootstrapAuditSessionState } from '../utils/auditSessionStorage';
import { cn } from '../utils/cn';

const SESSION_KEY = CLOSING_STOCK_AUDIT_CONFIG.sessionKey;

function slimSnapshot(data) {
  if (!data) return null;
  return {
    result: data.result ?? null,
    sheetError: data.sheetError ?? null,
    salesFileName: data.salesFileName ?? null,
    purchasesFileName: data.purchasesFileName ?? null,
    openingQtyFileName: data.openingQtyFileName ?? null,
    previousYearFileName: data.previousYearFileName ?? null,
    companyName: data.companyName ?? '',
    address: data.address ?? '',
    financialYear: data.financialYear ?? CLOSING_STOCK_AUDIT_CONFIG.defaultFinancialYear,
  };
}

export default function FinancialsPivotPage() {
  const [initialSession] = useState(() => bootstrapAuditSessionState(SESSION_KEY));
  const [salesFile, setSalesFile] = useState(null);
  const [purchasesFile, setPurchasesFile] = useState(null);
  const [openingQtyFile, setOpeningQtyFile] = useState(null);
  const [previousYearFile, setPreviousYearFile] = useState(null);
  const [restoredSalesName, setRestoredSalesName] = useState(
    () => initialSession.data?.salesFileName ?? null
  );
  const [restoredPurchasesName, setRestoredPurchasesName] = useState(
    () => initialSession.data?.purchasesFileName ?? null
  );
  const [restoredOpeningQtyName, setRestoredOpeningQtyName] = useState(
    () => initialSession.data?.openingQtyFileName ?? null
  );
  const [restoredPreviousYearName, setRestoredPreviousYearName] = useState(
    () => initialSession.data?.previousYearFileName ?? null
  );
  const [loading, setLoading] = useState(false);
  const [exportingPivots, setExportingPivots] = useState(false);
  const [exportingClosing, setExportingClosing] = useState(false);
  const [result, setResult] = useState(() => initialSession.data?.result ?? null);
  const [sheetError, setSheetError] = useState(() => initialSession.data?.sheetError ?? null);
  const [activeCategory, setActiveCategory] = useState(CLOSING_STOCK_CATEGORIES[0]);
  const [companyName, setCompanyName] = useState(() => initialSession.data?.companyName ?? '');
  const [address, setAddress] = useState(() => initialSession.data?.address ?? '');
  const [financialYear, setFinancialYear] = useState(
    () => initialSession.data?.financialYear ?? CLOSING_STOCK_AUDIT_CONFIG.defaultFinancialYear
  );

  const applySession = useCallback((data) => {
    setResult(data?.result ?? null);
    setSheetError(data?.sheetError ?? null);
    setRestoredSalesName(data?.salesFileName ?? null);
    setRestoredPurchasesName(data?.purchasesFileName ?? null);
    setRestoredOpeningQtyName(data?.openingQtyFileName ?? null);
    setRestoredPreviousYearName(data?.previousYearFileName ?? null);
    setCompanyName(data?.companyName ?? '');
    setAddress(data?.address ?? '');
    setFinancialYear(data?.financialYear ?? CLOSING_STOCK_AUDIT_CONFIG.defaultFinancialYear);
    setSalesFile(null);
    setPurchasesFile(null);
    setOpeningQtyFile(null);
    setPreviousYearFile(null);
  }, []);

  const sessionSnapshot = useMemo(
    () => ({
      result,
      sheetError,
      salesFileName: salesFile?.name ?? restoredSalesName ?? null,
      purchasesFileName: purchasesFile?.name ?? restoredPurchasesName ?? null,
      openingQtyFileName: openingQtyFile?.name ?? restoredOpeningQtyName ?? null,
      previousYearFileName: previousYearFile?.name ?? restoredPreviousYearName ?? null,
      companyName,
      address,
      financialYear,
    }),
    [
      result,
      sheetError,
      salesFile?.name,
      purchasesFile?.name,
      openingQtyFile?.name,
      previousYearFile?.name,
      restoredSalesName,
      restoredPurchasesName,
      restoredOpeningQtyName,
      restoredPreviousYearName,
      companyName,
      address,
      financialYear,
    ]
  );

  const { sessionLabel, sessionMeta, persist, restoreSession, startNewAudit, restoring } =
    useAuditSessionPersistence(SESSION_KEY, sessionSnapshot, {
      transform: slimSnapshot,
      onApplySession: applySession,
      onSaveFailed: () => {
        auditToastError('Could not save results locally. Free browser storage or start a new audit.');
      },
    });

  const displaySales = salesFile ?? (restoredSalesName ? { name: restoredSalesName } : null);
  const displayPurchases =
    purchasesFile ?? (restoredPurchasesName ? { name: restoredPurchasesName } : null);
  const displayOpeningQty =
    openingQtyFile ?? (restoredOpeningQtyName ? { name: restoredOpeningQtyName } : null);
  const displayPreviousYear =
    previousYearFile ?? (restoredPreviousYearName ? { name: restoredPreviousYearName } : null);
  const allReady = Boolean(salesFile && purchasesFile && openingQtyFile && previousYearFile);

  const resetResults = useCallback(() => {
    setSheetError(null);
    setResult(null);
  }, []);

  const runProcess = useCallback(async () => {
    if (!salesFile || !purchasesFile || !openingQtyFile || !previousYearFile) {
      auditToastError(
        'Upload Sales, Purchases, Opening Quantity, and Previous Year Closing files before processing.'
      );
      return;
    }
    setLoading(true);
    try {
      const data = await CLOSING_STOCK_AUDIT_CONFIG.process(
        salesFile,
        purchasesFile,
        openingQtyFile,
        previousYearFile
      );
      if (data && data.success === false) {
        auditToastError(data.detail || 'Processing failed');
        setSheetError(typeof data.error === 'object' ? data : { ...data });
        setResult(null);
        return;
      }
      setResult(data);
      setSheetError(null);
      setActiveCategory(CLOSING_STOCK_CATEGORIES[0]);
      const saved = persist(
        {
          result: data,
          sheetError: null,
          salesFileName: salesFile.name,
          purchasesFileName: purchasesFile.name,
          openingQtyFileName: openingQtyFile.name,
          previousYearFileName: previousYearFile.name,
          companyName,
          address,
          financialYear,
        },
        { notifyOnFailure: true, force: true }
      );
      if (saved === false) {
        auditToastError('Results loaded but could not be saved for later.');
      }
      const mapped = data?.summary?.mappedProductCount ?? data?.summary?.productsDisplayed ?? 0;
      const unmapped = data?.summary?.unmappedProductCount ?? 0;
      const openingMatched = data?.openingStockReport?.matchedCount
        ?? data?.openingStockReport?.quantityMatchedCount
        ?? 0;
      if (mapped > 0) {
        auditToastSuccess(
          `Closing Stock ready — ${mapped} product${mapped === 1 ? '' : 's'} mapped` +
            (openingMatched ? ` · ${openingMatched} Opening matched` : '') +
            (unmapped ? ` (${unmapped} unmapped)` : '')
        );
      } else {
        auditToastError(
          unmapped
            ? `No products matched the Rule Book (${unmapped} unmapped). Check product names.`
            : 'Closing Stock ready but no products were mapped.'
        );
      }
    } catch (e) {
      setSheetError(e.details ?? null);
      setResult(null);
      auditToastError(e.message || 'Processing failed');
    } finally {
      setLoading(false);
    }
  }, [
    salesFile,
    purchasesFile,
    openingQtyFile,
    previousYearFile,
    persist,
    companyName,
    address,
    financialYear,
  ]);

  const salesPivot = useMemo(
    () => (Array.isArray(result?.salesPivot) ? result.salesPivot : []),
    [result]
  );
  const purchasesPivot = useMemo(
    () => (Array.isArray(result?.purchasesPivot) ? result.purchasesPivot : []),
    [result]
  );
  const openingPivot = useMemo(
    () => (Array.isArray(result?.openingPivot) ? result.openingPivot : []),
    [result]
  );
  const handleRuleBookSynced = useCallback((updated) => {
    setResult(updated);
  }, []);

  const { mappedResult, refreshing: remappingRuleBook } = useClosingStockMapping(
    result,
    handleRuleBookSynced
  );
  const openingStockReport = useMemo(() => {
    const base =
      mappedResult?.openingStockReport ||
      result?.openingStockReport ||
      mappedResult?.summary?.openingStockReport ||
      result?.summary?.openingStockReport ||
      {};
    const mappedCount =
      mappedResult?.summary?.productsWithOpeningData ??
      base.mappedToClosingStockCount ??
      (Array.isArray(mappedResult?.mappedOpeningProducts)
        ? mappedResult.mappedOpeningProducts.length
        : undefined);
    if (mappedCount == null) return base;
    return { ...base, mappedToClosingStockCount: mappedCount };
  }, [mappedResult, result]);
  const summary = mappedResult?.summary ?? {};
  const productsByCategory = useMemo(() => {
    const mapped = mappedResult?.productsByCategory;
    if (mapped && typeof mapped === 'object') {
      return mapped;
    }
    return Object.fromEntries(CLOSING_STOCK_CATEGORIES.map((c) => [c, []]));
  }, [mappedResult]);
  const layoutByCategory = useMemo(() => {
    const mapped = mappedResult?.layoutByCategory;
    if (mapped && typeof mapped === 'object') {
      return mapped;
    }
    return Object.fromEntries(CLOSING_STOCK_CATEGORIES.map((c) => [c, []]));
  }, [mappedResult]);
  const unmappedProducts = useMemo(
    () =>
      Array.isArray(mappedResult?.unmappedProducts) ? mappedResult.unmappedProducts : [],
    [mappedResult]
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
  const mappedProductCount = useMemo(
    () =>
      CLOSING_STOCK_CATEGORIES.reduce(
        (total, category) =>
          total +
          (Array.isArray(productsByCategory[category]) ? productsByCategory[category].length : 0),
        0
      ),
    [productsByCategory]
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
    if (!result) {
      auditToastError('Process all four input files first.');
      return;
    }
    setExportingClosing(true);
    try {
      await CLOSING_STOCK_AUDIT_CONFIG.downloadClosingStock({
        salesPivot,
        purchasesPivot,
        openingPivot,
        companyName: companyName.trim(),
        address: address.trim(),
        financialYear: financialYear.trim() || CLOSING_STOCK_AUDIT_CONFIG.defaultFinancialYear,
      });
      auditToastSuccess('Closing Stock workbook downloaded');
    } catch (e) {
      auditToastError(e.message || 'Closing Stock download failed');
    } finally {
      setExportingClosing(false);
    }
  }, [result, salesPivot, purchasesPivot, openingPivot, companyName, address, financialYear]);

  const handleStartNew = useCallback(() => {
    startNewAudit();
    setSalesFile(null);
    setPurchasesFile(null);
    setOpeningQtyFile(null);
    setPreviousYearFile(null);
    setRestoredSalesName(null);
    setRestoredPurchasesName(null);
    setRestoredOpeningQtyName(null);
    setRestoredPreviousYearName(null);
    setCompanyName('');
    setAddress('');
    setFinancialYear(CLOSING_STOCK_AUDIT_CONFIG.defaultFinancialYear);
    setResult(null);
    setSheetError(null);
    setActiveCategory(CLOSING_STOCK_CATEGORIES[0]);
  }, [startNewAudit]);

  return (
    <div className="relative space-y-8">
      <AuditValidationOverlay open={loading} label={CLOSING_STOCK_AUDIT_CONFIG.processOverlayLabel} />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-slate-50">
              {CLOSING_STOCK_AUDIT_CONFIG.pageTitle}
            </h1>
            <Badge tone="amber">{CLOSING_STOCK_AUDIT_CONFIG.badgeLabel}</Badge>
          </div>
          <p className="mt-1 max-w-3xl text-sm text-slate-600 dark:text-slate-400">
            {CLOSING_STOCK_AUDIT_CONFIG.pageSubtitle}
          </p>
        </div>
      </div>

      {result ? (
        <AuditSessionBanner
          sessionMeta={sessionMeta}
          sessionLabel={sessionLabel}
          hasResults={Boolean(result)}
          onRestore={restoreSession}
          onStartNew={handleStartNew}
          restoring={restoring}
        />
      ) : null}

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-emerald-700">Upload &amp; process</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Four files are required. Opening Qty from Opening Balance; Opening Amount from each
                product’s previous-year sheet Closing Balance — then Rule Book layout.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <WatchDemoButton moduleKey={CLOSING_STOCK_AUDIT_CONFIG.demoModuleKey} />
              <Button
                variant="primary"
                size="md"
                loading={loading}
                disabled={loading || !allReady}
                onClick={runProcess}
              >
                <FileSpreadsheet className="h-4 w-4" />
                {CLOSING_STOCK_AUDIT_CONFIG.processLabel}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardBody>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                Upload Sales File
              </div>
              <p className="text-xs text-slate-500">Required · Product, Quantity, Gross Amount</p>
              <FileUploadZone
                file={displaySales}
                accept={CLOSING_STOCK_AUDIT_CONFIG.fileAccept}
                formatHint={CLOSING_STOCK_AUDIT_CONFIG.fileFormatHint}
                onFileChange={(file) => {
                  resetResults();
                  setRestoredSalesName(null);
                  setSalesFile(file);
                }}
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <ShoppingCart className="h-4 w-4 text-violet-600" />
                Upload Purchases File
              </div>
              <p className="text-xs text-slate-500">Required · Product, Quantity, Gross Amount</p>
              <FileUploadZone
                file={displayPurchases}
                accept={CLOSING_STOCK_AUDIT_CONFIG.fileAccept}
                formatHint={CLOSING_STOCK_AUDIT_CONFIG.fileFormatHint}
                onFileChange={(file) => {
                  resetResults();
                  setRestoredPurchasesName(null);
                  setPurchasesFile(file);
                }}
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <Package className="h-4 w-4 text-amber-600" />
                Current Year Opening Quantity
              </div>
              <p className="text-xs text-slate-500">
                Required · Product, SKU, Opening Balance, Receipts, Issues, Closing Balance
              </p>
              <FileUploadZone
                file={displayOpeningQty}
                accept={CLOSING_STOCK_AUDIT_CONFIG.fileAccept}
                formatHint={CLOSING_STOCK_AUDIT_CONFIG.fileFormatHint}
                onFileChange={(file) => {
                  resetResults();
                  setRestoredOpeningQtyName(null);
                  setOpeningQtyFile(file);
                }}
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <Table2 className="h-4 w-4 text-sky-600" />
                Previous Year Closing Stock
              </div>
              <p className="text-xs text-slate-500">
                Required · Closing Stock sheets (Dia / Eme / Prls / Rubi / Prec) with product
                Closing stock Amt
              </p>
              <FileUploadZone
                file={displayPreviousYear}
                accept={CLOSING_STOCK_AUDIT_CONFIG.fileAccept}
                formatHint={CLOSING_STOCK_AUDIT_CONFIG.fileFormatHint}
                onFileChange={(file) => {
                  resetResults();
                  setRestoredPreviousYearName(null);
                  setPreviousYearFile(file);
                }}
                disabled={loading}
              />
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <label className="block space-y-1.5 text-sm">
              <span className="font-semibold text-slate-700 dark:text-slate-200">Company name</span>
              <Input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Optional — printed on Closing Stock sheets"
                disabled={loading}
              />
            </label>
            <label className="block space-y-1.5 text-sm">
              <span className="font-semibold text-slate-700 dark:text-slate-200">Address</span>
              <Input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Optional"
                disabled={loading}
              />
            </label>
            <label className="block space-y-1.5 text-sm">
              <span className="font-semibold text-slate-700 dark:text-slate-200">Financial year</span>
              <Input
                value={financialYear}
                onChange={(e) => setFinancialYear(e.target.value)}
                placeholder={CLOSING_STOCK_AUDIT_CONFIG.defaultFinancialYear}
                disabled={loading}
              />
            </label>
          </div>
          {!allReady ? (
            <p className="mt-4 text-sm text-slate-500">
              Select all four Excel files to enable Process.
            </p>
          ) : null}
        </CardBody>
      </Card>

      {sheetError ? (
        <Card className="border-rose-200/80 bg-rose-50/40 shadow-md">
          <CardHeader>
            <h3 className="text-base font-semibold text-rose-950">Unable to process workbook</h3>
            <p className="mt-1 text-sm text-rose-900/80">
              Headers are detected by column name (Product, Quantity, Gross Amount) — order and
              capitalization do not matter.
            </p>
          </CardHeader>
          <CardBody>
            <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-xl bg-[var(--color-surface-elevated)] p-4 font-mono text-xs text-[var(--color-text-primary)] shadow-inner">
              {formatProcessingErrorHuman(sheetError)}
            </pre>
          </CardBody>
        </Card>
      ) : null}

      {result ? (
        <>
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
            </AuditSummaryGrid>
          </section>

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
                  [
                    'Fallback matched',
                    openingStockReport.fallbackMatchedCount ?? 0,
                  ],
                  [
                    'Quantity mismatch',
                    openingStockReport.quantityMismatchCount ?? 0,
                  ],
                  [
                    'Previous year mapping required',
                    openingStockReport.previousYearMappingRequiredCount ?? 0,
                  ],
                  [
                    'Other unmatched',
                    (openingStockReport.unmatched || []).length,
                  ],
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
              {(openingStockReport.previousYearMappingRequired || []).length ? (
                <details className="rounded-xl border border-violet-200/70 bg-violet-50/50 p-3 dark:border-violet-900/40 dark:bg-violet-950/20">
                  <summary className="cursor-pointer text-sm font-semibold text-violet-950 dark:text-violet-100">
                    Previous year mapping required (
                    {formatNumber(openingStockReport.previousYearMappingRequiredCount ?? 0)})
                  </summary>
                  <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap font-mono text-xs">
                    {(openingStockReport.previousYearMappingRequired || [])
                      .map((row) => `${row.product}: ${row.reason || 'Previous Year Mapping Required'}`)
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
                Download the five-sheet Closing Stock workbook or supporting pivot sheets for
                verification.
              </p>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="flex flex-col gap-3 rounded-xl border border-emerald-200/70 bg-white/80 p-4 dark:border-emerald-900/40 dark:bg-[var(--color-surface-elevated)]/80 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-50">
                    Download Closing Stock
                  </h4>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                    One workbook with sheets: {CLOSING_STOCK_CATEGORIES.join(', ')}. Products are
                    placed by the Rule Book ({formatNumber(mappedProductCount)} mapped particular
                    {mappedProductCount === 1 ? '' : 's'}).
                  </p>
                </div>
                <Button
                  variant="primary"
                  size="md"
                  loading={exportingClosing}
                  disabled={exportingClosing || !result}
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
                    Select a category to inspect its Closing Stock sheet. Every Rule Book product
                    is listed even when Opening/Sales/Purchases measures are blank.
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
                  {CLOSING_STOCK_CATEGORIES.map((category) => {
                    const selected = category === activeCategory;
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
                        <span className={cn('ml-1.5 text-xs font-medium', selected ? 'text-emerald-100' : 'text-slate-400')}>
                          ({count})
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </CardHeader>
            <CardBody>
              <ClosingStockPreviewTable
                category={activeCategory}
                products={activeCategoryProducts}
                layoutRows={activeCategoryLayout}
                financialYear={financialYear || CLOSING_STOCK_AUDIT_CONFIG.defaultFinancialYear}
              />
            </CardBody>
          </Card>
        </>
      ) : !sheetError ? (
        <EmptyState
          icon={Gem}
          title="Awaiting process"
          description="Upload Sales, Purchases, Opening Quantity, and Previous Year Closing files, then Process."
        />
      ) : null}
    </div>
  );
}
