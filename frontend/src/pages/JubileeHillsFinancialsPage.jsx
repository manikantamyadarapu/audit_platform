import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, FileSpreadsheet, Gem } from 'lucide-react';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { AuditValidationOverlay } from '../components/ui/AuditValidationOverlay';
import { FolderUploadZone } from '../components/upload/FolderUploadZone';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { AuditSessionBanner } from '../components/audit/AuditSessionBanner';
import {
  JubileeOpeningAmountPanel,
  loadJubileeOpeningMappings,
  saveJubileeOpeningMapping,
} from '../components/audit/JubileeOpeningAmountPanel';
import { JubileePivotPreview } from '../components/audit/JubileePivotPreview';
import { ClosingStockPreviewTable } from '../components/tables/ClosingStockPreviewTable';
import { TradingAccountPreview } from '../components/tables/TradingAccountPreview';
import { AbstractPreviewTable } from '../components/tables/AbstractPreviewTable';
import { Input } from '../components/ui/Input';
import { CLOSING_STOCK_AUDIT_CONFIG } from '../config/closingStockAuditConfig';
import { CLOSING_STOCK_CATEGORIES, JUBILEE_HILLS_HEADER_LABELS } from '../config/closingStockLayout';
import { ABSTRACT_SHEET_NAME } from '../config/abstractLayout';
import { TRADING_SHEET_NAME } from '../config/tradingAccountLayout';
import {
  JUBILEE_HILLS_FOLDER_SLOTS,
  classifyJubileeHillsFolderFiles,
} from '../config/jubileeHillsFolderFiles';
import {
  JUBILEE_HILLS_PREVIEW_SHEETS,
} from '../config/jubileeHillsSheetStructure';
import {
  downloadJubileeHillsTemplate,
  placeJubileeHillsFromPivots,
  processJubileeHillsFinancials,
} from '../services/financials.service';
import { formatProcessingErrorHuman } from '../utils/processingErrorUtils';
import { auditToastError, auditToastSuccess } from '../utils/auditToast';
import { cn } from '../utils/cn';
import { SourceAverageRatesHint } from '../components/audit/SourceAverageRatesHint';
import { readSourceAverageRates, saveBranchAverageRates } from '../utils/sourceAverageRates';
import { useAuditSessionPersistence } from '../hooks/useAuditSessionPersistence';
import { bootstrapAuditSessionState, slimJubileeHillsSnapshot } from '../utils/auditSessionStorage';

const JUBILEE_SESSION_KEY = 'financials-jubilee-hills';

const EMPTY_RESTORED_NAMES = {
  sales: null,
  purchases: null,
  quantity: null,
  previousYear: null,
  salesReturn: null,
  purchaseReturn: null,
  creditNote: null,
  debitNote: null,
  mr: null,
  dc: null,
};

function restoredNamesFromSession(data) {
  if (!data) return { ...EMPTY_RESTORED_NAMES };
  return {
    sales: data.salesFileName ?? null,
    purchases: data.purchasesFileName ?? null,
    quantity: data.openingQtyFileName ?? null,
    previousYear: data.previousYearFileName ?? null,
    salesReturn: data.salesReturnFileName ?? null,
    purchaseReturn: data.purchaseReturnFileName ?? null,
    creditNote: data.creditNoteFileName ?? null,
    debitNote: data.debitNoteFileName ?? null,
    mr: data.mrFileName ?? null,
    dc: data.dcFileName ?? null,
  };
}

function withOpeningCandidates(result) {
  const match = result?.openingAmountMatch;
  const catalog = match?.previousYearByCategory;
  if (!match || !catalog || !Array.isArray(match.manualMappingRequiredRows)) return result;
  return {
    ...result,
    openingAmountMatch: {
      ...match,
      manualMappingRequiredRows: match.manualMappingRequiredRows.map((row) => {
        if (Array.isArray(row?.candidateProducts) && row.candidateProducts.length) return row;
        const category = String(row?.category || '').trim();
        const options = Array.isArray(catalog[category]) ? catalog[category] : [];
        return { ...row, candidateProducts: options };
      }),
    },
  };
}

function sessionResult(data) {
  return withOpeningCandidates(data?.result ?? null);
}

function slimSnapshot(data) {
  if (!data) return null;
  return slimJubileeHillsSnapshot({
    result: data.result ?? null,
    sheetError: data.sheetError ?? null,
    activeSheet: data.activeSheet ?? CLOSING_STOCK_CATEGORIES[0],
    salesFileName: data.salesFileName ?? null,
    purchasesFileName: data.purchasesFileName ?? null,
    openingQtyFileName: data.openingQtyFileName ?? null,
    previousYearFileName: data.previousYearFileName ?? null,
    salesReturnFileName: data.salesReturnFileName ?? null,
    purchaseReturnFileName: data.purchaseReturnFileName ?? null,
    creditNoteFileName: data.creditNoteFileName ?? null,
    debitNoteFileName: data.debitNoteFileName ?? null,
    mrFileName: data.mrFileName ?? null,
    dcFileName: data.dcFileName ?? null,
    companyName: data.companyName ?? '',
    address: data.address ?? '',
    financialYear: data.financialYear ?? CLOSING_STOCK_AUDIT_CONFIG.defaultFinancialYear,
  });
}

export default function JubileeHillsFinancialsPage() {
  const [initialSession] = useState(() => bootstrapAuditSessionState(JUBILEE_SESSION_KEY));
  const [folderFiles, setFolderFiles] = useState([]);
  const [restoredNames, setRestoredNames] = useState(() =>
    restoredNamesFromSession(initialSession.data)
  );
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [sheetsReady, setSheetsReady] = useState(() => Boolean(sessionResult(initialSession.data)?.layoutByCategory));
  const [sheetError, setSheetError] = useState(() => initialSession.data?.sheetError ?? null);
  const [result, setResult] = useState(() => sessionResult(initialSession.data));
  const [activeSheet, setActiveSheet] = useState(
    () => initialSession.data?.activeSheet || CLOSING_STOCK_CATEGORIES[0]
  );
  const [companyName, setCompanyName] = useState(() => initialSession.data?.companyName ?? '');
  const [address, setAddress] = useState(() => initialSession.data?.address ?? '');
  const [financialYear, setFinancialYear] = useState(
    () => initialSession.data?.financialYear ?? CLOSING_STOCK_AUDIT_CONFIG.defaultFinancialYear
  );

  const identification = useMemo(() => {
    if (!folderFiles.length) return null;
    return classifyJubileeHillsFolderFiles(folderFiles, { financialYear });
  }, [folderFiles, financialYear]);

  const canProcess = Boolean(identification?.ready);
  const namedFiles = identification?.files;

  const applySession = useCallback((data) => {
    const nextResult = sessionResult(data);
    setResult(nextResult);
    setSheetsReady(Boolean(nextResult?.layoutByCategory));
    setSheetError(data?.sheetError ?? null);
    setActiveSheet(data?.activeSheet || CLOSING_STOCK_CATEGORIES[0]);
    setRestoredNames(restoredNamesFromSession(data));
    setCompanyName(data?.companyName ?? '');
    setAddress(data?.address ?? '');
    setFinancialYear(data?.financialYear ?? CLOSING_STOCK_AUDIT_CONFIG.defaultFinancialYear);
    setFolderFiles([]);
  }, []);

  const sessionSnapshot = useMemo(
    () => ({
      result,
      sheetError,
      activeSheet,
      salesFileName: namedFiles?.sales?.name ?? restoredNames.sales ?? null,
      purchasesFileName: namedFiles?.purchases?.name ?? restoredNames.purchases ?? null,
      openingQtyFileName: namedFiles?.quantity?.name ?? restoredNames.quantity ?? null,
      previousYearFileName: namedFiles?.previousYear?.name ?? restoredNames.previousYear ?? null,
      salesReturnFileName: namedFiles?.salesReturn?.name ?? restoredNames.salesReturn ?? null,
      purchaseReturnFileName: namedFiles?.purchaseReturn?.name ?? restoredNames.purchaseReturn ?? null,
      creditNoteFileName: namedFiles?.creditNote?.name ?? restoredNames.creditNote ?? null,
      debitNoteFileName: namedFiles?.debitNote?.name ?? restoredNames.debitNote ?? null,
      mrFileName: namedFiles?.mr?.name ?? restoredNames.mr ?? null,
      dcFileName: namedFiles?.dc?.name ?? restoredNames.dc ?? null,
      companyName,
      address,
      financialYear,
    }),
    [result, sheetError, activeSheet, namedFiles, restoredNames, companyName, address, financialYear]
  );

  const { sessionLabel, sessionMeta, persist, restoreSession, startNewAudit, restoring } =
    useAuditSessionPersistence(JUBILEE_SESSION_KEY, sessionSnapshot, {
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

  const layouts = result?.layoutByCategory || {};

  const applyPlacement = useCallback((data) => {
    saveBranchAverageRates('jubileeHills', data?.productAverageRates);
    setResult(data);
    setSheetsReady(true);
    setSheetError(null);
  }, []);

  const runProcess = useCallback(async () => {
    const identified = classifyJubileeHillsFolderFiles(folderFiles, { financialYear });
    if (!identified.ready) {
      if (identified.issues?.length) {
        auditToastError(identified.issues.map((issue) => issue.message).join(' '));
      } else if (identified.missing?.length) {
        auditToastError(`Jubilee Hills is missing ${identified.missing.join(', ')}.`);
      } else {
        auditToastError('Upload a Jubilee Hills folder with Sales, Purchases, Opening Quantity, Sales Return, Purchase Return, Credit Notes from Suppliers, Debit Notes from Suppliers, and Previous Year Financials.');
      }
      return;
    }

    setLoading(true);
    const fileNames = {
      salesFileName: identified.files?.sales?.name ?? restoredNames.sales ?? null,
      purchasesFileName: identified.files?.purchases?.name ?? restoredNames.purchases ?? null,
      openingQtyFileName: identified.files?.quantity?.name ?? restoredNames.quantity ?? null,
      previousYearFileName: identified.files?.previousYear?.name ?? restoredNames.previousYear ?? null,
      salesReturnFileName: identified.files?.salesReturn?.name ?? restoredNames.salesReturn ?? null,
      purchaseReturnFileName: identified.files?.purchaseReturn?.name ?? restoredNames.purchaseReturn ?? null,
      creditNoteFileName: identified.files?.creditNote?.name ?? restoredNames.creditNote ?? null,
      debitNoteFileName: identified.files?.debitNote?.name ?? restoredNames.debitNote ?? null,
      mrFileName: identified.files?.mr?.name ?? restoredNames.mr ?? null,
      dcFileName: identified.files?.dc?.name ?? restoredNames.dc ?? null,
      companyName,
      address,
      financialYear,
    };
    try {
      const data = await processJubileeHillsFinancials(identified.files, {
        savedOpeningMappings: loadJubileeOpeningMappings(),
      });
      applyPlacement(data);
      setActiveSheet(CLOSING_STOCK_CATEGORIES[0]);
      persistWorkspace(
        { result: data, sheetError: null, activeSheet: CLOSING_STOCK_CATEGORIES[0], ...fileNames },
        { notifyOnFailure: true, force: true }
      );
      requestAnimationFrame(() => {
        document.getElementById('jubilee-hills-pivots')?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      });
      auditToastSuccess('Jubilee Hills pivots are ready.');
    } catch (e) {
      const errorBody = e.details ?? e.message ?? null;
      setResult(null);
      setSheetsReady(false);
      setSheetError(errorBody);
      persistWorkspace(
        { result: null, sheetError: errorBody, ...fileNames },
        { notifyOnFailure: true, force: true }
      );
      auditToastError(e.message || 'Could not build the Jubilee Hills sheets.');
    } finally {
      setLoading(false);
    }
  }, [address, applyPlacement, companyName, financialYear, folderFiles, persistWorkspace, restoredNames]);

  const handleConfirmOpeningAmount = useCallback(
    async (mapping) => {
      if (!result) return;
      const previousNames = mapping.previousYearProducts?.length
        ? mapping.previousYearProducts
        : [mapping.previousYearProduct].filter(Boolean);
      saveJubileeOpeningMapping(mapping.product, previousNames);
      const openingPivot = (result.openingPivot || []).map((row) => {
        if (String(row?.product || '').trim() !== mapping.product) return row;
        return {
          ...row,
          product: mapping.product,
          ruleBookProduct: mapping.product,
          sumOfGross: mapping.amount,
          status: 'matched_saved',
          matchMethod: 'saved',
          previousYearProduct: previousNames.join(' + '),
          previousYearProducts: previousNames,
        };
      });
      const match = { ...(result.openingAmountMatch || {}) };
      const manual = (match.manualMappingRequiredRows || []).filter(
        (row) => row.product !== mapping.product
      );
      const unresolved = (Array.isArray(match.unresolvedProducts) ? match.unresolvedProducts : []).filter(
        (row) => row.product !== mapping.product
      );
      const next = {
        ...result,
        openingPivot,
        openingAmountMatch: {
          ...match,
          manualMappingRequiredRows: manual,
          manualMappingRequired: manual.length,
          unresolvedProducts: unresolved,
          unresolvedProductCount: unresolved.length,
          savedMappingsReused: (match.savedMappingsReused || 0) + 1,
        },
      };
      setResult(next);
      try {
        const transfers = result.transferPivots || {};
        const placed = await placeJubileeHillsFromPivots({
          salesPivot: next.salesPivot || [],
          purchasesPivot: next.purchasesPivot || [],
          salesReturnPivot: next.salesReturnPivot || [],
          purchaseReturnPivot: next.purchaseReturnPivot || [],
          supplierDebitNotePivot: next.supplierDebitNotePivot || [],
          supplierCreditNotePivot: next.supplierCreditNotePivot || [],
          openingPivot,
          mrPivots: transfers.mrPivots || {},
          dcPivots: transfers.dcPivots || {},
          sourceAverageRates: readSourceAverageRates(),
        });
        saveBranchAverageRates('jubileeHills', placed.productAverageRates);
        setResult({
          ...next,
          productsByCategory: placed.productsByCategory,
          layoutByCategory: placed.layoutByCategory,
          unmappedProducts: placed.unmappedProducts,
          unmappedProductDetails: placed.unmappedProductDetails,
          receiptAmountReview: placed.receiptAmountReview || [],
          productAverageRates: placed.productAverageRates || [],
        });
        persistWorkspace(
          {
            result: {
              ...next,
              productsByCategory: placed.productsByCategory,
              layoutByCategory: placed.layoutByCategory,
              unmappedProducts: placed.unmappedProducts,
              unmappedProductDetails: placed.unmappedProductDetails,
              receiptAmountReview: placed.receiptAmountReview || [],
              productAverageRates: placed.productAverageRates || [],
            },
          },
          { notifyOnFailure: true, force: true }
        );
        auditToastSuccess(`Opening amount mapped for ${mapping.product}`);
      } catch (e) {
        auditToastError(e.message || 'Could not update the Jubilee Hills sheets.');
      }
    },
    [persistWorkspace, result]
  );

  const handleStartNew = useCallback(() => {
    startNewAudit();
    setFolderFiles([]);
    setRestoredNames({ ...EMPTY_RESTORED_NAMES });
    setSheetsReady(false);
    setSheetError(null);
    setResult(null);
    setActiveSheet(CLOSING_STOCK_CATEGORIES[0]);
    setCompanyName('');
    setAddress('');
    setFinancialYear(CLOSING_STOCK_AUDIT_CONFIG.defaultFinancialYear);
  }, [startNewAudit]);

  const downloadSheets = useCallback(async () => {
    setExporting(true);
    try {
      await downloadJubileeHillsTemplate({
        companyName: companyName.trim(),
        address: address.trim(),
        financialYear: financialYear.trim() || CLOSING_STOCK_AUDIT_CONFIG.defaultFinancialYear,
        layoutByCategory: result?.layoutByCategory || null,
        salesPivot: result?.netSalesPivot || result?.salesPivot || [],
        purchasesPivot: result?.netPurchasesPivot || result?.purchasesPivot || [],
        openingPivot: result?.openingPivot || [],
        mrPivots: result?.mrPivots || result?.transferPivots?.mrPivots || {},
        dcPivots: result?.dcPivots || result?.transferPivots?.dcPivots || {},
      });
      auditToastSuccess('Jubilee Hills workbook downloaded');
    } catch (e) {
      auditToastError(e.message || 'Jubilee Hills download failed');
    } finally {
      setExporting(false);
    }
  }, [address, companyName, financialYear, result]);

  return (
    <div className="relative space-y-8">
      <AuditValidationOverlay open={loading} label="Building Jubilee Hills Financials…" />

      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-slate-50">
            Jubilee Hills Financials
          </h1>
          <Badge tone="amber">Eight files</Badge>
        </div>
        <p className="mt-1 max-w-3xl text-sm text-slate-600 dark:text-slate-400">
          Upload one Jubilee Hills folder. Diamond products are identified by Chakri, Flat Polki, Polki, FP,
          BD, Black Diamonds, DB, Di. Beads, RC, RA, and SD. JOS, JSP, and JSY go to Precious and Semi
          Precious as Precious Stones, Semi Precious, and Synthetic Stones. JEM, JPS, and JRU go
          to Emerald, Pearls, or Rubie. A product that appears only in Opening Quantity uses last
          year’s sheet, except Diamond, which follows those Diamond codes.
        </p>
        <SourceAverageRatesHint branch="jubileeHills" />
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
        <CardBody>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              The folder needs Sales, Purchases, Opening Quantity, Previous Year Financials, Sales
              Return, Purchase Return, Credit Notes from Suppliers, and Debit Notes from Suppliers.
              Sales Return uses Product, Quantity, and Amount. Purchase Return uses Product,
              Quantity, and Amount. Debit notes use Product and Debit Amount. Credit notes use
              Product and Credit Amount. Sheet sales are Sales minus Sales Return. Sheet purchases
              are Purchases minus Purchase Return, plus Debit Amount, minus Credit Amount. Opening,
              MR, and DC stay unchanged. MR and DC are optional.
            </p>
            <Button
              variant="primary"
              size="md"
              loading={loading}
              disabled={loading || !canProcess}
              onClick={runProcess}
            >
              <FileSpreadsheet className="h-4 w-4" />
              Show sheets
            </Button>
          </div>
          <div className="mt-4">
            <FolderUploadZone
              files={folderFiles}
              disabled={loading}
              formatHint={CLOSING_STOCK_AUDIT_CONFIG.fileFormatHint}
              onFilesChange={(files) => {
                setFolderFiles(Array.isArray(files) ? files : []);
              }}
            />
          </div>
          {identification?.missing.length ? (
            <p className="mt-4 text-sm font-medium text-rose-700 dark:text-rose-300">
              Missing: {identification.missing.join(', ')}. Those six Jubilee Hills files are required.
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
              The six Jubilee Hills files are identified.
            </p>
          ) : null}
          <ul className="mt-4 divide-y divide-slate-200/80 overflow-hidden rounded-xl border border-slate-200/80 bg-white/80 dark:divide-slate-700 dark:border-slate-700 dark:bg-[var(--color-surface-elevated)]/80">
            {JUBILEE_HILLS_FOLDER_SLOTS.map((slot) => {
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
                status = restored;
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
        <Card className="border-amber-200/80 bg-amber-50/40 shadow-md">
          <CardHeader>
            <h3 className="text-base font-semibold text-amber-950">Jubilee Hills sheets could not be built</h3>
          </CardHeader>
          <CardBody>
            <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-xl bg-[var(--color-surface-elevated)] p-4 font-mono text-xs text-[var(--color-text-primary)] shadow-inner">
              {formatProcessingErrorHuman(sheetError)}
            </pre>
          </CardBody>
        </Card>
      ) : null}

      {sheetsReady ? <JubileePivotPreview result={result} /> : null}

      {sheetsReady && result?.openingAmountMatch ? (
        <Card className="border-sky-200/80 bg-sky-50/40 dark:border-sky-900/40 dark:bg-sky-950/20">
          <CardHeader>
            <h3 className="text-base font-semibold text-sky-950 dark:text-sky-100">
              Previous-year opening amounts
            </h3>
            <p className="mt-1 text-sm text-sky-900/80 dark:text-sky-200/80">
              Amounts are filled when one previous-year product in the same category matches and
              the quantity matches. Anything else stays here for review. The list shows only that
              category.
            </p>
          </CardHeader>
          <CardBody>
            <JubileeOpeningAmountPanel
              match={result.openingAmountMatch}
              onConfirm={handleConfirmOpeningAmount}
            />
          </CardBody>
        </Card>
      ) : null}

      {Array.isArray(result?.receiptAmountReview) && result.receiptAmountReview.length ? (
        <Card className="border-amber-200/80 bg-amber-50/70">
          <CardHeader>
            <h3 className="text-base font-bold text-amber-900">Receipt amounts to review</h3>
            <p className="mt-1 text-sm text-amber-900/80">
              These receipt quantities have no matching Average Rate on the source branch, so the amount was left blank.
            </p>
          </CardHeader>
          <CardBody>
            <ul className="space-y-1 text-sm text-amber-950">
              {result.receiptAmountReview.map((row) => (
                <li key={`${row.category}-${row.product}-${row.column}`}>
                  {row.product} — {row.column} needs {row.sourceBranchLabel} Average Rate
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}

      {sheetsReady ? (
        <Card id="jubilee-hills-results">
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-base font-bold text-emerald-700">Jubilee Hills Financials</h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  Diamond codes and words place the product on the Diamond sheet. JOS, JSP, and JSY
                  place it on Precious and Semi Precious. JEM, JPS, and JRU place it on Emerald,
                  Pearls, or Rubie. An opening-only product uses last year’s sheet when that sheet
                  is not Diamond.
                </p>
              </div>
              <Button variant="primary" size="md" loading={exporting} disabled={exporting} onClick={downloadSheets}>
                <Download className="h-4 w-4" />
                Download workbook
              </Button>
            </div>
            <div
              className="mt-4 flex flex-wrap gap-1 rounded-xl border border-slate-200/80 bg-slate-50/80 p-1 dark:border-slate-700 dark:bg-slate-900/30"
              role="tablist"
              aria-label="Jubilee Hills sheets"
            >
              {JUBILEE_HILLS_PREVIEW_SHEETS.map((sheet) => {
                const selected = sheet === activeSheet;
                const isCategorySheet =
                  sheet !== TRADING_SHEET_NAME && sheet !== ABSTRACT_SHEET_NAME;
                const count = Array.isArray(result?.productsByCategory?.[sheet])
                  ? result.productsByCategory[sheet].length
                  : 0;
                return (
                  <button
                    key={sheet}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    onClick={() => setActiveSheet(sheet)}
                    className={cn(
                      'rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors',
                      selected
                        ? 'bg-emerald-700 text-white shadow-sm'
                        : 'text-slate-600 hover:bg-white hover:text-emerald-800 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-emerald-200'
                    )}
                  >
                    {sheet}
                    {isCategorySheet ? (
                      <span
                        className={cn(
                          'ml-1.5 text-xs font-medium',
                          selected ? 'text-emerald-100' : 'text-slate-400'
                        )}
                      >
                        ({count})
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </CardHeader>
          <CardBody>
            {activeSheet === TRADING_SHEET_NAME ? (
              <TradingAccountPreview
                layoutByCategory={layouts}
                salesPivot={result?.netSalesPivot || result?.salesPivot || []}
                purchasesPivot={result?.netPurchasesPivot || result?.purchasesPivot || []}
                openingPivot={result?.openingPivot || []}
                mrPivots={result?.mrPivots || result?.transferPivots?.mrPivots || {}}
                dcPivots={result?.dcPivots || result?.transferPivots?.dcPivots || {}}
              />
            ) : activeSheet === ABSTRACT_SHEET_NAME ? (
              <AbstractPreviewTable
                layoutByCategory={layouts}
                salesPivot={result?.netSalesPivot || result?.salesPivot || []}
                purchasesPivot={result?.netPurchasesPivot || result?.purchasesPivot || []}
                openingPivot={result?.openingPivot || []}
                mrPivots={result?.mrPivots || result?.transferPivots?.mrPivots || {}}
                dcPivots={result?.dcPivots || result?.transferPivots?.dcPivots || {}}
              />
            ) : (
              <ClosingStockPreviewTable
                category={activeSheet}
                layoutRows={layouts[activeSheet] || []}
                products={result?.productsByCategory?.[activeSheet] || []}
                financialYear={financialYear || CLOSING_STOCK_AUDIT_CONFIG.defaultFinancialYear}
                companyName={companyName}
                address={address}
                headerLabels={JUBILEE_HILLS_HEADER_LABELS}
              />
            )}
          </CardBody>
        </Card>
      ) : (
        <EmptyState
          icon={Gem}
          title="Sheet structure not shown yet"
          description="Upload a Jubilee Hills folder with the six required files, then Show sheets."
        />
      )}
    </div>
  );
}
