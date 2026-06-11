import { useCallback, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  BookOpen,
  BarChart3,
  Coins,
  Gem,
  Loader2,
  AlertTriangle,
  Rows3,
  Download,
  FileSpreadsheet,
  FileText,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { FileUploadZone } from '../components/upload/FileUploadZone';
import { Button } from '../components/ui/Button';
import { KpiCard } from '../components/cards/KpiCard';
import { EmptyState } from '../components/ui/EmptyState';
import { SalesReturnExceptionTable } from '../components/tables/SalesReturnExceptionTable';
import { validateSalesExcel } from '../services/processExcelService';
import { formatNumber, formatPercent } from '../utils/format';
import { formatProcessingErrorHuman } from '../utils/processingErrorUtils';
import { filterSalesRecords, SALES_FILTER_LABELS } from '../utils/salesRecordFilters';
import { exportRowsToCsv } from '../utils/csvExport';
import { exportRowsToPdf } from '../utils/pdfExport';
import {
  downloadAuditExceptionXlsx,
  resolveAuditExportColumns,
} from '../utils/salesReturnXlsxExport';
import { AuditFilterStrip } from '../components/audit/AuditFilterStrip';
import { AuditSessionBanner } from '../components/audit/AuditSessionBanner';
import { useAuditSessionPersistence } from '../hooks/useAuditSessionPersistence';
import {
  readAuditSessionData,
  slimSalesLedgerSnapshot,
} from '../utils/auditSessionStorage';

const SALES_LEDGER_SESSION_KEY = 'sales-ledger';

export default function SalesLedger() {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [restoredFileName, setRestoredFileName] = useState(
    () => readAuditSessionData(SALES_LEDGER_SESSION_KEY)?.fileName ?? null
  );
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [result, setResult] = useState(
    () => readAuditSessionData(SALES_LEDGER_SESSION_KEY)?.result ?? null
  );
  const [sheetError, setSheetError] = useState(
    () => readAuditSessionData(SALES_LEDGER_SESSION_KEY)?.sheetError ?? null
  );
  const [activeFilter, setActiveFilter] = useState(
    () => readAuditSessionData(SALES_LEDGER_SESSION_KEY)?.activeFilter ?? null
  );

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
  });

  const displayFile = file ?? (restoredFileName ? { name: restoredFileName } : null);

  const runValidation = useCallback(async () => {
    if (!file) {
      toast.error('Choose an Excel file first.');
      return;
    }
    const ac = new AbortController();
    setLoading(true);
    setResult(null);
    setSheetError(null);
    setActiveFilter(null);
    try {
      const data = await validateSalesExcel(file, ac.signal);
      if (data && data.success === false) {
        toast.error(data.detail || 'Validation failed');
        setSheetError(typeof data.error === 'object' ? data : { ...data });
        setResult(null);
        return;
      }
      setResult(data);
      persist({
        result: data,
        sheetError: null,
        activeFilter: null,
        fileName: file?.name ?? null,
      });
      toast.success('Sales validation complete');
    } catch (e) {
      const payload = e.details ?? null;
      setSheetError(payload);
      toast.error(e.message || 'Validation failed');
    } finally {
      setLoading(false);
    }
  }, [file, persist]);

  const exceptionRecords = useMemo(
    () => result?.exceptionRecords ?? result?.records ?? [],
    [result]
  );

  const exceptionColumnOrder = useMemo(
    () =>
      exceptionRecords.length
        ? resolveAuditExportColumns(
            exceptionRecords,
            result?.exportColumns,
            result?.columnDisplayHeaders
          )
        : null,
    [exceptionRecords, result?.exportColumns, result?.columnDisplayHeaders]
  );

  const exceptionExportColumns = useMemo(() => {
    if (!exceptionRecords.length) return [];
    const keys = exceptionColumnOrder?.length
      ? exceptionColumnOrder
      : Object.keys(exceptionRecords[0]);
    return keys.map((header) => ({
      header,
      accessor: (row) => row[header] ?? '',
    }));
  }, [exceptionRecords, exceptionColumnOrder]);

  const filteredRecords = useMemo(
    () => filterSalesRecords(exceptionRecords, activeFilter),
    [exceptionRecords, activeFilter]
  );

  const toggleCardFilter = useCallback((key) => {
    setActiveFilter((prev) => (prev === key ? null : key));
  }, []);

  const exportFilteredColumnOrder = useMemo(() => {
    if (!filteredRecords.length) return exceptionColumnOrder;
    const keys = exceptionColumnOrder?.length
      ? exceptionColumnOrder
      : Object.keys(filteredRecords[0]);
    return keys.filter((key) => key in filteredRecords[0]);
  }, [filteredRecords, exceptionColumnOrder]);

  const exportFilteredColumns = useMemo(() => {
    const order = exportFilteredColumnOrder ?? [];
    return order.map((header) => ({
      header,
      accessor: (row) => row[header] ?? '',
    }));
  }, [exportFilteredColumnOrder]);

  const runExportExcel = useCallback(() => {
    if (!filteredRecords.length) {
      toast.error('No rows to export.');
      return;
    }
    setExporting(true);
    try {
      const tag = activeFilter ? `filtered-${activeFilter}` : 'all';
      downloadAuditExceptionXlsx(
        filteredRecords,
        exportFilteredColumnOrder,
        `sales-ledger-exceptions-${tag}-${Date.now()}.xlsx`
      );
      toast.success('Excel export downloaded');
    } finally {
      setExporting(false);
    }
  }, [filteredRecords, activeFilter, exportFilteredColumnOrder]);

  const runExportCsv = useCallback(() => {
    if (!filteredRecords.length) {
      toast.error('No rows to export.');
      return;
    }
    const tag = activeFilter ? `filtered-${activeFilter}` : 'all';
    exportRowsToCsv(
      `sales-ledger-exceptions-${tag}-${Date.now()}.csv`,
      exportFilteredColumns,
      filteredRecords
    );
    toast.success('CSV export downloaded');
  }, [filteredRecords, activeFilter, exportFilteredColumns]);

  const runExportPdf = useCallback(() => {
    if (!filteredRecords.length) {
      toast.error('No rows to export.');
      return;
    }
    const tag = activeFilter ? `filtered-${activeFilter}` : 'all';
    exportRowsToPdf(
      `sales-ledger-exceptions-${tag}-${Date.now()}.pdf`,
      'Rate and ledger audit — exception report',
      exportFilteredColumns,
      filteredRecords
    );
    toast.success('PDF export downloaded');
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
      <AnimatePresence>
        {loading ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/25 backdrop-blur-sm"
          >
            <div className="flex flex-col items-center rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-surface-overlay)] px-10 py-8 shadow-2xl backdrop-blur-sm">
              <Loader2 className="h-10 w-10 animate-spin text-emerald-600 dark:text-emerald-400" />
              <p className="mt-4 text-sm font-semibold text-[var(--color-text-primary)]">Validating ledger…</p>
              <p className="mt-1 text-xs text-slate-500">
                Large ledgers (4k+ rows) usually finish in under a minute. Keep Node and Python running.
              </p>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

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

            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                to="/scrutiny/rate-rule-book"
                className="inline-flex h-12 items-center gap-2 rounded-full border border-slate-200 bg-white px-5 text-sm font-medium text-slate-700 transition hover:border-emerald-200 hover:bg-emerald-50/50 hover:text-emerald-800"
              >
                <Coins className="h-4 w-4" />
                Gold & silver rates
              </Link>
              <Button variant="primary" size="md" loading={loading} disabled={loading || !file} onClick={runValidation}>
                <FileSpreadsheet className="h-4 w-4" />
                Run validation
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardBody>
          <FileUploadZone
            file={displayFile}
            onFileChange={(f) => {
              setSheetError(null);
              setRestoredFileName(null);
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
            <h3 className="mb-4 text-base font-bold text-emerald-700">Summary</h3>
            <div className="flex flex-wrap items-stretch gap-4">
              <div className="min-w-[190px]  h-[120px]">
                <KpiCard
                  label="Total rows"
                  value={formatNumber(totalRows)}
                  icon={Rows3}
                  accent="blue"
                />
              </div>

              <div className="min-w-[190px]  h-[120px]">
                <KpiCard
                  label="Error rows"
                  value={formatNumber(errorRows)}
                  icon={AlertTriangle}
                  accent="amber"
                  interactive
                  selected={activeFilter === 'errors'}
                  onClick={() => toggleCardFilter('errors')}
                />
              </div>

              <div className="min-w-[190px]  h-[120px]">
                <KpiCard
                  label="Account vs product"
                  value={formatNumber(catVsProduct)}
                  icon={BookOpen}
                  accent="rose"
                  interactive
                  selected={activeFilter === 'accountVsProduct'}
                  onClick={() => toggleCardFilter('accountVsProduct')}
                />
              </div>

              <div className="min-w-[190px]  h-[120px]">
                <KpiCard
                  label="Range deviations"
                  value={formatNumber(rateViolations)}
                  icon={BookOpen}
                  accent="amber"
                  interactive
                  selected={activeFilter === 'mixedLedgers'}
                  onClick={() => toggleCardFilter('mixedLedgers')}
                />
              </div>

              <div className="min-w-[190px]  h-[120px]">
                <KpiCard
                  label="Accessories Unit Rate Check"
                  value={formatNumber(accessoriesUnitRateCount)}
                  icon={BookOpen}
                  accent="amber"
                  interactive
                  selected={activeFilter === 'accessoriesUnitRate'}
                  onClick={() => toggleCardFilter('accessoriesUnitRate')}
                />
              </div>

              <div className="min-w-[190px] h-[120px]">
                <KpiCard
                  label="Unit of measurement deviations"
                  value={formatNumber(caratGemErrors)}
                  icon={Gem}
                  accent="violet"
                  interactive
                  selected={activeFilter === 'caratGemErrors'}
                  onClick={() => toggleCardFilter('caratGemErrors')}
                />
              </div>

              <div className="min-w-[190px]  h-[120px]">
                <KpiCard
                  label="Compliance"
                  value={compliance != null ? formatPercent(compliance) : '—'}
                  icon={Rows3}
                  accent="emerald"
                />
              </div>
            </div>
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
                    <SalesReturnExceptionTable
                      data={filteredRecords}
                      columnOrder={exportFilteredColumnOrder}
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
