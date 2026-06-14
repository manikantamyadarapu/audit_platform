/** Issue codes: python sales_audit_processor.py */

export const SALES_FILTER_LABELS = {
  total: 'All rows',
  errors: 'Error rows',
  accountVsProduct: 'Account vs product',
  mixedLedgers: 'Range deviations',
  accessoriesUnitRate: 'Accessories Unit Rate Check',
  caratGemErrors: 'Unit of measurement deviations',
  compliance: 'Compliance (no issues)',
};

const ACCOUNT_VS_PRODUCT_ISSUES = new Set([
  'INVALID_PRODUCT_MAPPING',
  'INVALID_LEDGER_MAPPING',
  'MISSING_PRODUCT_CATEGORY_FOR_VALIDATION',
  'PRODUCT_CATEGORY_DOES_NOT_MATCH_SALES_ACCOUNT',
]);

const RATE_DEVIATION_ISSUES = new Set([
  'INVALID_RATE_DEVIATION',
  'INVALID_PRODUCT_PATTERN',
  'MISSING_UNIT_RATE',
  'MISSING_RATE_RULE',
  'RATE_DEVIATION_VIOLATION',
]);

const ACCESSORIES_UNIT_RATE_ISSUES = new Set(['INVALID_UNIT_RATE_RANGE', 'INVALID_FREE_QUANTITY']);

const CARAT_GEM_ISSUES = new Set(['INVALID_UOM']);

const HIGHER_RETURN_RATE_ISSUES = new Set([
  'HIGHER_SALES_RETURN_RATE',
  'PRODUCT_NOT_FOUND_IN_SALES',
]);

const FILTER_ISSUE_SETS = {
  accountVsProduct: ACCOUNT_VS_PRODUCT_ISSUES,
  mixedLedgers: RATE_DEVIATION_ISSUES,
  accessoriesUnitRate: ACCESSORIES_UNIT_RATE_ISSUES,
  caratGemErrors: CARAT_GEM_ISSUES,
  higherReturnRate: HIGHER_RETURN_RATE_ISSUES,
};

/** KPI filters that show row-level exception data (upload columns + Message). */
export const SALES_RETURN_VALIDATION_FILTERS = new Set([
  'errors',
  'accountVsProduct',
  'mixedLedgers',
  'accessoriesUnitRate',
  'caratGemErrors',
]);

export function isSalesReturnValidationFilter(filter) {
  return filter != null && SALES_RETURN_VALIDATION_FILTERS.has(filter);
}

/**
 * @param {Record<string, unknown>} record
 * @returns {string[]}
 */
export function recordIssueCodes(record) {
  if (Array.isArray(record?.issues) && record.issues.length) {
    return record.issues.map((code) => String(code).trim()).filter(Boolean);
  }
  const message = record?.Message;
  if (message == null || message === '') return [];
  return String(message)
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

/**
 * @param {Record<string, unknown>[] | undefined} records
 * @param {keyof typeof SALES_FILTER_LABELS | null | 'total'} filter
 * @returns {Record<string, unknown>[]}
 */
export function productNameKey(name) {
  return String(name ?? '').trim().toUpperCase();
}

/**
 * Merge row-level validation issue codes onto product-wise comparison rows.
 * @param {Record<string, unknown>[] | undefined} productRecords
 * @param {Record<string, unknown>[] | undefined} exceptionRecords
 */
export function enrichProductComparisonRecords(productRecords, exceptionRecords) {
  const byProduct = new Map();
  for (const row of exceptionRecords ?? []) {
    const key = productNameKey(row.Product ?? row.product);
    if (!key) continue;
    const codes = recordIssueCodes(row);
    if (!codes.length) continue;
    if (!byProduct.has(key)) byProduct.set(key, new Set());
    codes.forEach((code) => byProduct.get(key).add(code));
  }

  return (productRecords ?? []).map((row) => {
    const key = productNameKey(row.product);
    const validationCodes = [...(byProduct.get(key) ?? [])];
    const rateCodes = Array.isArray(row.issues)
      ? row.issues.map((code) => String(code).trim()).filter(Boolean)
      : [];
    const merged = [];
    for (const code of [...rateCodes, ...validationCodes]) {
      if (code && !merged.includes(code)) merged.push(code);
    }
    const rateMessages = Array.isArray(row.messages)
      ? row.messages.map((m) => String(m).trim()).filter(Boolean)
      : [];
    const validationPart = validationCodes.join(', ');
    const ratePart = rateMessages.join('; ');
    const messageParts = [ratePart, validationPart].filter(Boolean);
    const Message = messageParts.length ? messageParts.join('; ') : merged.join(', ');
    return { ...row, issues: merged, Message };
  });
}

function relevantIssueCodes(record, filter) {
  const codes = recordIssueCodes(record);
  if (!filter || filter === 'total' || filter === 'compliance') return codes;
  if (filter === 'errors') return codes;
  const allowed = FILTER_ISSUE_SETS[filter];
  if (!allowed) return codes;
  return codes.filter((code) => allowed.has(code));
}

function messageTextForIssueCodes(record, codes) {
  if (!codes.length) return '';
  const issues = Array.isArray(record?.issues) ? record.issues.map((code) => String(code)) : [];
  const messages = Array.isArray(record?.messages)
    ? record.messages.map((message) => String(message))
    : [];
  return codes
    .map((code) => {
      const index = issues.indexOf(code);
      if (index >= 0 && messages[index]?.trim()) return messages[index].trim();
      return code;
    })
    .join('; ');
}

/** Message text for the active widget filter only (not unrelated issues). */
export function messageForActiveFilter(record, filter) {
  if (filter === 'compliance') return '';
  return messageTextForIssueCodes(record, relevantIssueCodes(record, filter));
}

export function applyFilterDisplayMessage(records, filter) {
  if (!filter || filter === 'total') return records;
  return records.map((row) => ({
    ...row,
    Message: messageForActiveFilter(row, filter),
  }));
}

export function filterSalesRecordsForDisplay(records, filter) {
  return applyFilterDisplayMessage(filterSalesRecords(records, filter), filter);
}

export function filterSalesRecords(records, filter) {
  const list = Array.isArray(records) ? records : [];
  if (filter == null || filter === 'total') {
    return list;
  }
  if (filter === 'errors' || filter === 'exceptions') {
    return list.filter((r) => recordIssueCodes(r).length > 0);
  }
  if (filter === 'accountVsProduct') {
    return list.filter((r) => recordIssueCodes(r).some((code) => ACCOUNT_VS_PRODUCT_ISSUES.has(code)));
  }
  if (filter === 'mixedLedgers') {
    return list.filter((r) => recordIssueCodes(r).some((code) => RATE_DEVIATION_ISSUES.has(code)));
  }
  if (filter === 'accessoriesUnitRate') {
    return list.filter((r) =>
      recordIssueCodes(r).some((code) => ACCESSORIES_UNIT_RATE_ISSUES.has(code))
    );
  }
  if (filter === 'caratGemErrors') {
    return list.filter((r) => recordIssueCodes(r).some((code) => CARAT_GEM_ISSUES.has(code)));
  }
  if (filter === 'compliance') {
    return list.filter((r) => recordIssueCodes(r).length === 0);
  }
  if (filter === 'validationErrors') {
    return list.filter((r) => {
      const codes = recordIssueCodes(r);
      return codes.length > 0 && codes.some((code) => !HIGHER_RETURN_RATE_ISSUES.has(code));
    });
  }
  if (filter === 'higherReturnRate') {
    return list.filter((r) =>
      recordIssueCodes(r).some((code) => HIGHER_RETURN_RATE_ISSUES.has(code))
    );
  }
  return list;
}
