import { useCallback, useMemo, useState } from 'react';
import {
  Download,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  Rows3,
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
import { processForm269 } from '../services/form269.service';
import { formatNumber } from '../utils/format';
import { formatProcessingErrorHuman } from '../utils/processingErrorUtils';
import { exportRowsToCsv } from '../utils/csvExport';
import { exportRowsToPdf } from '../utils/pdfExport';
import { downloadAuditMultiSheetXlsx } from '../utils/auditMultiSheetExcelExport';
import { auditToastError, auditToastSuccess } from '../utils/auditToast';

const DEFAULT_TABLE_COLUMNS = [
  'lender_name',
  'lender_address',
  'lender_pan',
  'lender_aadhaar',
  'amount',
  'squared_up',
  'maximum_outstanding',
  'taken_by_cheque_ecs',
  'nature_code',
  'please_specify',
  'account_payee_cheque',
];

const DEFAULT_TABLE_HEADERS = {
  lender_name: 'Name of lender or depositor',
  lender_address: 'Address of lender or depositor',
  lender_pan: 'PAN of the lender or depositor(optional)',
  lender_aadhaar: 'Aadhaar no (optional)',
  amount: 'Amount of loan or deposit taken or accepted',
  squared_up: 'Whether the loan/deposit was squared up during the Previous Year',
  maximum_outstanding:
    'Maximum amount outstanding in the account at any time during the previous year',
  taken_by_cheque_ecs:
    'Whether the loan or deposit was taken or accepted by cheque or bank draft or use of the electronic clearing system through a bank account',
  nature_code: 'Code of the nature of such amount (as mentioned in field (iv) above)',
  please_specify: 'Please specify',
  account_payee_cheque:
    'In case of loan or deposit was taken or deposit was accepted by cheque or bank draft whether the same was taken or accepted by an account payee cheque or an account payee bank draft',
};

const FILTER_LABELS = {
  total: 'All rows',
  ss: '269SS',
  st: '269ST',
};

export default function Form269Page() {
  const [inputFiles, setInputFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [sheetError, setSheetError] = useState(null);
  const [activeFilter, setActiveFilter] = useState('ss');

  const canProcess = inputFiles.length > 0;

  const handleFolderChange = useCallback((files) => {
    setInputFiles(files);
    setResult(null);
    setSheetError(null);
    setActiveFilter('ss');
  }, []);

  const runAudit = useCallback(async () => {
    if (!inputFiles.length) {
      auditToastError('Choose a folder containing ledger Excel files first.');
      return;
    }

    setLoading(true);
    setSheetError(null);
    try {
      const data = await processForm269(inputFiles);
      if (data && data.success === false) {
        auditToastError(data.detail || 'Audit failed');
        setSheetError(typeof data.error === 'object' ? data : { ...data });
        setResult(null);
        return;
      }
      setResult(data);
      setActiveFilter('ss');
      auditToastSuccess('Form 269SS / 269ST audit complete');
    } catch (e) {
      const payload = e.details ?? null;
      setSheetError(payload || { detail: e.message });
      setResult(null);
      auditToastError(e.message || 'Audit failed');
    } finally {
      setLoading(false);
    }
  }, [inputFiles]);

  const records269SS = useMemo(
    () => (Array.isArray(result?.records269SS) ? result.records269SS : []),
    [result]
  );
  const records269ST = useMemo(
    () => (Array.isArray(result?.records269ST) ? result.records269ST : []),
    [result]
  );

  const tableColumns = useMemo(
    () =>
      Array.isArray(result?.exportColumns) && result.exportColumns.length
        ? result.exportColumns
        : DEFAULT_TABLE_COLUMNS,
    [result]
  );

  const tableHeaders = useMemo(
    () => ({ ...DEFAULT_TABLE_HEADERS, ...(result?.columnDisplayHeaders ?? {}) }),
    [result]
  );

  const exportColumns = useMemo(
    () => tableColumns.map((key) => ({ key, header: tableHeaders[key] ?? key })),
    [tableColumns, tableHeaders]
  );

  const exportColumnDefs = useMemo(
    () =>
      tableColumns.map((key) => ({
        header: tableHeaders[key] ?? key,
        accessor: (row) => row?.[key],
      })),
    [tableColumns, tableHeaders]
  );

  const filteredRecords = useMemo(() => {
    if (activeFilter === 'st') return records269ST;
    if (activeFilter === 'ss') return records269SS;
    return [...records269SS, ...records269ST];
  }, [activeFilter, records269SS, records269ST]);

  const runExportExcel = useCallback(() => {
    if (!result) {
      auditToastError('Run the audit first.');
      return;
    }
    downloadAuditMultiSheetXlsx({
      filename: `Form-269-SS-ST-${Date.now()}.xlsx`,
      sheets: {
        '269SS': records269SS,
        '269ST': records269ST,
      },
      columns: exportColumns,
    });
    auditToastSuccess('Excel export downloaded');
  }, [result, records269SS, records269ST, exportColumns]);

  const runExportCsv = useCallback(() => {
    const tag = activeFilter === 'st' ? '269ST' : activeFilter === 'ss' ? '269SS' : 'all';
    exportRowsToCsv(`Form-269-${tag}-${Date.now()}.csv`, exportColumnDefs, filteredRecords);
    auditToastSuccess('CSV export downloaded');
  }, [activeFilter, filteredRecords, exportColumnDefs]);

  const runExportPdf = useCallback(() => {
    const tag = activeFilter === 'st' ? '269ST' : activeFilter === 'ss' ? '269SS' : 'Form 269';
    exportRowsToPdf(
      `Form-269-${tag}-${Date.now()}.pdf`,
      `Form ${tag}`,
      exportColumnDefs,
      filteredRecords
    );
    auditToastSuccess('PDF export downloaded');
  }, [activeFilter, filteredRecords, exportColumnDefs]);

  const totalFiles = result?.totalInputFiles ?? 0;
  const totalSs = result?.totalRows269SS ?? records269SS.length;
  const totalSt = result?.totalRows269ST ?? records269ST.length;

  return (
    <div className="relative space-y-8">
      <AuditValidationOverlay open={loading} />

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-emerald-700 dark:text-emerald-400">
                Form 269SS / 269ST
              </h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Select a folder of ledger Excel files. Lender names are taken from each filename
                and matched to the bundled master reference.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="primary"
                size="md"
                loading={loading}
                disabled={loading || !canProcess}
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
            directory
            multiple
            files={inputFiles}
            onFilesChange={handleFolderChange}
            disabled={loading}
            dropzoneLabel="Select a folder of ledger Excel files"
            dropzoneHint="All .xlsx, .xls, and .xlsm files in the folder will be processed"
          />
        </CardBody>
      </Card>

      {sheetError ? (
        <Card className="border-rose-200/80 bg-rose-50/40 shadow-md dark:border-rose-900/50 dark:bg-rose-950/30">
          <CardHeader>
            <h3 className="text-base font-semibold text-rose-950 dark:text-rose-200">
              Sheet did not match required layout
            </h3>
          </CardHeader>
          <CardBody>
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
                label="Ledger files"
                value={formatNumber(totalFiles)}
                icon={FolderOpen}
                accent="blue"
              />
              <AuditSummaryWidget
                label="269SS rows"
                value={formatNumber(totalSs)}
                icon={Rows3}
                accent="emerald"
              />
              <AuditSummaryWidget
                label="269ST rows"
                value={formatNumber(totalSt)}
                icon={Rows3}
                accent="amber"
              />
            </AuditSummaryGrid>
          </section>

          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h3 className="text-base font-semibold text-emerald-800 dark:text-emerald-400">
                    Form 269 report
                  </h3>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                    269SS uses credits taken during the year. 269ST uses debits in the amount column.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" size="sm" onClick={() => setActiveFilter('ss')}>
                    269SS
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => setActiveFilter('st')}>
                    269ST
                  </Button>
                  <Button variant="secondary" size="sm" onClick={runExportExcel}>
                    <Download className="h-4 w-4" />
                    Excel
                  </Button>
                  <Button variant="secondary" size="sm" onClick={runExportCsv}>
                    <FileText className="h-4 w-4" />
                    CSV
                  </Button>
                  <Button variant="secondary" size="sm" onClick={runExportPdf}>
                    <FileSpreadsheet className="h-4 w-4" />
                    PDF
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardBody className="space-y-4">
              <AuditFilterStrip
                activeFilter={activeFilter}
                labels={FILTER_LABELS}
                count={filteredRecords.length}
                onClear={() => setActiveFilter('ss')}
              />
              {filteredRecords.length ? (
                <AuditUploadResultsTable
                  data={filteredRecords}
                  columnOrder={tableColumns}
                  columnDisplayHeaders={tableHeaders}
                />
              ) : (
                <EmptyState
                  title="No report rows"
                  description="No 269SS or 269ST rows were produced from the selected folder."
                />
              )}
            </CardBody>
          </Card>
        </>
      ) : !sheetError ? (
        <EmptyState
          icon={FolderOpen}
          title="Awaiting folder"
          description="Select a folder of ledger Excel files and start the audit to generate 269SS and 269ST reports."
        />
      ) : null}
    </div>
  );
}
