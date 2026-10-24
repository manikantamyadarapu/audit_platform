import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
memory.set('user', JSON.stringify({ id: 7 }));

const { attachOpeningStockReport, slimOpeningStockReport } = await import(
  './openingStockReportPersistence.js'
);
const { restoreFinancialsMappings, saveOpeningStockMapping } = await import(
  './financialsOpeningMappings.js'
);
const { beginFinancialsMappingSession, setActiveMappingSessionId, readActiveMappingSessionId } =
  await import('./financialsMappingSession.js');

function summaryOnlyResult(products) {
  return {
    auditRunId: 11,
    summary: {
      openingStockReport: {
        manualMappingRequired: products,
        manualMappingRequiredCount: products.length,
        fallbackMatched: [],
      },
    },
    openingPivot: products.map((row) => ({
      product: row.product,
      status: 'manual_mapping_required',
      sumOfQuantity: row.openingQty,
    })),
  };
}

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

test('session slim keeps unresolved opening rows and their candidates', () => {
  const slim = slimOpeningStockReport({
    manualMappingRequired: [ring, chain],
    manualMappingRequiredCount: 2,
    fallbackMatched: [],
  });
  assert.deepEqual(
    slim.manualMappingRequired.map((row) => row.product),
    ['Ring', 'Chain']
  );
  assert.equal(slim.manualMappingRequired[0].candidateProducts[0].product, 'Old Ring');
  assert.equal(slim.manualMappingRequiredCount, 2);
});

test('returning to a branch restores unresolved products and keeps a completed mapping resolved', () => {
  memory.clear();
  memory.set('user', JSON.stringify({ id: 7 }));
  const basheerbagh = beginFinancialsMappingSession('basheerbagh');
  saveOpeningStockMapping('basheerbagh', {
    product: 'Ring',
    category: 'Diamond',
    previousYearProducts: ['Old Ring'],
  });
  const returned = restoreFinancialsMappings(summaryOnlyResult([ring, chain]), 'basheerbagh');
  assert.deepEqual(
    returned.openingStockReport.manualMappingRequired.map((row) => row.product),
    ['Chain']
  );
  assert.equal(returned.openingStockReport.fallbackMatched[0].product, 'Ring');

  const kokapet = beginFinancialsMappingSession('kokapet');
  const kokapetResult = restoreFinancialsMappings(
    summaryOnlyResult([
      {
        product: 'Pearl',
        category: 'Pearls',
        openingQty: 3,
        candidateProducts: [{ product: 'Old Pearl', closingStockAmount: 8 }],
      },
    ]),
    'kokapet'
  );
  assert.deepEqual(
    kokapetResult.openingStockReport.manualMappingRequired.map((row) => row.product),
    ['Pearl']
  );

  setActiveMappingSessionId('basheerbagh', basheerbagh);
  const back = restoreFinancialsMappings(summaryOnlyResult([ring, chain]), 'basheerbagh');
  assert.deepEqual(
    back.openingStockReport.manualMappingRequired.map((row) => row.product),
    ['Chain']
  );
  assert.notEqual(basheerbagh, kokapet);
});

test('a saved session without the report rebuilds pending rows from the opening pivot', () => {
  const restored = attachOpeningStockReport({
    openingPivot: [
      { product: 'Ring', status: 'manual_mapping_required', sumOfQuantity: 2 },
      { product: 'Chain', status: 'matched', sumOfQuantity: 1 },
    ],
  });
  assert.deepEqual(
    restored.openingStockReport.manualMappingRequired.map((row) => [row.product, row.openingQty]),
    [['Ring', 2]]
  );
});

test('a new audit does not reuse the previous branch session mappings', () => {
  const first = readActiveMappingSessionId('basheerbagh');
  const next = beginFinancialsMappingSession('basheerbagh');
  const fresh = restoreFinancialsMappings(summaryOnlyResult([ring, chain]), 'basheerbagh');
  assert.notEqual(first, next);
  assert.deepEqual(
    fresh.openingStockReport.manualMappingRequired.map((row) => row.product),
    ['Ring', 'Chain']
  );
  setActiveMappingSessionId('basheerbagh', first);
  const rerun = restoreFinancialsMappings(summaryOnlyResult([ring, chain]), 'basheerbagh');
  assert.deepEqual(
    rerun.openingStockReport.manualMappingRequired.map((row) => row.product),
    ['Chain']
  );
});

test('Jubilee opening rows keep candidate products in the session slim', () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const source = readFileSync(path.join(here, 'auditSessionStorage.js'), 'utf8');
  assert.match(source, /function slimOpeningStockReport/);
  assert.match(source, /openingStockReport,/);
  assert.match(source, /candidateProducts: candidates/);
});

test('refresh restores the same pending rows', () => {
  const again = restoreFinancialsMappings(summaryOnlyResult([ring, chain]), 'basheerbagh');
  assert.equal(again.openingStockReport.manualMappingRequiredCount, 1);
  assert.equal(again.openingStockReport.manualMappingRequired[0].product, 'Chain');
});
