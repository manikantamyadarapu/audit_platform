import { useCallback, useMemo, useState } from 'react';
import { FileSpreadsheet, Gem } from 'lucide-react';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { AuditValidationOverlay } from '../components/ui/AuditValidationOverlay';
import { FolderUploadZone } from '../components/upload/FolderUploadZone';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { FinancialsBranchResults } from '../components/audit/FinancialsBranchResults';
import { Input } from '../components/ui/Input';
import { CLOSING_STOCK_AUDIT_CONFIG } from '../config/closingStockAuditConfig';
import {
  JUBILEE_HILLS_FOLDER_SLOTS,
  classifyJubileeHillsFolderFiles,
} from '../config/jubileeHillsFolderFiles';
import { processJubileeHillsFinancials } from '../services/financials.service';
import { formatProcessingErrorHuman } from '../utils/processingErrorUtils';
import { auditToastError, auditToastSuccess } from '../utils/auditToast';
import { cn } from '../utils/cn';

function toastOutcome(data) {
  const mapped = data?.summary?.mappedProductCount ?? data?.summary?.productsDisplayed ?? 0;
  const unmapped = data?.summary?.unmappedProductCount ?? 0;
  if (mapped > 0) {
    auditToastSuccess(
      `Jubilee Hills Financials ready — ${mapped} product${mapped === 1 ? '' : 's'} mapped` +
        (unmapped ? ` (${unmapped} unmapped)` : '')
    );
  } else {
    auditToastError(
      unmapped
        ? `Jubilee Hills Financials: no products matched the Rule Book (${unmapped} unmapped).`
        : 'Jubilee Hills Financials ready but no products were mapped.'
    );
  }
}

export default function JubileeHillsFinancialsPage() {
  const [folderFiles, setFolderFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [sheetError, setSheetError] = useState(null);
  const [companyName, setCompanyName] = useState('');
  const [address, setAddress] = useState('');
  const [financialYear, setFinancialYear] = useState(CLOSING_STOCK_AUDIT_CONFIG.defaultFinancialYear);

  const identification = useMemo(() => {
    if (!folderFiles.length) return null;
    return classifyJubileeHillsFolderFiles(folderFiles, { financialYear });
  }, [folderFiles, financialYear]);

  const canProcess = Boolean(identification?.ready);

  const runProcess = useCallback(async () => {
    const identified = classifyJubileeHillsFolderFiles(folderFiles, { financialYear });
    if (!identified.ready) {
      if (identified.issues?.length) {
        auditToastError(identified.issues.map((issue) => issue.message).join(' '));
      } else if (identified.missing?.length) {
        auditToastError(`Jubilee Hills is missing ${identified.missing.join(', ')}.`);
      } else {
        auditToastError('Upload a Jubilee Hills folder with all ten files before processing.');
      }
      return;
    }

    setLoading(true);
    try {
      const data = await processJubileeHillsFinancials(identified.files);
      if (data && data.success === false) {
        auditToastError(data.detail || 'Jubilee Hills processing failed');
        setSheetError(typeof data.error === 'object' ? data : { ...data });
        setResult(null);
      } else {
        setResult(data);
        setSheetError(null);
        requestAnimationFrame(() => {
          document.getElementById('jubilee-hills-results')?.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
          });
        });
        toastOutcome(data);
      }
    } catch (e) {
      setSheetError(e.details ?? null);
      setResult(null);
      auditToastError(e.message || 'Jubilee Hills processing failed');
    } finally {
      setLoading(false);
    }
  }, [folderFiles, financialYear]);

  return (
    <div className="relative space-y-8">
      <AuditValidationOverlay open={loading} label="Building Jubilee Hills Financials…" />

      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-slate-50">
            Jubilee Hills Financials
          </h1>
          <Badge tone="amber">Ten files</Badge>
        </div>
        <p className="mt-1 max-w-3xl text-sm text-slate-600 dark:text-slate-400">
          Upload one Jubilee Hills folder. Sales on the sheets are Sales minus Sales Return.
          Purchases are Purchases minus Purchase Return minus supplier credit notes, plus supplier
          debit notes. The download is the same Closing Stock workbook.
        </p>
      </div>

      <Card>
        <CardBody>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              The folder needs Sales, Purchases, Opening Quantity, Previous Year Financials, MR, DC,
              Sales Return, Purchase Return, Credit notes from suppliers, and Debit notes from
              suppliers.
            </p>
            <Button
              variant="primary"
              size="md"
              loading={loading}
              disabled={loading || !canProcess}
              onClick={runProcess}
            >
              <FileSpreadsheet className="h-4 w-4" />
              Process
            </Button>
          </div>
          <div className="mt-4">
            <FolderUploadZone
              files={folderFiles}
              disabled={loading}
              formatHint={CLOSING_STOCK_AUDIT_CONFIG.fileFormatHint}
              onFilesChange={(files) => {
                setFolderFiles(files);
                setResult(null);
                setSheetError(null);
              }}
            />
          </div>
          {identification?.missing.length ? (
            <p className="mt-4 text-sm font-medium text-rose-700 dark:text-rose-300">
              Missing: {identification.missing.join(', ')}. All ten Jubilee Hills files are required.
            </p>
          ) : null}
          {identification?.issues.length ? (
            <ul className="mt-3 space-y-1 text-sm font-medium text-amber-800 dark:text-amber-200">
              {identification.issues.map((issue) => (
                <li key={issue.key}>{issue.message}</li>
              ))}
            </ul>
          ) : null}
          {identification?.ready ? (
            <p className="mt-4 text-sm font-medium text-emerald-700 dark:text-emerald-300">
              All ten Jubilee Hills files are identified.
            </p>
          ) : null}
          <ul className="mt-4 divide-y divide-slate-200/80 overflow-hidden rounded-xl border border-slate-200/80 bg-white/80 dark:divide-slate-700 dark:border-slate-700 dark:bg-[var(--color-surface-elevated)]/80">
            {JUBILEE_HILLS_FOLDER_SLOTS.map((slot) => {
              const shown = identification?.files?.[slot.key];
              const ambiguous = identification?.issues.some((issue) => issue.key === slot.key);
              const waiting = !identification;
              let status = 'Waiting for folder';
              let statusClass = 'text-slate-400';
              if (!waiting && shown?.name) {
                status = shown.name;
                statusClass = 'text-slate-500';
              } else if (ambiguous) {
                status = 'Not selected — more than one file matched';
                statusClass = 'font-medium text-amber-700 dark:text-amber-300';
              } else if (!waiting) {
                status = 'Missing';
                statusClass = 'font-medium text-rose-600';
              }
              return (
                <li key={slot.key} className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {slot.label}
                  </span>
                  <span className={cn('min-w-0 truncate text-xs', statusClass)}>{status}</span>
                </li>
              );
            })}
          </ul>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <label className="block space-y-1.5 text-sm">
              <span className="font-semibold text-slate-700 dark:text-slate-200">Company name</span>
              <Input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Optional — printed on Closing Stock sheets"
                disabled={loading}
              />
            </label>
            <label className="block space-y-1.5 text-sm">
              <span className="font-semibold text-slate-700 dark:text-slate-200">Address</span>
              <Input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Optional"
                disabled={loading}
              />
            </label>
            <label className="block space-y-1.5 text-sm">
              <span className="font-semibold text-slate-700 dark:text-slate-200">Financial year</span>
              <Input
                value={financialYear}
                onChange={(e) => setFinancialYear(e.target.value)}
                placeholder={CLOSING_STOCK_AUDIT_CONFIG.defaultFinancialYear}
                disabled={loading}
              />
            </label>
          </div>
        </CardBody>
      </Card>

      {sheetError ? (
        <Card className="border-rose-200/80 bg-rose-50/40 shadow-md">
          <CardHeader>
            <h3 className="text-base font-semibold text-rose-950">Unable to process Jubilee Hills workbook</h3>
          </CardHeader>
          <CardBody>
            <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-xl bg-[var(--color-surface-elevated)] p-4 font-mono text-xs text-[var(--color-text-primary)] shadow-inner">
              {formatProcessingErrorHuman(sheetError)}
            </pre>
          </CardBody>
        </Card>
      ) : null}

      {result ? (
        <FinancialsBranchResults
          key={`jh-${result.auditRunId || result.requestId || 'current'}`}
          result={result}
          onResultUpdate={setResult}
          resultsId="jubilee-hills-results"
          branchHeading="Jubilee Hills Financials"
          financialYear={financialYear}
          companyName={companyName}
          address={address}
        />
      ) : !sheetError ? (
        <EmptyState
          icon={Gem}
          title="Awaiting process"
          description="Upload a Jubilee Hills folder with the ten required files, then Process."
        />
      ) : null}
    </div>
  );
}
