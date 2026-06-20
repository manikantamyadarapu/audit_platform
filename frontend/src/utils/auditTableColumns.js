/**
 * Resolve display column order: all upload columns + Message last.
 * @param {Record<string, unknown>[]} records
 * @param {string[] | null | undefined} exportColumns
 * @param {Record<string, string> | null | undefined} columnDisplayHeaders
 */
export function resolveAuditColumnOrder(records, exportColumns, columnDisplayHeaders) {
  if (!records?.length) return [];

  const headers = columnDisplayHeaders ?? {};
  const allKeys = new Set();
  for (const row of records) {
    Object.keys(row ?? {}).forEach((key) => allKeys.add(key));
  }

  const messageKey = allKeys.has('Message')
    ? 'Message'
    : allKeys.has('messages')
      ? 'messages'
      : null;

  const hiddenKeys = new Set([
    'issues',
    '_issues',
    'panReport',
    'addressReport',
    '_rowNumber',
    'messages',
    'Message',
  ]);

  const ordered = [];
  const seen = new Set();

  const pushKey = (key) => {
    if (!key || seen.has(key) || hiddenKeys.has(key)) return;
    if (key.startsWith('__original_')) return;
    seen.add(key);
    ordered.push(key);
  };

  const findRecordKey = (col) => {
    if (allKeys.has(col)) return col;
    const internal = Object.entries(headers).find(([, label]) => label === col)?.[0];
    if (internal && allKeys.has(internal)) return internal;
    const fuzzy = [...allKeys].find(
      (k) => columnHeaderLabel(k).toLowerCase() === String(col).toLowerCase()
    );
    return fuzzy ?? null;
  };

  if (exportColumns?.length) {
    for (const col of exportColumns) {
      if (col === 'Message' || col === 'messages') continue;
      const key = findRecordKey(col);
      if (key) pushKey(key);
    }
  }

  const priority = [
    'rowNumber',
    'sNo',
    'date',
    'voucherNo',
    'party',
    'nameOfParty',
    'salesAccount',
    'product',
  ];

  for (const key of priority) {
    if (allKeys.has(key)) pushKey(key);
  }

  for (const key of [...allKeys].sort()) {
    pushKey(key);
  }

  if (messageKey) {
    ordered.push('Message');
  } else if (records.some((row) => Array.isArray(row?.issues) && row.issues.length)) {
    ordered.push('Message');
  }

  return ordered;
}

export function columnHeaderLabel(key) {
  if (key === 'Message') return 'Message';
  if (key === 'messages') return 'Message';
  if (/\s/.test(key)) {
    return key.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  }
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (c) => c.toUpperCase());
}

export function auditCellValue(record, columnKey) {
  if (!record) return '';

  if (columnKey === 'Message') {
    if (record.Message != null && record.Message !== '') return String(record.Message);
    if (Array.isArray(record.messages) && record.messages.length) {
      return record.messages.join('; ');
    }
    return '';
  }

  const value = record[columnKey];
  if (value == null || value === '') return '';
  if (Array.isArray(value)) return value.join('; ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/**
 * @param {string[]} columnOrder
 * @param {Record<string, unknown>[]} records
 */
export function buildExportColumnDefs(columnOrder, records) {
  const order = columnOrder?.length
    ? columnOrder
    : resolveAuditColumnOrder(records);

  return order.map((key) => ({
    header: columnHeaderLabel(key),
    accessor: (row) => auditCellValue(row, key),
  }));
}

/**
 * Map display column key to value for xlsx row export.
 * @param {Record<string, unknown>[]} records
 * @param {string[]} columnOrder
 */
export function recordsToExportRows(records, columnOrder) {
  const order = columnOrder?.length ? columnOrder : resolveAuditColumnOrder(records);
  return records.map((record) => {
    const row = {};
    for (const key of order) {
      row[columnHeaderLabel(key)] = auditCellValue(record, key);
    }
    return row;
  });
}
