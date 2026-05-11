import { useCallback, useMemo, useState } from 'react';
import { Scale, Loader2, AlertTriangle, Rows3, Download, FileSpreadsheet } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { FileUploadZone } from '../components/upload/FileUploadZone';
import { Button } from '../components/ui/Button';
import { KpiCard } from '../components/cards/KpiCard';
import { EmptyState } from '../components/ui/EmptyState';
import { GrossWeightResultsTable } from '../components/tables/GrossWeightResultsTable';
import toast from 'react-hot-toast';
import { validateGrossWeightExcel } from '../services/processExcelService';
import { formatNumber, formatPercent } from '../utils/format';
import { filterGrossWeightRecords, GROSS_FILTER_LABELS } from '../utils/grossRecordFilters';
import { downloadGrossWeightRecordsXlsx } from '../utils/grossXlsxExport';
import { AuditFilterStrip } from '../components/audit/AuditFilterStrip';

export default function GrossWeight() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [result, setResult] = useState(null);
  const [activeFilter, setActiveFilter] = useState(null);

  const runComparison = useCallback(async () => {
    if (!file) {
      toast.error('Choose an Excel file first.');
      return;
    }
    const ac = new AbortController();
    setLoading(true);
    setResult(null);
    setActiveFilter(null);
    try {
      const data = await validateGrossWeightExcel(file, ac.signal);
      if (data && data.success === false) {
        toast.error(data.detail || 'Comparison failed');
        setResult(null);
        return;
      }
      setResult(data);
      toast.success('Gross weight comparison complete');
    } catch (e) {
      toast.error(e.message || 'Comparison failed');
    } finally {
      setLoading(false);
    }
  }, [file]);

  const rawRecords = result?.records;
  const filteredRecords = useMemo(
    () => filterGrossWeightRecords(rawRecords, activeFilter),
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
      downloadGrossWeightRecordsXlsx(filteredRecords, `gross-weight-rows-${tag}-${Date.now()}.xlsx`);
      toast.success('Excel export downloaded');
    } finally {
      setExporting(false);
    }
  }, [filteredRecords, activeFilter]);

  const summary = result?.summary ?? {};
  const totalRows = result?.totalRows ?? 0;
  const errorRows = result?.errorRows ?? 0;
  const manualAutoMismatch = summary.mismatchCount ?? 0;
  const differenceViolations = summary.differenceViolations ?? 0;
  const negativeViolations = summary.negativeValueViolations ?? 0;
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
              <p className="mt-4 text-sm font-semibold text-slate-800">Comparing weights…</p>
              <p className="mt-1 text-xs text-slate-500">Forwarding multipart upload to gateway</p>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Upload &amp; validate</h2>
              <p className="text-sm text-slate-500">
                Strict manual vs auto gross (±0.01), optional{' '}
                <code className="rounded bg-slate-100 px-1 font-mono text-xs">difference</code> must be 0.00. Connected to{' '}
                <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs">
                  POST /api/v1/process/gross-weight/validate
                </code>
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="md" disabled={loading} onClick={() => setFile(null)}>
                Clear file
              </Button>
              <Button variant="primary" size="md" loading={loading} disabled={loading || !file} onClick={runComparison}>
                <FileSpreadsheet className="h-4 w-4" />
                Run comparison
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardBody>
          <FileUploadZone file={file} onFileChange={setFile} disabled={loading} />
        </CardBody>
      </Card>

      {result ? (
        <>
          <section>
            <h3 className="mb-4 text-base font-semibold text-slate-900">Summary</h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <KpiCard
                label="Total rows"
                value={formatNumber(totalRows)}
                icon={Rows3}
                accent="blue"
                interactive
                selected={activeFilter === 'total'}
                onClick={() => toggleCardFilter('total')}
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
                label="Manual ≠ auto"
                value={formatNumber(manualAutoMismatch)}
                hint="Quantized mismatch"
                icon={Scale}
                accent="rose"
                interactive
                selected={activeFilter === 'grossMismatch'}
                onClick={() => toggleCardFilter('grossMismatch')}
              />
              <KpiCard
                label="Difference ≠ 0"
                value={formatNumber(differenceViolations)}
                hint="After manual=auto match"
                icon={Scale}
                accent="orange"
                interactive
                selected={activeFilter === 'differenceViolation'}
                onClick={() => toggleCardFilter('differenceViolation')}
              />
              <KpiCard
                label="Negative values"
                value={formatNumber(negativeViolations)}
                hint="Manual, auto, or difference"
                icon={Scale}
                accent="violet"
                interactive
                selected={activeFilter === 'negativeWeight'}
                onClick={() => toggleCardFilter('negativeWeight')}
              />
              <KpiCard
                label="Compliance"
                value={compliance != null ? formatPercent(compliance) : '—'}
                hint="Clean rows / total rows"
                icon={Rows3}
                accent="emerald"
                interactive
                selected={activeFilter === 'compliance'}
                onClick={() => toggleCardFilter('compliance')}
              />
            </div>
          </section>

          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Issue register</h3>
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
                    labels={GROSS_FILTER_LABELS}
                    count={filteredRecords.length}
                    onClear={() => setActiveFilter(null)}
                  />
                  <GrossWeightResultsTable data={filteredRecords} />
                </div>
              ) : (
                <EmptyState
                  title="No issues detected"
                  description="Every scanned row satisfied gross-weight checks, or non-data rows were skipped."
                />
              )}
            </CardBody>
          </Card>
        </>
      ) : (
        <EmptyState
          icon={Scale}
          title="Awaiting validation"
          description="Upload an Excel workbook and run comparison to populate summary metrics, issue badges, and exports."
        />
      )}
    </div>
  );
}
