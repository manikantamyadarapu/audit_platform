import { useCallback, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Download,
  FileSpreadsheet,
  FileText,
  Rows3,
} from 'lucide-react';
import { FileUploadZone } from '../components/upload/FileUploadZone';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { AuditValidationOverlay } from '../components/ui/AuditValidationOverlay';
import { Button } from '../components/ui/Button';
import { AuditUploadResultsTable } from '../components/tables/AuditUploadResultsTable';
import { EmptyState } from '../components/ui/EmptyState';
import { AuditSummaryWidget } from '../components/cards/AuditSummaryWidget';
import { AuditSummaryGroup } from '../components/audit/AuditSummaryGrid';
import { validatePanExcel } from '../services/panService';
import { formatNumber } from '../utils/format';
import { AuditFilterStrip } from '../components/audit/AuditFilterStrip';
import { AuditSessionBanner } from '../components/audit/AuditSessionBanner';
import { useAuditSessionPersistence } from '../hooks/useAuditSessionPersistence';
import {
  bootstrapAuditSessionState,
  slimPanSnapshot,
} from '../utils/auditSessionStorage';
import { filterPanRecords, PAN_FILTER_LABELS } from '../utils/panRecordFilters';
import { downloadPanRecordsXlsx } from '../utils/panXlsxExport';
import { exportRowsToCsv } from '../utils/csvExport';
import { exportRowsToPdf } from '../utils/pdfExport';
import {
  buildExportColumnDefs,
  resolveAuditColumnOrder,
} from '../utils/auditTableColumns';
import { auditToastError, auditToastSuccess } from '../utils/auditToast';
import { useAppUi } from '../context/AppUiContext';

const PAN_SESSION_KEY = 'pan-audit';

export default function PanVerification() {
  const { recordPanValidation, recordExport } = useAppUi();
  const [initialSession] = useState(() => bootstrapAuditSessionState(PAN_SESSION_KEY));
  const [file, setFile] = useState(null);
  const [restoredFileName, setRestoredFileName] = useState(
    () => initialSession.data?.fileName ?? null
  );
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [result, setResult] = useState(() => initialSession.data?.result ?? null);
  const [activeFilter, setActiveFilter] = useState(
    () => initialSession.data?.activeFilter ?? null
  );

  const applySession = useCallback((data) => {
    setResult(data?.result ?? null);
    setActiveFilter(data?.activeFilter ?? null);
    setRestoredFileName(data?.fileName ?? null);
    setFile(null);
  }, []);

  const sessionSnapshot = useMemo(
    () => ({
      result,
      sheetError: null,
      activeFilter,
      fileName: file?.name ?? restoredFileName ?? null,
    }),
    [result, activeFilter, file?.name, restoredFileName]
  );

  const {
    sessionLabel,
    sessionMeta,
    persist,
    restoreSession,
    startNewAudit,
    restoring,
  } = useAuditSessionPersistence(PAN_SESSION_KEY, sessionSnapshot, {
    transform: slimPanSnapshot,
    onApplySession: applySession,
    onSaveFailed: () => {
      auditToastError('Could not save audit results locally. Free browser storage or start a new audit.');
    },
  });

  const displayFile = file ?? (restoredFileName ? { name: restoredFileName } : null);

  const runValidate = useCallback(async () => {
    if (!file) {
      auditToastError('Choose an Excel file first.');
      return;
    }
    const ac = new AbortController();
    setLoading(true);
    try {
      const data = await validatePanExcel(file, ac.signal);
      if (data && data.success === false) {
        auditToastError(data.detail || 'Validation failed');
        return;
      }
      setResult(data);
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
        auditToastError('Results loaded but could not be saved for later. Clear browser storage if this persists.');
      }
      recordPanValidation({
        totalRows: data.totalRows,
        errorRows: data.errorRows,
      });
      auditToastSuccess('PAN validation complete');
    } catch (e) {
      auditToastError(e.message || 'Validation failed');
    } finally {
      setLoading(false);
    }
  }, [file, persist, recordPanValidation]);

  const rawRecords = result?.records;
  const filteredRecords = useMemo(
    () => filterPanRecords(rawRecords, activeFilter),
    [rawRecords, activeFilter]
  );

  const toggleCardFilter = useCallback((key) => {
    setActiveFilter((prev) => (prev === key ? null : key));
  }, []);

  const exportColumnOrder = useMemo(
    () => (filteredRecords.length ? resolveAuditColumnOrder(filteredRecords) : []),
    [filteredRecords]
  );

  const exportColumns = useMemo(
    () => buildExportColumnDefs(exportColumnOrder, filteredRecords),
    [exportColumnOrder, filteredRecords]
  );

  const runExportExcel = useCallback(() => {
    if (!filteredRecords.length) {
      auditToastError('No rows to export.');
      return;
    }
    setExporting(true);
    try {
      const tag = activeFilter ? `filtered-${activeFilter}` : 'all';
      downloadPanRecordsXlsx(
        filteredRecords,
        `pan-rows-${tag}-${Date.now()}.xlsx`,
        exportColumnOrder
      );
      recordExport();
      auditToastSuccess('Excel export downloaded');
    } finally {
      setExporting(false);
    }
  }, [filteredRecords, activeFilter, exportColumnOrder, recordExport]);

  const runExportCsv = useCallback(() => {
    if (!filteredRecords.length) {
      auditToastError('No rows to export.');
      return;
    }
    const tag = activeFilter ? `filtered-${activeFilter}` : 'all';
    exportRowsToCsv(
      `pan-rows-${tag}-${Date.now()}.csv`,
      exportColumns,
      filteredRecords
    );
    recordExport();
    auditToastSuccess('CSV export downloaded');
  }, [filteredRecords, activeFilter, exportColumns, recordExport]);

  const runExportPdf = useCallback(() => {
    if (!filteredRecords.length) {
      auditToastError('No rows to export.');
      return;
    }
    const tag = activeFilter ? `filtered-${activeFilter}` : 'all';
    exportRowsToPdf(
      `pan-rows-${tag}-${Date.now()}.pdf`,
      'PAN audit — report',
      exportColumns,
      filteredRecords
    );
    recordExport();
    auditToastSuccess('PDF export downloaded');
  }, [filteredRecords, activeFilter, exportColumns, recordExport]);

  const summary = result?.summary ?? {};
  const totalRows = result?.totalRows ?? 0;
  const noPanNoForm60Count = summary.noPanNoForm60Count ?? 0;
  const noPanForm60AvailableCount = summary.noPanForm60AvailableCount ?? 0;
  const noPanInvalidForm60Count = summary.noPanInvalidForm60Count ?? 0;
  const gst50kAddressMissingCount = summary.gst50kAddressMissingCount ?? 0;
  const incorrectAddressFormatCount = summary.incorrectAddressFormatCount ?? 0;
  const validAddressFormatCount = summary.validAddressFormatCount ?? 0;

  return (
    <div className="relative space-y-8">
      <AuditValidationOverlay open={loading} />

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
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" size="md" loading={loading} disabled={loading || !file} onClick={runValidate}>
                <FileSpreadsheet className="h-4 w-4" />
                Validate file
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardBody>
          <FileUploadZone
            file={displayFile}
            onFileChange={(f) => {
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
        <>
          <section>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.14em] text-emerald-700/90">
              Audit intelligence summary
            </h3>

            <div className="space-y-6">
              <AuditSummaryGroup title="PAN summary">
                <AuditSummaryWidget
                  label="Total workbook rows"
                  value={formatNumber(totalRows)}
                  icon={Rows3}
                  accent="blue"
                  importance="secondary"
                />
                <AuditSummaryWidget
                  label="valid pan"
                  value={formatNumber(summary.validPanCount ?? 0)}
                  icon={Rows3}
                  accent="emerald"
                  total={totalRows}
                  interactive
                  selected={activeFilter === 'validPan'}
                  onClick={() => toggleCardFilter('validPan')}
                />
                <AuditSummaryWidget
                  label="incorrect pan format"
                  value={formatNumber(summary.incorrectPanFormatCount ?? summary.invalidPanFormatCount ?? summary.invalidPanFormat ?? 0)}
                  icon={AlertTriangle}
                  accent="rose"
                  variant="error"
                  total={totalRows}
                  interactive
                  selected={activeFilter === 'invalidPan'}
                  onClick={() => toggleCardFilter('invalidPan')}
                />
                <AuditSummaryWidget
                  label="form 60 available"
                  value={formatNumber(noPanForm60AvailableCount)}
                  icon={AlertTriangle}
                  accent="emerald"
                  total={totalRows}
                  interactive
                  selected={activeFilter === 'noPanForm60Available'}
                  onClick={() => toggleCardFilter('noPanForm60Available')}
                />
                <AuditSummaryWidget
                  label="no pan & invalid form 60"
                  value={formatNumber(noPanInvalidForm60Count)}
                  icon={AlertTriangle}
                  accent="rose"
                  variant="error"
                  total={totalRows}
                  interactive
                  selected={activeFilter === 'noPanInvalidForm60'}
                  onClick={() => toggleCardFilter('noPanInvalidForm60')}
                />
                <AuditSummaryWidget
                  label="no pan & no form 60"
                  value={formatNumber(noPanNoForm60Count)}
                  icon={AlertTriangle}
                  accent="amber"
                  variant="error"
                  total={totalRows}
                  interactive
                  selected={activeFilter === 'noPanNoForm60'}
                  onClick={() => toggleCardFilter('noPanNoForm60')}
                />
              </AuditSummaryGroup>

              <AuditSummaryGroup title="Address checks">
                <AuditSummaryWidget
                  label="addressing missing"
                  value={formatNumber(gst50kAddressMissingCount)}
                  icon={AlertTriangle}
                  accent="amber"
                  total={totalRows}
                  interactive
                  selected={activeFilter === 'gst50kAddressMissing'}
                  onClick={() => toggleCardFilter('gst50kAddressMissing')}
                />
                <AuditSummaryWidget
                  label="incorrect address format"
                  value={formatNumber(incorrectAddressFormatCount)}
                  icon={AlertTriangle}
                  accent="rose"
                  variant="error"
                  total={totalRows}
                  interactive
                  selected={activeFilter === 'incorrectAddressFormat'}
                  onClick={() => toggleCardFilter('incorrectAddressFormat')}
                />
                <AuditSummaryWidget
                  label="valid address format"
                  value={formatNumber(validAddressFormatCount)}
                  icon={AlertTriangle}
                  accent="emerald"
                  total={totalRows}
                  interactive
                  selected={activeFilter === 'validAddressFormat'}
                  onClick={() => toggleCardFilter('validAddressFormat')}
                />
              </AuditSummaryGroup>
            </div>
          </section>

          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h3 className="text-base font-bold text-emerald-700">PAN reports</h3>
                  <p className="text-sm text-slate-500">Rows where Total Value is above ₹2L and PAN/PAN1 is present or Form 60 status</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="primary"
                    size="md"
                    loading={exporting}
                    disabled={exporting || filteredRecords.length === 0}
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
              {result.records?.length || activeFilter != null ? (
                <div className="space-y-4">
                  <div className="space-y-3">
                    <AuditFilterStrip
                      activeFilter={activeFilter}
                      labels={PAN_FILTER_LABELS}
                      count={filteredRecords.length}
                      onClear={() => setActiveFilter(null)}
                    />
                    <AuditUploadResultsTable
                      data={filteredRecords}
                      searchPlaceholder="Search PAN report rows…"
                    />
                  </div>
                </div>
              ) : (
                <EmptyState
                  title="No PAN report rows"
                  description="No rows matched Total Value > ₹2L with PAN or PAN1 present."
                />
              )}
            </CardBody>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Awaiting validation"
          description="Upload an Excel workbook and run validate to populate analytics, issue badges, and exports."
        />
      )}
    </div>
  );
}
