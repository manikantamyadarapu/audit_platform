import { useCallback, useState } from 'react';
import { BookOpen, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { FileUploadZone } from '../components/upload/FileUploadZone';
import { Button } from '../components/ui/Button';
import { KpiCard } from '../components/cards/KpiCard';
import { EmptyState } from '../components/ui/EmptyState';
import { validateSalesExcel } from '../services/processExcelService';
import { formatNumber } from '../utils/format';
import { formatProcessingErrorHuman } from '../utils/processingErrorUtils';

export default function SalesLedger() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
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

  const summary = result?.summary ?? {};
  const totalRows = result?.totalRows ?? 0;
  const catVsProduct = summary.salesAccountProductMismatches ?? 0;
  const accountConflicts = summary.conflictingSalesAccountForProduct ?? 0;
  const grossWt = summary.grossWeightMismatches ?? 0;

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
              <p className="mt-4 text-sm font-semibold text-slate-800">Validating ledger…</p>
              <p className="mt-1 text-xs text-slate-500">Forwarding multipart upload to gateway</p>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-wrap items-center gap-3">
        <h2 className="text-2xl font-semibold text-slate-900">Sales ledger</h2>
      </motion.div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Ledger ingestion</h3>
              <p className="text-sm text-slate-500">
                Matches your detail export by{' '}
                <span className="font-medium text-slate-700">normalized headers</span> (titles above the grid are skipped
                automatically): Voucher No, Sales Account, Product, Manual Gross Wt., Auto Gross Wt.; validates{' '}
                <span className="font-medium text-slate-700">sales account vs product</span> consistency and gross-weight
                tolerance. Connected to{' '}
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
              Fix the workbook using the checklist below — this is returned by the API as structured JSON, not a generic
              connection error.
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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard label="Rows imported" value={formatNumber(totalRows)} icon={BookOpen} accent="blue" />
            <KpiCard
              label="Account vs product flags"
              value={formatNumber(catVsProduct)}
              hint="Classifier mismatch / missing category"
              icon={BookOpen}
              accent="rose"
            />
            <KpiCard
              label="Same product, mixed ledgers"
              value={formatNumber(accountConflicts)}
              hint="Odd sales account vs majority"
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
          </div>

          <Card>
            <CardHeader>
              <h3 className="text-base font-semibold text-slate-900">Exception queue</h3>
              <p className="text-sm text-slate-500">Detailed issue codes per spreadsheet row (`records` from the API).</p>
            </CardHeader>
            <CardBody>
              {result.records?.length ? (
                <p className="text-sm text-slate-600">{result.records.length} exception row(s) returned.</p>
              ) : (
                <EmptyState
                  icon={BookOpen}
                  title="No exception rows"
                  description="This run did not return queued rows, or the ledger passed current checks."
                />
              )}
            </CardBody>
          </Card>
        </>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard label="Rows imported" value="—" icon={BookOpen} accent="blue" />
            <KpiCard label="Account vs product flags" value="—" icon={BookOpen} accent="rose" />
            <KpiCard label="Same product, mixed ledgers" value="—" icon={BookOpen} accent="amber" />
            <KpiCard label="Gross weight gaps" value="—" icon={BookOpen} accent="violet" />
          </div>

          <Card>
            <CardHeader>
              <h3 className="text-base font-semibold text-slate-900">Exception queue</h3>
              <p className="text-sm text-slate-500">Designed for the same glass cards + data table stack as PAN.</p>
            </CardHeader>
            <CardBody>
              <EmptyState
                icon={BookOpen}
                title="Awaiting validation"
                description="Upload a ledger and run validation to load summary metrics from the gateway."
              />
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}
