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
import { WatchDemoButton } from '../components/demo/WatchDemoButton';
import { Input } from '../components/ui/Input';
import { CLOSING_STOCK_AUDIT_CONFIG } from '../config/closingStockAuditConfig';
import {
  BASHEERBAGH_FOLDER_SLOTS,
  KOKAPET_FOLDER_SLOTS,
  classifyBasheerbaghFolderFiles,
  classifyKokapetFolderFiles,
} from '../config/basheerbaghFolderFiles';
import { formatProcessingErrorHuman } from '../utils/processingErrorUtils';
import { auditToastError, auditToastSuccess } from '../utils/auditToast';
import { useAuditSessionPersistence } from '../hooks/useAuditSessionPersistence';
import { bootstrapAuditSessionState } from '../utils/auditSessionStorage';
import { cn } from '../utils/cn';

const SESSION_KEY = CLOSING_STOCK_AUDIT_CONFIG.sessionKey;

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
  return slots
    .filter((slot) => !assigned?.[slot.key])
    .map((slot) => slot.label);
}

function toastClosingStockOutcome(data, branch = '') {
  const mapped = data?.summary?.mappedProductCount ?? data?.summary?.productsDisplayed ?? 0;
  const unmapped = data?.summary?.unmappedProductCount ?? 0;
  const openingMatched = data?.openingStockReport?.matchedCount
    ?? data?.openingStockReport?.quantityMatchedCount
    ?? 0;
  const mrClassified = data?.summary?.mrClassifiedRows
    ?? data?.mrReport?.classifiedRowCount
    ?? 0;
  const dcClassified = data?.summary?.dcClassifiedRows
    ?? data?.dcReport?.classifiedRowCount
    ?? 0;
  if (mapped > 0) {
    const label = branch ? `${branch} Closing Stock` : 'Closing Stock';
    auditToastSuccess(
      `${label} ready — ${mapped} product${mapped === 1 ? '' : 's'} mapped` +
        (openingMatched ? ` · ${openingMatched} Opening matched` : '') +
        ` · MR ${mrClassified} / DC ${dcClassified} classified` +
        (unmapped ? ` (${unmapped} unmapped)` : '')
    );
  } else {
    const label = branch ? `${branch} Closing Stock` : 'Closing Stock';
    auditToastError(
      unmapped
        ? `${label}: no products matched the Rule Book (${unmapped} unmapped). Check product names.`
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

export default function FinancialsPivotPage() {
  const [initialSession] = useState(() => bootstrapAuditSessionState(SESSION_KEY));
  const [salesFile, setSalesFile] = useState(null);
  const [purchasesFile, setPurchasesFile] = useState(null);
  const [openingQtyFile, setOpeningQtyFile] = useState(null);
  const [previousYearFile, setPreviousYearFile] = useState(null);
  const [mrFile, setMrFile] = useState(null);
  const [dcFile, setDcFile] = useState(null);
  const [basheerbaghFolderFiles, setBasheerbaghFolderFiles] = useState([]);
  const [kokapetFolderFiles, setKokapetFolderFiles] = useState([]);
  const [restoredSalesName, setRestoredSalesName] = useState(
    () => initialSession.data?.salesFileName ?? null
  );
  const [restoredPurchasesName, setRestoredPurchasesName] = useState(
    () => initialSession.data?.purchasesFileName ?? null
  );
  const [restoredOpeningQtyName, setRestoredOpeningQtyName] = useState(
    () => initialSession.data?.openingQtyFileName ?? null
  );
  const [restoredPreviousYearName, setRestoredPreviousYearName] = useState(
    () => initialSession.data?.previousYearFileName ?? null
  );
  const [restoredMrName, setRestoredMrName] = useState(
    () => initialSession.data?.mrFileName ?? null
  );
  const [restoredDcName, setRestoredDcName] = useState(
    () => initialSession.data?.dcFileName ?? null
  );
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(() => initialSession.data?.result ?? null);
  const [sheetError, setSheetError] = useState(() => initialSession.data?.sheetError ?? null);
  const [kokapetResult, setKokapetResult] = useState(null);
  const [kokapetSheetError, setKokapetSheetError] = useState(null);
  const [companyName, setCompanyName] = useState(() => initialSession.data?.companyName ?? '');
  const [address, setAddress] = useState(() => initialSession.data?.address ?? '');
  const [financialYear, setFinancialYear] = useState(
    () => initialSession.data?.financialYear ?? CLOSING_STOCK_AUDIT_CONFIG.defaultFinancialYear
  );

  const applySession = useCallback((data) => {
    setResult(data?.result ?? null);
    setSheetError(data?.sheetError ?? null);
    setRestoredSalesName(data?.salesFileName ?? null);
    setRestoredPurchasesName(data?.purchasesFileName ?? null);
    setRestoredOpeningQtyName(data?.openingQtyFileName ?? null);
    setRestoredPreviousYearName(data?.previousYearFileName ?? null);
    setRestoredMrName(data?.mrFileName ?? null);
    setRestoredDcName(data?.dcFileName ?? null);
    setCompanyName(data?.companyName ?? '');
    setAddress(data?.address ?? '');
    setFinancialYear(data?.financialYear ?? CLOSING_STOCK_AUDIT_CONFIG.defaultFinancialYear);
    setSalesFile(null);
    setPurchasesFile(null);
    setOpeningQtyFile(null);
    setPreviousYearFile(null);
    setMrFile(null);
    setDcFile(null);
    setBasheerbaghFolderFiles([]);
    setKokapetFolderFiles([]);
    setKokapetResult(null);
    setKokapetSheetError(null);
  }, []);

  const kokapetIdentification = useMemo(() => {
    if (!kokapetFolderFiles.length) return null;
    return classifyKokapetFolderFiles(kokapetFolderFiles, { financialYear });
  }, [kokapetFolderFiles, financialYear]);

  const sessionSnapshot = useMemo(
    () => ({
      result,
      sheetError,
      salesFileName: salesFile?.name ?? restoredSalesName ?? null,
      purchasesFileName: purchasesFile?.name ?? restoredPurchasesName ?? null,
      openingQtyFileName: openingQtyFile?.name ?? restoredOpeningQtyName ?? null,
      previousYearFileName: previousYearFile?.name ?? restoredPreviousYearName ?? null,
      mrFileName: mrFile?.name ?? restoredMrName ?? null,
      dcFileName: dcFile?.name ?? restoredDcName ?? null,
      companyName,
      address,
      financialYear,
    }),
    [
      result,
      sheetError,
      salesFile?.name,
      purchasesFile?.name,
      openingQtyFile?.name,
      previousYearFile?.name,
      mrFile?.name,
      dcFile?.name,
      restoredSalesName,
      restoredPurchasesName,
      restoredOpeningQtyName,
      restoredPreviousYearName,
      restoredMrName,
      restoredDcName,
      companyName,
      address,
      financialYear,
    ]
  );

  const { sessionLabel, sessionMeta, persist, restoreSession, startNewAudit, restoring } =
    useAuditSessionPersistence(SESSION_KEY, sessionSnapshot, {
      transform: slimSnapshot,
      onApplySession: applySession,
      onSaveFailed: () => {
        auditToastError('Could not save results locally. Free browser storage or start a new audit.');
      },
    });

  const displaySales = salesFile ?? (restoredSalesName ? { name: restoredSalesName } : null);
  const displayPurchases =
    purchasesFile ?? (restoredPurchasesName ? { name: restoredPurchasesName } : null);
  const displayOpeningQty =
    openingQtyFile ?? (restoredOpeningQtyName ? { name: restoredOpeningQtyName } : null);
  const displayPreviousYear =
    previousYearFile ?? (restoredPreviousYearName ? { name: restoredPreviousYearName } : null);
  const displayMr = mrFile ?? (restoredMrName ? { name: restoredMrName } : null);
  const displayDc = dcFile ?? (restoredDcName ? { name: restoredDcName } : null);
  const canProcess = Boolean(
    salesFile && purchasesFile && openingQtyFile && previousYearFile && mrFile && dcFile
  );

  const applyBasheerbaghFolder = useCallback((files) => {
    const list = Array.isArray(files) ? files : [];
    setBasheerbaghFolderFiles(list);
    setRestoredSalesName(null);
    setRestoredPurchasesName(null);
    setRestoredOpeningQtyName(null);
    setRestoredPreviousYearName(null);
    setRestoredMrName(null);
    setRestoredDcName(null);
    if (!list.length) {
      setSalesFile(null);
      setPurchasesFile(null);
      setOpeningQtyFile(null);
      setPreviousYearFile(null);
      setMrFile(null);
      setDcFile(null);
    }
  }, []);

  useEffect(() => {
    if (!basheerbaghFolderFiles.length) return;
    const assigned = classifyBasheerbaghFolderFiles(basheerbaghFolderFiles, { financialYear });
    setSalesFile(assigned.sales);
    setPurchasesFile(assigned.purchases);
    setOpeningQtyFile(assigned.quantity);
    setPreviousYearFile(assigned.previousYear);
    setMrFile(assigned.mr);
    setDcFile(assigned.dc);
  }, [basheerbaghFolderFiles, financialYear]);

  const workspaceRef = useRef(sessionSnapshot);
  workspaceRef.current = sessionSnapshot;
  const persistWorkspace = useCallback(
    (patch, options = { notifyOnFailure: true, force: true }) => {
      persist({ ...workspaceRef.current, ...patch }, options);
    },
    [persist]
  );

  const runProcess = useCallback(async () => {
    let bhSales = salesFile;
    let bhPurchases = purchasesFile;
    let bhOpeningQty = openingQtyFile;
    let bhPreviousYear = previousYearFile;
    let bhMr = mrFile;
    let bhDc = dcFile;
    if (basheerbaghFolderFiles.length) {
      const assigned = classifyBasheerbaghFolderFiles(basheerbaghFolderFiles, { financialYear });
      bhSales = assigned.sales;
      bhPurchases = assigned.purchases;
      bhOpeningQty = assigned.quantity;
      bhPreviousYear = assigned.previousYear;
      bhMr = assigned.mr;
      bhDc = assigned.dc;
      setSalesFile(assigned.sales);
      setPurchasesFile(assigned.purchases);
      setOpeningQtyFile(assigned.quantity);
      setPreviousYearFile(assigned.previousYear);
      setMrFile(assigned.mr);
      setDcFile(assigned.dc);
    }
    const bhReady = assignedSixReady({
      sales: bhSales,
      purchases: bhPurchases,
      quantity: bhOpeningQty,
      previousYear: bhPreviousYear,
      mr: bhMr,
      dc: bhDc,
    });

    if (!bhReady) {
      if (basheerbaghFolderFiles.length) {
        const missing = missingSlotLabels(
          {
            sales: bhSales,
            purchases: bhPurchases,
            quantity: bhOpeningQty,
            previousYear: bhPreviousYear,
            mr: bhMr,
            dc: bhDc,
          },
          BASHEERBAGH_FOLDER_SLOTS
        );
        auditToastError(
          `Basheerbagh is missing ${missing.join(', ')}. Closing Stock runs only when all six files are identified.`
        );
      } else {
        auditToastError(
          'Upload Sales, Purchases, Opening Quantity, Previous Year Closing, MR, and DC files before processing.'
        );
      }
      return;
    }

    setLoading(true);
    try {
      const data = await CLOSING_STOCK_AUDIT_CONFIG.process(
        bhSales,
        bhPurchases,
        bhOpeningQty,
        bhPreviousYear,
        bhMr,
        bhDc
      );
      if (data && data.success === false) {
        auditToastError(data.detail || 'Processing failed');
        setSheetError(typeof data.error === 'object' ? data : { ...data });
        setResult(null);
        persistWorkspace(
          {
            result: null,
            sheetError: typeof data.error === 'object' ? data : { ...data },
            salesFileName: bhSales?.name ?? restoredSalesName ?? null,
            purchasesFileName: bhPurchases?.name ?? restoredPurchasesName ?? null,
            openingQtyFileName: bhOpeningQty?.name ?? restoredOpeningQtyName ?? null,
            previousYearFileName: bhPreviousYear?.name ?? restoredPreviousYearName ?? null,
            mrFileName: bhMr?.name ?? restoredMrName ?? null,
            dcFileName: bhDc?.name ?? restoredDcName ?? null,
            companyName,
            address,
            financialYear,
          },
          { notifyOnFailure: true, force: true }
        );
      } else {
        setResult(data);
        setSheetError(null);
        requestAnimationFrame(() => {
          document.getElementById('basheerbagh-results')?.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
          });
        });
        toastClosingStockOutcome(data);
        persistWorkspace(
          {
            result: data,
            sheetError: null,
            salesFileName: bhSales?.name ?? restoredSalesName ?? null,
            purchasesFileName: bhPurchases?.name ?? restoredPurchasesName ?? null,
            openingQtyFileName: bhOpeningQty?.name ?? restoredOpeningQtyName ?? null,
            previousYearFileName: bhPreviousYear?.name ?? restoredPreviousYearName ?? null,
            mrFileName: bhMr?.name ?? restoredMrName ?? null,
            dcFileName: bhDc?.name ?? restoredDcName ?? null,
            companyName,
            address,
            financialYear,
          },
          { notifyOnFailure: true, force: true }
        );
      }
    } catch (e) {
      setSheetError(e.details ?? null);
      setResult(null);
      auditToastError(e.message || 'Processing failed');
      persistWorkspace(
        {
          result: null,
          sheetError: e.details ?? null,
          salesFileName: bhSales?.name ?? restoredSalesName ?? null,
          purchasesFileName: bhPurchases?.name ?? restoredPurchasesName ?? null,
          openingQtyFileName: bhOpeningQty?.name ?? restoredOpeningQtyName ?? null,
          previousYearFileName: bhPreviousYear?.name ?? restoredPreviousYearName ?? null,
          mrFileName: bhMr?.name ?? restoredMrName ?? null,
          dcFileName: bhDc?.name ?? restoredDcName ?? null,
          companyName,
          address,
          financialYear,
        },
        { notifyOnFailure: true, force: true }
      );
    } finally {
      setLoading(false);
    }
  }, [
    basheerbaghFolderFiles,
    salesFile,
    purchasesFile,
    openingQtyFile,
    previousYearFile,
    mrFile,
    dcFile,
    persistWorkspace,
    restoredSalesName,
    restoredPurchasesName,
    restoredOpeningQtyName,
    restoredPreviousYearName,
    restoredMrName,
    restoredDcName,
    companyName,
    address,
    financialYear,
  ]);

  const canProcessKokapet = Boolean(kokapetIdentification?.ready);

  const runKokapetProcess = useCallback(async () => {
    const identified = classifyKokapetFolderFiles(kokapetFolderFiles, { financialYear });
    if (!identified.ready) {
      if (identified.issues?.length) {
        auditToastError(identified.issues.map((issue) => issue.message).join(' '));
      } else if (identified.missing?.length) {
        auditToastError(
          `Kokapet is missing ${identified.missing.join(', ')}. Closing Stock runs only when all six files are identified.`
        );
      } else {
        auditToastError('Upload a Kokapet folder with the six required files before processing.');
      }
      return;
    }

    const kpSales = identified.files.sales;
    const kpPurchases = identified.files.purchases;
    const kpOpeningQty = identified.files.quantity;
    const kpPreviousYear = identified.files.previousYear;
    const kpMr = identified.files.mr;
    const kpDc = identified.files.dc;

    setLoading(true);
    try {
      const data = await CLOSING_STOCK_AUDIT_CONFIG.process(
        kpSales,
        kpPurchases,
        kpOpeningQty,
        kpPreviousYear,
        kpMr,
        kpDc
      );
      if (data && data.success === false) {
        auditToastError(data.detail || 'Kokapet processing failed');
        setKokapetSheetError(typeof data.error === 'object' ? data : { ...data });
        setKokapetResult(null);
      } else {
        setKokapetResult(data);
        setKokapetSheetError(null);
        requestAnimationFrame(() => {
          document.getElementById('kokapet-results')?.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
          });
        });
        toastClosingStockOutcome(data, 'Kokapet');
      }
    } catch (e) {
      setKokapetSheetError(e.details ?? null);
      setKokapetResult(null);
      auditToastError(e.message || 'Kokapet processing failed');
    } finally {
      setLoading(false);
    }
  }, [kokapetFolderFiles, financialYear]);

  const handleStartNew = useCallback(() => {
    startNewAudit();
    setSalesFile(null);
    setPurchasesFile(null);
    setOpeningQtyFile(null);
    setPreviousYearFile(null);
    setMrFile(null);
    setDcFile(null);
    setBasheerbaghFolderFiles([]);
    setKokapetFolderFiles([]);
    setKokapetResult(null);
    setKokapetSheetError(null);
    setRestoredSalesName(null);
    setRestoredPurchasesName(null);
    setRestoredOpeningQtyName(null);
    setRestoredPreviousYearName(null);
    setRestoredMrName(null);
    setRestoredDcName(null);
    setCompanyName('');
    setAddress('');
    setFinancialYear(CLOSING_STOCK_AUDIT_CONFIG.defaultFinancialYear);
    setResult(null);
    setSheetError(null);
  }, [startNewAudit]);

  return (
    <div className="relative space-y-8">
      <AuditValidationOverlay open={loading} label={CLOSING_STOCK_AUDIT_CONFIG.processOverlayLabel} />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-slate-50">
              {CLOSING_STOCK_AUDIT_CONFIG.pageTitle}
            </h1>
            <Badge tone="amber">{CLOSING_STOCK_AUDIT_CONFIG.badgeLabel}</Badge>
          </div>
          <p className="mt-1 max-w-3xl text-sm text-slate-600 dark:text-slate-400">
            {CLOSING_STOCK_AUDIT_CONFIG.pageSubtitle}
          </p>
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
              <h2 className="text-lg font-bold text-emerald-700">Upload &amp; process</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Six files are required. Opening Qty from Opening Balance; Opening Amount from each
                product’s previous-year sheet Closing Balance — then Rule Book layout. MR and DC
                each produce three location pivots.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <WatchDemoButton moduleKey={CLOSING_STOCK_AUDIT_CONFIG.demoModuleKey} />
              <Button
                variant="primary"
                size="md"
                loading={loading}
                disabled={loading || !canProcess}
                onClick={runProcess}
              >
                <FileSpreadsheet className="h-4 w-4" />
                {CLOSING_STOCK_AUDIT_CONFIG.processLabel}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardBody>
          <section className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 dark:border-slate-700 dark:bg-slate-900/20">
            <h3 className="text-base font-bold text-emerald-800 dark:text-emerald-300">Basheerbagh</h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Upload one folder. Files are identified by name (Sales, Purchases, MR, DC, Quantity
              File). Previous Year Financials is the spreadsheet whose name ends with the year (for
              2025: 2024-2025, 2025, 2k24-2k25, or 2k25). Process still uses the same six-file flow.
            </p>
            <div className="mt-4">
              <FolderUploadZone
                files={basheerbaghFolderFiles}
                disabled={loading}
                formatHint={CLOSING_STOCK_AUDIT_CONFIG.fileFormatHint}
                onFilesChange={applyBasheerbaghFolder}
              />
            </div>
            <ul className="mt-4 divide-y divide-slate-200/80 overflow-hidden rounded-xl border border-slate-200/80 bg-white/80 dark:divide-slate-700 dark:border-slate-700 dark:bg-[var(--color-surface-elevated)]/80">
              {BASHEERBAGH_FOLDER_SLOTS.map((slot) => {
                const shown = {
                  sales: displaySales,
                  purchases: displayPurchases,
                  quantity: displayOpeningQty,
                  previousYear: displayPreviousYear,
                  mr: displayMr,
                  dc: displayDc,
                }[slot.key];
                return (
                  <li key={slot.key} className="flex items-center justify-between gap-3 px-3 py-2.5">
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {slot.label}
                    </span>
                    <span
                      className={cn(
                        'min-w-0 truncate text-xs',
                        shown?.name ? 'text-slate-500' : 'font-medium text-rose-600'
                      )}
                    >
                      {shown?.name || 'Not found in folder'}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="mt-6 rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 dark:border-slate-700 dark:bg-slate-900/20">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-base font-bold text-emerald-800 dark:text-emerald-300">Kokapet</h3>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Upload one Kokapet folder. Process uses the same six-file Financials flow as
                  Basheerbagh: Sales, Purchases, Opening Quantity, Previous Year Financials, MR,
                  and DC. Sales Return and Purchase Return are not inputs.
                </p>
              </div>
              <Button
                variant="primary"
                size="md"
                loading={loading}
                disabled={loading || !canProcessKokapet}
                onClick={runKokapetProcess}
              >
                <FileSpreadsheet className="h-4 w-4" />
                {CLOSING_STOCK_AUDIT_CONFIG.processLabel}
              </Button>
            </div>
            <div className="mt-4">
              <FolderUploadZone
                files={kokapetFolderFiles}
                disabled={loading}
                formatHint={CLOSING_STOCK_AUDIT_CONFIG.fileFormatHint}
                onFilesChange={(files) => {
                  setKokapetFolderFiles(files);
                  setKokapetResult(null);
                  setKokapetSheetError(null);
                }}
              />
            </div>
            {kokapetIdentification?.missing.length ? (
              <p className="mt-4 text-sm font-medium text-rose-700 dark:text-rose-300">
                Missing: {kokapetIdentification.missing.join(', ')}. All six Kokapet files are
                required.
              </p>
            ) : null}
            {kokapetIdentification?.issues.length ? (
              <ul className="mt-3 space-y-1 text-sm font-medium text-amber-800 dark:text-amber-200">
                {kokapetIdentification.issues.map((issue) => (
                  <li key={issue.key}>{issue.message}</li>
                ))}
              </ul>
            ) : null}
            {kokapetIdentification?.ready ? (
              <p className="mt-4 text-sm font-medium text-emerald-700 dark:text-emerald-300">
                All six Kokapet files are identified.
              </p>
            ) : null}
            <ul className="mt-4 divide-y divide-slate-200/80 overflow-hidden rounded-xl border border-slate-200/80 bg-white/80 dark:divide-slate-700 dark:border-slate-700 dark:bg-[var(--color-surface-elevated)]/80">
              {KOKAPET_FOLDER_SLOTS.map((slot) => {
                const shown = kokapetIdentification?.files?.[slot.key];
                const ambiguous = kokapetIdentification?.issues.some((issue) => issue.key === slot.key);
                const waiting = !kokapetIdentification;
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
          </section>

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
          {!canProcess ? (
            <p className="mt-4 text-sm text-slate-500">
              Upload a Basheerbagh folder with the six required files to enable Process.
            </p>
          ) : null}
        </CardBody>
      </Card>

      {sheetError ? (
        <Card className="border-rose-200/80 bg-rose-50/40 shadow-md">
          <CardHeader>
            <h3 className="text-base font-semibold text-rose-950">Unable to process workbook</h3>
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
          key={`bh-${result.auditRunId || result.requestId || 'current'}`}
          result={result}
          onResultUpdate={setResult}
          resultsId="basheerbagh-results"
          branchHeading="Basheerbagh Financials"
          financialYear={financialYear}
          companyName={companyName}
          address={address}
        />
      ) : !sheetError ? (
        <EmptyState
          icon={Gem}
          title="Awaiting process"
          description="Upload a Basheerbagh folder with the six required files, then Process."
        />
      ) : null}

      {kokapetSheetError ? (
        <Card className="border-rose-200/80 bg-rose-50/40 shadow-md">
          <CardHeader>
            <h3 className="text-base font-semibold text-rose-950">Unable to process Kokapet workbook</h3>
            <p className="mt-1 text-sm text-rose-900/80">
              Headers are detected by column name (Product, Quantity, Gross Amount) — order and
              capitalization do not matter.
            </p>
          </CardHeader>
          <CardBody>
            <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-xl bg-[var(--color-surface-elevated)] p-4 font-mono text-xs text-[var(--color-text-primary)] shadow-inner">
              {formatProcessingErrorHuman(kokapetSheetError)}
            </pre>
          </CardBody>
        </Card>
      ) : null}

      {kokapetResult ? (
        <FinancialsBranchResults
          key={`kp-${kokapetResult.auditRunId || kokapetResult.requestId || 'current'}`}
          result={kokapetResult}
          onResultUpdate={setKokapetResult}
          resultsId="kokapet-results"
          branchHeading="Kokapet Financials"
          financialYear={financialYear}
          companyName={companyName}
          address={address}
        />
      ) : null}
    </div>
  );
}
