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
import { SalesReturnRateComparisonTable } from '../components/tables/SalesReturnRateComparisonTable';
import { AuditFilterStrip } from '../components/audit/AuditFilterStrip';
import { AuditSessionBanner } from '../components/audit/AuditSessionBanner';
import { filterSalesRecords, SALES_FILTER_LABELS } from '../utils/salesRecordFilters';

const SALES_RETURN_FILTER_LABELS = {
  ...SALES_FILTER_LABELS,
  higherReturnRate: 'Higher sales return rate',
};
import {
  exportSalesReturnRateComparison,
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
import {
  downloadSalesReturnExceptionXlsx,
  resolveSalesReturnExportColumns,
} from '../utils/salesReturnXlsxExport';

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
  const [activeFilter, setActiveFilter] = useState(
    () => readAuditSessionData(SALES_RETURN_SESSION_KEY)?.activeFilter ?? null
  );

  const applySession = useCallback((data) => {
    setResult(data?.result ?? null);
    setSheetError(data?.sheetError ?? null);
    setActiveFilter(data?.activeFilter ?? null);
    setRestoredFileName(data?.fileName ?? null);
    setReturnFile(null);
  }, []);

  const sessionSnapshot = useMemo(
    () => ({
      result,
      sheetError,
      activeFilter,
      fileName: returnFile?.name ?? restoredFileName ?? null,
    }),
    [result, sheetError, activeFilter, returnFile?.name, restoredFileName]
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
    setActiveFilter(null);
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

  const productComparisonRecords = useMemo(
    () =>
      result?.productAverageComparisonRecords ??
      result?.rateComparisonRecords ??
      result?.comparisonIssues ??
      [],
    [result]
  );

  const filteredProductComparison = useMemo(() => {
    if (activeFilter === 'higherReturnRate') {
      return productComparisonRecords.filter(
        (row) => row.status === 'VIOLATION' || (row.issues || []).includes('HIGHER_SALES_RETURN_RATE')
      );
    }
    return productComparisonRecords;
  }, [productComparisonRecords, activeFilter]);

  const exceptionRecords = useMemo(
    () => result?.exceptionRecords ?? result?.records ?? [],
    [result]
  );

  const exceptionColumnOrder = useMemo(
    () =>
      exceptionRecords.length
        ? resolveSalesReturnExportColumns(
            exceptionRecords,
            result?.exportColumns,
            result?.columnDisplayHeaders
          )
        : null,
    [exceptionRecords, result?.exportColumns, result?.columnDisplayHeaders]
  );

  const filteredRecords = useMemo(
    () => filterSalesRecords(exceptionRecords, activeFilter),
    [exceptionRecords, activeFilter]
  );

  const exportFilteredColumnOrder = useMemo(() => {
    if (!filteredRecords.length) return exceptionColumnOrder;
    const keys = exceptionColumnOrder?.length
      ? exceptionColumnOrder
      : Object.keys(filteredRecords[0]);
    return keys.filter((key) => key in filteredRecords[0]);
  }, [filteredRecords, exceptionColumnOrder]);

  const exceptionExportColumns = useMemo(() => {
    const order = exportFilteredColumnOrder ?? [];
    if (!filteredRecords.length || !order.length) return [];
    return order.map((header) => ({
      header,
      accessor: (row) => row[header] ?? '',
    }));
  }, [filteredRecords, exportFilteredColumnOrder]);

  const toggleCardFilter = useCallback((key) => {
    setActiveFilter((prev) => (prev === key ? null : key));
  }, []);

  const summary = result?.summary ?? {};
  const totalRows = result?.totalRows ?? 0;
  const errorRows =
    summary.distinctInvalidRows ??
    summary.errorRowsCount ??
    summary.exceptionRowCount ??
    result?.errorRows ??
    exceptionRecords.length;
  const higherRateProducts = summary.higherReturnRateProducts ?? 0;
  const productComparisonCount =
    summary.productAverageComparisonCount ?? productComparisonRecords.length;
  const catVsProduct = summary.invalidProductMappings ?? summary.salesAccountProductMismatches ?? 0;
  const rateViolations = summary.rateDeviationViolations ?? 0;
  const accessoriesUnitRateCount = filterSalesRecords(exceptionRecords, 'accessoriesUnitRate').length;
  const caratGemErrors =
    summary.invalidUomRows ??
    summary.caratGemErrorRows ??
    filterSalesRecords(exceptionRecords, 'caratGemErrors').length;
  const compliance =
    totalRows > 0 ? Math.max(0, Math.min(100, ((totalRows - errorRows) / totalRows) * 100)) : null;
  const salesBaselineLabel = result?.salesAuditFileName
    ? `Baseline: ${result.salesAuditFileName} (${formatNumber(result.salesAuditBaselineCount ?? summary.salesAuditBaselineCount ?? 0)} products)`
    : 'Sales audit averages loaded from database';

  const exportProductComparisonExcel = useCallback(async () => {
    if (!filteredProductComparison.length) {
      toast.error('No product averages to export.');
      return;
    }
    setExporting(true);
    try {
      await exportSalesReturnRateComparison(filteredProductComparison);
      toast.success('Product average report downloaded');
    } catch (e) {
      toast.error(e.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  }, [filteredProductComparison]);

  const exportFinalReportExcel = useCallback(() => {
    if (!filteredRecords.length) {
      toast.error('No exception rows to export.');
      return;
    }
    setExporting(true);
    try {
      const tag = activeFilter ? `filtered-${activeFilter}` : 'all';
      downloadSalesReturnExceptionXlsx(
        filteredRecords,
        exportFilteredColumnOrder,
        `sales-return-exceptions-${tag}-${Date.now()}.xlsx`
      );
      toast.success('Excel report downloaded');
    } catch (e) {
      toast.error(e.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  }, [filteredRecords, activeFilter, exportFilteredColumnOrder]);

  const exportFinalReportCsv = useCallback(() => {
    if (!filteredRecords.length) {
      toast.error('No exception rows to export.');
      return;
    }
    const tag = activeFilter ? `filtered-${activeFilter}` : 'all';
    exportRowsToCsv(
      `sales-return-exception-${tag}-${Date.now()}.csv`,
      exceptionExportColumns,
      filteredRecords
    );
    toast.success('CSV report downloaded');
  }, [filteredRecords, activeFilter, exceptionExportColumns]);

  const exportFinalReportPdf = useCallback(() => {
    if (!filteredRecords.length) {
      toast.error('No exception rows to export.');
      return;
    }
    const tag = activeFilter ? `filtered-${activeFilter}` : 'all';
    exportRowsToPdf(
      `sales-return-exception-${tag}-${Date.now()}.pdf`,
      'Sales return audit — final exception report',
      exceptionExportColumns,
      filteredRecords
    );
    toast.success('PDF report downloaded');
  }, [filteredRecords, activeFilter, exceptionExportColumns]);

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
            <div className="mb-4">
              <h3 className="text-base font-bold text-emerald-700">Summary</h3>
              <p className="text-sm text-slate-500">{salesBaselineLabel}</p>
            </div>
            <div className="flex flex-wrap items-stretch gap-4">
              <div className="min-w-[190px] h-[120px]">
                <KpiCard label="Total rows" value={formatNumber(totalRows)} icon={Rows3} accent="blue" />
              </div>

              <div className="min-w-[190px] h-[120px]">
                <KpiCard
                  label="Error rows"
                  value={formatNumber(errorRows)}
                  icon={AlertTriangle}
                  accent="amber"
                  interactive
                  selected={activeFilter === 'errors'}
                  onClick={() => toggleCardFilter('errors')}
                />
              </div>

              <div className="min-w-[190px] h-[120px]">
                <KpiCard
                  label="Account vs product"
                  value={formatNumber(catVsProduct)}
                  icon={BookOpen}
                  accent="rose"
                  interactive
                  selected={activeFilter === 'accountVsProduct'}
                  onClick={() => toggleCardFilter('accountVsProduct')}
                />
              </div>

              <div className="min-w-[190px] h-[120px]">
                <KpiCard
                  label="Range deviations"
                  value={formatNumber(rateViolations)}
                  icon={BookOpen}
                  accent="amber"
                  interactive
                  selected={activeFilter === 'mixedLedgers'}
                  onClick={() => toggleCardFilter('mixedLedgers')}
                />
              </div>

              <div className="min-w-[190px] h-[120px]">
                <KpiCard
                  label="Accessories Unit Rate Check"
                  value={formatNumber(accessoriesUnitRateCount)}
                  icon={BookOpen}
                  accent="amber"
                  interactive
                  selected={activeFilter === 'accessoriesUnitRate'}
                  onClick={() => toggleCardFilter('accessoriesUnitRate')}
                />
              </div>

              <div className="min-w-[190px] h-[120px]">
                <KpiCard
                  label="Unit of measurement deviations"
                  value={formatNumber(caratGemErrors)}
                  icon={Gem}
                  accent="violet"
                  interactive
                  selected={activeFilter === 'caratGemErrors'}
                  onClick={() => toggleCardFilter('caratGemErrors')}
                />
              </div>

              <div className="min-w-[190px] h-[120px]">
                <KpiCard
                  label="Products compared"
                  value={formatNumber(productComparisonCount)}
                  icon={Rows3}
                  accent="blue"
                />
              </div>

              <div className="min-w-[190px] h-[120px]">
                <KpiCard
                  label="Higher sales return rate"
                  value={formatNumber(higherRateProducts)}
                  icon={Undo2}
                  accent="rose"
                  interactive
                  selected={activeFilter === 'higherReturnRate'}
                  onClick={() => toggleCardFilter('higherReturnRate')}
                />
              </div>

              <div className="min-w-[190px] h-[120px]">
                <KpiCard
                  label="Compliance"
                  value={compliance != null ? formatPercent(compliance) : '—'}
                  icon={Rows3}
                  accent="emerald"
                />
              </div>
            </div>
          </section>

          <Card>
            <CardHeader>
              <div>
                <h3 className="text-base font-bold text-emerald-700">Product-wise average comparison</h3>
                <p className="text-sm text-slate-500">
                  One row per product. Return rows are combined using SUM(gross) ÷ SUM(quantity), then
                  compared to the stored Sales Audit baseline.
                </p>
              </div>
            </CardHeader>
            <CardBody>
              {productComparisonRecords.length ? (
                <SalesReturnRateComparisonTable
                  data={filteredProductComparison}
                  exporting={exporting}
                  onExportXlsx={exportProductComparisonExcel}
                />
              ) : (
                <EmptyState
                  title="No product averages"
                  description="No eligible return products were found for average comparison."
                />
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h3 className="text-base font-bold text-emerald-700">Row-level exception report</h3>
                  <p className="text-sm text-slate-500">
                    All validation and rate comparison issues in one view. Original upload columns are
                    preserved with Message (issue codes) appended.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="primary"
                    size="md"
                    loading={exporting}
                    disabled={exporting || !filteredRecords.length}
                    onClick={exportFinalReportExcel}
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                    Export Excel
                  </Button>
                  <Button
                    variant="secondary"
                    size="md"
                    disabled={exporting || !filteredRecords.length}
                    onClick={exportFinalReportCsv}
                  >
                    <Download className="h-4 w-4" />
                    Export CSV
                  </Button>
                  <Button
                    variant="secondary"
                    size="md"
                    disabled={exporting || !filteredRecords.length}
                    onClick={exportFinalReportPdf}
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
                    labels={SALES_RETURN_FILTER_LABELS}
                    count={filteredRecords.length}
                    onClear={() => setActiveFilter(null)}
                  />
                  {filteredRecords.length ? (
                    <SalesReturnExceptionTable
                      data={filteredRecords}
                      columnOrder={exportFilteredColumnOrder}
                    />
                  ) : (
                    <EmptyState
                      title="No rows for this filter"
                      description="Clear the filter or choose a different issue category."
                    />
                  )}
                </div>
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
