import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FileSpreadsheet, Gem } from 'lucide-react';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { AuditValidationOverlay } from '../components/ui/AuditValidationOverlay';
import { FolderUploadZone } from '../components/upload/FolderUploadZone';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { AuditSessionBanner } from '../components/audit/AuditSessionBanner';
import { FinancialsBranchResults } from '../components/audit/FinancialsBranchResults';
import { SourceAverageRatesHint } from '../components/audit/SourceAverageRatesHint';
import { WatchDemoButton } from '../components/demo/WatchDemoButton';
import { Input } from '../components/ui/Input';
import { CLOSING_STOCK_AUDIT_CONFIG } from '../config/closingStockAuditConfig';
import {
  BASHEERBAGH_FOLDER_SLOTS,
  KOKAPET_FOLDER_SLOTS,
  classifyBasheerbaghFolderFiles,
  classifyKokapetFolderFiles,
} from '../config/basheerbaghFolderFiles';
import {
  clearHeldFinancialsBranchFiles,
  holdFinancialsBranchFiles,
  listHeldFinancialsBranchFiles,
  processFinancialsPivotFromHeld,
} from '../services/financials.service';
import { formatProcessingErrorHuman } from '../utils/processingErrorUtils';
import { auditToastError, auditToastSuccess } from '../utils/auditToast';
import { useAuditSessionPersistence } from '../hooks/useAuditSessionPersistence';
import { bootstrapAuditSessionState } from '../utils/auditSessionStorage';
import { cn } from '../utils/cn';
import { saveBranchAverageRates } from '../utils/sourceAverageRates';

const EMPTY_SIX_NAMES = {
  sales: null,
  purchases: null,
  quantity: null,
  previousYear: null,
  mr: null,
  dc: null,
};

function namesFromHeldFiles(files) {
  const next = { ...EMPTY_SIX_NAMES };
  for (const row of Array.isArray(files) ? files : []) {
    if (row?.slotKey && Object.prototype.hasOwnProperty.call(next, row.slotKey)) {
      next[row.slotKey] = row.originalName || null;
    }
  }
  return next;
}

const BRANCH_PAGE = {
  basheerbagh: {
    branch: 'basheerbagh',
    title: 'Basheerbagh Financials',
    heading: 'Basheerbagh',
    resultsId: 'basheerbagh-results',
    sessionKey: CLOSING_STOCK_AUDIT_CONFIG.sessionKey,
    slots: BASHEERBAGH_FOLDER_SLOTS,
    intro:
      'Upload one Basheerbagh folder. Files are identified by name (Sales, Purchases, MR, DC, Quantity File). Previous Year Financials is the spreadsheet whose name ends with the year. Process still uses the same six-file flow.',
    missingPrefix: 'Basheerbagh is missing',
  },
  kokapet: {
    branch: 'kokapet',
    title: 'Kokapet Financials',
    heading: 'Kokapet',
    resultsId: 'kokapet-results',
    sessionKey: 'financials-kokapet',
    slots: KOKAPET_FOLDER_SLOTS,
    intro:
      'Upload one Kokapet folder. Process uses the same six-file Financials flow as Basheerbagh: Sales, Purchases, Opening Quantity, Previous Year Financials, MR, and DC. Sales Return and Purchase Return are not inputs.',
    missingPrefix: 'Kokapet is missing',
  },
};

function assignedSixReady(assigned) {
  return Boolean(
    assigned?.sales &&
      assigned?.purchases &&
      assigned?.quantity &&
      assigned?.previousYear &&
      assigned?.mr &&
      assigned?.dc
  );
}

function missingSlotLabels(assigned, slots) {
  return slots.filter((slot) => !assigned?.[slot.key]).map((slot) => slot.label);
}

function toastClosingStockOutcome(data, branchLabel = '') {
  const mapped = data?.summary?.mappedProductCount ?? data?.summary?.productsDisplayed ?? 0;
  const unmapped = data?.summary?.unmappedProductCount ?? 0;
  const openingMatched =
    data?.openingStockReport?.matchedCount ?? data?.openingStockReport?.quantityMatchedCount ?? 0;
  const mrClassified = data?.summary?.mrClassifiedRows ?? data?.mrReport?.classifiedRowCount ?? 0;
  const dcClassified = data?.summary?.dcClassifiedRows ?? data?.dcReport?.classifiedRowCount ?? 0;
  const label = branchLabel ? `${branchLabel} Closing Stock` : 'Closing Stock';
  if (mapped > 0) {
    auditToastSuccess(
      `${label} ready — ${mapped} product${mapped === 1 ? '' : 's'} mapped` +
        (openingMatched ? ` · ${openingMatched} Opening matched` : '') +
        ` · MR ${mrClassified} / DC ${dcClassified} classified` +
        (unmapped ? ` (${unmapped} unmapped)` : '')
    );
  } else {
    auditToastError(
      unmapped
        ? `${label}: no products matched a sheet code (${unmapped} unmapped). Check product names.`
        : `${label} ready but no products were mapped.`
    );
  }
}

function slimSnapshot(data) {
  if (!data) return null;
  return {
    result: data.result ?? null,
    sheetError: data.sheetError ?? null,
    salesFileName: data.salesFileName ?? null,
    purchasesFileName: data.purchasesFileName ?? null,
    openingQtyFileName: data.openingQtyFileName ?? null,
    previousYearFileName: data.previousYearFileName ?? null,
    mrFileName: data.mrFileName ?? null,
    dcFileName: data.dcFileName ?? null,
    companyName: data.companyName ?? '',
    address: data.address ?? '',
    financialYear: data.financialYear ?? CLOSING_STOCK_AUDIT_CONFIG.defaultFinancialYear,
  };
}

function identifyFolder(branch, folderFiles, financialYear) {
  if (branch === 'kokapet') {
    return classifyKokapetFolderFiles(folderFiles, { financialYear });
  }
  const assigned = classifyBasheerbaghFolderFiles(folderFiles, { financialYear });
  return {
    files: assigned,
    missing: missingSlotLabels(assigned, BASHEERBAGH_FOLDER_SLOTS),
    issues: [],
    ready: assignedSixReady(assigned),
  };
}

export function SixFileBranchFinancialsPage({ branch }) {
  const page = BRANCH_PAGE[branch] || BRANCH_PAGE.basheerbagh;
  const [initialSession] = useState(() => bootstrapAuditSessionState(page.sessionKey));
  const [folderFiles, setFolderFiles] = useState([]);
  const [restoredNames, setRestoredNames] = useState(() => ({
    sales: initialSession.data?.salesFileName ?? null,
    purchases: initialSession.data?.purchasesFileName ?? null,
    quantity: initialSession.data?.openingQtyFileName ?? null,
    previousYear: initialSession.data?.previousYearFileName ?? null,
    mr: initialSession.data?.mrFileName ?? null,
    dc: initialSession.data?.dcFileName ?? null,
  }));
  const [heldReady, setHeldReady] = useState(false);
  const [loadingHeld, setLoadingHeld] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(() => initialSession.data?.result ?? null);
  const [sheetError, setSheetError] = useState(() => initialSession.data?.sheetError ?? null);
  const [companyName, setCompanyName] = useState(() => initialSession.data?.companyName ?? '');
  const [address, setAddress] = useState(() => initialSession.data?.address ?? '');
  const [financialYear, setFinancialYear] = useState(
    () => initialSession.data?.financialYear ?? CLOSING_STOCK_AUDIT_CONFIG.defaultFinancialYear
  );

  const applySession = useCallback((data) => {
    setResult(data?.result ?? null);
    setSheetError(data?.sheetError ?? null);
    setRestoredNames({
      sales: data?.salesFileName ?? null,
      purchases: data?.purchasesFileName ?? null,
      quantity: data?.openingQtyFileName ?? null,
      previousYear: data?.previousYearFileName ?? null,
      mr: data?.mrFileName ?? null,
      dc: data?.dcFileName ?? null,
    });
    setCompanyName(data?.companyName ?? '');
    setAddress(data?.address ?? '');
    setFinancialYear(data?.financialYear ?? CLOSING_STOCK_AUDIT_CONFIG.defaultFinancialYear);
    setFolderFiles([]);
  }, []);

  const identification = useMemo(() => {
    if (!folderFiles.length) return null;
    return identifyFolder(page.branch, folderFiles, financialYear);
  }, [folderFiles, financialYear, page.branch]);

  const namedFiles = identification?.files;
  const sessionSnapshot = useMemo(
    () => ({
      result,
      sheetError,
      salesFileName: namedFiles?.sales?.name ?? restoredNames.sales ?? null,
      purchasesFileName: namedFiles?.purchases?.name ?? restoredNames.purchases ?? null,
      openingQtyFileName: namedFiles?.quantity?.name ?? restoredNames.quantity ?? null,
      previousYearFileName: namedFiles?.previousYear?.name ?? restoredNames.previousYear ?? null,
      mrFileName: namedFiles?.mr?.name ?? restoredNames.mr ?? null,
      dcFileName: namedFiles?.dc?.name ?? restoredNames.dc ?? null,
      companyName,
      address,
      financialYear,
    }),
    [result, sheetError, namedFiles, restoredNames, companyName, address, financialYear]
  );

  const { sessionLabel, sessionMeta, persist, restoreSession, startNewAudit, restoring } =
    useAuditSessionPersistence(page.sessionKey, sessionSnapshot, {
      transform: slimSnapshot,
      onApplySession: applySession,
      onSaveFailed: () => {
        auditToastError('Could not save results locally. Free browser storage or start a new audit.');
      },
    });

  const workspaceRef = useRef(sessionSnapshot);
  workspaceRef.current = sessionSnapshot;
  const persistWorkspace = useCallback(
    (patch, options = { notifyOnFailure: true, force: true }) => {
      persist({ ...workspaceRef.current, ...patch }, options);
    },
    [persist]
  );

  useEffect(() => {
    workspaceRef.current = sessionSnapshot;
  }, [sessionSnapshot]);

  useEffect(() => {
    let cancelled = false;
    setLoadingHeld(true);
    listHeldFinancialsBranchFiles(page.branch)
      .then((held) => {
        if (cancelled) return;
        setHeldReady(Boolean(held?.ready));
        if (held?.files?.length) {
          setRestoredNames((prev) => ({ ...prev, ...namesFromHeldFiles(held.files) }));
        }
      })
      .catch(() => {
        if (!cancelled) setHeldReady(false);
      })
      .finally(() => {
        if (!cancelled) setLoadingHeld(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page.branch]);

  useEffect(() => {
    if (!identification?.ready || !identification.files) return undefined;
    let cancelled = false;
    holdFinancialsBranchFiles(page.branch, identification.files)
      .then((held) => {
        if (cancelled) return;
        setHeldReady(Boolean(held?.ready));
        setRestoredNames(namesFromHeldFiles(held?.files));
      })
      .catch(() => {
        /* Holding is best-effort; Process can still run from the live folder. */
      });
    return () => {
      cancelled = true;
    };
  }, [identification?.ready, identification?.files, page.branch]);

  const canProcess = Boolean(identification?.ready || heldReady);

  const runProcess = useCallback(async () => {
    const identified = folderFiles.length
      ? identifyFolder(page.branch, folderFiles, financialYear)
      : null;
    const files = identified?.files || {};
    if (folderFiles.length && !identified?.ready) {
      if (identified?.issues?.length) {
        auditToastError(identified.issues.map((issue) => issue.message).join(' '));
      } else if (identified?.missing?.length) {
        auditToastError(
          `${page.missingPrefix} ${identified.missing.join(', ')}. Closing Stock runs only when all six files are identified.`
        );
      } else {
        auditToastError(
          'Upload Sales, Purchases, Opening Quantity, Previous Year Closing, MR, and DC files before processing.'
        );
      }
      return;
    }
    const useHeld = !folderFiles.length;
    if (useHeld && !heldReady) {
      auditToastError(
        'Upload Sales, Purchases, Opening Quantity, Previous Year Closing, MR, and DC files before processing.'
      );
      return;
    }

    setLoading(true);
    const fileNames = {
      salesFileName: files.sales?.name ?? restoredNames.sales ?? null,
      purchasesFileName: files.purchases?.name ?? restoredNames.purchases ?? null,
      openingQtyFileName: files.quantity?.name ?? restoredNames.quantity ?? null,
      previousYearFileName: files.previousYear?.name ?? restoredNames.previousYear ?? null,
      mrFileName: files.mr?.name ?? restoredNames.mr ?? null,
      dcFileName: files.dc?.name ?? restoredNames.dc ?? null,
      companyName,
      address,
      financialYear,
    };
    try {
      if (!useHeld) {
        try {
          await holdFinancialsBranchFiles(page.branch, files);
          setHeldReady(true);
        } catch (holdErr) {
          auditToastError(
            holdErr.message ||
              'Files were processed but could not be saved for the next visit. Upload the folder again later if needed.'
          );
        }
      }
      const data = useHeld
        ? await processFinancialsPivotFromHeld(page.branch)
        : page.branch === 'kokapet'
          ? await CLOSING_STOCK_AUDIT_CONFIG.process(
              files.sales,
              files.purchases,
              files.quantity,
              files.previousYear,
              files.mr,
              files.dc,
              undefined,
              'kokapet'
            )
          : await CLOSING_STOCK_AUDIT_CONFIG.process(
              files.sales,
              files.purchases,
              files.quantity,
              files.previousYear,
              files.mr,
              files.dc
            );
      if (data && data.success === false) {
        auditToastError(data.detail || `${page.heading} processing failed`);
        const errorBody = typeof data.error === 'object' ? data : { ...data };
        setSheetError(errorBody);
        setResult(null);
        persistWorkspace({ result: null, sheetError: errorBody, ...fileNames }, { notifyOnFailure: true, force: true });
      } else {
        saveBranchAverageRates(page.branch, data.productAverageRates);
        setResult(data);
        setSheetError(null);
        requestAnimationFrame(() => {
          document.getElementById(page.resultsId)?.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
          });
        });
        toastClosingStockOutcome(data, page.branch === 'kokapet' ? 'Kokapet' : '');
        persistWorkspace({ result: data, sheetError: null, ...fileNames }, { notifyOnFailure: true, force: true });
      }
    } catch (e) {
      setSheetError(e.details ?? null);
      setResult(null);
      auditToastError(e.message || `${page.heading} processing failed`);
      persistWorkspace(
        { result: null, sheetError: e.details ?? null, ...fileNames },
        { notifyOnFailure: true, force: true }
      );
    } finally {
      setLoading(false);
    }
  }, [
    page,
    folderFiles,
    financialYear,
    heldReady,
    restoredNames,
    companyName,
    address,
    persistWorkspace,
  ]);

  const handleStartNew = useCallback(() => {
    startNewAudit();
    setFolderFiles([]);
    setRestoredNames({ ...EMPTY_SIX_NAMES });
    setHeldReady(false);
    setCompanyName('');
    setAddress('');
    setFinancialYear(CLOSING_STOCK_AUDIT_CONFIG.defaultFinancialYear);
    setResult(null);
    setSheetError(null);
    clearHeldFinancialsBranchFiles(page.branch).catch(() => {});
  }, [page.branch, startNewAudit]);

  return (
    <div className="relative space-y-8">
      <AuditValidationOverlay open={loading} label={CLOSING_STOCK_AUDIT_CONFIG.processOverlayLabel} />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-slate-50">
              {page.title}
            </h1>
            <Badge tone="amber">{CLOSING_STOCK_AUDIT_CONFIG.badgeLabel}</Badge>
          </div>
          <p className="mt-1 max-w-3xl text-sm text-slate-600 dark:text-slate-400">{page.intro}</p>
          <SourceAverageRatesHint branch={page.branch} />
        </div>
      </div>

      {result ? (
        <AuditSessionBanner
          sessionMeta={sessionMeta}
          sessionLabel={sessionLabel}
          hasResults={Boolean(result)}
          onRestore={restoreSession}
          onStartNew={handleStartNew}
          restoring={restoring}
        />
      ) : null}

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-emerald-700">{page.heading}</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Six files are required. Opening Qty from Opening Balance; Opening Amount from each
                product’s previous-year sheet Closing Balance.
                {heldReady && !folderFiles.length
                  ? ' Previously uploaded files for this branch are ready to process again.'
                  : ''}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <WatchDemoButton moduleKey={CLOSING_STOCK_AUDIT_CONFIG.demoModuleKey} />
              <Button
                variant="primary"
                size="md"
                loading={loading}
                disabled={loading || loadingHeld || !canProcess}
                onClick={runProcess}
              >
                <FileSpreadsheet className="h-4 w-4" />
                {CLOSING_STOCK_AUDIT_CONFIG.processLabel}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardBody>
          <FolderUploadZone
            files={folderFiles}
            disabled={loading}
            formatHint={CLOSING_STOCK_AUDIT_CONFIG.fileFormatHint}
            onFilesChange={(files) => {
              setFolderFiles(Array.isArray(files) ? files : []);
              setRestoredNames({
                sales: null,
                purchases: null,
                quantity: null,
                previousYear: null,
                mr: null,
                dc: null,
              });
              setResult(null);
              setSheetError(null);
            }}
          />
          {identification?.missing.length ? (
            <p className="mt-4 text-sm font-medium text-rose-700 dark:text-rose-300">
              Missing: {identification.missing.join(', ')}. All six {page.heading} files are required.
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
              All six {page.heading} files are identified.
            </p>
          ) : null}
          <ul className="mt-4 divide-y divide-slate-200/80 overflow-hidden rounded-xl border border-slate-200/80 bg-white/80 dark:divide-slate-700 dark:border-slate-700 dark:bg-[var(--color-surface-elevated)]/80">
            {page.slots.map((slot) => {
              const shown = identification?.files?.[slot.key];
              const restored = restoredNames[slot.key];
              const ambiguous = identification?.issues.some((issue) => issue.key === slot.key);
              const waiting = !identification && !restored;
              let status = 'Waiting for folder';
              let statusClass = 'text-slate-400';
              if (shown?.name) {
                status = shown.name;
                statusClass = 'text-slate-500';
              } else if (restored) {
                status = heldReady ? `${restored} (held)` : restored;
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
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{slot.label}</span>
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
            <h3 className="text-base font-semibold text-rose-950">Unable to process {page.heading} workbook</h3>
            <p className="mt-1 text-sm text-rose-900/80">
              Headers are detected by column name (Product, Quantity, Gross Amount) — order and
              capitalization do not matter.
            </p>
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
          key={`${page.branch}-${result.auditRunId || result.requestId || 'current'}`}
          result={result}
          onResultUpdate={setResult}
          resultsId={page.resultsId}
          branchHeading={`${page.heading} Financials`}
          destinationBranch={page.branch}
          financialYear={financialYear}
          companyName={companyName}
          address={address}
        />
      ) : !sheetError ? (
        <EmptyState
          icon={Gem}
          title="Awaiting process"
          description={`Upload a ${page.heading} folder with the six required files, then Process.`}
        />
      ) : null}
    </div>
  );
}
