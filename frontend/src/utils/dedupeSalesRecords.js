/**
 * Ensure one UI/export record per Excel rowNumber (merge issues + messages).
 * @param {Record<string, unknown>[] | undefined} records
 * @returns {Record<string, unknown>[]}
 */
export function dedupeSalesRecordsByRowNumber(records) {
  const list = Array.isArray(records) ? records : [];
  const byRow = new Map();

  for (const record of list) {
    const rowNumber = Number(record.rowNumber ?? record.sourceExcelRowNumber ?? 0);
    if (!rowNumber) continue;

    const existing = byRow.get(rowNumber);
    if (!existing) {
      byRow.set(rowNumber, {
        ...record,
        rowNumber,
        rowId: rowNumber,
        sourceExcelRowNumber: rowNumber,
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

  return [...byRow.values()].sort((a, b) => Number(a.rowNumber) - Number(b.rowNumber));
}
