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

  filterSalesRecords,

  filterSalesRecordsForDisplay,

  isSalesReturnValidationFilter,

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

  readAuditSessionData,

  slimSalesLedgerSnapshot,

} from '../utils/auditSessionStorage';



const SALES_RETURN_SESSION_KEY = 'sales-return-audit';



const SALES_RETURN_FILTER_LABELS = {

  ...SALES_FILTER_LABELS,

  higherReturnRate: 'Higher sales return rate',

};



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

      auditToastError('Upload a Sales Return Audit file first.');

      return;

    }

    setLoading(true);

    setResult(null);

    setSheetError(null);

    setActiveFilter(null);

    try {

      const data = await validateSalesReturnAudit(returnFile);

      if (data && data.success === false) {

        auditToastError(data.detail || 'Validation failed');

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

    return Array.isArray(rows) ? rows : [];

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



  const filteredExceptionRecords = useMemo(

    () => filterSalesRecordsForDisplay(exceptionRecords, activeFilter),

    [exceptionRecords, activeFilter]

  );



  const showExceptionTable = isSalesReturnValidationFilter(activeFilter);



  const toggleCardFilter = useCallback((key) => {

    setActiveFilter((prev) => (prev === key ? null : key));

  }, []);



  const summary = result?.summary ?? {};

  const totalRows = result?.totalRows ?? 0;

  const productComparisonCount =

    summary.productAverageComparisonCount ?? enrichedProductRecords.length;

  const errorProducts = filterSalesRecords(exceptionRecords, 'errors').length;

  const catVsProduct = filterSalesRecords(exceptionRecords, 'accountVsProduct').length;

  const rateViolations = filterSalesRecords(exceptionRecords, 'mixedLedgers').length;

  const accessoriesUnitRateCount = filterSalesRecords(

    exceptionRecords,

    'accessoriesUnitRate'

  ).length;

  const caratGemErrors = filterSalesRecords(exceptionRecords, 'caratGemErrors').length;

  const higherRateProducts = filterSalesRecords(enrichedProductRecords, 'higherReturnRate').length;

  const compliance =

    productComparisonCount > 0

      ? Math.max(

          0,

          Math.min(

            100,

            ((productComparisonCount - higherRateProducts) / productComparisonCount) * 100

          )

        )

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

    return buildExportColumnDefs(order, filteredExceptionRecords);

  }, [exceptionColumnOrder, filteredExceptionRecords]);



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

    if (!filteredExceptionRecords.length) {

      auditToastError('No exception rows to export.');

      return;

    }

    setExporting(true);

    try {

      const tag = activeFilter ? `filtered-${activeFilter}` : 'all';

      if (result?.exportColumns?.length) {

        await exportSalesReturnConsolidated({

          records: filteredExceptionRecords,

          exportColumns: result.exportColumns,

          columnDisplayHeaders: result.columnDisplayHeaders,

        });

      } else {

        downloadAuditExceptionXlsx(

          filteredExceptionRecords,

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

    filteredExceptionRecords,

    activeFilter,

    exceptionColumnOrder,

    result?.exportColumns,

    result?.columnDisplayHeaders,

  ]);



  const exportExceptionPdf = useCallback(() => {

    if (!filteredExceptionRecords.length) {

      auditToastError('No exception rows to export.');

      return;

    }

    const tag = activeFilter ? `filtered-${activeFilter}` : 'all';

    exportRowsToPdf(

      `sales-return-exceptions-${tag}-${Date.now()}.pdf`,

      'Sales return audit — exception report',

      exceptionExportColumns,

      filteredExceptionRecords

    );

    auditToastSuccess('PDF export downloaded');

  }, [filteredExceptionRecords, activeFilter, exceptionExportColumns]);



  const exportExceptionCsv = useCallback(() => {

    if (!filteredExceptionRecords.length) {

      auditToastError('No exception rows to export.');

      return;

    }

    const tag = activeFilter ? `filtered-${activeFilter}` : 'all';

    exportRowsToCsv(

      `sales-return-exceptions-${tag}-${Date.now()}.csv`,

      exceptionExportColumns,

      filteredExceptionRecords

    );

    auditToastSuccess('CSV export downloaded');

  }, [filteredExceptionRecords, activeFilter, exceptionExportColumns]);



  return (

    <div className="relative space-y-8">

      <AuditValidationOverlay open={loading} scope="container" />



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

                value={formatNumber(errorProducts)}

                icon={AlertTriangle}

                accent="amber"

                variant="error"

                total={totalRows}

                interactive

                selected={activeFilter === 'errors'}

                onClick={() => toggleCardFilter('errors')}

              />

              <AuditSummaryWidget

                label="Account vs product"

                value={formatNumber(catVsProduct)}

                icon={BookOpen}

                accent="rose"

                importance="secondary"

                total={totalRows}

                interactive

                selected={activeFilter === 'accountVsProduct'}

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

                selected={activeFilter === 'mixedLedgers'}

                onClick={() => toggleCardFilter('mixedLedgers')}

              />

              <AuditSummaryWidget

                label="Accessories Unit Rate Check"

                value={formatNumber(accessoriesUnitRateCount)}

                icon={BookOpen}

                accent="amber"

                importance="secondary"

                total={totalRows}

                interactive

                selected={activeFilter === 'accessoriesUnitRate'}

                onClick={() => toggleCardFilter('accessoriesUnitRate')}

              />

              <AuditSummaryWidget

                label="UOM deviations"

                value={formatNumber(caratGemErrors)}

                icon={Gem}

                accent="violet"

                importance="secondary"

                total={totalRows}

                interactive

                selected={activeFilter === 'caratGemErrors'}

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

                selected={activeFilter === 'higherReturnRate'}

                onClick={() => toggleCardFilter('higherReturnRate')}

              />

              <AuditSummaryWidget

                label="Compliance"

                value={compliance != null ? formatPercent(compliance) : '—'}

                icon={Rows3}

                accent="emerald"

                variant="compliance"

                interactive

                selected={activeFilter === 'compliance'}

                onClick={() => toggleCardFilter('compliance')}

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
                    ? 'Original upload columns with Message for the selected issue category.'
                    : 'One row per product. Return lines use SUM(gross) ÷ SUM(quantity) compared to the Sales Audit baseline.'}

                </p>

              </div>

            </CardHeader>

            <CardBody>

              {showExceptionTable ? (
                exceptionRecords.length || activeFilter != null ? (
                  <div className="space-y-4">
                    <AuditFilterStrip
                      activeFilter={activeFilter}
                      labels={SALES_RETURN_FILTER_LABELS}
                      count={filteredExceptionRecords.length}
                      onClear={() => setActiveFilter(null)}
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


