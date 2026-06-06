import { useCallback, useMemo, useState } from 'react';
import { Loader2, AlertTriangle, Rows3, Undo2, Download, FileSpreadsheet } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { FileUploadZone } from '../components/upload/FileUploadZone';
import { Button } from '../components/ui/Button';
import { KpiCard } from '../components/cards/KpiCard';
import { EmptyState } from '../components/ui/EmptyState';
import { SalesReturnExceptionTable } from '../components/tables/SalesReturnExceptionTable';
import {
  exportSalesReturnExceptions,
  validateSalesReturnAudit,
} from '../services/processExcelService';
import { formatNumber, formatPercent } from '../utils/format';
import { formatProcessingErrorHuman } from '../utils/processingErrorUtils';
import { filterSalesRecords } from '../utils/salesRecordFilters';

export default function SalesReturnRateAudit() {
  const [salesFile, setSalesFile] = useState(null);
  const [returnFile, setReturnFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
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

  const exceptionRecords = useMemo(
    () => result?.exceptionRecords ?? result?.records ?? [],
    [result]
  );

  const summary = result?.summary ?? {};
  const returnErrorRows =
    summary.returnValidationErrorRows ??
    summary.distinctInvalidRows ??
    (result?.returnValidationRecords ?? []).length;
  const higherRateProducts = summary.higherReturnRateProducts ?? 0;
  const totalReturnRows = result?.totalRows ?? 0;
  const totalExceptions = summary.exceptionRowCount ?? exceptionRecords.length;
  const compliance =
    totalReturnRows > 0
      ? Math.max(0, Math.min(100, ((totalReturnRows - returnErrorRows) / totalReturnRows) * 100))
      : null;

  const accessoriesUnitRateCount = filterSalesRecords(returnRecords, 'accessoriesUnitRate').length;


  const exportExceptions = useCallback(async () => {
    if (!exceptionRecords.length) {
      toast.error('No exception rows to export.');
      return;
    }
    setExporting(true);
    try {
      await exportSalesReturnExceptions(exceptionRecords);
      toast.success('Exception report downloaded');
    } catch (e) {
      toast.error(e.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  }, [exceptionRecords]);

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
                Both files are required — sales audit for baseline rates, sales return for all validations.
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

            <div className="overflow-x-auto">
              <div className="flex flex-nowrap w-max gap-2">
                <div className="shrink-0 w-[180px]">
                  <KpiCard label="TOTAL ROWS" value="" icon={Rows3} accent="blue" />
                </div>
                <div className="shrink-0 w-[180px]">
                  <KpiCard label="ERROR ROWS" value="" icon={AlertTriangle} accent="amber" />
                </div>
                <div className="shrink-0 w-[190px]">
                  <KpiCard label="ACCOUNT VS PRODUCT" value="" icon={Undo2} accent="rose" />
                </div>
                <div className="shrink-0 w-[180px]">
                  <KpiCard label="RANGE DEVIATIONS" value="" icon={Undo2} accent="amber" />
                </div>
                <div className="shrink-0 w-[210px]">
                  <KpiCard label="ACCESSORIES UNIT RATE CHECK" value="" icon={Undo2} accent="amber" />
                </div>
                <div className="shrink-0 w-[220px]">
                  <KpiCard label="UNIT OF MEASUREMENT DEVIATIONS" value="" icon={Rows3} accent="emerald" />
                </div>
                <div className="shrink-0 w-[150px]">
                  <KpiCard label="COMPLIANCE" value="" icon={Rows3} accent="emerald" />
                </div>
              </div>
            </div>
          </section>

          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h3 className="text-base font-bold text-emerald-700">Exception report</h3>
                  <p className="text-sm text-slate-500">
                    One consolidated report — rate, ledger, free quantity, UOM, and average rate comparison issues.
                  </p>
                </div>
                <Button
                  variant="primary"
                  size="md"
                  loading={exporting}
                  disabled={exporting || exceptionRecords.length === 0}
                  onClick={exportExceptions}
                >
                  <Download className="h-4 w-4" />
                  Export exception report
                </Button>
              </div>
            </CardHeader>
            <CardBody>
              {exceptionRecords.length ? (
                <SalesReturnExceptionTable data={exceptionRecords} totalCount={totalExceptions} />
              ) : (
                <EmptyState
                  title="No exceptions found"
                  description="All return validations passed and no product has a higher average return rate than sales."
                />
              )}
            </CardBody>
          </Card>
        </>
      ) : !sheetError ? (
        <EmptyState
          icon={Undo2}
          title="Awaiting audit"
          description="Upload both Excel files and run the audit to generate the consolidated exception report."
        />
      ) : null}
    </div>
  );
}
