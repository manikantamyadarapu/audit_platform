import assert from 'node:assert/strict';
import test from 'node:test';

const memory = new Map();
const sessionMemory = new Map();
globalThis.localStorage = {
  getItem: (key) => (memory.has(key) ? memory.get(key) : null),
  setItem: (key, value) => memory.set(key, String(value)),
  removeItem: (key) => memory.delete(key),
};
globalThis.sessionStorage = {
  getItem: (key) => (sessionMemory.has(key) ? sessionMemory.get(key) : null),
  setItem: (key, value) => sessionMemory.set(key, String(value)),
  removeItem: (key) => sessionMemory.delete(key),
};

function setUser(id) {
  memory.set('user', JSON.stringify({ id }));
}

setUser(7);

const {
  beginFinancialsMappingSession,
  ensureFinancialsMappingSession,
  setActiveMappingSessionId,
  readActiveMappingSessionId,
} = await import('./financialsMappingSession.js');
const {
  applyManualOpeningMapping,
  saveOpeningStockMapping,
  reapplyOpeningStockMappings,
  restoreFinancialsMappings,
} = await import('./financialsOpeningMappings.js');
const { saveReceiptRateMapping, readReceiptRateMappings } = await import('./receiptRateMappings.js');
const { saveBranchAverageRates } = await import('./sourceAverageRates.js');

function pendingResult(products) {
  return {
    openingPivot: products.map((row) => ({ product: row.product, status: 'manual_mapping_required' })),
    validatedOpening: products.map((row) => ({ product: row.product, openingQty: row.openingQty })),
    openingStockReport: {
      manualMappingRequired: products,
      manualMappingRequiredCount: products.length,
      fallbackMatched: [],
      exactMatchedCount: 0,
    },
  };
}

test('mapping one opening product removes only that product from pending', () => {
  memory.clear();
  setUser(7);
  beginFinancialsMappingSession('basheerbagh');
  const start = pendingResult([
    { product: 'Ring', category: 'Diamond', openingQty: 2, candidateProducts: [{ product: 'Old Ring', closingStockAmount: 10 }] },
    { product: 'Chain', category: 'Diamond', openingQty: 1, candidateProducts: [{ product: 'Old Chain', closingStockAmount: 4 }] },
  ]);
  const next = applyManualOpeningMapping(start, {
    product: 'Ring',
    openingQty: 2,
    openingAmt: 10,
    previousYearProducts: ['Old Ring'],
  });
  saveOpeningStockMapping('basheerbagh', {
    product: 'Ring',
    category: 'Diamond',
    previousYearProducts: ['Old Ring'],
  });
  assert.deepEqual(
    next.openingStockReport.manualMappingRequired.map((row) => row.product),
    ['Chain']
  );
  assert.equal(next.openingStockReport.manualMappingRequiredCount, 1);
});

test('rerunning the same audit reapplies its opening mapping and does not list it as pending', () => {
  const fresh = pendingResult([
    { product: 'Ring', category: 'Diamond', openingQty: 2, candidateProducts: [{ product: 'Old Ring', closingStockAmount: 10 }] },
    { product: 'Chain', category: 'Diamond', openingQty: 1, candidateProducts: [{ product: 'Old Chain', closingStockAmount: 4 }] },
  ]);
  const rerun = reapplyOpeningStockMappings(fresh, 'basheerbagh');
  assert.deepEqual(
    rerun.openingStockReport.manualMappingRequired.map((row) => row.product),
    ['Chain']
  );
  const again = reapplyOpeningStockMappings(rerun, 'basheerbagh');
  assert.equal(again.openingStockReport.fallbackMatched.filter((row) => row.product === 'Ring').length, 1);
});

test('switching branches and returning restores each branch session', () => {
  const basheerbaghId = readActiveMappingSessionId('basheerbagh');
  beginFinancialsMappingSession('kokapet');
  saveOpeningStockMapping('kokapet', {
    product: 'Chain',
    category: 'Emerald',
    previousYearProducts: ['Old Chain'],
  });
  setActiveMappingSessionId('basheerbagh', basheerbaghId);
  const back = reapplyOpeningStockMappings(
    pendingResult([
      { product: 'Ring', category: 'Diamond', openingQty: 2, candidateProducts: [{ product: 'Old Ring', closingStockAmount: 10 }] },
      { product: 'Chain', category: 'Emerald', openingQty: 1, candidateProducts: [{ product: 'Old Chain', closingStockAmount: 4 }] },
    ]),
    'basheerbagh'
  );
  assert.deepEqual(
    back.openingStockReport.manualMappingRequired.map((row) => row.product),
    ['Chain']
  );
  const kokapet = reapplyOpeningStockMappings(
    pendingResult([
      { product: 'Ring', category: 'Diamond', openingQty: 2, candidateProducts: [{ product: 'Old Ring', closingStockAmount: 10 }] },
      { product: 'Chain', category: 'Emerald', openingQty: 1, candidateProducts: [{ product: 'Old Chain', closingStockAmount: 4 }] },
    ]),
    'kokapet'
  );
  assert.deepEqual(
    kokapet.openingStockReport.manualMappingRequired.map((row) => row.product),
    ['Ring']
  );
});

test('a new audit session does not reuse the previous session, and returning restores it', () => {
  const first = readActiveMappingSessionId('basheerbagh');
  const second = beginFinancialsMappingSession('basheerbagh');
  assert.notEqual(first, second);
  const fresh = pendingResult([
    { product: 'Ring', category: 'Diamond', openingQty: 2, candidateProducts: [{ product: 'Old Ring', closingStockAmount: 10 }] },
  ]);
  assert.equal(reapplyOpeningStockMappings(fresh, 'basheerbagh'), fresh);
  setActiveMappingSessionId('basheerbagh', first);
  assert.equal(readActiveMappingSessionId('basheerbagh'), first);
  const restored = reapplyOpeningStockMappings(fresh, 'basheerbagh');
  assert.equal(restored.openingStockReport.manualMappingRequired.length, 0);
});

test('refresh keeps the same session id and its mappings', () => {
  const id = readActiveMappingSessionId('basheerbagh');
  const again = ensureFinancialsMappingSession('basheerbagh', { preferredId: id });
  assert.equal(again, id);
  const restored = reapplyOpeningStockMappings(
    pendingResult([
      { product: 'Ring', category: 'Diamond', openingQty: 2, candidateProducts: [{ product: 'Old Ring', closingStockAmount: 10 }] },
    ]),
    'basheerbagh'
  );
  assert.equal(restored.openingStockReport.manualMappingRequiredCount, 0);
});

test('an invalid saved opening mapping stays pending', () => {
  saveOpeningStockMapping('basheerbagh', {
    product: 'Bangle',
    previousYearProducts: ['Missing Old Bangle'],
  });
  const fresh = pendingResult([
    {
      product: 'Bangle',
      category: 'Diamond',
      openingQty: 1,
      candidateProducts: [{ product: 'Other Bangle', closingStockAmount: 5 }],
    },
  ]);
  const next = reapplyOpeningStockMappings(fresh, 'basheerbagh');
  assert.deepEqual(
    next.openingStockReport.manualMappingRequired.map((row) => row.product),
    ['Bangle']
  );
});

test('opening and average-rate mappings stay isolated, and a stale rate is not sent', () => {
  beginFinancialsMappingSession('jubilee-hills');
  saveOpeningStockMapping('jubilee-hills', {
    product: 'Pearl',
    previousYearProducts: ['Old Pearl'],
  });
  saveReceiptRateMapping('jubileeHills', {
    product: 'Pearl',
    category: 'Pearls',
    sourceBranch: 'basheerbagh',
    sourceProduct: 'Pearl',
    averageRateAmt: 12,
  });
  saveReceiptRateMapping('jubileeHills', {
    product: 'Gone',
    category: 'Pearls',
    sourceBranch: 'basheerbagh',
    sourceProduct: 'Gone',
    averageRateAmt: 9,
  });
  saveBranchAverageRates('basheerbagh', [{ product: 'Pearl', category: 'Pearls', averageRateAmt: 12 }]);
  const rates = readReceiptRateMappings('jubilee-hills');
  assert.deepEqual(rates.map((row) => row.product), ['Pearl']);
  const restored = restoreFinancialsMappings(
    {
      receiptAmountReview: [
        { product: 'Pearl', sourceBranch: 'basheerbagh', category: 'Pearls' },
        { product: 'Gone', sourceBranch: 'basheerbagh', category: 'Pearls' },
      ],
    },
    'jubilee-hills'
  );
  assert.deepEqual(
    restored.receiptAmountReview.map((row) => row.product),
    ['Gone']
  );
  assert.equal(reapplyOpeningStockMappings(
    pendingResult([
      { product: 'Pearl', category: 'Pearls', openingQty: 1, candidateProducts: [{ product: 'Old Pearl', closingStockAmount: 3 }] },
    ]),
    'basheerbagh'
  ).openingStockReport.manualMappingRequiredCount, 1);
});

test('another user does not see this user mappings', () => {
  const id = readActiveMappingSessionId('basheerbagh');
  setUser(99);
  assert.equal(readActiveMappingSessionId('basheerbagh'), null);
  assert.equal(
    reapplyOpeningStockMappings(
      pendingResult([
        { product: 'Ring', category: 'Diamond', openingQty: 2, candidateProducts: [{ product: 'Old Ring', closingStockAmount: 10 }] },
      ]),
      'basheerbagh'
    ).openingStockReport.manualMappingRequiredCount,
    1
  );
  setUser(7);
  setActiveMappingSessionId('basheerbagh', id);
});
