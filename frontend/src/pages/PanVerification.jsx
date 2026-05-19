import { useCallback, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  BadgeAlert,
  Download,
  FileSpreadsheet,
  Home,
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
import { formatNumber, formatPercent } from '../utils/format';
import { AuditFilterStrip } from '../components/audit/AuditFilterStrip';
import { filterPanRecords, PAN_FILTER_LABELS } from '../utils/panRecordFilters';
import { downloadPanRecordsXlsx } from '../utils/panXlsxExport';
import { useAppUi } from '../context/AppUiContext';
export default function PanVerification() {
  const { recordPanValidation, recordExport } = useAppUi();
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [result, setResult] = useState(null);
  const [activeFilter, setActiveFilter] = useState(null);

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
  }, [file, recordPanValidation]);

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
  const errorRows = result?.errorRows ?? 0;
  const compliance =
    totalRows > 0 ? Math.max(0, Math.min(100, ((totalRows - errorRows) / totalRows) * 100)) : null;

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
              <p className="mt-4 text-sm font-semibold text-slate-800">Validating workbook…</p>
              <p className="mt-1 text-xs text-slate-500">Forwarding secure multipart upload to gateway</p>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Upload &amp; validate</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="md" disabled={loading} onClick={() => setFile(null)}>
                Clear file
              </Button>
              <Button variant="primary" size="md" loading={loading} disabled={loading || !file} onClick={runValidate}>
                <FileSpreadsheet className="h-4 w-4" />
                Validate file
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardBody>
          <FileUploadZone file={file} onFileChange={setFile} disabled={loading} />
        </CardBody>
      </Card>

      {result ? (
        <>
          <section>
            <h3 className="mb-4 text-base font-semibold text-slate-900">Summary</h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <KpiCard
                label="Total rows"
                value={formatNumber(totalRows)}
                icon={Rows3}
                accent="blue"
                interactive
                selected={activeFilter === 'total'}
                onClick={() => toggleCardFilter('total')}
              />
              <KpiCard
                label="Error rows"
                value={formatNumber(errorRows)}
                icon={AlertTriangle}
                accent="amber"
                interactive
                selected={activeFilter === 'errors'}
                onClick={() => toggleCardFilter('errors')}
              />
              <KpiCard
                label={'Missing PAN (> ₹2L)'}
                value={formatNumber(summary.missingPanCount ?? summary.missingPanAbove2L ?? 0)}
                icon={BadgeAlert}
                accent="rose"
                interactive
                selected={activeFilter === 'missingPan'}
                onClick={() => toggleCardFilter('missingPan')}
              />
              <KpiCard
                label="Invalid PAN format"
                value={formatNumber(summary.invalidPanFormatCount ?? summary.invalidPanFormat ?? 0)}
                icon={AlertTriangle}
                accent="rose"
                interactive
                selected={activeFilter === 'invalidPan'}
                onClick={() => toggleCardFilter('invalidPan')}
              />
              <KpiCard
                label={'Missing address (> ₹50k)'}
                value={formatNumber(
                  summary.missingAddressProofCount ?? summary.missingAddressProofAbove50K ?? 0
                )}
                icon={Home}
                accent="violet"
                interactive
                selected={activeFilter === 'missingAddress'}
                onClick={() => toggleCardFilter('missingAddress')}
              />
              <KpiCard
                label="Compliance"
                value={compliance != null ? formatPercent(compliance) : '—'}
                hint="Clean rows / total rows"
                icon={Rows3}
                accent="emerald"
                interactive
                selected={activeFilter === 'compliance'}
                onClick={() => toggleCardFilter('compliance')}
              />
            </div>
          </section>

          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Issue register</h3>
                  <p className="text-sm text-slate-500">TanStack Table · sort · paginate · CSV & PDF export</p>
                </div>
                <Button
                  variant="primary"
                  size="md"
                  loading={exporting}
                  disabled={exporting || filteredRecords.length === 0}
                  onClick={runExport}
                >
                  <Download className="h-4 w-4" />
                  Export invalid rows (.xlsx)
                </Button>
              </div>
            </CardHeader>
            <CardBody>
              {result.records?.length || activeFilter != null ? (
                <div className="space-y-4">
                  <AuditFilterStrip
                    activeFilter={activeFilter}
                    labels={PAN_FILTER_LABELS}
                    count={filteredRecords.length}
                    onClear={() => setActiveFilter(null)}
                  />
                  <PanResultsTable data={filteredRecords} />
                </div>
              ) : (
                <EmptyState
                  title="No issues detected"
                  description="Every normalized row satisfied PAN and address checks for this upload."
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
