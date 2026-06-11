import { useCallback, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  Download,
  FileSpreadsheet,
  Loader2,
  Rows3,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { FileUploadZone } from '../components/upload/FileUploadZone';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { PanResultsTable } from '../components/tables/PanResultsTable';
import { EmptyState } from '../components/ui/EmptyState';
import { KpiCard } from '../components/cards/KpiCard';
import { validatePanExcel } from '../services/panService';
import { formatNumber } from '../utils/format';
import { AuditFilterStrip } from '../components/audit/AuditFilterStrip';
import { AuditSessionBanner } from '../components/audit/AuditSessionBanner';
import { useAuditSessionPersistence } from '../hooks/useAuditSessionPersistence';
import { readAuditSessionData } from '../utils/auditSessionStorage';
import { filterPanRecords, PAN_FILTER_LABELS } from '../utils/panRecordFilters';
import { downloadPanRecordsXlsx } from '../utils/panXlsxExport';
import { useAppUi } from '../context/AppUiContext';

const PAN_SESSION_KEY = 'pan-audit';

export default function PanVerification() {
  const { recordPanValidation, recordExport } = useAppUi();
  const [file, setFile] = useState(null);
  const [restoredFileName, setRestoredFileName] = useState(
    () => readAuditSessionData(PAN_SESSION_KEY)?.fileName ?? null
  );
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [result, setResult] = useState(
    () => readAuditSessionData(PAN_SESSION_KEY)?.result ?? null
  );
  const [activeFilter, setActiveFilter] = useState(
    () => readAuditSessionData(PAN_SESSION_KEY)?.activeFilter ?? null
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
    onApplySession: applySession,
  });

  const displayFile = file ?? (restoredFileName ? { name: restoredFileName } : null);

  const runValidate = useCallback(async () => {
    if (!file) {
      toast.error('Choose an Excel file first.');
      return;
    }
    const ac = new AbortController();
    setLoading(true);
    setResult(null);
    setActiveFilter(null);
    try {
      const data = await validatePanExcel(file, ac.signal);
      if (data && data.success === false) {
        toast.error(data.detail || 'Validation failed');
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
      recordPanValidation({
        totalRows: data.totalRows,
        errorRows: data.errorRows,
      });
      toast.success('PAN validation complete');
    } catch (e) {
      toast.error(e.message || 'Validation failed');
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

  const runExport = useCallback(() => {
    if (!filteredRecords.length) {
      toast.error('No rows to export.');
      return;
    }
    setExporting(true);
    try {
      const tag = activeFilter ? `filtered-${activeFilter}` : 'all';
      downloadPanRecordsXlsx(filteredRecords, `pan-rows-${tag}-${Date.now()}.xlsx`);
      recordExport();
      toast.success('Excel export downloaded');
    } finally {
      setExporting(false);
    }
  }, [filteredRecords, activeFilter, recordExport]);

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
              <p className="mt-4 text-sm font-semibold text-[var(--color-text-primary)]">Validating workbook…</p>
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
              setFile(f);
            }}
            disabled={loading}
          />
        </CardBody>
      </Card>

      {result ? (
        <>
          <section>
            <h3 className="mb-4 text-base font-bold text-emerald-700">Summary</h3>

            {/* KPI widgets arranged in two labeled rows for clarity */}
            <div>
              <div className="mb-2 text-sm font-semibold text-slate-700">PAN summary</div>
              <div className="flex flex-nowrap gap-4 overflow-x-auto pb-1">
                <KpiCard
                  label="Total workbook rows"
                  value={formatNumber(totalRows)}
                  icon={Rows3}
                  accent="blue"
                />
                <KpiCard
                  label="Valid PAN"
                  value={formatNumber(summary.validPanCount ?? 0)}
                  icon={Rows3}
                  accent="emerald"
                  interactive
                  selected={activeFilter === 'validPan'}
                  onClick={() => toggleCardFilter('validPan')}
                />
                <KpiCard
                  label="Incorrect PAN format"
                  value={formatNumber(summary.incorrectPanFormatCount ?? summary.invalidPanFormatCount ?? summary.invalidPanFormat ?? 0)}
                  icon={AlertTriangle}
                  accent="rose"
                  interactive
                  selected={activeFilter === 'invalidPan'}
                  onClick={() => toggleCardFilter('invalidPan')}
                />
                <KpiCard
                  label="No PAN & Form 60 Available"
                  value={formatNumber(noPanForm60AvailableCount)}
                  icon={AlertTriangle}
                  accent="emerald"
                  interactive
                  selected={activeFilter === 'noPanForm60Available'}
                  onClick={() => toggleCardFilter('noPanForm60Available')}
                />
                <KpiCard
                  label="No PAN & Invalid Form 60"
                  value={formatNumber(noPanInvalidForm60Count)}
                  icon={AlertTriangle}
                  accent="rose"
                  interactive
                  selected={activeFilter === 'noPanInvalidForm60'}
                  onClick={() => toggleCardFilter('noPanInvalidForm60')}
                />
                <KpiCard
                  label="No PAN & No Form 60"
                  value={formatNumber(noPanNoForm60Count)}
                  icon={AlertTriangle}
                  accent="amber"
                  interactive
                  selected={activeFilter === 'noPanNoForm60'}
                  onClick={() => toggleCardFilter('noPanNoForm60')}
                />
              </div>

              <div className="mt-4 mb-2 text-sm font-semibold text-slate-700">Address checks</div>
              <div className="flex flex-nowrap gap-4 overflow-x-auto pb-1">
                <KpiCard
                  label="gst>=50k address missing"
                  value={formatNumber(gst50kAddressMissingCount)}
                  icon={AlertTriangle}
                  accent="amber"
                  interactive
                  selected={activeFilter === 'gst50kAddressMissing'}
                  onClick={() => toggleCardFilter('gst50kAddressMissing')}
                />
                <KpiCard
                  label="incorrect address format"
                  value={formatNumber(incorrectAddressFormatCount)}
                  icon={AlertTriangle}
                  accent="rose"
                  interactive
                  selected={activeFilter === 'incorrectAddressFormat'}
                  onClick={() => toggleCardFilter('incorrectAddressFormat')}
                />
                <KpiCard
                  label="valid address format"
                  value={formatNumber(validAddressFormatCount)}
                  icon={AlertTriangle}
                  accent="emerald"
                  interactive
                  selected={activeFilter === 'validAddressFormat'}
                  onClick={() => toggleCardFilter('validAddressFormat')}
                />
              </div>
            </div>
          </section>

          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h3 className="text-base font-bold text-emerald-700">PAN reports</h3>
                  <p className="text-sm text-slate-500">Rows where Total Value is above ₹2L and PAN/PAN1 is present or Form 60 status</p>
                </div>
                <Button
                  variant="primary"
                  size="md"
                  loading={exporting}
                  disabled={exporting || filteredRecords.length === 0}
                  onClick={runExport}
                >
                  <Download className="h-4 w-4" />
                  Export shown rows (.xlsx)
                </Button>
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
                    <PanResultsTable data={filteredRecords} />
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
