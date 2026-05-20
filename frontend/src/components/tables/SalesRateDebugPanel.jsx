function DebugRow({ label, value }) {
  return (
    <>
      <dt className="font-medium text-slate-500">{label}</dt>
      <dd className="break-all font-mono text-slate-800">{value ?? '—'}</dd>
    </>
  );
}

function formatNum(value) {
  if (value === null || value === undefined || value === '') return '—';
  const n = Number(value);
  return Number.isFinite(n) ? String(n) : String(value);
}

export function SalesRateDebugPanel({ record }) {
  const hasRateDebug =
    record?.rateValidationSource ||
    record?.uploadedUnitRate != null ||
    record?.masterStandardRate != null;

  if (!hasRateDebug) return null;

  let rawJson = null;
  if (record.rawExcelRowJson) {
    try {
      rawJson = JSON.stringify(JSON.parse(record.rawExcelRowJson), null, 2);
    } catch {
      rawJson = String(record.rawExcelRowJson);
    }
  }

  return (
    <div className="mt-3 space-y-3 rounded-xl border border-slate-200/80 bg-slate-50/90 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        Rate debug (master-driven)
      </p>
      <dl className="grid gap-2 sm:grid-cols-2">
        <DebugRow label="Excel row" value={record.sourceExcelRowNumber ?? record.rowNumber} />
        <DebugRow label="Excel product (raw)" value={record.originalExcelProduct} />
        <DebugRow label="Excel sales account (raw)" value={record.originalExcelSalesAccount} />
        <DebugRow label="Excel unit rate (raw)" value={record.originalExcelUnitRate} />
        <DebugRow label="Validation product" value={record.validationProduct ?? record.product} />
        <DebugRow label="Validation sales account" value={record.validationSalesAccount ?? record.salesAccount} />
        <DebugRow label="Validation source" value={record.rateValidationSource} />
        <DebugRow label="Uploaded unit rate" value={formatNum(record.uploadedUnitRate ?? record.unitRate)} />
        <DebugRow label="Master standard rate" value={formatNum(record.masterStandardRate ?? record.standardRate)} />
        <DebugRow label="Current market rate" value={formatNum(record.currentMarketRate)} />
        <DebugRow label="Validation status" value={record.validationStatus} />
        <DebugRow label="Min allowed (70%)" value={formatNum(record.minAllowedRate)} />
        <DebugRow label="Max allowed (130%)" value={formatNum(record.maxAllowedRate)} />
        <DebugRow
          label="Deviation %"
          value={
            record.deviationPercent != null ? `${record.deviationPercent}%` : '—'
          }
        />
        <DebugRow label="Rate difference" value={formatNum(record.rateDifference)} />
        <DebugRow label="Quantity (parsed)" value={formatNum(record.parsedQuantity ?? record.quantity)} />
        <DebugRow label="Unit rate (raw cell)" value={record.rawUnitRate} />
      </dl>
      {rawJson ? (
        <details className="text-xs">
          <summary className="cursor-pointer font-medium text-slate-600">Raw Excel row (JSON)</summary>
          <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-white p-2 font-mono text-[10px] text-slate-700 shadow-inner">
            {rawJson}
          </pre>
        </details>
      ) : null}
    </div>
  );
}
