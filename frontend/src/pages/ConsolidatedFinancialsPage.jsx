import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Layers } from 'lucide-react';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { AuditValidationOverlay } from '../components/ui/AuditValidationOverlay';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { AbstractPreviewTable } from '../components/tables/AbstractPreviewTable';
import { TShapePreview } from '../components/tables/TShapePreview';
import { downloadConsolidatedFinancialsTemplate } from '../services/financials.service';
import {
  CONSOLIDATED_ABSTRACT_BODY_ROWS,
  CONSOLIDATED_ABSTRACT_MEASURE_COLUMNS,
  CONSOLIDATED_ABSTRACT_SHEET_NAME,
  CONSOLIDATED_ABSTRACT_TITLE,
  CONSOLIDATED_PREVIEW_SHEETS,
  CONSOLIDATED_TSHAPE_SHEET_NAME,
} from '../config/consolidatedAbstractLayout';
import {
  CONSOLIDATED_BRANCH_LABELS,
  loadConsolidatedBranchPayloads,
} from '../utils/consolidatedFinancialsSources';
import { buildConsolidatedAbstractRowMeasures } from '../utils/consolidatedAbstractValues';
import { buildConsolidatedTShapeValues } from '../utils/consolidatedTShapeValues';
import { formatProcessingErrorHuman } from '../utils/processingErrorUtils';
import { auditToastError, auditToastSuccess } from '../utils/auditToast';
import { cn } from '../utils/cn';

export default function ConsolidatedFinancialsPage() {
  const [exporting, setExporting] = useState(false);
  const [loadingSheets, setLoadingSheets] = useState(true);
  const [sheetError, setSheetError] = useState(null);
  const [branches, setBranches] = useState({});
  const [missingBranches, setMissingBranches] = useState([]);
  const [activeSheet, setActiveSheet] = useState(CONSOLIDATED_ABSTRACT_SHEET_NAME);

  const loadSheets = useCallback(async () => {
    setLoadingSheets(true);
    try {
      const { branches: next, missing } = await loadConsolidatedBranchPayloads();
      setBranches(next);
      setMissingBranches(missing);
    } finally {
      setLoadingSheets(false);
    }
  }, []);

  useEffect(() => {
    loadSheets();
  }, [loadSheets]);

  const mappingReady = missingBranches.length === 0 && Object.keys(branches).length === 3;
  const { byLabel } = useMemo(
    () => buildConsolidatedAbstractRowMeasures(mappingReady ? branches : {}),
    [branches, mappingReady]
  );
  const tshapeValues = useMemo(
    () => buildConsolidatedTShapeValues(mappingReady ? branches : {}),
    [branches, mappingReady]
  );
  const missingLabels = missingBranches.map(
    (key) => CONSOLIDATED_BRANCH_LABELS[key] || key
  );

  const downloadWorkbook = useCallback(async () => {
    setExporting(true);
    setSheetError(null);
    try {
      const { branches: latest, missing } = await loadConsolidatedBranchPayloads();
      setBranches(latest);
      setMissingBranches(missing);
      const ready = missing.length === 0;
      await downloadConsolidatedFinancialsTemplate({ branches: ready ? latest : {} });
      if (ready) {
        auditToastSuccess('Consolidated Financials workbook downloaded');
      } else {
        const labels = missing.map((key) => CONSOLIDATED_BRANCH_LABELS[key] || key).join(', ');
        auditToastSuccess(
          `Workbook downloaded without mapped values. Complete Financials for: ${labels}`
        );
      }
    } catch (error) {
      const body = error.details ?? error.message ?? null;
      setSheetError(body);
      auditToastError(error.message || 'Consolidated Financials download failed');
    } finally {
      setExporting(false);
    }
  }, []);

  return (
    <div className="relative space-y-8">
      <AuditValidationOverlay
        open={exporting || loadingSheets}
        label={exporting ? 'Building Consolidated Financials…' : 'Loading Consolidated Financials…'}
      />

      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-slate-50">
            Consolidated Financials
          </h1>
          <Badge tone="amber">Two sheets</Badge>
        </div>
        <p className="mt-1 max-w-3xl text-sm text-slate-600 dark:text-slate-400">
          Abstract and TShape stay blank until Basheerbagh, Kokapet, and Jubilee Hills Financials
          are all complete.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-base font-bold text-emerald-700">Consolidated Financials</h3>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                The workbook has two sheets in this order: Abstract, then TShape.
              </p>
            </div>
            <Button
              variant="primary"
              size="md"
              loading={exporting}
              disabled={exporting}
              onClick={downloadWorkbook}
            >
              <Download className="h-4 w-4" />
              Download workbook
            </Button>
          </div>
          <div
            className="mt-4 flex flex-wrap gap-1 rounded-xl border border-slate-200/80 bg-slate-50/80 p-1 dark:border-slate-700 dark:bg-slate-900/30"
            role="tablist"
            aria-label="Consolidated Financials sheets"
          >
            {CONSOLIDATED_PREVIEW_SHEETS.map((sheet) => {
              const selected = sheet === activeSheet;
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
                </button>
              );
            })}
          </div>
        </CardHeader>
        <CardBody>
          {activeSheet === CONSOLIDATED_TSHAPE_SHEET_NAME ? (
            <TShapePreview
              values={tshapeValues}
              className="max-h-[min(72vh,44rem)] rounded-xl border border-slate-200/80 dark:border-slate-700"
            />
          ) : (
            <AbstractPreviewTable
              title={CONSOLIDATED_ABSTRACT_TITLE}
              bodyRows={CONSOLIDATED_ABSTRACT_BODY_ROWS}
              measureColumns={CONSOLIDATED_ABSTRACT_MEASURE_COLUMNS}
              byLabel={byLabel}
              blankValues={!mappingReady}
              className="max-h-[min(72vh,44rem)] rounded-xl border border-slate-200/80 dark:border-slate-700"
            />
          )}
          <p className="mt-4 flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
            <Layers className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
            {mappingReady
              ? 'All three branch Financials are complete. Abstract and TShape use those saved results.'
              : `Values stay unmapped until all three branch Financials are done${
                  missingLabels.length ? ` (waiting on ${missingLabels.join(', ')})` : ''
                }.`}
          </p>
        </CardBody>
      </Card>

      {sheetError ? (
        <Card className="border-amber-200/80 bg-amber-50/40 shadow-md">
          <CardHeader>
            <h3 className="text-base font-semibold text-amber-950">
              Unable to download Consolidated Financials workbook
            </h3>
          </CardHeader>
          <CardBody>
            <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-xl bg-[var(--color-surface-elevated)] p-4 font-mono text-xs text-[var(--color-text-primary)] shadow-inner">
              {formatProcessingErrorHuman(sheetError)}
            </pre>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
