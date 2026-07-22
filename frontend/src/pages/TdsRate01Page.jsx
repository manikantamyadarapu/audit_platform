import { useCallback, useMemo, useState } from 'react';
import {
  Percent,
  Users,
  UserX,
  Rows3,
  IndianRupee,
  Download,
  FileSpreadsheet,
  FileText,
  BadgeCheck,
} from 'lucide-react';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { AuditValidationOverlay } from '../components/ui/AuditValidationOverlay';
import { FileUploadZone } from '../components/upload/FileUploadZone';
import { Button } from '../components/ui/Button';
import { AuditSummaryWidget } from '../components/cards/AuditSummaryWidget';
import { AuditSummaryGrid } from '../components/audit/AuditSummaryGrid';
import { EmptyState } from '../components/ui/EmptyState';
import { AuditUploadResultsTable } from '../components/tables/AuditUploadResultsTable';
import { AuditSessionBanner } from '../components/audit/AuditSessionBanner';
import { exportTds01Report, validateTds01Excel } from '../services/tds01.service';
import { formatNumber, formatPercent } from '../utils/format';
import { formatProcessingErrorHuman } from '../utils/processingErrorUtils';
import { exportRowsToCsv } from '../utils/csvExport';
import { exportRowsToPdf } from '../utils/pdfExport';
import { auditToastError, auditToastSuccess } from '../utils/auditToast';
import { useAuditSessionPersistence } from '../hooks/useAuditSessionPersistence';
import { bootstrapAuditSessionState } from '../utils/auditSessionStorage';

const SESSION_KEY = 'tds-rate-0.1';

const TABLE_COLUMNS = ['party', 'purchases_during_year', 'tds_deductible'];
const TABLE_HEADERS = {
  party: 'Party',
  purchases_during_year: 'Purchases During Year',
  tds_deductible: 'TDS Deductible',
};

const EXPORT_COLUMN_DEFS = TABLE_COLUMNS.map((key) => ({
  header: TABLE_HEADERS[key],
  accessor: (row) => row?.[key],
}));

function slimSnapshot(data) {
  if (!data) return null;
  return {
    result: data.result ?? null,
    sheetError: data.sheetError ?? null,
    activeFilter: data.activeFilter ?? null,
    fileName: data.fileName ?? null,
  };
}

export default function TdsRate01Page() {
  const [initialSession] = useState(() => bootstrapAuditSessionState(SESSION_KEY));
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
  } = useAuditSessionPersistence(SESSION_KEY, sessionSnapshot, {
    transform: slimSnapshot,
    onApplySession: applySession,
    onSaveFailed: () => {
      auditToastError('Could not save audit results locally. Free browser storage or start a new audit.');
    },
  });

  const displayFile = file ?? (restoredFileName ? { name: restoredFileName } : null);

  const runAudit = useCallback(async () => {
    if (!file) {
      auditToastError('Choose a Purchase Voucher Listing Excel file first.');
      return;
    }
    setLoading(true);
    try {
      const data = await validateTds01Excel(file);
      if (data && data.success === false) {
        auditToastError(data.detail || 'Audit failed');
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
      auditToastSuccess('TDS @ 0.1% audit complete');
    } catch (e) {
      const payload = e.details ?? null;
      setSheetError(payload);
      setResult(null);
      auditToastError(e.message || 'Audit failed');
    } finally {
      setLoading(false);
    }
  }, [file, persist]);

  const summaryRecords = useMemo(() => {
    const rows = result?.summaryRecords ?? result?.records ?? [];
    return Array.isArray(rows) ? rows : [];
  }, [result]);

  const detailedRecords = useMemo(() => {
    const rows = result?.detailedRecords ?? [];
    return Array.isArray(rows) ? rows : [];
  }, [result]);

  const filteredRecords = useMemo(() => summaryRecords, [summaryRecords]);

  const runExportExcel = useCallback(async () => {
    if (!summaryRecords.length && !detailedRecords.length) {
      auditToastError('No rows to export.');
      return;
    }
    setExporting(true);
    try {
      await exportTds01Report({
        detailedRecords,
        summaryRecords,
      });
      auditToastSuccess('TDS_0_1_Report.xlsx downloaded');
    } catch (e) {
      auditToastError(e.message || 'Excel export failed');
    } finally {
      setExporting(false);
    }
  }, [detailedRecords, summaryRecords]);

  const runExportCsv = useCallback(() => {
    if (!filteredRecords.length) {
      auditToastError('No rows to export.');
      return;
    }
    exportRowsToCsv(`tds-0.1-summary-${Date.now()}.csv`, EXPORT_COLUMN_DEFS, filteredRecords);
    auditToastSuccess('CSV export downloaded');
  }, [filteredRecords]);

  const runExportPdf = useCallback(() => {
    if (!filteredRecords.length) {
      auditToastError('No rows to export.');
      return;
    }
    exportRowsToPdf(
      `tds-0.1-summary-${Date.now()}.pdf`,
      'TDS @ 0.1% — eligible supplier summary',
      EXPORT_COLUMN_DEFS,
      filteredRecords
    );
    auditToastSuccess('PDF export downloaded');
  }, [filteredRecords]);

  const summary = result?.summary ?? {};
  const totalRecords = summary.totalRecords ?? result?.totalRows ?? 0;
  const eligibleSuppliers = summary.eligibleSuppliers ?? 0;
  const nonEligibleSuppliers = summary.nonEligibleSuppliers ?? 0;
  const totalPurchaseAmount = summary.totalPurchaseAmount ?? 0;
  const totalTdsDeductible = summary.totalTdsDeductible ?? 0;
  const compliancePercent = summary.compliancePercent ?? null;

  return (
    <div className="relative space-y-8">
      <AuditValidationOverlay open={loading} label="Calculating TDS @ 0.1%…" />

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-emerald-700">Upload &amp; validate</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Upload a Purchase Voucher Listing Excel file. Suppliers with purchases above
                ₹50,00,000 are assessed for TDS @ 0.1%.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="primary"
                size="md"
                loading={loading}
                disabled={loading || !file}
                onClick={runAudit}
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
                label="Total Records"
                value={formatNumber(totalRecords)}
                icon={Rows3}
                accent="blue"
              />
              <AuditSummaryWidget
                label="Eligible Suppliers"
                value={formatNumber(eligibleSuppliers)}
                icon={Users}
                accent="emerald"
              />
              <AuditSummaryWidget
                label="Non Eligible Suppliers"
                value={formatNumber(nonEligibleSuppliers)}
                icon={UserX}
                accent="amber"
              />
              <AuditSummaryWidget
                label="Total Purchase Amount"
                value={formatNumber(totalPurchaseAmount, 2)}
                icon={IndianRupee}
                accent="blue"
              />
              <AuditSummaryWidget
                label="Total TDS Deductible"
                value={formatNumber(totalTdsDeductible, 2)}
                icon={Percent}
                accent="emerald"
              />
              <AuditSummaryWidget
                label="Compliance %"
                value={
                  compliancePercent == null
                    ? '—'
                    : formatPercent(compliancePercent, 1)
                }
                icon={BadgeCheck}
                accent="emerald"
              />
            </AuditSummaryGrid>
          </section>

          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-base font-semibold text-emerald-800">Eligible supplier summary</h3>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                    One row per supplier above the ₹50,00,000 threshold. Download Excel for Detailed + Summary sheets.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={exporting}
                    disabled={exporting || (!summaryRecords.length && !detailedRecords.length)}
                    onClick={runExportExcel}
                  >
                    <Download className="h-4 w-4" />
                    Excel
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={!filteredRecords.length}
                    onClick={runExportCsv}
                  >
                    <FileText className="h-4 w-4" />
                    CSV
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={!filteredRecords.length}
                    onClick={runExportPdf}
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                    PDF
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardBody className="space-y-4">
              {filteredRecords.length ? (
                <AuditUploadResultsTable
                  data={filteredRecords}
                  columnOrder={TABLE_COLUMNS}
                  columnDisplayHeaders={TABLE_HEADERS}
                />
              ) : (
                <EmptyState
                  title="No eligible suppliers"
                  description="No supplier exceeded purchases of ₹50,00,000 in the uploaded voucher listing."
                />
              )}
            </CardBody>
          </Card>
        </>
      ) : null}
    </div>
  );
}
