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

/** Sales Return file-validation issue codes (excludes rate comparison). */
export const SALES_RETURN_VALIDATION_ISSUES = new Set([
  'INVALID_RATE_DEVIATION',
  'INVALID_LEDGER_MAPPING',
  'INVALID_FREE_QUANTITY',
  'INVALID_UOM',
]);

export const SALES_RETURN_ISSUE_MESSAGES = {
  INVALID_RATE_DEVIATION: 'Unit rate outside allowed range.',
  INVALID_LEDGER_MAPPING: 'Invalid sales return ledger mapping.',
  INVALID_FREE_QUANTITY: 'Free quantity not allowed for this product.',
  INVALID_UOM: 'Invalid UOM for product.',
  HIGHER_SALES_RETURN_RATE: 'Average sales return rate is higher than average sales rate.',
};

const SALES_RETURN_MESSAGE_TO_ISSUE = Object.fromEntries(
  Object.entries(SALES_RETURN_ISSUE_MESSAGES).map(([code, message]) => [message, code])
);

const SALES_RETURN_ACCOUNT_VS_PRODUCT_ISSUES = new Set(['INVALID_LEDGER_MAPPING']);
const SALES_RETURN_RATE_DEVIATION_ISSUES = new Set(['INVALID_RATE_DEVIATION']);
const SALES_RETURN_ACCESSORIES_UNIT_RATE_ISSUES = new Set(['INVALID_FREE_QUANTITY']);
const SALES_RETURN_UOM_ISSUES = new Set(['INVALID_UOM']);

const SALES_RETURN_FILTER_ISSUE_SETS = {
  accountVsProduct: SALES_RETURN_ACCOUNT_VS_PRODUCT_ISSUES,
  mixedLedgers: SALES_RETURN_RATE_DEVIATION_ISSUES,
  accessoriesUnitRate: SALES_RETURN_ACCESSORIES_UNIT_RATE_ISSUES,
  caratGemErrors: SALES_RETURN_UOM_ISSUES,
  higherReturnRate: HIGHER_RETURN_RATE_ISSUES,
};

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
    return normalizeSalesReturnIssueCodes(
      record.issues.map((code) => String(code).trim()).filter(Boolean)
    );
  }
  const message = record?.Message;
  if (message == null || message === '') return [];
  return normalizeSalesReturnIssueCodes(
    String(message)
      .split(/[;,]/)
      .map((part) => part.trim())
      .map((part) => SALES_RETURN_MESSAGE_TO_ISSUE[part] || part)
      .filter(Boolean)
  );
}

/** Map legacy sales-engine codes to sales-return widget codes. */
function normalizeSalesReturnIssueCodes(codes) {
  const mapped = [];
  for (const code of codes) {
    let next = code;
    if (
      code === 'INVALID_PRODUCT_MAPPING' ||
      code === 'MISSING_PRODUCT_CATEGORY_FOR_VALIDATION' ||
      code === 'PRODUCT_CATEGORY_DOES_NOT_MATCH_SALES_ACCOUNT'
    ) {
      next = 'INVALID_LEDGER_MAPPING';
    }
    if (code === 'INVALID_UNIT_RATE_RANGE') {
      next = 'INVALID_FREE_QUANTITY';
    }
    if (next && !mapped.includes(next)) mapped.push(next);
  }
  return mapped;
}

export function enrichSalesReturnExceptionRecords(records) {
  const list = Array.isArray(records) ? records : [];
  return list.map((record) => {
    const codes = recordIssueCodes(record);
    if (!codes.length) return record;
    if (Array.isArray(record?.issues) && record.issues.length) return record;
    return { ...record, issues: codes };
  });
}

export function salesReturnValidationIssueCodes(record) {
  return recordIssueCodes(record).filter((code) => SALES_RETURN_VALIDATION_ISSUES.has(code));
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

function messageTextForIssueCodes(record, codes, messageMap = null) {
  if (!codes.length) return '';
  const issues = Array.isArray(record?.issues) ? record.issues.map((code) => String(code)) : [];
  const messages = Array.isArray(record?.messages)
    ? record.messages.map((message) => String(message))
    : [];
  return codes
    .map((code) => {
      if (messageMap?.[code]) return messageMap[code];
      const index = issues.indexOf(code);
      if (index >= 0 && messages[index]?.trim()) return messages[index].trim();
      return code;
    })
    .join('; ');
}

function salesReturnRelevantIssueCodes(record, filter) {
  const codes = recordIssueCodes(record);
  if (!filter || filter === 'total' || filter === 'compliance') {
    return codes.filter((code) => SALES_RETURN_VALIDATION_ISSUES.has(code));
  }
  if (filter === 'errors') {
    return salesReturnValidationIssueCodes(record);
  }
  const allowed = SALES_RETURN_FILTER_ISSUE_SETS[filter];
  if (!allowed) return codes;
  return codes.filter((code) => allowed.has(code));
}

/** Message text for the active Sales Return widget filter only. */
export function salesReturnMessageForActiveFilter(record, filter) {
  if (filter === 'compliance') return '';
  return messageTextForIssueCodes(
    record,
    salesReturnRelevantIssueCodes(record, filter),
    SALES_RETURN_ISSUE_MESSAGES
  );
}

export function applySalesReturnFilterDisplayMessage(records, filter) {
  if (!filter || filter === 'total') return records;
  return records.map((row) => ({
    ...row,
    Message: salesReturnMessageForActiveFilter(row, filter),
  }));
}

export function filterSalesReturnRecordsForDisplay(records, filter) {
  return applySalesReturnFilterDisplayMessage(filterSalesReturnRecords(records, filter), filter);
}

/** Default widget filter when none selected (Error rows when validation issues exist). */
export function resolveSalesReturnActiveFilter(activeFilter, errorRows = 0) {
  if (activeFilter != null) return activeFilter;
  return errorRows > 0 ? 'errors' : null;
}

/** Rows sent to Excel/CSV/PDF — widget-scoped Message only, no internal issue arrays. */
export function salesReturnRecordsForExport(records) {
  return (Array.isArray(records) ? records : []).map((record) => {
    const { issues, messages, ...rest } = record;
    return rest;
  });
}

export function filterSalesReturnRecords(records, filter) {
  const list = Array.isArray(records) ? records : [];
  if (filter == null || filter === 'total') {
    return list;
  }
  if (filter === 'errors' || filter === 'exceptions') {
    return list.filter((r) => salesReturnValidationIssueCodes(r).length > 0);
  }
  if (filter === 'accountVsProduct') {
    return list.filter((r) =>
      recordIssueCodes(r).some((code) => SALES_RETURN_ACCOUNT_VS_PRODUCT_ISSUES.has(code))
    );
  }
  if (filter === 'mixedLedgers') {
    return list.filter((r) =>
      recordIssueCodes(r).some((code) => SALES_RETURN_RATE_DEVIATION_ISSUES.has(code))
    );
  }
  if (filter === 'accessoriesUnitRate') {
    return list.filter((r) =>
      recordIssueCodes(r).some((code) => SALES_RETURN_ACCESSORIES_UNIT_RATE_ISSUES.has(code))
    );
  }
  if (filter === 'caratGemErrors') {
    return list.filter((r) =>
      recordIssueCodes(r).some((code) => SALES_RETURN_UOM_ISSUES.has(code))
    );
  }
  if (filter === 'compliance') {
    return list.filter((r) => salesReturnValidationIssueCodes(r).length === 0);
  }
  if (filter === 'higherReturnRate') {
    return list.filter((r) =>
      recordIssueCodes(r).some((code) => HIGHER_RETURN_RATE_ISSUES.has(code))
    );
  }
  return list;
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
