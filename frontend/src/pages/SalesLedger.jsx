import { useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  FileSpreadsheet,
  HelpCircle,
  Loader2,
  Rows3,
  Sparkles,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { FileUploadZone } from '../components/upload/FileUploadZone';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { KpiCard } from '../components/cards/KpiCard';
import { SalesAuditResultsTable } from '../components/tables/SalesAuditResultsTable';
import { validateSalesAuditExcel } from '../services/salesAuditService';
import { formatNumber } from '../utils/format';
import { useAppUi } from '../context/AppUiContext';

export default function SalesLedger() {
  const { recordSalesAuditValidation } = useAppUi();
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
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
      const data = await validateSalesAuditExcel(file, ac.signal);
      if (data && data.success === false) {
        toast.error(data.detail || 'Validation failed');
        setResult(null);
        return;
      }
      setResult(data);
      recordSalesAuditValidation({
        totalRows: data.totalRows,
        errorRows: data.errorRows,
      });
      toast.success('Sales audit validation complete');
    } catch (e) {
      toast.error(e.message || 'Validation failed');
    } finally {
      setLoading(false);
    }
  }, [file, recordSalesAuditValidation]);

  const summary = result?.summary ?? {};
  const total = summary.total ?? result?.totalRows ?? 0;
  const valid = summary.valid ?? 0;
  const invalid = summary.invalid ?? result?.errorRows ?? 0;
  const fuzzyMatches = summary.fuzzyMatches ?? 0;
  const unknownProducts = summary.unknownProducts ?? 0;
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
              <p className="mt-4 text-sm font-semibold text-slate-800">Auditing sales workbook...</p>
              <p className="mt-1 text-xs text-slate-500">Checking sales account category against product labels</p>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Upload &amp; validate</h2>
                <p className="text-sm text-slate-500">
                  Connected to <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs">POST /api/v1/process/sales-audit</code>
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
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <KpiCard label="Total rows" value={formatNumber(total)} icon={Rows3} accent="blue" />
                <KpiCard label="Valid" value={formatNumber(valid)} icon={CheckCircle2} accent="emerald" />
                <KpiCard label="Invalid" value={formatNumber(invalid)} icon={AlertTriangle} accent="rose" />
                <KpiCard label="Fuzzy matches" value={formatNumber(fuzzyMatches)} icon={Sparkles} accent="amber" />
                <KpiCard
                  label="Unknown products"
                  value={formatNumber(unknownProducts)}
                  icon={HelpCircle}
                  accent="slate"
                />
                <KpiCard
                  label="Category buckets"
                  value={formatNumber(
                    Object.values(summary.categoryBreakdown ?? {}).reduce((acc, n) => acc + (Number(n) || 0), 0)
                  )}
                  icon={BookOpen}
                  accent="violet"
                />
              </div>
            </section>

            <Card>
              <CardHeader>
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Sales register</h3>
                  <p className="text-sm text-slate-500">TanStack Table · sort · paginate · CSV export</p>
                </div>
              </CardHeader>
              <CardBody>
                {rows.length ? (
                  <SalesAuditResultsTable data={rows} />
                ) : (
                  <EmptyState
                    icon={BookOpen}
                    title="No sales rows detected"
                    description="Ensure the workbook has headers for Sales Account and Product."
                  />
                )}
              </CardBody>
            </Card>
          </>
        ) : (
          <EmptyState
            icon={BookOpen}
            title="Awaiting validation"
            description="Upload a sales ledger workbook and run validate to populate summary cards and row-level checks."
          />
        )}
      </motion.div>
    </div>
  );
}
