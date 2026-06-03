import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen,
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

export default function SalesLedger() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [result, setResult] = useState(null);
  const [sheetError, setSheetError] = useState(null);
  const [activeFilter, setActiveFilter] = useState(null);

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
      toast.success('Sales validation complete');
    } catch (e) {
      const payload = e.details ?? null;
      setSheetError(payload);
      toast.error(e.message || 'Validation failed');
    } finally {
      setLoading(false);
    }
  }, [file]);

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
  const caratGemErrors =
    summary.invalidUomRows ??
    summary.caratGemErrorRows ??
    filterSalesRecords(rawRecords, 'caratGemErrors').length;
  const compliance =
    totalRows > 0 ? Math.max(0, Math.min(100, ((totalRows - errorRows) / totalRows) * 100)) : null;

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
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <KpiCard
                label="Total rows"
                value={formatNumber(totalRows)}
                icon={Rows3}
                accent="blue"
              />
              <KpiCard
                label="Error rows"
                value={formatNumber(errorRows)}
                icon={AlertTriangle}
                accent="amber"
                interactive
                selected={activeFilter === 'errors'}
                onClick={() => toggleCardFilter('errors')}
              />
              <KpiCard
                label="Account vs product"
                value={formatNumber(catVsProduct)}
                hint="Classifier mismatch / missing category"
                icon={BookOpen}
                accent="rose"
                interactive
                selected={activeFilter === 'accountVsProduct'}
                onClick={() => toggleCardFilter('accountVsProduct')}
              />
              <KpiCard
                label="Range deviations"
                value={formatNumber(rateViolations)}
                hint="Unit rate outside allowed range"
                icon={BookOpen}
                accent="amber"
                interactive
                selected={activeFilter === 'mixedLedgers'}
                onClick={() => toggleCardFilter('mixedLedgers')}
              />
              <KpiCard
                label="Unit of measurement deviations"
                value={formatNumber(caratGemErrors)}
                hint="Invalid UOM on rows"
                icon={Gem}
                accent="violet"
                interactive
                selected={activeFilter === 'caratGemErrors'}
                onClick={() => toggleCardFilter('caratGemErrors')}
              />
              <KpiCard
                label="Compliance"
                value={compliance != null ? formatPercent(compliance) : '—'}
                hint="Clean rows / total rows"
                icon={Rows3}
                accent="emerald"
              />
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
