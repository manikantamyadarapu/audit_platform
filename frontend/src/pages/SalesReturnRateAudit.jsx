import { useCallback, useMemo, useState } from 'react';
import { Loader2, AlertTriangle, Rows3, Undo2, Download, FileSpreadsheet } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { FileUploadZone } from '../components/upload/FileUploadZone';
import { Button } from '../components/ui/Button';
import { KpiCard } from '../components/cards/KpiCard';
import { EmptyState } from '../components/ui/EmptyState';
import { SalesResultsTable } from '../components/tables/SalesResultsTable';
import { SalesReturnRateComparisonTable } from '../components/tables/SalesReturnRateComparisonTable';
import {
  exportSalesReturnRateComparison,
  validateSalesReturnAudit,
} from '../services/processExcelService';
import { formatNumber, formatPercent } from '../utils/format';
import { formatProcessingErrorHuman } from '../utils/processingErrorUtils';
import { dedupeSalesRecordsByRowNumber } from '../utils/dedupeSalesRecords';
import { downloadSalesRecordsXlsx } from '../utils/salesXlsxExport';

export default function SalesReturnRateAudit() {
  const [salesFile, setSalesFile] = useState(null);
  const [returnFile, setReturnFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exportingComparison, setExportingComparison] = useState(false);
  const [exportingReturn, setExportingReturn] = useState(false);
  const [result, setResult] = useState(null);
  const [sheetError, setSheetError] = useState(null);

  const runValidation = useCallback(async () => {
    if (!salesFile || !returnFile) {
      toast.error('Upload both Sales Audit and Sales Return Audit files.');
      return;
    }
    setLoading(true);
    setResult(null);
    setSheetError(null);
    try {
      const data = await validateSalesReturnAudit(salesFile, returnFile);
      if (data && data.success === false) {
        toast.error(data.detail || 'Validation failed');
        setSheetError(typeof data.error === 'object' ? data : { ...data });
        setResult(null);
        return;
      }
      setResult(data);
      toast.success('Sales return audit complete');
    } catch (e) {
      setSheetError(e.details ?? null);
      toast.error(e.message || 'Validation failed');
    } finally {
      setLoading(false);
    }
  }, [salesFile, returnFile]);

  const returnRecords = useMemo(
    () => dedupeSalesRecordsByRowNumber(result?.returnValidationRecords ?? result?.records),
    [result]
  );
  const comparisonRecords = useMemo(
    () => result?.rateComparisonRecords ?? [],
    [result]
  );

  const summary = result?.summary ?? {};
  const returnErrorRows =
    summary.returnValidationErrorRows ??
    summary.distinctInvalidRows ??
    returnRecords.filter((r) => (r.issues?.length ?? 0) > 0).length;
  const higherRateProducts = summary.higherReturnRateProducts ?? comparisonRecords.length;
  const totalReturnRows = result?.totalRows ?? 0;
  const compliance =
    totalReturnRows > 0
      ? Math.max(0, Math.min(100, ((totalReturnRows - returnErrorRows) / totalReturnRows) * 100))
      : null;

  const exportComparison = useCallback(async () => {
    if (!comparisonRecords.length) {
      toast.error('No rate comparison rows to export.');
      return;
    }
    setExportingComparison(true);
    try {
      await exportSalesReturnRateComparison(comparisonRecords);
      toast.success('Rate comparison Excel downloaded');
    } catch (e) {
      toast.error(e.message || 'Export failed');
    } finally {
      setExportingComparison(false);
    }
  }, [comparisonRecords]);

  const exportReturnRows = useCallback(() => {
    if (!returnRecords.length) {
      toast.error('No return validation rows to export.');
      return;
    }
    setExportingReturn(true);
    try {
      downloadSalesRecordsXlsx(returnRecords, `sales-return-validation-${Date.now()}.xlsx`);
      toast.success('Return validation Excel downloaded');
    } finally {
      setExportingReturn(false);
    }
  }, [returnRecords]);

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
              <p className="mt-4 text-sm font-semibold text-slate-800">Running sales return audit…</p>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-emerald-700">Upload &amp; validate</h2>
              <p className="text-sm text-slate-500">
                Both files are required — sales audit for baseline rates, sales return for validations and comparison.
              </p>
            </div>
            <Button
              variant="primary"
              size="md"
              loading={loading}
              disabled={loading || !salesFile || !returnFile}
              onClick={runValidation}
            >
              <FileSpreadsheet className="h-4 w-4" />
              Run audit
            </Button>
          </div>
        </CardHeader>
        <CardBody>
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <p className="mb-2 text-sm font-semibold text-slate-700">1. Sales Audit File</p>
              <FileUploadZone
                file={salesFile}
                onFileChange={(f) => {
                  setSheetError(null);
                  setSalesFile(f);
                }}
                disabled={loading}
              />
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold text-slate-700">2. Sales Return Audit File</p>
              <FileUploadZone
                file={returnFile}
                onFileChange={(f) => {
                  setSheetError(null);
                  setReturnFile(f);
                }}
                disabled={loading}
              />
            </div>
          </div>
        </CardBody>
      </Card>

      {sheetError ? (
        <Card className="border-rose-200/80 bg-rose-50/40 shadow-md">
          <CardHeader>
            <h3 className="text-base font-semibold text-rose-950">Workbook layout error</h3>
          </CardHeader>
          <CardBody>
            <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-xl bg-white/90 p-4 font-mono text-xs text-slate-800">
              {formatProcessingErrorHuman(sheetError)}
            </pre>
          </CardBody>
        </Card>
      ) : null}

      {result ? (
        <>
          <section>
            <h3 className="mb-4 text-base font-bold text-emerald-700">Summary</h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard label="Return rows" value={formatNumber(totalReturnRows)} icon={Rows3} accent="blue" />
              <KpiCard
                label="Return validation errors"
                value={formatNumber(returnErrorRows)}
                icon={AlertTriangle}
                accent="amber"
              />
              <KpiCard
                label="Higher return rate products"
                value={formatNumber(higherRateProducts)}
                icon={Undo2}
                accent="rose"
              />
              <KpiCard
                label="Return compliance"
                value={compliance != null ? formatPercent(compliance) : '—'}
                hint="Clean return rows / total return rows"
                icon={Rows3}
                accent="emerald"
              />
            </div>
          </section>

          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h3 className="text-base font-bold text-emerald-700">Rate comparison report</h3>
                  <p className="text-sm text-slate-500">
                    Products where return average rate exceeds sales average rate (product-wise only).
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardBody>
              {comparisonRecords.length ? (
                <SalesReturnRateComparisonTable
                  data={comparisonRecords}
                  onExportXlsx={exportComparison}
                  exporting={exportingComparison}
                />
              ) : (
                <EmptyState
                  title="No higher return rate products"
                  description="Every matched product has a sales return average rate at or below the sales average."
                />
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h3 className="text-base font-bold text-emerald-700">Sales return validation issues</h3>
                  <p className="text-sm text-slate-500">
                    Rate, ledger, free quantity, and UOM checks on the return file (reused sales validators).
                  </p>
                </div>
                <Button
                  variant="secondary"
                  size="md"
                  loading={exportingReturn}
                  disabled={exportingReturn || returnRecords.length === 0}
                  onClick={exportReturnRows}
                >
                  <Download className="h-4 w-4" />
                  Export return issues
                </Button>
              </div>
            </CardHeader>
            <CardBody>
              {returnRecords.length ? (
                <SalesResultsTable data={returnRecords} />
              ) : (
                <EmptyState title="No return validation issues" description="All return rows passed sales audit rules." />
              )}
            </CardBody>
          </Card>
        </>
      ) : !sheetError ? (
        <EmptyState
          icon={Undo2}
          title="Awaiting audit"
          description="Upload both Excel files and run the audit to compare product-wise average rates."
        />
      ) : null}
    </div>
  );
}
