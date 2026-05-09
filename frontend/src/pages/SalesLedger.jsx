import { useCallback, useState } from 'react';
import {
  BookOpen,
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
import {
  validateSalesExcel,
  exportInvalidSalesRows,
} from '../services/processExcelService';
import { formatNumber, formatPercent } from '../utils/format';
import { formatProcessingErrorHuman } from '../utils/processingErrorUtils';

export default function SalesLedger() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [result, setResult] = useState(null);
  const [sheetError, setSheetError] = useState(null);

  const runValidation = useCallback(async () => {
    if (!file) {
      toast.error('Choose an Excel file first.');
      return;
    }
    const ac = new AbortController();
    setLoading(true);
    setResult(null);
    setSheetError(null);
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

  const runExport = useCallback(async () => {
    const records = result?.records;
    if (!Array.isArray(records) || records.length === 0) {
      toast.error('No invalid rows to export.');
      return;
    }
    const ac = new AbortController();
    setExporting(true);
    try {
      const { blob, filename } = await exportInvalidSalesRows(records, ac.signal);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Excel export downloaded');
    } catch (e) {
      toast.error(e.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  }, [result]);

  const summary = result?.summary ?? {};
  const totalRows = result?.totalRows ?? 0;
  const errorRows = result?.errorRows ?? 0;
  const catVsProduct = summary.salesAccountProductMismatches ?? 0;
  const accountConflicts = summary.conflictingSalesAccountForProduct ?? 0;
  const grossWt = summary.grossWeightMismatches ?? 0;
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
                Normalized headers: voucher, sales account, product, manual/auto gross weight. Connected to{' '}
                <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs">
                  POST /api/v1/process/sales/validate
                </code>
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="md" disabled={loading} onClick={() => setFile(null)}>
                Clear file
              </Button>
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
              Fix the workbook using the checklist below — this is returned by the API as structured JSON.
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
            <h3 className="mb-4 text-base font-semibold text-slate-900">Summary</h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <KpiCard label="Total rows" value={formatNumber(totalRows)} icon={Rows3} accent="blue" />
              <KpiCard label="Error rows" value={formatNumber(errorRows)} icon={AlertTriangle} accent="amber" />
              <KpiCard
                label="Account vs product"
                value={formatNumber(catVsProduct)}
                hint="Classifier mismatch / missing category"
                icon={BookOpen}
                accent="rose"
              />
              <KpiCard
                label="Mixed ledgers"
                value={formatNumber(accountConflicts)}
                hint="Product vs dominant sales account"
                icon={BookOpen}
                accent="amber"
              />
              <KpiCard
                label="Gross weight gaps"
                value={formatNumber(grossWt)}
                hint="Manual vs auto exceeds tolerance"
                icon={BookOpen}
                accent="violet"
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
                  <h3 className="text-base font-semibold text-slate-900">Issue register</h3>
                  <p className="text-sm text-slate-500">TanStack Table · sort · paginate · CSV export</p>
                </div>
                <Button
                  variant="primary"
                  size="md"
                  loading={exporting}
                  disabled={exporting || !result.records?.length}
                  onClick={runExport}
                >
                  <Download className="h-4 w-4" />
                  Export invalid rows (.xlsx)
                </Button>
              </div>
            </CardHeader>
            <CardBody>
              {result.records?.length ? (
                <SalesResultsTable data={result.records} />
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
