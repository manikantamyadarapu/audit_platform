import { useCallback, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  GitCompare,
  Gem,
  Loader2,
  AlertTriangle,
  Rows3,
  Undo2,
  Download,
  FileSpreadsheet,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { FileUploadZone } from '../components/upload/FileUploadZone';
import { Button } from '../components/ui/Button';
import { KpiCard } from '../components/cards/KpiCard';
import { EmptyState } from '../components/ui/EmptyState';
import { SalesReturnRateComparisonTable } from '../components/tables/SalesReturnRateComparisonTable';
import { SalesResultsTable } from '../components/tables/SalesResultsTable';
import { AuditFilterStrip } from '../components/audit/AuditFilterStrip';
import {
  exportSalesReturnExceptions,
  validateSalesReturnAudit,
} from '../services/processExcelService';
import { formatNumber, formatPercent } from '../utils/format';
import { formatProcessingErrorHuman } from '../utils/processingErrorUtils';
import { dedupeSalesRecordsByRowNumber } from '../utils/dedupeSalesRecords';
import { filterSalesRecords, SALES_FILTER_LABELS } from '../utils/salesRecordFilters';
import { useAuditSessionPersistence } from '../hooks/useAuditSessionPersistence';
import {
  AUDIT_SESSION_RETENTION_DAYS,
  readAuditSessionData,
  slimSalesLedgerSnapshot,
} from '../utils/auditSessionStorage';

const SALES_RETURN_SESSION_KEY = 'sales-return-audit';

export default function SalesReturnRateAudit() {
  const rateComparisonRef = useRef(null);
  const [returnFile, setReturnFile] = useState(null);
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

  const sessionSnapshot = useMemo(
    () => ({
      result,
      sheetError,
      activeFilter,
      fileName: returnFile?.name ?? null,
    }),
    [result, sheetError, activeFilter, returnFile?.name]
  );

  const { sessionLabel, persist } = useAuditSessionPersistence(
    SALES_RETURN_SESSION_KEY,
    sessionSnapshot,
    {
      transform: slimSalesLedgerSnapshot,
      onSaveFailed: () => {
        toast.error('Results are too large to keep in the browser. Export the exception report.');
      },
    }
  );

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

  const validationRecords = useMemo(
    () =>
      dedupeSalesRecordsByRowNumber(
        result?.validationIssues ?? result?.returnValidationRecords ?? []
      ),
    [result]
  );

  const rateComparisonRecords = useMemo(
    () => result?.comparisonIssues ?? result?.rateComparisonRecords ?? [],
    [result]
  );

  const exceptionRecords = useMemo(
    () => result?.exceptionRecords ?? result?.records ?? [],
    [result]
  );

  const filteredValidationRecords = useMemo(
    () => filterSalesRecords(validationRecords, activeFilter),
    [validationRecords, activeFilter]
  );

  const toggleCardFilter = useCallback((key) => {
    setActiveFilter((prev) => (prev === key ? null : key));
  }, []);

  const scrollToRateComparison = useCallback(() => {
    rateComparisonRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const summary = result?.summary ?? {};
  const returnErrorRows =
    summary.returnValidationErrorRows ??
    summary.distinctInvalidRows ??
    validationRecords.length;
  const higherRateProducts = summary.higherReturnRateProducts ?? rateComparisonRecords.length;
  const totalReturnRows = result?.totalRows ?? 0;
  const catVsProduct = summary.invalidProductMappings ?? summary.salesAccountProductMismatches ?? 0;
  const rateViolations = summary.rateDeviationViolations ?? 0;
  const freeQuantityCount = filterSalesRecords(validationRecords, 'accessoriesUnitRate').length;
  const uomErrors =
    summary.invalidUomRows ??
    summary.caratGemErrorRows ??
    filterSalesRecords(validationRecords, 'caratGemErrors').length;
  const compliance =
    totalReturnRows > 0
      ? Math.max(0, Math.min(100, ((totalReturnRows - returnErrorRows) / totalReturnRows) * 100))
      : null;
  const salesBaselineLabel = result?.salesAuditFileName
    ? `Baseline: ${result.salesAuditFileName} (${formatNumber(result.salesAuditBaselineCount ?? summary.salesAuditBaselineCount ?? 0)} products)`
    : 'Sales audit averages loaded from database';

  const exportExceptions = useCallback(async () => {
    if (!exceptionRecords.length) {
      toast.error('No exception rows to export.');
      return;
    }
    setExporting(true);
    try {
      await exportSalesReturnExceptions(exceptionRecords);
      toast.success('Consolidated exception report downloaded');
    } catch (e) {
      toast.error(e.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  }, [exceptionRecords]);

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
              <p className="mt-4 text-sm font-semibold text-slate-800">Running sales return audit…</p>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {sessionLabel && result ? (
        <p className="rounded-xl border border-emerald-200/80 bg-emerald-50/60 px-4 py-2.5 text-sm text-emerald-900">
          {sessionLabel} — results are kept for {AUDIT_SESSION_RETENTION_DAYS} days when you switch tabs.
        </p>
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
            file={returnFile}
            onFileChange={(f) => {
              setSheetError(null);
              setReturnFile(f);
            }}
            disabled={loading}
          />
        </CardBody>
      </Card>

      {result ? (
        <section>
          <h3 className="mb-4 text-base font-bold text-emerald-700">Analytics</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <KpiCard
              label="Sales Return Rate Comparison"
              value={formatNumber(rateComparisonRecords.length)}
              hint={
                rateComparisonRecords.length
                  ? 'Products with higher return average rate than sales audit baseline'
                  : 'Compare product-wise average rates after audit'
              }
              icon={GitCompare}
              accent="violet"
              interactive
              onClick={scrollToRateComparison}
            />
          </div>
        </section>
      ) : null}

      {sheetError ? (
        <Card className="border-rose-200/80 bg-rose-50/40 shadow-md">
          <CardHeader>
            <h3 className="text-base font-semibold text-rose-950">Audit could not run</h3>
          </CardHeader>
          <CardBody>
            <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-xl bg-white/90 p-4 font-mono text-xs text-slate-800">
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
              <Button
                variant="primary"
                size="md"
                loading={exporting}
                disabled={exporting || exceptionRecords.length === 0}
                onClick={exportExceptions}
              >
                <Download className="h-4 w-4" />
                Export consolidated exception report
              </Button>
            </div>
            <div className="flex flex-wrap items-stretch gap-4">
              <div className="min-w-[190px] h-[120px]">
                <KpiCard
                  label="Return rows"
                  value={formatNumber(totalReturnRows)}
                  icon={Rows3}
                  accent="blue"
                />
              </div>
              <div className="min-w-[190px] h-[120px]">
                <KpiCard
                  label="Validation errors"
                  value={formatNumber(returnErrorRows)}
                  icon={AlertTriangle}
                  accent="amber"
                  interactive
                  selected={activeFilter === 'errors'}
                  onClick={() => toggleCardFilter('errors')}
                />
              </div>
              <div className="min-w-[190px] h-[120px]">
                <KpiCard
                  label="Ledger mapping"
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
                  label="Rate deviations"
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
                  label="Free quantity check"
                  value={formatNumber(freeQuantityCount)}
                  icon={BookOpen}
                  accent="amber"
                  interactive
                  selected={activeFilter === 'accessoriesUnitRate'}
                  onClick={() => toggleCardFilter('accessoriesUnitRate')}
                />
              </div>
              <div className="min-w-[190px] h-[120px]">
                <KpiCard
                  label="UOM deviations"
                  value={formatNumber(uomErrors)}
                  icon={Gem}
                  accent="violet"
                  interactive
                  selected={activeFilter === 'caratGemErrors'}
                  onClick={() => toggleCardFilter('caratGemErrors')}
                />
              </div>
              <div className="min-w-[190px] h-[120px]">
                <KpiCard
                  label="Higher return rate"
                  value={formatNumber(higherRateProducts)}
                  icon={Undo2}
                  accent="rose"
                  onClick={scrollToRateComparison}
                  interactive
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
                <h3 className="text-base font-bold text-emerald-700">Validation results</h3>
                <p className="text-sm text-slate-500">
                  Rate, ledger, free quantity, and UOM issues on the sales return file.
                </p>
              </div>
            </CardHeader>
            <CardBody>
              {validationRecords.length || activeFilter != null ? (
                <div className="space-y-4">
                  <AuditFilterStrip
                    activeFilter={activeFilter}
                    labels={SALES_FILTER_LABELS}
                    count={filteredValidationRecords.length}
                    onClear={() => setActiveFilter(null)}
                  />
                  <SalesResultsTable data={filteredValidationRecords} />
                </div>
              ) : (
                <EmptyState
                  title="No validation issues"
                  description="Every evaluated return row passed rate, ledger, free quantity, and UOM checks."
                />
              )}
            </CardBody>
          </Card>

          <section ref={rateComparisonRef}>
            <Card>
              <CardHeader>
                <div>
                  <h3 className="text-base font-bold text-emerald-700">Sales Return Rate Comparison</h3>
                  <p className="text-sm text-slate-500">
                    Product-wise average unit rate — SUM(Gross Amount) / SUM(Quantity) — compared against
                    stored sales audit averages. Exact product name match only.
                  </p>
                </div>
              </CardHeader>
              <CardBody>
                {rateComparisonRecords.length ? (
                  <SalesReturnRateComparisonTable data={rateComparisonRecords} />
                ) : (
                  <EmptyState
                    title="No rate comparison issues"
                    description="No return product has a higher average rate than the matching sales audit product."
                  />
                )}
              </CardBody>
            </Card>
          </section>
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
