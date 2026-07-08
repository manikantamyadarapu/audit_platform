import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Wallet,
  AlertTriangle,
  Rows3,
  Download,
  FileSpreadsheet,
  FileText,
  Info,
} from 'lucide-react';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { AuditValidationOverlay } from '../components/ui/AuditValidationOverlay';
import { FileUploadZone } from '../components/upload/FileUploadZone';
import { Button } from '../components/ui/Button';
import { KpiCard } from '../components/cards/KpiCard';
import { AuditSummaryWidget } from '../components/cards/AuditSummaryWidget';
import { AuditSummaryGrid } from '../components/audit/AuditSummaryGrid';
import { EmptyState } from '../components/ui/EmptyState';
import { AuditUploadResultsTable } from '../components/tables/AuditUploadResultsTable';
import { validateCashLedgerExcel } from '../services/processExcelService';
import { formatNumber, formatPercent } from '../utils/format';
import { formatProcessingErrorHuman } from '../utils/processingErrorUtils';
import { exportRowsToCsv } from '../utils/csvExport';
import { exportRowsToPdf } from '../utils/pdfExport';
import { downloadAuditExceptionXlsx } from '../utils/salesReturnXlsxExport';
import {
  buildExportColumnDefs,
  resolveAuditColumnOrder,
} from '../utils/auditTableColumns';
import { auditToastError, auditToastSuccess } from '../utils/auditToast';
import { cn } from '../utils/cn';
import { AuditSessionBanner } from '../components/audit/AuditSessionBanner';
import { useAuditSessionPersistence } from '../hooks/useAuditSessionPersistence';
import {
  bootstrapAuditSessionState,
  slimCashLedgerSnapshot,
} from '../utils/auditSessionStorage';

const CASH_LEDGER_SESSION_KEY = 'cash-ledger';

export default function CashLedger() {
  const navigate = useNavigate();
  const location = useLocation();
  const [initialSession] = useState(() => bootstrapAuditSessionState(CASH_LEDGER_SESSION_KEY));
  const [file, setFile] = useState(null);
  const [restoredFileName, setRestoredFileName] = useState(
    () => initialSession.data?.fileName ?? null
  );
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [result, setResult] = useState(() => initialSession.data?.result ?? null);
  const [sheetError, setSheetError] = useState(() => initialSession.data?.sheetError ?? null);

  const applySession = useCallback((data) => {
    setResult(data?.result ?? null);
    setSheetError(data?.sheetError ?? null);
    setRestoredFileName(data?.fileName ?? null);
    setFile(null);
  }, []);

  const sessionSnapshot = useMemo(
    () => ({
      result,
      sheetError,
      fileName: file?.name ?? restoredFileName ?? null,
    }),
    [result, sheetError, file?.name, restoredFileName]
  );

  const {
    sessionLabel,
    sessionMeta,
    persist,
    restoreSession,
    startNewAudit,
    restoring,
  } = useAuditSessionPersistence(CASH_LEDGER_SESSION_KEY, sessionSnapshot, {
    transform: slimCashLedgerSnapshot,
    onApplySession: applySession,
    onSaveFailed: () => {
      auditToastError('Could not save audit results locally. Free browser storage or start a new audit.');
    },
  });

  const displayFile = file ?? (restoredFileName ? { name: restoredFileName } : null);

  const runValidation = useCallback(async () => {
    if (!file) {
      auditToastError('Choose an Excel file first.');
      return;
    }
    setLoading(true);
    try {
      const data = await validateCashLedgerExcel(file);
      if (data && data.success === false) {
        auditToastError(data.detail || 'Validation failed');
        setSheetError(typeof data.error === 'object' ? data : { ...data });
        return;
      }
      setResult(data);
      setSheetError(null);
      const saved = persist(
        {
          result: data,
          sheetError: null,
          fileName: file?.name ?? null,
        },
        { notifyOnFailure: true, force: true }
      );
      if (saved === false) {
        auditToastError('Results loaded but could not be saved for later.');
      }
      auditToastSuccess('Cash Ledger validation complete');
    } catch (e) {
      const payload = e.details ?? null;
      setSheetError(payload);
      auditToastError(e.message || 'Validation failed');
    } finally {
      setLoading(false);
    }
  }, [file, persist]);

  const exceptionRecords = useMemo(() => {
    const rows = result?.records ?? [];
    return Array.isArray(rows) ? rows : [];
  }, [result]);

  const exceptionColumnOrder = useMemo(
    () =>
      exceptionRecords.length
        ? resolveAuditColumnOrder(
            exceptionRecords,
            result?.exportColumns,
            result?.columnDisplayHeaders
          )
        : [],
    [exceptionRecords, result?.exportColumns, result?.columnDisplayHeaders]
  );

  const exportFilteredColumnOrder = useMemo(() => {
    if (!exceptionRecords.length) return exceptionColumnOrder;
    return exceptionColumnOrder.filter((key) => {
      if (key === 'Message') return true;
      return key in exceptionRecords[0];
    });
  }, [exceptionRecords, exceptionColumnOrder]);

  const exportFilteredColumns = useMemo(
    () => buildExportColumnDefs(exportFilteredColumnOrder, exceptionRecords),
    [exportFilteredColumnOrder, exceptionRecords]
  );

  const runExportExcel = useCallback(() => {
    if (!exceptionRecords.length) {
      auditToastError('No rows to export.');
      return;
    }
    setExporting(true);
    try {
      downloadAuditExceptionXlsx(
        exceptionRecords,
        exportFilteredColumnOrder,
        `cash-ledger-exceptions-${Date.now()}.xlsx`,
        'Exception report',
        result?.exportColumns,
        result?.columnDisplayHeaders
      );
      auditToastSuccess('Excel export downloaded');
    } finally {
      setExporting(false);
    }
  }, [
    exceptionRecords,
    exportFilteredColumnOrder,
    result?.exportColumns,
    result?.columnDisplayHeaders,
  ]);

  const runExportCsv = useCallback(() => {
    if (!exceptionRecords.length) {
      auditToastError('No rows to export.');
      return;
    }
    exportRowsToCsv(
      `cash-ledger-exceptions-${Date.now()}.csv`,
      exportFilteredColumns,
      exceptionRecords
    );
    auditToastSuccess('CSV export downloaded');
  }, [exceptionRecords, exportFilteredColumns]);

  const runExportPdf = useCallback(() => {
    if (!exceptionRecords.length) {
      auditToastError('No rows to export.');
      return;
    }
    exportRowsToPdf(
      `cash-ledger-exceptions-${Date.now()}.pdf`,
      'Cash Ledger audit — exception report',
      exportFilteredColumns,
      exceptionRecords
    );
    auditToastSuccess('PDF export downloaded');
  }, [exceptionRecords, exportFilteredColumns]);

  const summary = result?.summary ?? {};
  const totalRows = result?.totalRows ?? 0;
  const errorRows = summary.failedRows ?? result?.errorRows ?? exceptionRecords.length;
  const passedRows = summary.passedRows ?? totalRows - errorRows;
  const totalIssues = summary.totalIssues ?? exceptionRecords.length;
  const compliance =
    totalRows > 0 ? Math.max(0, Math.min(100, ((totalRows - errorRows) / totalRows) * 100)) : null;

  const issuesByType = summary.issuesByType ?? {};

  return (
    <div className="relative space-y-8">
      <AuditValidationOverlay open={loading} />

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-emerald-700">Upload &amp; validate</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Upload a Cash Book Excel file to validate cash transactions based on predefined audit rules.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="primary"
                size="md"
                loading={loading}
                disabled={loading || !file}
                onClick={runValidation}
              >
                <FileSpreadsheet className="h-4 w-4" />
                Start Audit
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardBody className="space-y-4">
          <FileUploadZone
            file={displayFile}
            onFileChange={(f) => {
              setSheetError(null);
              setRestoredFileName(null);
              setResult(null);
              setFile(f);
            }}
            disabled={loading}
          />
        </CardBody>
      </Card>

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

      <section>
        <h3 className="mb-4 text-base font-bold text-emerald-700">Rules Verified</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <KpiCard
            label="Total Rules"
            value="3"
            hint="Cash ledger audit rules applied"
            icon={Wallet}
            accent="blue"
          />
        </div>
        <div className="mt-4 rounded-xl border border-slate-200/80 bg-slate-50/80 px-4 py-3 text-sm text-slate-950 dark:border-slate-800 dark:bg-slate-950/30 dark:text-slate-100">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span>Negative Cash Balance</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span>Cash Payments &gt; ₹10,000</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span>Cash Receipts &gt; ₹2,00,000</span>
            </div>
          </div>
        </div>
      </section>

      {sheetError ? (
        <Card className="border-rose-200/80 bg-rose-50/40 shadow-md">
          <CardHeader>
            <h3 className="text-base font-semibold text-rose-950">Sheet did not match required layout</h3>
            <p className="mt-1 text-sm text-rose-900/80">
              Fix the workbook using the checklist below.
            </p>
          </CardHeader>
          <CardBody className="space-y-4">
            <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-xl bg-[var(--color-surface-elevated)] p-4 font-mono text-xs text-[var(--color-text-primary)] shadow-inner">
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
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.14em] text-emerald-700/90">
              Audit intelligence summary
            </h3>
            <AuditSummaryGrid>
              <AuditSummaryWidget
                label="Total rows"
                value={formatNumber(totalRows)}
                icon={Rows3}
                accent="blue"
                importance="secondary"
              />
              <AuditSummaryWidget
                label="Passed rows"
                value={formatNumber(passedRows)}
                icon={Rows3}
                accent="emerald"
                importance="secondary"
              />
              <AuditSummaryWidget
                label="Failed rows"
                value={formatNumber(errorRows)}
                icon={AlertTriangle}
                accent="amber"
                variant="error"
                importance="critical"
                total={totalRows}
              />
              <AuditSummaryWidget
                label="Total issues"
                value={formatNumber(totalIssues)}
                icon={AlertTriangle}
                accent="rose"
                importance="secondary"
              />
              <AuditSummaryWidget
                label="Compliance"
                value={compliance != null ? formatPercent(compliance) : '—'}
                icon={Rows3}
                accent="emerald"
                variant="compliance"
                importance="critical"
              />
            </AuditSummaryGrid>
          </section>

          {Object.keys(issuesByType).length > 0 && (
            <section>
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.14em] text-emerald-700/90">
                Issue distribution
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {Object.entries(issuesByType).map(([code, count]) => (
                  <div
                    key={code}
                    className="rounded-xl border border-slate-200/80 bg-slate-50/80 px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-950/30"
                  >
                    <div className="font-semibold text-slate-900 dark:text-slate-100">{code}</div>
                    <div className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                      {formatNumber(count)}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h3 className="text-base font-bold text-emerald-700">Exception report</h3>
                  <p className="text-sm text-slate-500">
                    Original upload columns preserved with Message appended.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="primary"
                    size="md"
                    loading={exporting}
                    disabled={exporting || exceptionRecords.length === 0}
                    onClick={runExportExcel}
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                    Export Excel
                  </Button>
                  <Button
                    variant="secondary"
                    size="md"
                    disabled={exporting || exceptionRecords.length === 0}
                    onClick={runExportCsv}
                  >
                    <Download className="h-4 w-4" />
                    Export CSV
                  </Button>
                  <Button
                    variant="secondary"
                    size="md"
                    disabled={exporting || exceptionRecords.length === 0}
                    onClick={runExportPdf}
                  >
                    <FileText className="h-4 w-4" />
                    Export PDF
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardBody>
              {exceptionRecords.length ? (
                <AuditUploadResultsTable
                  data={exceptionRecords}
                  columnOrder={exportFilteredColumnOrder}
                  exportColumns={result?.exportColumns}
                  columnDisplayHeaders={result?.columnDisplayHeaders}
                  searchPlaceholder="Search exception rows…"
                />
              ) : (
                <EmptyState
                  title="No issues detected"
                  description="Every evaluated row passed validation for this upload."
                />
              )}
            </CardBody>
          </Card>
        </>
      ) : !sheetError ? (
        <EmptyState
          icon={Wallet}
          title="Awaiting validation"
          description="Upload a Cash Book Excel file and run validation to populate summary metrics, issue badges, and exports."
        />
      ) : null}
    </div>
  );
}
