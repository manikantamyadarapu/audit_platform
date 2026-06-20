import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  BookOpen,
  BarChart3,
  Coins,
  Gem,
  AlertTriangle,
  Rows3,
  Download,
  FileSpreadsheet,
  FileText,
  Info,
} from 'lucide-react';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { AuditValidationOverlay } from '../components/ui/AuditValidationOverlay';
import { FileUploadZone } from '../components/upload/FileUploadZone';
import { Button } from '../components/ui/Button';
import { KpiCard } from '../components/cards/KpiCard';
import { AuditSummaryWidget } from '../components/cards/AuditSummaryWidget';
import { AuditSummaryGrid } from '../components/audit/AuditSummaryGrid';
import { EmptyState } from '../components/ui/EmptyState';
import { AuditUploadResultsTable } from '../components/tables/AuditUploadResultsTable';
import { validateSalesExcel } from '../services/processExcelService';
import { formatNumber, formatPercent } from '../utils/format';
import { formatProcessingErrorHuman } from '../utils/processingErrorUtils';
import { filterSalesRecords, SALES_FILTER_LABELS } from '../utils/salesRecordFilters';
import { exportRowsToCsv } from '../utils/csvExport';
import { exportRowsToPdf } from '../utils/pdfExport';
import { downloadAuditExceptionXlsx } from '../utils/salesReturnXlsxExport';
import {
  buildExportColumnDefs,
  resolveAuditColumnOrder,
} from '../utils/auditTableColumns';
import { auditToastError, auditToastSuccess } from '../utils/auditToast';
import { cn } from '../utils/cn';
import { AuditFilterStrip } from '../components/audit/AuditFilterStrip';
import { AuditSessionBanner } from '../components/audit/AuditSessionBanner';
import { useAuditSessionPersistence } from '../hooks/useAuditSessionPersistence';
import {
  bootstrapAuditSessionState,
  slimSalesLedgerSnapshot,
} from '../utils/auditSessionStorage';
import { fetchRateRules } from '../services/rateRuleService';
import { hasConfiguredRateRules } from '../utils/metalRateRules';

const SALES_LEDGER_SESSION_KEY = 'sales-ledger';

export default function SalesLedger() {
  const navigate = useNavigate();
  const location = useLocation();
  const [initialSession] = useState(() => bootstrapAuditSessionState(SALES_LEDGER_SESSION_KEY));
  const [file, setFile] = useState(null);
  const [restoredFileName, setRestoredFileName] = useState(
    () => initialSession.data?.fileName ?? null
  );
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [result, setResult] = useState(() => initialSession.data?.result ?? null);
  const [sheetError, setSheetError] = useState(() => initialSession.data?.sheetError ?? null);
  const [activeFilter, setActiveFilter] = useState(
    () => initialSession.data?.activeFilter ?? null
  );
  const [rateRulesReady, setRateRulesReady] = useState(false);
  const [rateRulesLoading, setRateRulesLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    setRateRulesLoading(true);
    fetchRateRules(controller.signal)
      .then((data) => {
        setRateRulesReady(hasConfiguredRateRules(data));
      })
      .catch(() => {
        setRateRulesReady(false);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setRateRulesLoading(false);
        }
      });
    return () => controller.abort();
  }, [location.key]);

  const applySession = useCallback((data) => {
    setResult(data?.result ?? null);
    setSheetError(data?.sheetError ?? null);
    setActiveFilter(data?.activeFilter ?? null);
    setRestoredFileName(data?.fileName ?? null);
    setFile(null);
  }, []);

  const sessionSnapshot = useMemo(
    () => ({
      result,
      sheetError,
      activeFilter,
      fileName: file?.name ?? restoredFileName ?? null,
    }),
    [result, sheetError, activeFilter, file?.name, restoredFileName]
  );

  const {
    sessionLabel,
    sessionMeta,
    persist,
    restoreSession,
    startNewAudit,
    restoring,
  } = useAuditSessionPersistence(SALES_LEDGER_SESSION_KEY, sessionSnapshot, {
    transform: slimSalesLedgerSnapshot,
    onApplySession: applySession,
    onSaveFailed: () => {
      auditToastError('Could not save audit results locally. Free browser storage or start a new audit.');
    },
  });

  const displayFile = file ?? (restoredFileName ? { name: restoredFileName } : null);

  const runValidation = useCallback(async () => {
    if (!file) {
      auditToastError('Choose an Excel file first.');
      return;
    }
    if (!rateRulesReady) {
      auditToastError('Please save gold & silver rates before running the audit.');
      return;
    }
    setLoading(true);
    try {
      const data = await validateSalesExcel(file);
      if (data && data.success === false) {
        auditToastError(data.detail || 'Validation failed');
        setSheetError(typeof data.error === 'object' ? data : { ...data });
        return;
      }
      setResult(data);
      setSheetError(null);
      setActiveFilter(null);
      const saved = persist(
        {
          result: data,
          sheetError: null,
          activeFilter: null,
          fileName: file?.name ?? null,
        },
        { notifyOnFailure: true, force: true }
      );
      if (saved === false) {
        auditToastError('Results loaded but could not be saved for later.');
      }
      auditToastSuccess('Sales validation complete');
    } catch (e) {
      const payload = e.details ?? null;
      setSheetError(payload);
      auditToastError(e.message || 'Validation failed');
    } finally {
      setLoading(false);
    }
  }, [file, persist, rateRulesReady]);

  const exceptionRecords = useMemo(() => {
    const rows = result?.exceptionRecords ?? result?.records ?? [];
    return Array.isArray(rows) ? rows : [];
  }, [result]);

  const exceptionColumnOrder = useMemo(
    () =>
      exceptionRecords.length
        ? resolveAuditColumnOrder(
            exceptionRecords,
            result?.exportColumns,
            result?.columnDisplayHeaders
          )
        : [],
    [exceptionRecords, result?.exportColumns, result?.columnDisplayHeaders]
  );

  const filteredRecords = useMemo(
    () => filterSalesRecords(exceptionRecords, activeFilter),
    [exceptionRecords, activeFilter]
  );

  const exportFilteredColumnOrder = useMemo(() => {
    if (!filteredRecords.length) return exceptionColumnOrder;
    return exceptionColumnOrder.filter((key) => {
      if (key === 'Message') return true;
      return key in filteredRecords[0];
    });
  }, [filteredRecords, exceptionColumnOrder]);

  const exportFilteredColumns = useMemo(
    () => buildExportColumnDefs(exportFilteredColumnOrder, filteredRecords),
    [exportFilteredColumnOrder, filteredRecords]
  );

  const toggleCardFilter = useCallback((key) => {
    setActiveFilter((prev) => (prev === key ? null : key));
  }, []);

  const runExportExcel = useCallback(() => {
    if (!filteredRecords.length) {
      auditToastError('No rows to export.');
      return;
    }
    setExporting(true);
    try {
      const tag = activeFilter ? `filtered-${activeFilter}` : 'all';
      downloadAuditExceptionXlsx(
        filteredRecords,
        exportFilteredColumnOrder,
        `sales-ledger-exceptions-${tag}-${Date.now()}.xlsx`,
        'Exception report',
        result?.exportColumns,
        result?.columnDisplayHeaders
      );
      auditToastSuccess('Excel export downloaded');
    } finally {
      setExporting(false);
    }
  }, [
    filteredRecords,
    activeFilter,
    exportFilteredColumnOrder,
    result?.exportColumns,
    result?.columnDisplayHeaders,
  ]);

  const runExportCsv = useCallback(() => {
    if (!filteredRecords.length) {
      auditToastError('No rows to export.');
      return;
    }
    const tag = activeFilter ? `filtered-${activeFilter}` : 'all';
    exportRowsToCsv(
      `sales-ledger-exceptions-${tag}-${Date.now()}.csv`,
      exportFilteredColumns,
      filteredRecords
    );
    auditToastSuccess('CSV export downloaded');
  }, [filteredRecords, activeFilter, exportFilteredColumns]);

  const runExportPdf = useCallback(() => {
    if (!filteredRecords.length) {
      auditToastError('No rows to export.');
      return;
    }
    const tag = activeFilter ? `filtered-${activeFilter}` : 'all';
    exportRowsToPdf(
      `sales-ledger-exceptions-${tag}-${Date.now()}.pdf`,
      'Rate and ledger audit — exception report',
      exportFilteredColumns,
      filteredRecords
    );
    auditToastSuccess('PDF export downloaded');
  }, [filteredRecords, activeFilter, exportFilteredColumns]);

  const summary = result?.summary ?? {};
  const totalRows = result?.totalRows ?? 0;
  const errorRows =
    summary.distinctInvalidRows ??
    summary.errorRowsCount ??
    result?.errorRows ??
    exceptionRecords.length;
  const catVsProduct = summary.invalidProductMappings ?? summary.salesAccountProductMismatches ?? 0;
  const rateViolations = summary.rateDeviationViolations ?? 0;
  const accessoriesUnitRateCount = filterSalesRecords(exceptionRecords, 'accessoriesUnitRate').length;
  const caratGemErrors =
    summary.invalidUomRows ??
    summary.caratGemErrorRows ??
    filterSalesRecords(exceptionRecords, 'caratGemErrors').length;
  const compliance =
    totalRows > 0 ? Math.max(0, Math.min(100, ((totalRows - errorRows) / totalRows) * 100)) : null;
  const productAverageCount =
    result?.productAverages?.length ?? summary.productAverageCount ?? 0;

  return (
    <div className="relative space-y-8">
      <AuditValidationOverlay open={loading} />

      {result ? (
        <AuditSessionBanner
          sessionMeta={sessionMeta}
          sessionLabel={sessionLabel}
          hasResults={Boolean(result)}
          onRestore={restoreSession}
          onStartNew={startNewAudit}
          restoring={restoring}
        />
      ) : null}

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-emerald-700">Upload &amp; validate</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                {rateRulesLoading
                  ? 'Checking gold & silver rate book…'
                  : rateRulesReady
                    ? 'Gold & silver rates are saved. Upload your ledger and run validation.'
                    : 'Please save gold & silver rates before running the audit.'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                to="/scrutiny/rate-rule-book"
                state={{ returnTo: '/scrutiny/sales-ledger' }}
                className={cn(
                  'inline-flex h-12 items-center gap-2 rounded-full border px-5 text-sm font-semibold transition',
                  rateRulesLoading
                    ? 'border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400'
                    : rateRulesReady
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:border-emerald-400 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200'
                      : 'border-rose-300 bg-rose-50 text-rose-800 hover:border-rose-400 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200'
                )}
              >
                <Coins className="h-4 w-4" />
                Gold and silver rates
              </Link>
              <Button
                variant="primary"
                size="md"
                loading={loading}
                disabled={loading || !file || rateRulesLoading || !rateRulesReady}
                onClick={runValidation}
              >
                <FileSpreadsheet className="h-4 w-4" />
                Run validation
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardBody className="space-y-4">
          {!rateRulesLoading && !rateRulesReady ? (
            <div className="flex gap-3 rounded-xl border border-amber-200/80 bg-amber-50/80 px-4 py-3 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium">Save gold & silver rates first</p>
                <p className="mt-1 text-amber-900/85 dark:text-amber-100/85">
                  Open{' '}
                  <Link to="/scrutiny/rate-rule-book" state={{ returnTo: '/scrutiny/sales-ledger' }} className="font-semibold underline">
                    Gold and silver rates
                  </Link>{' '}
                  and save min/max ranges before you upload and validate the ledger.
                </p>
              </div>
            </div>
          ) : null}
          <FileUploadZone
            file={displayFile}
            onFileChange={(f) => {
              setSheetError(null);
              setRestoredFileName(null);
              setResult(null);
              setActiveFilter(null);
              setFile(f);
            }}
            disabled={loading}
          />
        </CardBody>
      </Card>

      <section>
        <h3 className="mb-4 text-base font-bold text-emerald-700">Analytics</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <KpiCard
            label="Product Average Rates"
            value={result ? formatNumber(productAverageCount) : 'View'}
            hint={
              result
                ? 'Products with gross/qty averages from this run'
                : 'Open stored product-wise average unit rates'
            }
            icon={BarChart3}
            accent="violet"
            interactive
            onClick={() => navigate('/sales-audit/product-average-rates')}
          />
        </div>
      </section>

      {sheetError ? (
        <Card className="border-rose-200/80 bg-rose-50/40 shadow-md">
          <CardHeader>
            <h3 className="text-base font-semibold text-rose-950">Sheet did not match required layout</h3>
            <p className="mt-1 text-sm text-rose-900/80">
              Fix the workbook using the checklist below.
            </p>
          </CardHeader>
          <CardBody className="space-y-4">
            <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-xl bg-[var(--color-surface-elevated)] p-4 font-mono text-xs text-[var(--color-text-primary)] shadow-inner">
              {formatProcessingErrorHuman(sheetError)}
            </pre>
            {sheetError.error ? (
              <details className="rounded-xl border border-slate-200/80 bg-white/80 px-4 py-3 text-sm">
                <summary className="cursor-pointer font-medium text-slate-700">Technical: error payload</summary>
                <pre className="mt-3 max-h-48 overflow-auto text-xs text-slate-600">
                  {JSON.stringify(sheetError.error, null, 2)}
                </pre>
              </details>
            ) : null}
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
                label="Total rows"
                value={formatNumber(totalRows)}
                icon={Rows3}
                accent="blue"
                importance="secondary"
              />
              <AuditSummaryWidget
                label="Error rows"
                value={formatNumber(errorRows)}
                icon={AlertTriangle}
                accent="amber"
                variant="error"
                importance="critical"
                total={totalRows}
                interactive
                selected={activeFilter === 'errors'}
                onClick={() => toggleCardFilter('errors')}
              />
              <AuditSummaryWidget
                label="Account vs product"
                value={formatNumber(catVsProduct)}
                icon={BookOpen}
                accent="rose"
                importance="secondary"
                total={totalRows}
                interactive
                selected={activeFilter === 'accountVsProduct'}
                onClick={() => toggleCardFilter('accountVsProduct')}
              />
              <AuditSummaryWidget
                label="Range deviations"
                value={formatNumber(rateViolations)}
                icon={BookOpen}
                accent="amber"
                variant="deviation"
                importance="secondary"
                total={totalRows}
                interactive
                selected={activeFilter === 'mixedLedgers'}
                onClick={() => toggleCardFilter('mixedLedgers')}
              />
              <AuditSummaryWidget
                label="Accessories Unit Rate Check"
                value={formatNumber(accessoriesUnitRateCount)}
                icon={BookOpen}
                accent="amber"
                importance="secondary"
                total={totalRows}
                interactive
                selected={activeFilter === 'accessoriesUnitRate'}
                onClick={() => toggleCardFilter('accessoriesUnitRate')}
              />
              <AuditSummaryWidget
                label="Unit of measurement deviations"
                value={formatNumber(caratGemErrors)}
                icon={Gem}
                accent="violet"
                importance="secondary"
                total={totalRows}
                interactive
                selected={activeFilter === 'caratGemErrors'}
                onClick={() => toggleCardFilter('caratGemErrors')}
              />
              <AuditSummaryWidget
                label="Compliance"
                value={compliance != null ? formatPercent(compliance) : '—'}
                icon={Rows3}
                accent="emerald"
                variant="compliance"
                importance="critical"
              />
            </AuditSummaryGrid>
          </section>

          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h3 className="text-base font-bold text-emerald-700">Exception report</h3>
                  <p className="text-sm text-slate-500">
                    Original upload columns preserved with Message (issue codes) appended.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="primary"
                    size="md"
                    loading={exporting}
                    disabled={exporting || filteredRecords.length === 0}
                    onClick={runExportExcel}
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                    Export Excel
                  </Button>
                  <Button
                    variant="secondary"
                    size="md"
                    disabled={exporting || filteredRecords.length === 0}
                    onClick={runExportCsv}
                  >
                    <Download className="h-4 w-4" />
                    Export CSV
                  </Button>
                  <Button
                    variant="secondary"
                    size="md"
                    disabled={exporting || filteredRecords.length === 0}
                    onClick={runExportPdf}
                  >
                    <FileText className="h-4 w-4" />
                    Export PDF
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardBody>
              {exceptionRecords.length || activeFilter != null ? (
                <div className="space-y-4">
                  <AuditFilterStrip
                    activeFilter={activeFilter}
                    labels={SALES_FILTER_LABELS}
                    count={filteredRecords.length}
                    onClear={() => setActiveFilter(null)}
                  />
                  {filteredRecords.length ? (
                    <AuditUploadResultsTable
                      data={filteredRecords}
                      columnOrder={exportFilteredColumnOrder}
                      exportColumns={result?.exportColumns}
                      columnDisplayHeaders={result?.columnDisplayHeaders}
                      searchPlaceholder="Search exception rows…"
                    />
                  ) : (
                    <EmptyState
                      title="No rows for this filter"
                      description="Clear the filter or choose a different issue category."
                    />
                  )}
                </div>
              ) : (
                <EmptyState
                  title="No issues detected"
                  description="Every evaluated row passed validation for this upload."
                />
              )}
            </CardBody>
          </Card>
        </>
      ) : !sheetError ? (
        <EmptyState
          icon={BookOpen}
          title="Awaiting validation"
          description="Upload an Excel ledger and run validation to populate summary metrics, issue badges, and exports."
        />
      ) : null}
    </div>
  );
}
