import { useCallback, useMemo, useState } from 'react';

import {

  BookOpen,

  Gem,

  AlertTriangle,

  Rows3,

  Undo2,

  FileSpreadsheet,

  Download,

  FileText,

} from 'lucide-react';

import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { AuditValidationOverlay } from '../components/ui/AuditValidationOverlay';
import { FileUploadZone } from '../components/upload/FileUploadZone';

import { Button } from '../components/ui/Button';

import { AuditSummaryWidget } from '../components/cards/AuditSummaryWidget';
import { AuditSummaryGrid } from '../components/audit/AuditSummaryGrid';

import { EmptyState } from '../components/ui/EmptyState';

import {
  SalesReturnRateComparisonTable,
  salesReturnComparisonExportCols,
} from '../components/tables/SalesReturnRateComparisonTable';
import { AuditUploadResultsTable } from '../components/tables/AuditUploadResultsTable';

import { AuditFilterStrip } from '../components/audit/AuditFilterStrip';

import { AuditSessionBanner } from '../components/audit/AuditSessionBanner';

import {

  exportSalesReturnRateComparison,

  exportSalesReturnConsolidated,

  validateSalesReturnAudit,

} from '../services/processExcelService';

import { formatNumber, formatPercent } from '../utils/format';

import { exportRowsToCsv } from '../utils/csvExport';

import { exportRowsToPdf } from '../utils/pdfExport';

import { formatProcessingErrorHuman } from '../utils/processingErrorUtils';

import {

  enrichProductComparisonRecords,

  enrichSalesReturnExceptionRecords,

  filterSalesRecords,

  filterSalesReturnRecords,

  filterSalesReturnRecordsForDisplay,

  filterSalesRecordsForDisplay,

  resolveSalesReturnActiveFilter,

  normalizeSalesFilter,

  salesReturnRecordsForExport,

  SALES_FILTER_LABELS,

} from '../utils/salesRecordFilters';

import {

  downloadAuditExceptionXlsx,

  downloadRowsXlsx,

} from '../utils/salesReturnXlsxExport';

import {
  buildExportColumnDefs,
  resolveAuditColumnOrder,
} from '../utils/auditTableColumns';

import { auditToastError, auditToastSuccess } from '../utils/auditToast';

import { useAuditSessionPersistence } from '../hooks/useAuditSessionPersistence';

import {

  bootstrapAuditSessionState,

  slimSalesLedgerSnapshot,

} from '../utils/auditSessionStorage';



const SALES_RETURN_SESSION_KEY = 'sales-return-audit';



const SALES_RETURN_FILTER_LABELS = {

  ...SALES_FILTER_LABELS,

  higherReturnRate: 'Higher sales return rate',

};



export default function SalesReturnRateAudit() {

  const [initialSession] = useState(() => bootstrapAuditSessionState(SALES_RETURN_SESSION_KEY));

  const [returnFile, setReturnFile] = useState(null);

  const [restoredFileName, setRestoredFileName] = useState(

    () => initialSession.data?.fileName ?? null

  );

  const [loading, setLoading] = useState(false);

  const [exporting, setExporting] = useState(false);

  const [result, setResult] = useState(() => initialSession.data?.result ?? null);

  const [sheetError, setSheetError] = useState(() => initialSession.data?.sheetError ?? null);

  const [activeFilter, setActiveFilter] = useState(() => {

    if (initialSession.data?.activeFilter != null) {
      return normalizeSalesFilter(initialSession.data.activeFilter);
    }

    const errorCount =

      initialSession.data?.result?.summary?.distinctInvalidRows ??

      initialSession.data?.result?.summary?.errorRowsCount ??

      initialSession.data?.result?.errorRows ??

      0;

    return errorCount > 0 ? 'errors' : null;

  });



  const applySession = useCallback((data) => {

    setResult(data?.result ?? null);

    setSheetError(data?.sheetError ?? null);

    const errorCount =

      data?.result?.summary?.distinctInvalidRows ??

      data?.result?.summary?.errorRowsCount ??

      data?.result?.errorRows ??

      0;

    setActiveFilter(
      data?.activeFilter != null
        ? normalizeSalesFilter(data.activeFilter)
        : errorCount > 0
          ? 'errors'
          : null
    );

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

    onSaveFailed: () => {

      auditToastError('Could not save audit results locally. Free browser storage or start a new audit.');

    },

  });



  const displayFile =

    returnFile ?? (restoredFileName ? { name: restoredFileName } : null);



  const runValidation = useCallback(async () => {

    if (!returnFile) {

      auditToastError('Upload a Sales Return Audit file first.');

      return;

    }

    setLoading(true);

    try {

      const data = await validateSalesReturnAudit(returnFile);

      if (data && data.success === false) {

        auditToastError(data.detail || 'Validation failed');

        setSheetError(typeof data.error === 'object' ? data : { ...data });

        return;

      }

      setResult(data);

      const defaultFilter =
        (data?.summary?.distinctInvalidRows ??
          data?.summary?.errorRowsCount ??
          data?.errorRows ??
          0) > 0
          ? 'errors'
          : null;

      setActiveFilter(defaultFilter);

      setSheetError(null);

      const saved = persist(
        {
          result: data,
          sheetError: null,
          activeFilter: defaultFilter,
          fileName: returnFile?.name ?? null,
        },
        { notifyOnFailure: true, force: true }
      );

      if (saved === false) {

        auditToastError('Results loaded but could not be saved for later.');

      }

      auditToastSuccess('Sales return audit complete');

    } catch (e) {

      setSheetError(e.details ?? { detail: e.message });

      auditToastError(e.message || 'Validation failed');

    } finally {

      setLoading(false);

    }

  }, [returnFile, persist]);



  const productComparisonRecords = useMemo(() => {

    const rows =

      result?.productAverageComparisonRecords ??

      result?.rateComparisonRecords ??

      result?.comparisonIssues ??

      [];

    return Array.isArray(rows) ? rows : [];

  }, [result]);



  const exceptionRecords = useMemo(() => {

    const rows = result?.exceptionRecords ?? result?.records ?? [];

    return enrichSalesReturnExceptionRecords(Array.isArray(rows) ? rows : []);

  }, [result]);



  const enrichedProductRecords = useMemo(

    () => enrichProductComparisonRecords(productComparisonRecords, exceptionRecords),

    [productComparisonRecords, exceptionRecords]

  );



  const filteredProductComparison = useMemo(

    () => filterSalesRecordsForDisplay(enrichedProductRecords, activeFilter),

    [enrichedProductRecords, activeFilter]

  );



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



  const summary = result?.summary ?? {};

  const totalRows = result?.totalRows ?? 0;

  const errorRows =

    summary.distinctInvalidRows ??

    summary.errorRowsCount ??

    summary.returnValidationErrorRows ??

    result?.errorRows ??

    filterSalesReturnRecords(exceptionRecords, 'errors').length;

  const effectiveActiveFilter = resolveSalesReturnActiveFilter(activeFilter, errorRows);

  const filteredExceptionRecords = useMemo(

    () => filterSalesReturnRecordsForDisplay(exceptionRecords, effectiveActiveFilter),

    [exceptionRecords, effectiveActiveFilter]

  );

  const exportExceptionRows = useMemo(

    () => salesReturnRecordsForExport(filteredExceptionRecords),

    [filteredExceptionRecords]

  );

  const showExceptionTable = effectiveActiveFilter !== 'higherReturnRate';

  const toggleCardFilter = useCallback((key) => {

    setActiveFilter(key);

  }, []);

  const productComparisonCount =

    summary.productAverageComparisonCount ?? enrichedProductRecords.length;

  const catVsProduct = summary.invalidProductMappings ?? summary.salesAccountProductMismatches ?? 0;

  const rateViolations =
    exceptionRecords.length > 0
      ? filterSalesReturnRecords(exceptionRecords, 'mixedLedgers').length
      : summary.rateDeviationViolations ?? 0;

  const caratGemErrors =

    summary.invalidUomRows ??

    summary.caratGemErrorRows ??

    filterSalesReturnRecords(exceptionRecords, 'caratGemErrors').length;

  const higherRateProducts = filterSalesRecords(enrichedProductRecords, 'higherReturnRate').length;

  const compliance =

    totalRows > 0

      ? Math.max(0, Math.min(100, ((totalRows - errorRows) / totalRows) * 100))

      : null;

  const salesBaselineLabel = result?.salesAuditFileName

    ? `Baseline: ${result.salesAuditFileName} (${formatNumber(result.salesAuditBaselineCount ?? summary.salesAuditBaselineCount ?? 0)} products)`

    : 'Sales audit averages loaded from database';



  const productComparisonColumnMode =

    activeFilter === 'higherReturnRate' ? 'higherReturnRate' : 'full';



  const productExportColumns = useMemo(

    () => salesReturnComparisonExportCols(productComparisonColumnMode),

    [productComparisonColumnMode]

  );



  const exceptionExportColumns = useMemo(() => {

    const order = exceptionColumnOrder?.length

      ? exceptionColumnOrder

      : filteredExceptionRecords.length

        ? resolveAuditColumnOrder(filteredExceptionRecords)

        : [];

    return buildExportColumnDefs(order, exportExceptionRows);

  }, [exceptionColumnOrder, exportExceptionRows]);



  const exportProductComparisonExcel = useCallback(async () => {

    if (!filteredProductComparison.length) {

      auditToastError('No product averages to export.');

      return;

    }

    setExporting(true);

    try {

      const tag = activeFilter ? `filtered-${activeFilter}` : 'all';

      if (activeFilter === 'higherReturnRate') {

        downloadRowsXlsx(

          `sales-return-higher-rate-${Date.now()}.xlsx`,

          productExportColumns,

          filteredProductComparison,

          'Higher Sales Return Rate'

        );

      } else {

        await exportSalesReturnRateComparison(filteredProductComparison);

      }

      auditToastSuccess('Excel export downloaded');

    } catch (e) {

      auditToastError(e.message || 'Export failed');

    } finally {

      setExporting(false);

    }

  }, [filteredProductComparison, activeFilter, productExportColumns]);



  const exportProductComparisonPdf = useCallback(() => {

    if (!filteredProductComparison.length) {

      auditToastError('No product averages to export.');

      return;

    }

    const tag = activeFilter ? `filtered-${activeFilter}` : 'all';

    exportRowsToPdf(

      `sales-return-products-${tag}-${Date.now()}.pdf`,

      'Sales return audit — product comparison',

      productExportColumns,

      filteredProductComparison

    );

    auditToastSuccess('PDF export downloaded');

  }, [filteredProductComparison, activeFilter, productExportColumns]);



  const exportExceptionExcel = useCallback(async () => {

    if (!exportExceptionRows.length) {

      auditToastError('No exception rows to export.');

      return;

    }

    setExporting(true);

    try {

      const tag = effectiveActiveFilter ? `filtered-${effectiveActiveFilter}` : 'all';

      if (result?.exportColumns?.length) {

        await exportSalesReturnConsolidated({

          records: exportExceptionRows,

          exportColumns: result.exportColumns,

          columnDisplayHeaders: result.columnDisplayHeaders,

        });

      } else {

        downloadAuditExceptionXlsx(

          exportExceptionRows,

          exceptionColumnOrder,

          `sales-return-exceptions-${tag}-${Date.now()}.xlsx`,

          'Final Exception Report',

          result?.exportColumns,

          result?.columnDisplayHeaders

        );

      }

      auditToastSuccess('Excel export downloaded');

    } catch (e) {

      auditToastError(e.message || 'Export failed');

    } finally {

      setExporting(false);

    }

  }, [

    exportExceptionRows,

    effectiveActiveFilter,

    exceptionColumnOrder,

    result?.exportColumns,

    result?.columnDisplayHeaders,

  ]);



  const exportExceptionPdf = useCallback(() => {

    if (!exportExceptionRows.length) {

      auditToastError('No exception rows to export.');

      return;

    }

    const tag = effectiveActiveFilter ? `filtered-${effectiveActiveFilter}` : 'all';

    exportRowsToPdf(

      `sales-return-exceptions-${tag}-${Date.now()}.pdf`,

      'Sales return audit — exception report',

      exceptionExportColumns,

      exportExceptionRows

    );

    auditToastSuccess('PDF export downloaded');

  }, [exportExceptionRows, effectiveActiveFilter, exceptionExportColumns]);



  const exportExceptionCsv = useCallback(() => {

    if (!exportExceptionRows.length) {

      auditToastError('No exception rows to export.');

      return;

    }

    const tag = effectiveActiveFilter ? `filtered-${effectiveActiveFilter}` : 'all';

    exportRowsToCsv(

      `sales-return-exceptions-${tag}-${Date.now()}.csv`,

      exceptionExportColumns,

      exportExceptionRows

    );

    auditToastSuccess('CSV export downloaded');

  }, [exportExceptionRows, effectiveActiveFilter, exceptionExportColumns]);



  return (

    <div className="relative space-y-8">

      <AuditValidationOverlay open={loading} />



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
              setResult(null);
              setActiveFilter(null);
              setReturnFile(f);
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

              <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-emerald-700/90">

                Audit intelligence summary

              </h3>

              <p className="mt-1 text-sm text-slate-500">{salesBaselineLabel}</p>

            </div>

            <AuditSummaryGrid>

              <AuditSummaryWidget

                label="Total rows"

                value={formatNumber(totalRows)}

                icon={Rows3}

                accent="blue"

                importance="secondary"

              />

              <AuditSummaryWidget

                label="Error rows"

                value={formatNumber(errorRows)}

                icon={AlertTriangle}

                accent="amber"

                variant="error"

                importance="critical"

                total={totalRows}

                interactive

                selected={effectiveActiveFilter === 'errors'}

                onClick={() => toggleCardFilter('errors')}

              />

              <AuditSummaryWidget

                label="Sales ledger mismatch"

                value={formatNumber(catVsProduct)}

                icon={BookOpen}

                accent="rose"

                importance="secondary"

                total={totalRows}

                interactive

                selected={effectiveActiveFilter === 'accountVsProduct'}

                onClick={() => toggleCardFilter('accountVsProduct')}

              />

              <AuditSummaryWidget

                label="Range deviations"

                value={formatNumber(rateViolations)}

                icon={BookOpen}

                accent="amber"

                variant="deviation"

                importance="secondary"

                total={totalRows}

                interactive

                selected={effectiveActiveFilter === 'mixedLedgers'}

                onClick={() => toggleCardFilter('mixedLedgers')}

              />

              <AuditSummaryWidget

                label="Invalid UOM"

                value={formatNumber(caratGemErrors)}

                icon={Gem}

                accent="violet"

                importance="secondary"

                total={totalRows}

                interactive

                selected={effectiveActiveFilter === 'caratGemErrors'}

                onClick={() => toggleCardFilter('caratGemErrors')}

              />

              <AuditSummaryWidget

                label="Higher sales return rate"

                value={formatNumber(higherRateProducts)}

                icon={Undo2}

                accent="rose"

                variant="risk"

                total={productComparisonCount}

                interactive

                selected={effectiveActiveFilter === 'higherReturnRate'}

                onClick={() => toggleCardFilter('higherReturnRate')}

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



          <Card>

            <CardHeader>

              <div>

                <h3 className="text-base font-bold text-emerald-700">

                  {showExceptionTable ? 'Exception report' : 'Product-wise average comparison'}

                </h3>

                <p className="text-sm text-slate-500">

                  {showExceptionTable
                    ? effectiveActiveFilter
                      ? 'Showing rows for the selected issue category. Export includes only these rows with matching messages.'
                      : 'Click a summary widget above to filter exception rows by issue category.'
                    : 'One row per product. Return lines use SUM(gross) ÷ SUM(quantity) compared to the Sales Audit baseline.'}

                </p>

              </div>

            </CardHeader>

            <CardBody>

              {showExceptionTable ? (
                exceptionRecords.length || effectiveActiveFilter != null ? (
                  <div className="space-y-4">
                    <AuditFilterStrip
                      activeFilter={effectiveActiveFilter}
                      labels={SALES_RETURN_FILTER_LABELS}
                      count={filteredExceptionRecords.length}
                      onClear={() => setActiveFilter(errorRows > 0 ? 'errors' : null)}
                    />
                    {filteredExceptionRecords.length ? (
                      <>
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button
                            variant="primary"
                            size="md"
                            loading={exporting}
                            disabled={exporting}
                            onClick={exportExceptionExcel}
                          >
                            <FileSpreadsheet className="h-4 w-4" />
                            Export Excel
                          </Button>
                          <Button
                            variant="secondary"
                            size="md"
                            disabled={exporting}
                            onClick={exportExceptionCsv}
                          >
                            <Download className="h-4 w-4" />
                            Export CSV
                          </Button>
                          <Button
                            variant="secondary"
                            size="md"
                            disabled={exporting}
                            onClick={exportExceptionPdf}
                          >
                            <FileText className="h-4 w-4" />
                            Export PDF
                          </Button>
                        </div>
                        <AuditUploadResultsTable
                          data={filteredExceptionRecords}
                          columnOrder={exceptionColumnOrder}
                          exportColumns={result?.exportColumns}
                          columnDisplayHeaders={result?.columnDisplayHeaders}
                          searchPlaceholder="Search exception rows…"
                        />
                      </>
                    ) : (
                      <EmptyState
                        title="No rows for this filter"
                        description="Clear the filter or choose a different issue category."
                      />
                    )}
                  </div>
                ) : (
                  <EmptyState
                    title="No exception rows"
                    description="No validation issues were found in the return file."
                  />
                )
              ) : enrichedProductRecords.length || activeFilter != null ? (

                <div className="space-y-4">

                  <AuditFilterStrip

                    activeFilter={activeFilter}

                    labels={SALES_RETURN_FILTER_LABELS}

                    count={filteredProductComparison.length}

                    onClear={() => setActiveFilter(null)}

                  />

                  {filteredProductComparison.length ? (

                    <SalesReturnRateComparisonTable

                      data={filteredProductComparison}

                      exporting={exporting}

                      onExportXlsx={exportProductComparisonExcel}

                      onExportPdf={exportProductComparisonPdf}

                      columnMode={productComparisonColumnMode}

                    />

                  ) : (

                    <EmptyState

                      title="No products for this filter"

                      description="Clear the filter or choose a different issue category."

                    />

                  )}

                </div>

              ) : (

                <EmptyState

                  title="No product averages"

                  description="No eligible return products were found for average comparison."

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


