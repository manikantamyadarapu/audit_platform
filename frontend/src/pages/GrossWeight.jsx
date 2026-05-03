import { useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Rows3,
  Scale,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { FileUploadZone } from '../components/upload/FileUploadZone';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { GrossWeightResultsTable } from '../components/tables/GrossWeightResultsTable';
import { EmptyState } from '../components/ui/EmptyState';
import { KpiCard } from '../components/cards/KpiCard';
import { exportInvalidGrossWeightRows, validateGrossWeightExcel } from '../services/grossWeightService';
import { formatNumber } from '../utils/format';
import { useAppUi } from '../context/AppUiContext';

export default function GrossWeight() {
  const { recordGrossWeightValidation, recordExport } = useAppUi();
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [result, setResult] = useState(null);

  const runValidate = useCallback(async () => {
    if (!file) {
      toast.error('Choose an Excel file first.');
      return;
    }
    const ac = new AbortController();
    setLoading(true);
    setResult(null);
    try {
      const data = await validateGrossWeightExcel(file, ac.signal);
      if (data && data.success === false) {
        toast.error(data.detail || 'Validation failed');
        setResult(null);
        return;
      }
      setResult(data);
      recordGrossWeightValidation({
        totalRows: data.totalRows,
        errorRows: data.errorRows,
      });
      toast.success('Gross weight validation complete');
    } catch (e) {
      toast.error(e.message || 'Validation failed');
    } finally {
      setLoading(false);
    }
  }, [file, recordGrossWeightValidation]);

  const runExportXlsx = useCallback(async () => {
    const all = Array.isArray(result?.records) ? result.records : [];
    const invalidOnly = all.filter((r) => r?.status === 'invalid');
    if (!invalidOnly.length) {
      toast.error('No invalid rows to export.');
      return;
    }
    const ac = new AbortController();
    setExporting(true);
    try {
      const { blob, filename } = await exportInvalidGrossWeightRows(invalidOnly, ac.signal);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      recordExport('Gross weight invalid rows exported (.xlsx)');
      toast.success('Excel export downloaded');
    } catch (e) {
      toast.error(e.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  }, [result, recordExport]);

  const summary = result?.summary ?? {};
  const total = summary.total ?? result?.totalRows ?? 0;
  const valid = summary.valid ?? 0;
  const invalid = summary.invalid ?? result?.errorRows ?? 0;
  const mismatchCount = summary.mismatchCount ?? 0;
  const rows = Array.isArray(result?.records) ? result.records : [];

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
              <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
              <p className="mt-4 text-sm font-semibold text-slate-800">Scanning vouchers…</p>
              <p className="mt-1 text-xs text-slate-500">Forwarding multipart upload to the API gateway</p>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-wrap items-center gap-3">
        <h2 className="text-2xl font-semibold text-slate-900">Gross weight audit</h2>
        <p className="text-sm text-slate-500">
          Table-style exports with headers such as{' '}
          <span className="font-mono text-xs">SNo</span>, <span className="font-mono text-xs">Manual Gross wt.</span>,{' '}
          <span className="font-mono text-xs">Auto Gross Wt.</span>, <span className="font-mono text-xs">Difference in Gross wt.</span>{' '}
          (voucher and weights on the same row), or the legacy layout where <span className="font-mono text-xs">Voucher No:</span>{' '}
          sits on its own row with values on the row below (columns B–D).
        </p>
      </motion.div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Upload workbook</h3>
              <p className="text-sm text-slate-500">
                Connected to{' '}
                <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs">
                  POST /api/v1/process/gross-weight
                </code>
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="md" disabled={loading} onClick={() => setFile(null)}>
                Clear file
              </Button>
              <Button variant="primary" size="md" loading={loading} disabled={loading || !file} onClick={runValidate}>
                <FileSpreadsheet className="h-4 w-4" />
                Validate file
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
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard label="Total vouchers" value={formatNumber(total)} icon={Rows3} accent="blue" />
              <KpiCard label="Valid" value={formatNumber(valid)} icon={CheckCircle2} accent="emerald" />
              <KpiCard label="Invalid" value={formatNumber(invalid)} icon={AlertTriangle} accent="rose" />
              <KpiCard
                label="Manual vs auto mismatch"
                value={formatNumber(mismatchCount)}
                hint="Rows where both weights parsed but differ"
                icon={Scale}
                accent="amber"
              />
            </div>
          </section>

          <Card>
            <CardHeader>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Voucher register</h3>
                  <p className="text-sm text-slate-500">
                    TanStack Table · sort · paginate · invalid rows only for exports
                  </p>
                </div>
                <div className="flex flex-col items-stretch gap-2 sm:items-end">
                  <button
                    type="button"
                    disabled={exporting || invalid === 0}
                    onClick={runExportXlsx}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-blue-600 to-violet-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition hover:from-blue-500 hover:to-violet-500 disabled:pointer-events-none disabled:opacity-45"
                  >
                    {exporting ? (
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4 shrink-0" />
                    )}
                    Export invalid rows (.xlsx)
                  </button>
                </div>
              </div>
            </CardHeader>
            <CardBody>
              {rows.length ? (
                <GrossWeightResultsTable data={rows} />
              ) : (
                <EmptyState
                  icon={Scale}
                  title="No vouchers detected"
                  description="Ensure the sheet contains lines like “Voucher No: …” with numeric values on the following row in columns B, C, and D."
                />
              )}
            </CardBody>
          </Card>
        </>
      ) : (
        <EmptyState
          icon={Scale}
          title="Awaiting validation"
          description="Upload a gross-weight Excel report and run validate to populate summary cards and the voucher table."
        />
      )}
    </div>
  );
}
