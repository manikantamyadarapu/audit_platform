import { useCallback, useMemo, useState } from 'react';
import {
  Receipt,
  Users,
  IndianRupee,
  Download,
  FileSpreadsheet,
  FileText,
  ShoppingBag,
  Landmark,
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
import { WatchDemoButton } from '../components/demo/WatchDemoButton';
import {
  exportPartyWiseTdsSummary,
  validatePartyWiseTdsSummary,
} from '../services/partyWiseTds.service';
import { formatNumber } from '../utils/format';
import { formatProcessingErrorHuman } from '../utils/processingErrorUtils';
import { exportRowsToCsv } from '../utils/csvExport';
import { exportRowsToPdf } from '../utils/pdfExport';
import { auditToastError, auditToastSuccess } from '../utils/auditToast';
import { useAuditSessionPersistence } from '../hooks/useAuditSessionPersistence';
import { bootstrapAuditSessionState } from '../utils/auditSessionStorage';

const SESSION_KEY = 'party-wise-tds';

const SOURCE_PURCHASE = 'Purchase Goods';
const SOURCE_PAYABLE = 'TDS Payable';

const TABLE_COLUMNS = ['contra_account', 'total_tds_amount', 'source'];
const TABLE_HEADERS = {
  contra_account: 'Contra Account',
  total_tds_amount: 'Total TDS Amount',
  source: 'Source',
};

const FILTER_LABELS = {
  total: 'All parties',
  purchase: 'Purchase Goods',
  payable: 'TDS Payable',
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
    purchaseFileName: data.purchaseFileName ?? null,
    payableFileName: data.payableFileName ?? null,
  };
}

function filterRecords(records, activeFilter) {
  if (!activeFilter) return records;
  if (activeFilter === 'purchase') {
    return records.filter((r) => r.source === SOURCE_PURCHASE);
  }
  if (activeFilter === 'payable') {
    return records.filter((r) => r.source === SOURCE_PAYABLE);
  }
  return records;
}

export default function PartyWiseTdsSummaryPage() {
  const [initialSession] = useState(() => bootstrapAuditSessionState(SESSION_KEY));
  const [purchaseFile, setPurchaseFile] = useState(null);
  const [payableFile, setPayableFile] = useState(null);
  const [restoredPurchaseName, setRestoredPurchaseName] = useState(
    () => initialSession.data?.purchaseFileName ?? null
  );
  const [restoredPayableName, setRestoredPayableName] = useState(
    () => initialSession.data?.payableFileName ?? null
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
    setActiveFilter(data?.activeFilter ?? null);
    setRestoredPurchaseName(data?.purchaseFileName ?? null);
    setRestoredPayableName(data?.payableFileName ?? null);
    setPurchaseFile(null);
    setPayableFile(null);
  }, []);

  const sessionSnapshot = useMemo(
    () => ({
      result,
      sheetError,
      activeFilter,
      purchaseFileName: purchaseFile?.name ?? restoredPurchaseName ?? null,
      payableFileName: payableFile?.name ?? restoredPayableName ?? null,
    }),
    [
      result,
      sheetError,
      activeFilter,
      purchaseFile?.name,
      payableFile?.name,
      restoredPurchaseName,
      restoredPayableName,
    ]
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
      auditToastError('Could not save summary locally. Free browser storage or start a new audit.');
    },
  });

  const displayPurchase =
    purchaseFile ?? (restoredPurchaseName ? { name: restoredPurchaseName } : null);
  const displayPayable =
    payableFile ?? (restoredPayableName ? { name: restoredPayableName } : null);

  const bothReady = Boolean(purchaseFile && payableFile);

  const resetResults = useCallback(() => {
    setSheetError(null);
    setResult(null);
    setActiveFilter(null);
  }, []);

  const runSummary = useCallback(async () => {
    if (!purchaseFile || !payableFile) {
      auditToastError('Upload both Excel files before generating the summary.');
      return;
    }
    setLoading(true);
    try {
      const data = await validatePartyWiseTdsSummary(purchaseFile, payableFile);
      if (data && data.success === false) {
        auditToastError(data.detail || 'Summary failed');
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
          purchaseFileName: purchaseFile.name,
          payableFileName: payableFile.name,
        },
        { notifyOnFailure: true, force: true }
      );
      if (saved === false) {
        auditToastError('Summary loaded but could not be saved for later.');
      }
      auditToastSuccess('Party Wise TDS Summary complete');
    } catch (e) {
      const payload = e.details ?? null;
      setSheetError(payload);
      setResult(null);
      auditToastError(e.message || 'Summary failed');
    } finally {
      setLoading(false);
    }
  }, [purchaseFile, payableFile, persist]);

  const records = useMemo(() => {
    const rows = result?.records ?? [];
    return Array.isArray(rows) ? rows : [];
  }, [result]);

  const filteredRecords = useMemo(
    () => filterRecords(records, activeFilter),
    [records, activeFilter]
  );

  const summary = result?.summary ?? {};

  const toggleFilter = useCallback((key) => {
    setActiveFilter((prev) => (prev === key ? null : key));
  }, []);

  const handleExportExcel = useCallback(async () => {
    if (!result) {
      auditToastError('Generate a summary first.');
      return;
    }
    setExporting(true);
    try {
      await exportPartyWiseTdsSummary({
        purchaseSummary: result.purchaseSummary ?? [],
        payableSummary: result.payableSummary ?? [],
      });
      auditToastSuccess('Exported Party_Wise_TDS_Summary.xlsx');
    } catch (e) {
      auditToastError(e.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  }, [result]);

  const handleExportCsv = useCallback(() => {
    if (!filteredRecords.length) {
      auditToastError('No rows to export.');
      return;
    }
    const tag = activeFilter ? `filtered-${activeFilter}` : 'all';
    exportRowsToCsv(
      `Party_Wise_TDS_Summary-${tag}-${Date.now()}.csv`,
      EXPORT_COLUMN_DEFS,
      filteredRecords
    );
    auditToastSuccess('CSV downloaded');
  }, [filteredRecords, activeFilter]);

  const handleExportPdf = useCallback(() => {
    if (!filteredRecords.length) {
      auditToastError('No rows to export.');
      return;
    }
    const tag = activeFilter ? `filtered-${activeFilter}` : 'all';
    exportRowsToPdf(
      `Party_Wise_TDS_Summary-${tag}-${Date.now()}.pdf`,
      'Party Wise TDS Summary',
      EXPORT_COLUMN_DEFS,
      filteredRecords
    );
    auditToastSuccess('PDF downloaded');
  }, [filteredRecords, activeFilter]);

  const handleStartNew = useCallback(() => {
    startNewAudit();
    setPurchaseFile(null);
    setPayableFile(null);
    setRestoredPurchaseName(null);
    setRestoredPayableName(null);
    setResult(null);
    setSheetError(null);
    setActiveFilter(null);
  }, [startNewAudit]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-slate-50">
          Party Wise TDS Summary
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Upload both TDS ledgers to generate a consolidated party-wise credit summary.
          Informational only — no pass/fail or reconciliation.
        </p>
      </div>

      {result ? (
        <AuditSessionBanner
          sessionMeta={sessionMeta}
          sessionLabel={sessionLabel}
          hasResults={Boolean(result)}
          onRestore={restoreSession}
          onStartNew={handleStartNew}
          restoring={restoring}
        />
      ) : null}

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-emerald-700">Upload &amp; summarise</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Both files are mandatory. Processing starts only after both uploads are selected.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <WatchDemoButton moduleKey="tds-audit" />
              <Button
                variant="primary"
                size="md"
                loading={loading}
                disabled={loading || !bothReady}
                onClick={runSummary}
              >
                <FileSpreadsheet className="h-4 w-4" />
                Generate Summary
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardBody>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <ShoppingBag className="h-4 w-4 text-emerald-600" />
                TDS on Purchase of Goods
              </div>
              <p className="text-xs text-slate-500">File 1 — required</p>
              <FileUploadZone
                file={displayPurchase}
                onFileChange={(f) => {
                  resetResults();
                  setRestoredPurchaseName(null);
                  setPurchaseFile(f);
                }}
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <Landmark className="h-4 w-4 text-violet-600" />
                TDS Payable Account
              </div>
              <p className="text-xs text-slate-500">File 2 — required</p>
              <FileUploadZone
                file={displayPayable}
                onFileChange={(f) => {
                  resetResults();
                  setRestoredPayableName(null);
                  setPayableFile(f);
                }}
                disabled={loading}
              />
            </div>
          </div>
          {!bothReady ? (
            <p className="mt-4 text-sm text-slate-500">
              Select both Excel files to enable summary generation.
            </p>
          ) : null}
        </CardBody>
      </Card>

      <AuditValidationOverlay open={loading} label="Building party-wise TDS summary…" />

      {sheetError ? (
        <Card className="border-rose-200/80 bg-rose-50/40 shadow-md">
          <CardHeader>
            <h3 className="text-base font-semibold text-rose-950">
              Sheet did not match required layout
            </h3>
            <p className="mt-1 text-sm text-rose-900/80">
              Both ledgers must use Cash Book columns (Date, Voucher No, Contra Account, Debit,
              Credit, Balance, …). Fix the workbook using the checklist below.
            </p>
          </CardHeader>
          <CardBody className="space-y-4">
            <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-xl bg-[var(--color-surface-elevated)] p-4 font-mono text-xs text-[var(--color-text-primary)] shadow-inner">
              {formatProcessingErrorHuman(sheetError)}
            </pre>
            {sheetError.error ? (
              <details className="rounded-xl border border-slate-200/80 bg-white/80 px-4 py-3 text-sm">
                <summary className="cursor-pointer font-medium text-slate-700">
                  Technical: error payload
                </summary>
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
              Summary intelligence
            </h3>
            <AuditSummaryGrid>
              <AuditSummaryWidget
                label="Total Parties (Purchase)"
                value={formatNumber(summary.purchasePartyCount ?? 0)}
                icon={Users}
                accent="blue"
                interactive
                selected={activeFilter === 'purchase'}
                onClick={() => toggleFilter('purchase')}
              />
              <AuditSummaryWidget
                label="Total Parties (Payable)"
                value={formatNumber(summary.payablePartyCount ?? 0)}
                icon={Users}
                accent="violet"
                interactive
                selected={activeFilter === 'payable'}
                onClick={() => toggleFilter('payable')}
              />
              <AuditSummaryWidget
                label="Total TDS Amount (Purchase)"
                value={formatNumber(summary.purchaseTotalTds ?? 0)}
                icon={IndianRupee}
                accent="emerald"
                interactive
                selected={activeFilter === 'purchase'}
                onClick={() => toggleFilter('purchase')}
              />
              <AuditSummaryWidget
                label="Total TDS Amount (Payable)"
                value={formatNumber(summary.payableTotalTds ?? 0)}
                icon={IndianRupee}
                accent="amber"
                interactive
                selected={activeFilter === 'payable'}
                onClick={() => toggleFilter('payable')}
              />
            </AuditSummaryGrid>
          </section>

          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h3 className="text-base font-bold text-emerald-700">Party summary</h3>
                  <p className="text-sm text-slate-500">
                    Contra Account · Total TDS Amount · Source (Purchase Goods / TDS Payable)
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="primary"
                    size="md"
                    loading={exporting}
                    disabled={exporting || !result}
                    onClick={handleExportExcel}
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                    Export Excel
                  </Button>
                  <Button
                    variant="secondary"
                    size="md"
                    disabled={exporting || filteredRecords.length === 0}
                    onClick={handleExportCsv}
                  >
                    <Download className="h-4 w-4" />
                    Export CSV
                  </Button>
                  <Button
                    variant="secondary"
                    size="md"
                    disabled={exporting || filteredRecords.length === 0}
                    onClick={handleExportPdf}
                  >
                    <FileText className="h-4 w-4" />
                    Export PDF
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardBody>
              {records.length || activeFilter != null ? (
                <div className="space-y-4">
                  <AuditFilterStrip
                    activeFilter={activeFilter}
                    labels={FILTER_LABELS}
                    count={filteredRecords.length}
                    onClear={() => setActiveFilter(null)}
                  />
                  {filteredRecords.length ? (
                    <AuditUploadResultsTable
                      data={filteredRecords}
                      columnOrder={TABLE_COLUMNS}
                      exportColumns={TABLE_COLUMNS}
                      columnDisplayHeaders={TABLE_HEADERS}
                      searchPlaceholder="Search contra account…"
                    />
                  ) : (
                    <EmptyState
                      icon={Receipt}
                      title="No rows for this filter"
                      description="Try the other source widget or clear the filter to see all parties."
                    />
                  )}
                </div>
              ) : (
                <EmptyState
                  icon={FileSpreadsheet}
                  title="No records found"
                  description="Neither ledger produced party credit totals."
                />
              )}
            </CardBody>
          </Card>
        </>
      ) : null}
    </div>
  );
}
