import { useCallback, useState } from 'react';
import {
  Wallet,
  FileSpreadsheet,
  IndianRupee,
} from 'lucide-react';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { FileUploadZone } from '../components/upload/FileUploadZone';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { validateSection44AB } from '../services/section44ab.service';
import { formatNumber, formatPercent } from '../utils/format';
import { auditToastError, auditToastSuccess } from '../utils/auditToast';

export default function Section44ABPage() {
  const [cashFiles, setCashFiles] = useState([]);
  const [bankFiles, setBankFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const runValidation = useCallback(async () => {
    if (cashFiles.length === 0 && bankFiles.length === 0) {
      auditToastError('Upload at least one Cash or Bank file.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await validateSection44AB(cashFiles, bankFiles);
      if (data.success === false) {
        auditToastError(data.detail || 'Validation failed');
        setError(data);
        return;
      }
      setResult(data);
      auditToastSuccess('Section 44AB validation complete');
    } catch (e) {
      const errorMessage = e.response?.data?.detail || e.message || 'Validation failed';
      auditToastError(errorMessage);
      setError({ detail: errorMessage });
    } finally {
      setLoading(false);
    }
  }, [cashFiles, bankFiles]);

  const handleCashFilesChange = (files) => {
    setCashFiles(files);
    setError(null);
    setResult(null);
  };

  const handleBankFilesChange = (files) => {
    setBankFiles(files);
    setError(null);
    setResult(null);
  };

  const exportExcel = useCallback(() => {
    if (!result?.reportRows) return;
    
    // Create a simple Excel export
    const headers = ['Cash/Bank Account', 'Total Cash Receipts', 'Tally Total Receipts', 'Total Cash Payments', 'Tally Total Payment'];
    const rows = result.reportRows.map(row => [
      row.accountName,
      row.totalCashReceipts ?? '',
      row.tallyTotalReceipts ?? '',
      row.totalCashPayments ?? '',
      row.tallyTotalPayment ?? '',
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => cell === null || cell === undefined ? '' : cell).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `section44ab-report-${Date.now()}.csv`;
    link.click();
    auditToastSuccess('CSV export downloaded');
  }, [result]);

  const summary = result?.summary || {};
  const reportRows = result?.reportRows || [];

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-emerald-700">Section 44AB - Cash & Bank Audit</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Upload Cash and Bank ledger files to generate Section 44AB report.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="primary"
                size="md"
                loading={loading}
                disabled={loading || (cashFiles.length === 0 && bankFiles.length === 0)}
                onClick={runValidation}
              >
                <FileSpreadsheet className="h-4 w-4" />
                Run Audit
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardBody className="space-y-4">
          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-700">Cash Ledger Files</h3>
            <FileUploadZone
              files={cashFiles}
              onFilesChange={handleCashFilesChange}
              disabled={loading}
              multiple
              accept=".xlsx,.xls"
            />
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-700">Bank Ledger Files</h3>
            <FileUploadZone
              files={bankFiles}
              onFilesChange={handleBankFilesChange}
              disabled={loading}
              multiple
              accept=".xlsx,.xls"
            />
          </div>
        </CardBody>
      </Card>

      {error ? (
        <Card className="border-rose-200/80 bg-rose-50/40 shadow-md">
          <CardHeader>
            <h3 className="text-base font-semibold text-rose-950">Validation Error</h3>
          </CardHeader>
          <CardBody>
            <p className="text-sm text-rose-900/80">{error.detail}</p>
          </CardBody>
        </Card>
      ) : null}

      {result ? (
        <>
          <section>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.14em] text-emerald-700/90">
              Summary
            </h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Wallet className="h-4 w-4 text-emerald-600" />
                  Cash Files Processed
                </div>
                <div className="mt-2 text-2xl font-bold text-slate-900">
                  {summary.cashFilesProcessed || 0}
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Wallet className="h-4 w-4 text-blue-600" />
                  Bank Files Processed
                </div>
                <div className="mt-2 text-2xl font-bold text-slate-900">
                  {summary.bankFilesProcessed || 0}
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <IndianRupee className="h-4 w-4 text-violet-600" />
                  Receipt %
                </div>
                <div className="mt-2 text-2xl font-bold text-slate-900">
                  {formatPercent(summary.receiptPercentage || 0)}
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <IndianRupee className="h-4 w-4 text-amber-600" />
                  Payment %
                </div>
                <div className="mt-2 text-2xl font-bold text-slate-900">
                  {formatPercent(summary.paymentPercentage || 0)}
                </div>
              </div>
            </div>
          </section>

          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h3 className="text-base font-bold text-emerald-700">Section 44AB Report</h3>
                  <p className="text-sm text-slate-500">
                    Cash and Bank payments/receipts summary
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="primary"
                    size="md"
                    disabled={!reportRows.length}
                    onClick={exportExcel}
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                    Export CSV
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardBody>
              {reportRows.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b-2 border-slate-200 bg-slate-50">
                        <th className="px-4 py-3 text-left font-semibold text-slate-700">Cash/Bank Account</th>
                        <th className="px-4 py-3 text-right font-semibold text-slate-700">Total Cash Receipts</th>
                        <th className="px-4 py-3 text-right font-semibold text-slate-700">Tally Total Receipts</th>
                        <th className="px-4 py-3 text-right font-semibold text-slate-700">Total Cash Payments</th>
                        <th className="px-4 py-3 text-right font-semibold text-slate-700">Tally Total Payment</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportRows.map((row, idx) => (
                        <tr
                          key={idx}
                          className={`border-b border-slate-100 ${
                            row.accountName === 'TOTAL' ? 'bg-slate-100 font-bold' : ''
                          }`}
                        >
                          <td className="px-4 py-3 text-left">{row.accountName}</td>
                          <td className="px-4 py-3 text-right">
                            {row.totalCashReceipts !== null && row.totalCashReceipts !== undefined
                              ? formatNumber(row.totalCashReceipts)
                              : ''}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {row.tallyTotalReceipts !== null && row.tallyTotalReceipts !== undefined
                              ? formatNumber(row.tallyTotalReceipts)
                              : ''}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {row.totalCashPayments !== null && row.totalCashPayments !== undefined
                              ? formatNumber(row.totalCashPayments)
                              : ''}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {row.tallyTotalPayment !== null && row.tallyTotalPayment !== undefined
                              ? formatNumber(row.tallyTotalPayment)
                              : ''}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState
                  title="No report data"
                  description="Upload files and run the audit to generate the Section 44AB report."
                />
              )}
            </CardBody>
          </Card>
        </>
      ) : !error ? (
        <EmptyState
          icon={Wallet}
          title="Awaiting validation"
          description="Upload Cash and Bank ledger files and run validation to generate the Section 44AB report."
        />
      ) : null}
    </div>
  );
}
