import assert from 'node:assert/strict';
import test from 'node:test';

const memory = new Map();
globalThis.localStorage = {
  getItem: (key) => (memory.has(key) ? memory.get(key) : null),
  setItem: (key, value) => memory.set(key, String(value)),
  removeItem: (key) => memory.delete(key),
};
globalThis.sessionStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};
memory.set('user', JSON.stringify({ id: 4 }));

const {
  isSameFinancialsFileSet,
  readActiveMappingSessionId,
  scopeFinancialsMappingsForProcess,
  setActiveMappingSessionId,
  SIX_FILE_NAME_KEYS,
} = await import('./financialsMappingSession.js');
const { restoreFinancialsMappings, saveOpeningStockMapping } = await import(
  './financialsOpeningMappings.js'
);
const { readReceiptRateMappings, saveReceiptRateMapping } = await import('./receiptRateMappings.js');

function pendingResult(products) {
  return {
    openingStockReport: {
      manualMappingRequired: products,
      manualMappingRequiredCount: products.length,
      fallbackMatched: [],
    },
    receiptAmountReview: products.map((row) => ({
      product: row.product,
      sourceBranch: 'basheerbagh',
      category: row.category,
    })),
  };
}

let originalSession = null;

const ring = {
  product: 'Ring',
  category: 'Diamond',
  openingQty: 2,
  candidateProducts: [{ product: 'Old Ring', closingStockAmount: 10 }],
};
const chain = {
  product: 'Chain',
  category: 'Diamond',
  openingQty: 1,
  candidateProducts: [{ product: 'Old Chain', closingStockAmount: 4 }],
};

test('a new file set shows every unresolved product and does not reuse the previous session', () => {
  const first = scopeFinancialsMappingsForProcess('basheerbagh', { rerun: false });
  originalSession = first;
  saveOpeningStockMapping('basheerbagh', {
    product: 'Ring',
    category: 'Diamond',
    previousYearProducts: ['Old Ring'],
  });
  saveReceiptRateMapping('basheerbagh', {
    product: 'Ring',
    category: 'Diamond',
    sourceBranch: 'basheerbagh',
    sourceProduct: 'Ring',
    averageRateAmt: 5,
  });
  const sameFiles = { sales: 'Sales.xlsx', purchases: 'Purchases.xlsx', quantity: 'Qty.xlsx' };
  assert.equal(isSameFinancialsFileSet(sameFiles, sameFiles, SIX_FILE_NAME_KEYS), true);
  assert.equal(
    isSameFinancialsFileSet(
      { ...sameFiles, sales: 'Sales FY26.xlsx' },
      sameFiles,
      SIX_FILE_NAME_KEYS
    ),
    false
  );

  const next = scopeFinancialsMappingsForProcess('basheerbagh', { rerun: false });
  assert.notEqual(next, first);
  const fresh = restoreFinancialsMappings(pendingResult([ring, chain]), 'basheerbagh');
  assert.deepEqual(
    fresh.openingStockReport.manualMappingRequired.map((row) => row.product),
    ['Ring', 'Chain']
  );
  assert.deepEqual(
    fresh.receiptAmountReview.map((row) => row.product),
    ['Ring', 'Chain']
  );
  assert.equal(readReceiptRateMappings('basheerbagh').length, 0);
});

test('rerunning the same file set reuses that session and leaves the other branch alone', () => {
  setActiveMappingSessionId('basheerbagh', originalSession);
  const rerunId = scopeFinancialsMappingsForProcess('basheerbagh', { rerun: true });
  assert.equal(rerunId, originalSession);
  const rerun = restoreFinancialsMappings(pendingResult([ring, chain]), 'basheerbagh');
  assert.deepEqual(
    rerun.openingStockReport.manualMappingRequired.map((row) => row.product),
    ['Chain']
  );
  assert.deepEqual(
    rerun.receiptAmountReview.map((row) => row.product),
    ['Chain']
  );

  const original = readActiveMappingSessionId('basheerbagh');
  const kokapet = scopeFinancialsMappingsForProcess('kokapet', { rerun: false });
  saveOpeningStockMapping('kokapet', {
    product: 'Chain',
    category: 'Emerald',
    previousYearProducts: ['Old Chain'],
  });
  const kokapetResult = restoreFinancialsMappings(pendingResult([ring, chain]), 'kokapet');
  assert.deepEqual(
    kokapetResult.openingStockReport.manualMappingRequired.map((row) => row.product),
    ['Ring']
  );

  setActiveMappingSessionId('basheerbagh', original);
  const back = restoreFinancialsMappings(pendingResult([ring, chain]), 'basheerbagh');
  assert.deepEqual(
    back.openingStockReport.manualMappingRequired.map((row) => row.product),
    ['Chain']
  );
  assert.notEqual(original, kokapet);
});
