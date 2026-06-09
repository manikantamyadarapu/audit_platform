/**
 * Dedupe key for sales invalid rows.
 * Never use voucher alone — multiple lines per voucher are valid accounting.
 *
 * @param {Record<string, unknown>} record
 * @returns {string}
 */
export function salesRecordDedupeKey(record) {
  const rowNumber = Number(record.rowNumber ?? record.sourceExcelRowNumber ?? 0);
  if (rowNumber > 0) {
    return `row:${rowNumber}`;
  }
  const voucher = String(record.voucherNo ?? record.voucherNorm ?? '')
    .trim()
    .toUpperCase();
  const product = String(record.validationProduct ?? record.product ?? '')
    .trim()
    .toUpperCase();
  const amount = String(record.unitRate ?? record.uploadedUnitRate ?? '');
  const weight = String(record.parsedQuantity ?? record.quantity ?? '');
  return `biz:${voucher}|${product}|${amount}|${weight}`;
}

/**
 * One UI/export record per Excel row (or composite line). Merges issue codes only for the same key.
 * @param {Record<string, unknown>[] | undefined} records
 * @returns {Record<string, unknown>[]}
 */
export function dedupeSalesRecordsByRowNumber(records) {
  const list = Array.isArray(records) ? records : [];
  const byKey = new Map();

  for (const record of list) {
    const key = salesRecordDedupeKey(record);
    if (key === 'biz:|||') continue;

    const rowNumber = Number(record.rowNumber ?? record.sourceExcelRowNumber ?? 0);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, {
        ...record,
        ...(rowNumber > 0
          ? { rowNumber, rowId: rowNumber, sourceExcelRowNumber: rowNumber }
          : {}),
        issues: Array.isArray(record.issues) ? [...record.issues] : [],
        messages: Array.isArray(record.messages) ? [...record.messages] : [],
      });
      continue;
    }

    const issueSet = new Set([
      ...(Array.isArray(existing.issues) ? existing.issues : []),
      ...(Array.isArray(record.issues) ? record.issues : []),
    ]);
    const messageSet = new Set([
      ...(Array.isArray(existing.messages) ? existing.messages : []),
      ...(Array.isArray(record.messages) ? record.messages : []),
    ]);
    existing.issues = [...issueSet];
    existing.messages = [...messageSet];
    if (record.auditStatus && !existing.auditStatus) {
      existing.auditStatus = record.auditStatus;
    }
  }

  return [...byKey.values()].sort((a, b) => Number(a.rowNumber ?? 0) - Number(b.rowNumber ?? 0));
}
