import { useCallback, useMemo, useState } from 'react';
import {
  BookOpen,
  Gem,
  Loader2,
  AlertTriangle,
  Rows3,
  Undo2,
  Download,
  FileSpreadsheet,
  FileText,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { FileUploadZone } from '../components/upload/FileUploadZone';
import { Button } from '../components/ui/Button';
import { KpiCard } from '../components/cards/KpiCard';
import { EmptyState } from '../components/ui/EmptyState';
import { SalesReturnExceptionTable } from '../components/tables/SalesReturnExceptionTable';
import { AuditSessionBanner } from '../components/audit/AuditSessionBanner';
import {
  exportSalesReturnConsolidated,
  validateSalesReturnAudit,
} from '../services/processExcelService';
import { formatNumber, formatPercent } from '../utils/format';
import { formatProcessingErrorHuman } from '../utils/processingErrorUtils';
import { useAuditSessionPersistence } from '../hooks/useAuditSessionPersistence';
import {
  readAuditSessionData,
  slimSalesLedgerSnapshot,
} from '../utils/auditSessionStorage';
import { exportRowsToCsv } from '../utils/csvExport';
import { exportRowsToPdf } from '../utils/pdfExport';

const SALES_RETURN_SESSION_KEY = 'sales-return-audit';

export default function SalesReturnRateAudit() {
  const [returnFile, setReturnFile] = useState(null);
  const [restoredFileName, setRestoredFileName] = useState(
    () => readAuditSessionData(SALES_RETURN_SESSION_KEY)?.fileName ?? null
  );
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [result, setResult] = useState(
    () => readAuditSessionData(SALES_RETURN_SESSION_KEY)?.result ?? null
  );
  const [sheetError, setSheetError] = useState(
    () => readAuditSessionData(SALES_RETURN_SESSION_KEY)?.sheetError ?? null
  );

  const applySession = useCallback((data) => {
    setResult(data?.result ?? null);
    setSheetError(data?.sheetError ?? null);
    setRestoredFileName(data?.fileName ?? null);
    setReturnFile(null);
  }, []);

  const sessionSnapshot = useMemo(
    () => ({
      result,
      sheetError,
      activeFilter: null,
      fileName: returnFile?.name ?? restoredFileName ?? null,
    }),
    [result, sheetError, returnFile?.name, restoredFileName]
  );

  const {
    sessionLabel,
    sessionMeta,
    persist,
    restoreSession,
    startNewAudit,
    restoring,
  } = useAuditSessionPersistence(SALES_RETURN_SESSION_KEY, sessionSnapshot, {
    transform: slimSalesLedgerSnapshot,
    onApplySession: applySession,
    onSaveFailed: () => {
      toast.error('Results are too large to keep in the browser. Export the final exception report.');
    },
  });

  const displayFile =
    returnFile ?? (restoredFileName ? { name: restoredFileName } : null);

  const runValidation = useCallback(async () => {
    if (!returnFile) {
      toast.error('Upload a Sales Return Audit file first.');
      return;
    }
    setLoading(true);
    setResult(null);
    setSheetError(null);
    try {
      const data = await validateSalesReturnAudit(returnFile);
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
        fileName: returnFile?.name ?? null,
      });
      toast.success('Sales return audit complete');
    } catch (e) {
      setSheetError(e.details ?? { detail: e.message });
      toast.error(e.message || 'Validation failed');
    } finally {
      setLoading(false);
    }
  }, [returnFile, persist]);

  const exceptionRecords = useMemo(
    () => result?.exceptionRecords ?? result?.records ?? [],
    [result]
  );

  const exceptionColumnOrder = useMemo(() => {
    const internal = result?.exportColumns ?? [];
    const headers = result?.columnDisplayHeaders ?? {};
    if (!internal.length || !exceptionRecords.length) return null;
    const ordered = internal.map((col) => headers[col] || col);
    ordered.push('Message');
    return ordered;
  }, [result?.exportColumns, result?.columnDisplayHeaders, exceptionRecords.length]);

  const exceptionExportColumns = useMemo(() => {
    if (!exceptionRecords.length) return [];
    const keys = exceptionColumnOrder?.length
      ? exceptionColumnOrder
      : Object.keys(exceptionRecords[0]);
    return keys.map((header) => ({
      header,
      accessor: (row) => row[header] ?? '',
    }));
  }, [exceptionRecords, exceptionColumnOrder]);

  const summary = result?.summary ?? {};
  const totalReturnRows = result?.totalRows ?? 0;
  const exceptionRowCount = summary.exceptionRowCount ?? exceptionRecords.length;
  const returnErrorRows =
    summary.returnValidationErrorRows ??
    summary.distinctInvalidRows ??
    summary.errorRowsCount ??
    0;
  const higherRateProducts = summary.higherReturnRateProducts ?? 0;
  const catVsProduct = summary.invalidProductMappings ?? summary.salesAccountProductMismatches ?? 0;
  const rateViolations = summary.rateDeviationViolations ?? 0;
  const freeQuantityCount = summary.invalidUnitRateRangeRows ?? 0;
  const uomErrors = summary.invalidUomRows ?? summary.caratGemErrorRows ?? 0;
  const compliance =
    totalReturnRows > 0
      ? Math.max(0, Math.min(100, ((totalReturnRows - returnErrorRows) / totalReturnRows) * 100))
      : null;
  const salesBaselineLabel = result?.salesAuditFileName
    ? `Baseline: ${result.salesAuditFileName} (${formatNumber(result.salesAuditBaselineCount ?? summary.salesAuditBaselineCount ?? 0)} products)`
    : 'Sales audit averages loaded from database';

  const exportFinalReportExcel = useCallback(async () => {
    if (!exceptionRecords.length) {
      toast.error('No exception rows to export.');
      return;
    }
    setExporting(true);
    try {
      await exportSalesReturnConsolidated({
        records: exceptionRecords,
        exportColumns: result?.exportColumns,
        columnDisplayHeaders: result?.columnDisplayHeaders,
      });
      toast.success('Excel report downloaded');
    } catch (e) {
      toast.error(e.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  }, [exceptionRecords, result?.exportColumns, result?.columnDisplayHeaders]);

  const exportFinalReportCsv = useCallback(() => {
    if (!exceptionRecords.length) {
      toast.error('No exception rows to export.');
      return;
    }
    exportRowsToCsv(
      `sales-return-exception-${Date.now()}.csv`,
      exceptionExportColumns,
      exceptionRecords
    );
    toast.success('CSV report downloaded');
  }, [exceptionRecords, exceptionExportColumns]);

  const exportFinalReportPdf = useCallback(() => {
    if (!exceptionRecords.length) {
      toast.error('No exception rows to export.');
      return;
    }
    exportRowsToPdf(
      `sales-return-exception-${Date.now()}.pdf`,
      'Sales return audit — final exception report',
      exceptionExportColumns,
      exceptionRecords
    );
    toast.success('PDF report downloaded');
  }, [exceptionRecords, exceptionExportColumns]);

  return (
    <div className="relative space-y-8">
      <AnimatePresence>
        {loading ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-40 flex items-center justify-center rounded-2xl bg-slate-950/25 backdrop-blur-sm"
          >
            <div className="flex flex-col items-center rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-surface-overlay)] px-10 py-8 shadow-2xl backdrop-blur-sm">
              <Loader2 className="h-10 w-10 animate-spin text-emerald-600 dark:text-emerald-400" />
              <p className="mt-4 text-sm font-semibold text-[var(--color-text-primary)]">Running sales return audit…</p>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {result ? (
        <AuditSessionBanner
          sessionMeta={sessionMeta}
          sessionLabel={sessionLabel}
          hasResults={Boolean(result)}
          onRestore={restoreSession}
          onStartNew={startNewAudit}
          restoring={restoring}
        />
      ) : null}

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-emerald-700">Upload &amp; validate</h2>
              <p className="text-sm text-slate-500">
                Upload the Sales Return Audit file only. Average rates are compared against the latest
                Sales Audit run stored in the database.
              </p>
            </div>
            <Button
              variant="primary"
              size="md"
              loading={loading}
              disabled={loading || !returnFile}
              onClick={runValidation}
            >
              <FileSpreadsheet className="h-4 w-4" />
              Run audit
            </Button>
          </div>
        </CardHeader>
        <CardBody>
          <FileUploadZone
            file={displayFile}
            onFileChange={(f) => {
              setSheetError(null);
              setRestoredFileName(null);
              setReturnFile(f);
            }}
            disabled={loading}
          />
        </CardBody>
      </Card>

      {sheetError ? (
        <Card className="border-rose-200/80 bg-rose-50/40 shadow-md">
          <CardHeader>
            <h3 className="text-base font-semibold text-rose-950">Audit could not run</h3>
          </CardHeader>
          <CardBody>
            <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-xl bg-[var(--color-surface-elevated)] p-4 font-mono text-xs text-[var(--color-text-primary)]">
              {formatProcessingErrorHuman(sheetError)}
            </pre>
          </CardBody>
        </Card>
      ) : null}

      {result ? (
        <>
          <section>
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-base font-bold text-emerald-700">Audit summary</h3>
                <p className="text-sm text-slate-500">{salesBaselineLabel}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="primary"
                  size="md"
                  loading={exporting}
                  disabled={exporting || !exceptionRecords.length}
                  onClick={exportFinalReportExcel}
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  Export Excel
                </Button>
                <Button
                  variant="secondary"
                  size="md"
                  disabled={exporting || !exceptionRecords.length}
                  onClick={exportFinalReportCsv}
                >
                  <Download className="h-4 w-4" />
                  Export CSV
                </Button>
                <Button
                  variant="secondary"
                  size="md"
                  disabled={exporting || !exceptionRecords.length}
                  onClick={exportFinalReportPdf}
                >
                  <FileText className="h-4 w-4" />
                  Export PDF
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap items-stretch gap-4">
              <div className="min-w-[190px] h-[120px]">
                <KpiCard label="Return rows" value={formatNumber(totalReturnRows)} icon={Rows3} accent="blue" />
              </div>
              <div className="min-w-[190px] h-[120px]">
                <KpiCard
                  label="Exception rows"
                  value={formatNumber(exceptionRowCount)}
                  icon={AlertTriangle}
                  accent="amber"
                />
              </div>
              <div className="min-w-[190px] h-[120px]">
                <KpiCard
                  label="Validation errors"
                  value={formatNumber(returnErrorRows)}
                  icon={AlertTriangle}
                  accent="amber"
                />
              </div>
              <div className="min-w-[190px] h-[120px]">
                <KpiCard label="Ledger mapping" value={formatNumber(catVsProduct)} icon={BookOpen} accent="rose" />
              </div>
              <div className="min-w-[190px] h-[120px]">
                <KpiCard label="Rate deviations" value={formatNumber(rateViolations)} icon={BookOpen} accent="amber" />
              </div>
              <div className="min-w-[190px] h-[120px]">
                <KpiCard
                  label="Free quantity check"
                  value={formatNumber(freeQuantityCount)}
                  icon={BookOpen}
                  accent="amber"
                />
              </div>
              <div className="min-w-[190px] h-[120px]">
                <KpiCard label="UOM deviations" value={formatNumber(uomErrors)} icon={Gem} accent="violet" />
              </div>
              <div className="min-w-[190px] h-[120px]">
                <KpiCard
                  label="Higher return rate"
                  value={formatNumber(higherRateProducts)}
                  icon={Undo2}
                  accent="rose"
                />
              </div>
              <div className="min-w-[190px] h-[120px]">
                <KpiCard
                  label="Return compliance"
                  value={compliance != null ? formatPercent(compliance) : '—'}
                  hint="Clean return rows / total return rows"
                  icon={Rows3}
                  accent="emerald"
                />
              </div>
            </div>
          </section>

          <Card>
            <CardHeader>
              <div>
                <h3 className="text-base font-bold text-emerald-700">Final exception report</h3>
                <p className="text-sm text-slate-500">
                  All validation and rate comparison issues in one view. Original upload columns are
                  preserved with Message (issue codes) appended.
                </p>
              </div>
            </CardHeader>
            <CardBody>
              {exceptionRecords.length ? (
                <SalesReturnExceptionTable
                  data={exceptionRecords}
                  columnOrder={exceptionColumnOrder}
                />
              ) : (
                <EmptyState
                  title="No exceptions found"
                  description="Every evaluated return row passed validation and rate comparison checks."
                />
              )}
            </CardBody>
          </Card>
        </>
      ) : !sheetError ? (
        <EmptyState
          icon={Undo2}
          title="Awaiting audit"
          description="Upload the Sales Return Audit Excel file. Ensure a Sales Audit has been run first so product average rates are available in the database."
        />
      ) : null}
    </div>
  );
}
