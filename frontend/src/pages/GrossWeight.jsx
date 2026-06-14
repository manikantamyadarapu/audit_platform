import { useCallback, useMemo, useState } from 'react';
import { Scale, Loader2, Rows3, Download, FileSpreadsheet, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { FileUploadZone } from '../components/upload/FileUploadZone';
import { Button } from '../components/ui/Button';
import { AuditSummaryWidget } from '../components/cards/AuditSummaryWidget';
import { AuditSummaryGrid } from '../components/audit/AuditSummaryGrid';
import { EmptyState } from '../components/ui/EmptyState';
import { AuditUploadResultsTable } from '../components/tables/AuditUploadResultsTable';
import { AuditFilterStrip } from '../components/audit/AuditFilterStrip';
import { AuditSessionBanner } from '../components/audit/AuditSessionBanner';
import { validateGrossWeightExcel } from '../services/processExcelService';
import { formatNumber, formatPercent } from '../utils/format';
import { filterGrossWeightRecords, GROSS_FILTER_LABELS } from '../utils/grossRecordFilters';
import { downloadGrossWeightRecordsXlsx } from '../utils/grossXlsxExport';
import { exportRowsToCsv } from '../utils/csvExport';
import { exportRowsToPdf } from '../utils/pdfExport';
import {
  buildExportColumnDefs,
  resolveAuditColumnOrder,
} from '../utils/auditTableColumns';
import { auditToastError, auditToastSuccess } from '../utils/auditToast';
import { useAuditSessionPersistence } from '../hooks/useAuditSessionPersistence';
import { readAuditSessionData } from '../utils/auditSessionStorage';

const GROSS_WEIGHT_SESSION_KEY = 'gross-weight';

export default function GrossWeight() {
  const [file, setFile] = useState(null);
  const [restoredFileName, setRestoredFileName] = useState(
    () => readAuditSessionData(GROSS_WEIGHT_SESSION_KEY)?.fileName ?? null
  );
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [result, setResult] = useState(
    () => readAuditSessionData(GROSS_WEIGHT_SESSION_KEY)?.result ?? null
  );
  const [activeFilter, setActiveFilter] = useState(
    () => readAuditSessionData(GROSS_WEIGHT_SESSION_KEY)?.activeFilter ?? null
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
  } = useAuditSessionPersistence(GROSS_WEIGHT_SESSION_KEY, sessionSnapshot, {
    onApplySession: applySession,
  });

  const displayFile = file ?? (restoredFileName ? { name: restoredFileName } : null);

  const runComparison = useCallback(async () => {
    if (!file) {
      auditToastError('Choose an Excel file first.');
      return;
    }
    const ac = new AbortController();
    setLoading(true);
    setResult(null);
    setActiveFilter(null);
    try {
      const data = await validateGrossWeightExcel(file, ac.signal);
      if (data && data.success === false) {
        auditToastError(data.detail || 'Comparison failed');
        setResult(null);
        return;
      }
      setResult(data);
      persist({
        result: data,
        sheetError: null,
        activeFilter: null,
        fileName: file?.name ?? null,
      });
      auditToastSuccess('Gross weight comparison complete');
    } catch (e) {
      auditToastError(e.message || 'Comparison failed');
    } finally {
      setLoading(false);
    }
  }, [file, persist]);

  const rawRecords = result?.records;
  const filteredRecords = useMemo(
    () => filterGrossWeightRecords(rawRecords, activeFilter),
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
      downloadGrossWeightRecordsXlsx(
        filteredRecords,
        `gross-weight-rows-${tag}-${Date.now()}.xlsx`,
        exportColumnOrder
      );
      auditToastSuccess('Excel export downloaded');
    } finally {
      setExporting(false);
    }
  }, [filteredRecords, activeFilter, exportColumnOrder]);

  const runExportCsv = useCallback(() => {
    if (!filteredRecords.length) {
      auditToastError('No rows to export.');
      return;
    }
    const tag = activeFilter ? `filtered-${activeFilter}` : 'all';
    exportRowsToCsv(
      `gross-weight-rows-${tag}-${Date.now()}.csv`,
      exportColumns,
      filteredRecords
    );
    auditToastSuccess('CSV export downloaded');
  }, [filteredRecords, activeFilter, exportColumns]);

  const runExportPdf = useCallback(() => {
    if (!filteredRecords.length) {
      auditToastError('No rows to export.');
      return;
    }
    const tag = activeFilter ? `filtered-${activeFilter}` : 'all';
    exportRowsToPdf(
      `gross-weight-rows-${tag}-${Date.now()}.pdf`,
      'Gross weight audit — issue register',
      exportColumns,
      filteredRecords
    );
    auditToastSuccess('PDF export downloaded');
  }, [filteredRecords, activeFilter, exportColumns]);

  const totalRows = result?.totalRows ?? 0;
  const weightMismatch = result?.summary?.weightMismatch ?? result?.errorRows ?? 0;
  const compliance =
    totalRows > 0 ? Math.max(0, Math.min(100, ((totalRows - weightMismatch) / totalRows) * 100)) : null;

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
            <div className="flex flex-col items-center rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-surface-overlay)] px-10 py-8 shadow-2xl backdrop-blur-sm">
              <Loader2 className="h-10 w-10 animate-spin text-emerald-600 dark:text-emerald-400" />
              <p className="mt-4 text-sm font-semibold text-[var(--color-text-primary)]">Comparing weights…</p>
              <p className="mt-1 text-xs text-slate-500">Securely checking your workbook</p>
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
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" size="md" loading={loading} disabled={loading || !file} onClick={runComparison}>
                <FileSpreadsheet className="h-4 w-4" />
                Run comparison
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardBody>
          <FileUploadZone
            file={displayFile}
            onFileChange={(f) => {
              setRestoredFileName(null);
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
            <AuditSummaryGrid>
              <AuditSummaryWidget
                label="Total rows"
                value={formatNumber(totalRows)}
                icon={Rows3}
                accent="blue"
                importance="secondary"
              />
              <AuditSummaryWidget
                label="Weight mismatches"
                value={formatNumber(weightMismatch)}
                hint="Manual ≠ Auto Gross Wt."
                icon={Scale}
                accent="rose"
                variant="error"
                importance="critical"
                total={totalRows}
                interactive
                selected={activeFilter === 'mismatch'}
                onClick={() => toggleCardFilter('mismatch')}
              />
              <AuditSummaryWidget
                label="Compliance"
                value={compliance != null ? formatPercent(compliance) : '—'}
                hint="Clean rows / total rows"
                icon={Rows3}
                accent="emerald"
                variant="compliance"
                importance="critical"
              />
            </AuditSummaryGrid>
          </section>

          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h3 className="text-base font-bold text-emerald-700">Issue register</h3>
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
                  <AuditFilterStrip
                    activeFilter={activeFilter}
                    labels={GROSS_FILTER_LABELS}
                    count={filteredRecords.length}
                    onClear={() => setActiveFilter(null)}
                  />
                  <AuditUploadResultsTable
                    data={filteredRecords}
                    searchPlaceholder="Search issue rows…"
                  />
                </div>
              ) : (
                <EmptyState
                  title="No issues detected"
                  description="Every scanned row satisfied gross-weight checks, or non-data rows were skipped."
                />
              )}
            </CardBody>
          </Card>
        </>
      ) : (
        <EmptyState
          icon={Scale}
          title="Awaiting validation"
          description="Upload an Excel workbook and run comparison to populate summary metrics, issue badges, and exports."
        />
      )}
    </div>
  );
}
