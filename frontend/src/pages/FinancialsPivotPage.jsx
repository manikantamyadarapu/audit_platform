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
import {
  downloadClosingStockTemplate,
  downloadFinancialsPivots,
  processFinancialsPivot,
} from '../services/financials.service';
import { CLOSING_STOCK_CATEGORIES } from '../config/closingStockLayout';
import { formatNumber } from '../utils/format';
import { formatProcessingErrorHuman } from '../utils/processingErrorUtils';
import { auditToastError, auditToastSuccess } from '../utils/auditToast';
import { useAuditSessionPersistence } from '../hooks/useAuditSessionPersistence';
import { bootstrapAuditSessionState } from '../utils/auditSessionStorage';
import { ensureClosingStockMapping } from '../utils/closingStockProductMapping';
import { cn } from '../utils/cn';

const SESSION_KEY = 'financials-sales-purchases';

function slimSnapshot(data) {
  if (!data) return null;
  return {
    result: data.result ?? null,
    sheetError: data.sheetError ?? null,
    salesFileName: data.salesFileName ?? null,
    purchasesFileName: data.purchasesFileName ?? null,
  };
}

export default function FinancialsPivotPage() {
  const [initialSession] = useState(() => bootstrapAuditSessionState(SESSION_KEY));
  const [salesFile, setSalesFile] = useState(null);
  const [purchasesFile, setPurchasesFile] = useState(null);
  const [restoredSalesName, setRestoredSalesName] = useState(
    () => initialSession.data?.salesFileName ?? null
  );
  const [restoredPurchasesName, setRestoredPurchasesName] = useState(
    () => initialSession.data?.purchasesFileName ?? null
  );
  const [loading, setLoading] = useState(false);
  const [exportingPivots, setExportingPivots] = useState(false);
  const [exportingClosing, setExportingClosing] = useState(false);
  const [result, setResult] = useState(() =>
    ensureClosingStockMapping(initialSession.data?.result ?? null)
  );
  const [sheetError, setSheetError] = useState(() => initialSession.data?.sheetError ?? null);
  const [activeCategory, setActiveCategory] = useState(CLOSING_STOCK_CATEGORIES[0]);

  const applySession = useCallback((data) => {
    setResult(ensureClosingStockMapping(data?.result ?? null));
    setSheetError(data?.sheetError ?? null);
    setRestoredSalesName(data?.salesFileName ?? null);
    setRestoredPurchasesName(data?.purchasesFileName ?? null);
    setSalesFile(null);
    setPurchasesFile(null);
  }, []);

  const sessionSnapshot = useMemo(
    () => ({
      result,
      sheetError,
      salesFileName: salesFile?.name ?? restoredSalesName ?? null,
      purchasesFileName: purchasesFile?.name ?? restoredPurchasesName ?? null,
    }),
    [result, sheetError, salesFile?.name, purchasesFile?.name, restoredSalesName, restoredPurchasesName]
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
  const bothReady = Boolean(salesFile && purchasesFile);

  const resetResults = useCallback(() => {
    setSheetError(null);
    setResult(null);
  }, []);

  const runProcess = useCallback(async () => {
    if (!salesFile || !purchasesFile) {
      auditToastError('Upload both the Sales file and the Purchases file before processing.');
      return;
    }
    setLoading(true);
    try {
      const data = await processFinancialsPivot(salesFile, purchasesFile);
      if (data && data.success === false) {
        auditToastError(data.detail || 'Processing failed');
        setSheetError(typeof data.error === 'object' ? data : { ...data });
        setResult(null);
        return;
      }
      setResult(ensureClosingStockMapping(data));
      setSheetError(null);
      setActiveCategory(CLOSING_STOCK_CATEGORIES[0]);
      const enriched = ensureClosingStockMapping(data);
      const saved = persist(
        {
          result: enriched,
          sheetError: null,
          salesFileName: salesFile.name,
          purchasesFileName: purchasesFile.name,
        },
        { notifyOnFailure: true, force: true }
      );
      if (saved === false) {
        auditToastError('Results loaded but could not be saved for later.');
      }
      const mapped = enriched?.summary?.mappedProductCount ?? 0;
      const unmapped = enriched?.summary?.unmappedProductCount ?? 0;
      if (mapped > 0) {
        auditToastSuccess(
          `Closing Stock ready — ${mapped} product${mapped === 1 ? '' : 's'} mapped` +
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
  }, [salesFile, purchasesFile, persist]);

  const salesPivot = useMemo(
    () => (Array.isArray(result?.salesPivot) ? result.salesPivot : []),
    [result]
  );
  const purchasesPivot = useMemo(
    () => (Array.isArray(result?.purchasesPivot) ? result.purchasesPivot : []),
    [result]
  );
  const mappedResult = useMemo(() => ensureClosingStockMapping(result), [result]);
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
      await downloadFinancialsPivots({
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
      auditToastError('Process Sales and Purchases first.');
      return;
    }
    setExportingClosing(true);
    try {
      await downloadClosingStockTemplate({
        salesPivot,
        purchasesPivot,
        financialYear: 'AY 2025-26',
      });
      auditToastSuccess('Closing Stock workbook downloaded');
    } catch (e) {
      auditToastError(e.message || 'Closing Stock download failed');
    } finally {
      setExportingClosing(false);
    }
  }, [result, salesPivot, purchasesPivot]);

  const handleStartNew = useCallback(() => {
    startNewAudit();
    setSalesFile(null);
    setPurchasesFile(null);
    setRestoredSalesName(null);
    setRestoredPurchasesName(null);
    setResult(null);
    setSheetError(null);
    setActiveCategory(CLOSING_STOCK_CATEGORIES[0]);
  }, [startNewAudit]);

  return (
    <div className="relative space-y-8">
      <AuditValidationOverlay open={loading} label="Building Sales and Purchases pivots…" />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-slate-50">
              Closing Stock
            </h1>
            <Badge tone="amber">Template stage</Badge>
          </div>
          <p className="mt-1 max-w-3xl text-sm text-slate-600 dark:text-slate-400">
            Upload Sales and Purchases files. Product pivots are mapped to Diamond, Emerald, Pearls,
            Rubie, and Precious and Semi Precious sheets using the Closing Stock product Rule Book.
            Qty/Amt values stay blank until calculations are implemented.
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
                Both files are required. Sales and Purchases are pivoted independently — they are
                never combined.
              </p>
            </div>
            <Button
              variant="primary"
              size="md"
              loading={loading}
              disabled={loading || !bothReady}
              onClick={runProcess}
            >
              <FileSpreadsheet className="h-4 w-4" />
              Process
            </Button>
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
                onFileChange={(file) => {
                  resetResults();
                  setRestoredPurchasesName(null);
                  setPurchasesFile(file);
                }}
                disabled={loading}
              />
            </div>
          </div>
          {!bothReady ? (
            <p className="mt-4 text-sm text-slate-500">
              Select both Excel files to enable Process.
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
            </AuditSummaryGrid>
          </section>

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
                    Select a category to inspect its Closing Stock sheet. Only products listed under
                    that group in the Rule Book appear here.
                  </p>
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
                financialYear="AY 2025-26"
              />
            </CardBody>
          </Card>
        </>
      ) : !sheetError ? (
        <EmptyState
          icon={Gem}
          title="Awaiting process"
          description="Upload Sales and Purchases files, then Process to map products onto Closing Stock category sheets via the Rule Book."
        />
      ) : null}
    </div>
  );
}
