import { useCallback, useMemo, useState } from 'react';
import {
  Landmark,
  AlertTriangle,
  Rows3,
  Download,
  FileSpreadsheet,
  FileText,
} from 'lucide-react';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { AuditValidationOverlay } from '../components/ui/AuditValidationOverlay';
import { FileUploadZone } from '../components/upload/FileUploadZone';
import { Button } from '../components/ui/Button';
import { AuditSummaryWidget } from '../components/cards/AuditSummaryWidget';
import { AuditSummaryGrid } from '../components/audit/AuditSummaryGrid';
import { AuditFilterStrip } from '../components/audit/AuditFilterStrip';
import { EmptyState } from '../components/ui/EmptyState';
import { AuditUploadResultsTable } from '../components/tables/AuditUploadResultsTable';
import { AuditSessionBanner } from '../components/audit/AuditSessionBanner';
import {
  exportInvalidNegativeBankRows,
  validateNegativeBankExcel,
} from '../services/processExcelService';
import { formatNumber, formatPercent } from '../utils/format';
import { formatProcessingErrorHuman } from '../utils/processingErrorUtils';
import { exportRowsToCsv } from '../utils/csvExport';
import { exportRowsToPdf } from '../utils/pdfExport';
import {
  NEGATIVE_BANK_FILTER_LABELS,
  NEGATIVE_BANK_ISSUE_CODES,
  countNegativeBankRecordsByIssue,
  filterNegativeBankRecords,
} from '../utils/negativeBankRecordFilters';
import {
  buildNegativeBankExportColumnDefs,
  NEGATIVE_BANK_DISPLAY_HEADERS,
  resolveNegativeBankColumnOrder,
} from '../utils/negativeBankTableColumns';
import { auditToastError, auditToastSuccess } from '../utils/auditToast';
import { useAuditSessionPersistence } from '../hooks/useAuditSessionPersistence';
import {
  bootstrapAuditSessionState,
  slimCashLedgerSnapshot,
} from '../utils/auditSessionStorage';

const NEGATIVE_BANK_SESSION_KEY = 'negative-bank';

export default function NegativeBank() {
  const [initialSession] = useState(() => bootstrapAuditSessionState(NEGATIVE_BANK_SESSION_KEY));
  const [file, setFile] = useState(null);
  const [restoredFileName, setRestoredFileName] = useState(
    () => initialSession.data?.fileName ?? null
  );
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [result, setResult] = useState(() => initialSession.data?.result ?? null);
  const [sheetError, setSheetError] = useState(() => initialSession.data?.sheetError ?? null);
  const [activeFilter, setActiveFilter] = useState(
    () => initialSession.data?.activeFilter ?? null
  );

  const applySession = useCallback((data) => {
    setResult(data?.result ?? null);
    setSheetError(data?.sheetError ?? null);
    setRestoredFileName(data?.fileName ?? null);
    setActiveFilter(data?.activeFilter ?? null);
    setFile(null);
  }, []);

  const sessionSnapshot = useMemo(
    () => ({
      result,
      sheetError,
      activeFilter,
      fileName: file?.name ?? restoredFileName ?? null,
    }),
    [result, sheetError, activeFilter, file?.name, restoredFileName]
  );

  const {
    sessionLabel,
    sessionMeta,
    persist,
    restoreSession,
    startNewAudit,
    restoring,
  } = useAuditSessionPersistence(NEGATIVE_BANK_SESSION_KEY, sessionSnapshot, {
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
      const data = await validateNegativeBankExcel(file);
      if (data && data.success === false) {
        auditToastError(data.detail || 'Validation failed');
        setSheetError(typeof data.error === 'object' ? data : { ...data });
        return;
      }
      setResult(data);
      setSheetError(null);
      setActiveFilter(null);
      const saved = persist(
        {
          result: data,
          sheetError: null,
          activeFilter: null,
          fileName: file?.name ?? null,
        },
        { notifyOnFailure: true, force: true }
      );
      if (saved === false) {
        auditToastError('Results loaded but could not be saved for later.');
      }
      auditToastSuccess('Negative Bank validation complete');
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

  const filteredRecords = useMemo(
    () => filterNegativeBankRecords(exceptionRecords, activeFilter),
    [exceptionRecords, activeFilter]
  );

  const tableColumnOrder = useMemo(
    () => resolveNegativeBankColumnOrder(filteredRecords),
    [filteredRecords]
  );

  const exportColumns = useMemo(
    () => buildNegativeBankExportColumnDefs(tableColumnOrder, filteredRecords),
    [tableColumnOrder, filteredRecords]
  );

  const columnDisplayHeaders = useMemo(
    () => ({
      ...NEGATIVE_BANK_DISPLAY_HEADERS,
      ...(result?.columnDisplayHeaders ?? {}),
    }),
    [result?.columnDisplayHeaders]
  );

  const toggleCardFilter = useCallback((key) => {
    setActiveFilter((prev) => (prev === key ? null : key));
  }, []);

  const runExportExcel = useCallback(async () => {
    if (!exceptionRecords.length) {
      auditToastError('No rows to export.');
      return;
    }
    setExporting(true);
    try {
      await exportInvalidNegativeBankRows(exceptionRecords);
      auditToastSuccess('Excel export downloaded');
    } catch (e) {
      auditToastError(e.message || 'Excel export failed');
    } finally {
      setExporting(false);
    }
  }, [exceptionRecords]);

  const runExportCsv = useCallback(() => {
    if (!filteredRecords.length) {
      auditToastError('No rows to export.');
      return;
    }
    exportRowsToCsv(
      `negative-bank-exceptions-${Date.now()}.csv`,
      exportColumns,
      filteredRecords
    );
    auditToastSuccess('CSV export downloaded');
  }, [filteredRecords, exportColumns]);

  const runExportPdf = useCallback(() => {
    if (!filteredRecords.length) {
      auditToastError('No rows to export.');
      return;
    }
    exportRowsToPdf(
      `negative-bank-exceptions-${Date.now()}.pdf`,
      'Negative Bank audit — exception report',
      exportColumns,
      filteredRecords
    );
    auditToastSuccess('PDF export downloaded');
  }, [filteredRecords, exportColumns]);

  const totalRows = result?.totalRows ?? 0;
  const errorRows = result?.summary?.failedRows ?? result?.errorRows ?? exceptionRecords.length;
  const compliance =
    totalRows > 0 ? Math.max(0, Math.min(100, ((totalRows - errorRows) / totalRows) * 100)) : null;

  const negativeBankCount = countNegativeBankRecordsByIssue(
    exceptionRecords,
    NEGATIVE_BANK_ISSUE_CODES.negativeBank
  );

  return (
    <div className="relative space-y-8">
      <AuditValidationOverlay open={loading} />

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-emerald-700">Upload &amp; validate</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Upload a Cash Book Excel file to check Opening/Closing balances for Credit (Cr).
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
              setActiveFilter(null);
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
                interactive
                selected={activeFilter == null}
                onClick={() => setActiveFilter(null)}
              />
              <AuditSummaryWidget
                label="Negative Bank"
                value={formatNumber(negativeBankCount)}
                icon={AlertTriangle}
                accent="rose"
                interactive
                selected={activeFilter === 'negativeBank'}
                onClick={() => toggleCardFilter('negativeBank')}
              />
              <AuditSummaryWidget
                label="Compliance"
                value={compliance != null ? formatPercent(compliance) : '—'}
                icon={Rows3}
                accent="emerald"
              />
            </AuditSummaryGrid>
          </section>

          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h3 className="text-base font-bold text-emerald-700">Audit results</h3>
                  <p className="text-sm text-slate-500">
                    Exception rows with Credit (Cr) opening/closing balances.
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
                    disabled={exporting || filteredRecords.length === 0}
                    onClick={runExportCsv}
                  >
                    <Download className="h-4 w-4" />
                    Export CSV
                  </Button>
                  <Button
                    variant="secondary"
                    size="md"
                    disabled={exporting || filteredRecords.length === 0}
                    onClick={runExportPdf}
                  >
                    <FileText className="h-4 w-4" />
                    Export PDF
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardBody>
              {exceptionRecords.length || activeFilter != null ? (
                <div className="space-y-4">
                  <AuditFilterStrip
                    activeFilter={activeFilter}
                    labels={NEGATIVE_BANK_FILTER_LABELS}
                    count={filteredRecords.length}
                    onClear={() => setActiveFilter(null)}
                  />
                  {filteredRecords.length ? (
                    <AuditUploadResultsTable
                      data={filteredRecords}
                      columnOrder={tableColumnOrder}
                      columnDisplayHeaders={columnDisplayHeaders}
                      searchPlaceholder="Search exception rows…"
                    />
                  ) : (
                    <EmptyState
                      title="No rows for this filter"
                      description="Clear the filter to see all exception rows."
                    />
                  )}
                </div>
              ) : (
                <EmptyState
                  title="No issues detected"
                  description="Every evaluated row passed Negative Bank validation for this upload."
                />
              )}
            </CardBody>
          </Card>
        </>
      ) : !sheetError ? (
        <EmptyState
          icon={Landmark}
          title="Awaiting validation"
          description="Upload a Cash Book Excel file and run validation to populate Negative Bank results."
        />
      ) : null}
    </div>
  );
}
