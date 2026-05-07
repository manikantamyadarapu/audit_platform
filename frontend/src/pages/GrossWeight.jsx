import { useCallback, useState } from 'react';
import { Scale, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { FileUploadZone } from '../components/upload/FileUploadZone';
import { Button } from '../components/ui/Button';
import { KpiCard } from '../components/cards/KpiCard';
import { EmptyState } from '../components/ui/EmptyState';
import toast from 'react-hot-toast';
import { validateGrossWeightExcel } from '../services/processExcelService';
import { formatNumber } from '../utils/format';

export default function GrossWeight() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const runComparison = useCallback(async () => {
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

  const summary = result?.summary ?? {};
  const totalRows = result?.totalRows ?? 0;
  const errorRows = result?.errorRows ?? 0;
  const mismatchCount = summary.weightMismatch ?? errorRows;
  const withinTol = Math.max(0, totalRows - errorRows);

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
              <p className="mt-4 text-sm font-semibold text-slate-800">Comparing weights…</p>
              <p className="mt-1 text-xs text-slate-500">Forwarding multipart upload to gateway</p>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-wrap items-center gap-3">
        <h2 className="text-2xl font-semibold text-slate-900">Gross weight audit</h2>
      </motion.div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Upload workbook</h3>
              <p className="text-sm text-slate-500">
                Compare <code className="rounded bg-slate-100 px-1 font-mono text-xs">manual_gross_weight</code> vs{' '}
                <code className="rounded bg-slate-100 px-1 font-mono text-xs">auto_gross_weight</code>. Connected to{' '}
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
          <div className="grid gap-4 md:grid-cols-3">
            <KpiCard label="Rows scanned" value={formatNumber(totalRows)} hint="From workbook" icon={Scale} accent="blue" />
            <KpiCard
              label="Mismatches"
              value={formatNumber(mismatchCount)}
              hint="Outside tolerance"
              icon={Scale}
              accent="amber"
            />
            <KpiCard
              label="Within tolerance"
              value={formatNumber(withinTol)}
              hint="Clean vs flagged"
              icon={Scale}
              accent="emerald"
            />
          </div>

          <Card>
            <CardHeader>
              <h3 className="text-base font-semibold text-slate-900">Mismatch register</h3>
              <p className="text-sm text-slate-500">Exception rows returned by the processor appear here.</p>
            </CardHeader>
            <CardBody>
              {result.records?.length ? (
                <p className="text-sm text-slate-600">{result.records.length} mismatch row(s) returned.</p>
              ) : (
                <EmptyState
                  icon={Scale}
                  title="No mismatch rows"
                  description="The current processor run did not return individual exception rows, or all weights are within tolerance."
                />
              )}
            </CardBody>
          </Card>
        </>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <KpiCard label="Rows scanned" value="—" hint="Run comparison" icon={Scale} accent="blue" />
            <KpiCard label="Mismatches" value="—" hint="Awaiting run" icon={Scale} accent="amber" />
            <KpiCard label="Within tolerance" value="—" hint="Awaiting run" icon={Scale} accent="emerald" />
          </div>

          <Card>
            <CardHeader>
              <h3 className="text-base font-semibold text-slate-900">Mismatch register</h3>
              <p className="text-sm text-slate-500">Will reuse shared TanStack table + CSV export pattern.</p>
            </CardHeader>
            <CardBody>
              <EmptyState
                icon={Scale}
                title="No comparison yet"
                description="Upload a workbook and run comparison to pull results from the gateway."
              />
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}
