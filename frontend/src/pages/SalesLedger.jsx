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
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { FileUploadZone } from '../components/upload/FileUploadZone';
import { Button } from '../components/ui/Button';
import { KpiCard } from '../components/cards/KpiCard';
import { EmptyState } from '../components/ui/EmptyState';
import { SalesResultsTable } from '../components/tables/SalesResultsTable';
import { validateSalesExcel } from '../services/processExcelService';
import { formatNumber, formatPercent } from '../utils/format';
import { formatProcessingErrorHuman } from '../utils/processingErrorUtils';
import { dedupeSalesRecordsByRowNumber } from '../utils/dedupeSalesRecords';
import { filterSalesRecords, SALES_FILTER_LABELS } from '../utils/salesRecordFilters';
import { downloadSalesRecordsXlsx } from '../utils/salesXlsxExport';
import { AuditFilterStrip } from '../components/audit/AuditFilterStrip';
import { useAuditSessionPersistence } from '../hooks/useAuditSessionPersistence';
import {
  AUDIT_SESSION_RETENTION_DAYS,
  readAuditSessionData,
  slimSalesLedgerSnapshot,
} from '../utils/auditSessionStorage';

const SALES_LEDGER_SESSION_KEY = 'sales-ledger';

export default function SalesLedger() {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
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

  const sessionSnapshot = useMemo(
    () => ({
      result,
      sheetError,
      activeFilter,
      fileName: file?.name ?? null,
    }),
    [result, sheetError, activeFilter, file?.name]
  );

  const { sessionLabel, persist } = useAuditSessionPersistence(
    SALES_LEDGER_SESSION_KEY,
    sessionSnapshot,
    {
      transform: slimSalesLedgerSnapshot,
      onSaveFailed: () => {
        toast.error('Audit results are too large to keep in the browser. Export the Excel file to keep a copy.');
      },
    }
  );

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

  const rawRecords = useMemo(
    () => dedupeSalesRecordsByRowNumber(result?.records),
    [result?.records]
  );
  const filteredRecords = useMemo(
    () => filterSalesRecords(rawRecords, activeFilter),
    [rawRecords, activeFilter]
  );

  const toggleCardFilter = useCallback((key) => {
    setActiveFilter((prev) => (prev === key ? null : key));
  }, []);

  const runExport = useCallback(() => {
    if (!filteredRecords.length) {
      toast.error('No rows to export.');
      return;
    }
    setExporting(true);
    try {
      const tag = activeFilter ? `filtered-${activeFilter}` : 'all';
      downloadSalesRecordsXlsx(filteredRecords, `sales-rows-${tag}-${Date.now()}.xlsx`);
      toast.success('Excel export downloaded');
    } finally {
      setExporting(false);
    }
  }, [filteredRecords, activeFilter]);

  const summary = result?.summary ?? {};
  const totalRows = result?.totalRows ?? 0;
  const errorRows =
    summary.distinctInvalidRows ??
    summary.errorRowsCount ??
    result?.errorRows ??
    rawRecords.filter((r) => (Array.isArray(r.issues) ? r.issues.length : 0) > 0).length;
  const catVsProduct = summary.invalidProductMappings ?? summary.salesAccountProductMismatches ?? 0;
  const rateViolations = summary.rateDeviationViolations ?? 0;
  const accessoriesUnitRateCount = filterSalesRecords(rawRecords, 'accessoriesUnitRate').length;
  const caratGemErrors =
    summary.invalidUomRows ??
    summary.caratGemErrorRows ??
    filterSalesRecords(rawRecords, 'caratGemErrors').length;
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
            <div className="flex flex-col items-center rounded-2xl border border-white/40 bg-white/90 px-10 py-8 shadow-2xl">
              <Loader2 className="h-10 w-10 animate-spin text-emerald-600" />
              <p className="mt-4 text-sm font-semibold text-slate-800">Validating ledger…</p>
              <p className="mt-1 text-xs text-slate-500">
                Large ledgers (4k+ rows) usually finish in under a minute. Keep Node and Python running.
              </p>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {result ? (
        <p className="rounded-xl border border-emerald-200/80 bg-emerald-50/60 px-4 py-2.5 text-sm text-emerald-900">
          {sessionLabel || 'Previous audit results restored.'} — kept for {AUDIT_SESSION_RETENTION_DAYS} days when you switch tabs.
        </p>
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
            file={file}
            onFileChange={(f) => {
              setSheetError(null);
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
            <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-xl bg-white/90 p-4 font-mono text-xs text-slate-800 shadow-inner">
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
                  <h3 className="text-base font-bold text-emerald-700">Issue register</h3>
                  <p className="text-sm text-slate-500">TanStack Table · sort · paginate · CSV & PDF export</p>
                </div>
                <Button
                  variant="primary"
                  size="md"
                  loading={exporting}
                  disabled={exporting || filteredRecords.length === 0}
                  onClick={runExport}
                >
                  <Download className="h-4 w-4" />
                  Export invalid rows (.xlsx)
                </Button>
              </div>
            </CardHeader>
            <CardBody>
              {result.records?.length || activeFilter != null ? (
                <div className="space-y-4">
                  <AuditFilterStrip
                    activeFilter={activeFilter}
                    labels={SALES_FILTER_LABELS}
                    count={filteredRecords.length}
                    onClear={() => setActiveFilter(null)}
                  />
                  <SalesResultsTable data={filteredRecords} />
                </div>
              ) : (
                <EmptyState
                  title="No issues detected"
                  description="Every evaluated row satisfied sales-account and gross-weight checks for this upload."
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
