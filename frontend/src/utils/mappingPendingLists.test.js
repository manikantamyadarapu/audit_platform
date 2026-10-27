import assert from 'node:assert/strict';
import test from 'node:test';

const memory = new Map();
globalThis.localStorage = {
  getItem: (key) => (memory.has(key) ? memory.get(key) : null),
  setItem: (key, value) => memory.set(key, String(value)),
  removeItem: (key) => memory.delete(key),
};

const { applyManualOpeningMapping, saveOpeningStockMapping, reapplyOpeningStockMappings } =
  await import('./financialsOpeningMappings.js');
const {
  receiptReviewKey,
  withoutResolvedReceiptReviews,
  mergeReceiptReviews,
  preserveManualOpeningRows,
  keepVisiblePendingRows,
  pendingRowId,
  groupPendingRows,
} = await import('./mappingPendingLists.js');

function pendingRow(product, category, candidates) {
  return {
    product,
    category,
    subcategory: 'Gold',
    openingQty: 2,
    candidateProducts: candidates,
  };
}

function resultWith(rows) {
  return {
    openingPivot: rows.map((row) => ({ product: row.product, status: 'manual_mapping_required' })),
    validatedOpening: rows.map((row) => ({
      product: row.product,
      openingQty: row.openingQty,
      openingAmt: null,
    })),
    openingStockReport: {
      manualMappingRequired: rows,
      manualMappingRequiredCount: rows.length,
      fallbackMatched: [],
      exactMatchedCount: 0,
    },
  };
}

test('mapping one opening product updates the pivot and leaves the sibling pending', () => {
  const start = resultWith([
    pendingRow('Ring', 'Diamond', [{ product: 'Old Ring', closingStockAmount: 1500 }]),
    pendingRow('Chain', 'Diamond', [{ product: 'Old Ring', closingStockAmount: 1500 }]),
  ]);
  const next = applyManualOpeningMapping(start, {
    product: 'Ring',
    category: 'Diamond',
    subcategory: 'Gold',
    openingQty: 2,
    openingAmt: 1500,
    previousYearProducts: ['Old Ring'],
  });
  assert.equal(next.openingStockReport.manualMappingRequiredCount, 1);
  assert.deepEqual(
    next.openingStockReport.manualMappingRequired.map((row) => row.product),
    ['Chain']
  );
  assert.equal(next.openingStockReport.manualMappingRequired[0].candidateProducts.length, 0);
  assert.equal(next.openingPivot.find((row) => row.product === 'Ring').status, 'matched_fallback');
  assert.equal(next.openingPivot.find((row) => row.product === 'Ring').sumOfGross, 1500);
});

test('mapping the final opening product removes the category group', () => {
  const start = resultWith([
    pendingRow('Ring', 'Diamond', [{ product: 'Old Ring', closingStockAmount: 800 }]),
  ]);
  const next = applyManualOpeningMapping(start, {
    product: 'Ring',
    category: 'Diamond',
    openingQty: 2,
    openingAmt: 800,
    previousYearProducts: ['Old Ring'],
  });
  assert.equal(next.openingStockReport.manualMappingRequired.length, 0);
  assert.equal(groupPendingRows(next.openingStockReport.manualMappingRequired).length, 0);
});

test('a mapping without an opening amount is not applied', () => {
  const start = resultWith([pendingRow('Ring', 'Diamond', [])]);
  const next = applyManualOpeningMapping(start, { product: 'Ring', openingAmt: null });
  assert.equal(next, start);
  assert.equal(next.openingStockReport.manualMappingRequiredCount, 1);
});

test('saved opening mappings are restored per branch after a fresh process result', () => {
  memory.clear();
  saveOpeningStockMapping('basheerbagh', {
    product: 'Ring',
    category: 'Diamond',
    previousYearProducts: ['Old Ring'],
  });
  saveOpeningStockMapping('kokapet', {
    product: 'Chain',
    category: 'Emerald',
    previousYearProducts: ['Old Chain'],
  });

  const fresh = resultWith([
    pendingRow('Ring', 'Diamond', [{ product: 'Old Ring', closingStockAmount: 900 }]),
    pendingRow('Chain', 'Emerald', [{ product: 'Old Chain', closingStockAmount: 400 }]),
  ]);
  const basheerbagh = reapplyOpeningStockMappings(fresh, 'basheerbagh');
  assert.deepEqual(
    basheerbagh.openingStockReport.manualMappingRequired.map((row) => row.product),
    ['Chain']
  );
  const kokapet = reapplyOpeningStockMappings(fresh, 'kokapet');
  assert.deepEqual(
    kokapet.openingStockReport.manualMappingRequired.map((row) => row.product),
    ['Ring']
  );
});

test('receipt review drops one mapped row and the last row in a category', () => {
  const rows = [
    { product: 'Ring', category: 'Diamond', sourceBranch: 'basheerbagh', column: 'receipts' },
    { product: 'Chain', category: 'Diamond', sourceBranch: 'basheerbagh', column: 'receipts' },
    { product: 'Pearl', category: 'Pearls', sourceBranch: 'kokapet', column: 'receipts' },
  ];
  const one = withoutResolvedReceiptReviews(rows, [rows[0]]);
  assert.equal(one.length, 2);
  assert.equal(groupPendingRows(one.filter((row) => row.category === 'Diamond')).length, 1);
  const done = withoutResolvedReceiptReviews(one, [rows[1]]);
  assert.equal(groupPendingRows(done.filter((row) => row.category === 'Diamond')).length, 0);
  assert.equal(receiptReviewKey(rows[2]), receiptReviewKey({ ...rows[2] }));
});

test('hiding one mapped row still shows the other product after the parent list is cleared', () => {
  const rows = [
    { product: 'Ring', category: 'Diamond', subcategory: 'Gold', openingQty: 2 },
    { product: 'Chain', category: 'Diamond', subcategory: 'Gold', openingQty: 4 },
  ];
  const hidden = new Set([pendingRowId(rows[0])]);
  const visible = keepVisiblePendingRows(rows, [], hidden);
  assert.deepEqual(visible.map((row) => row.product), ['Chain']);
});

test('mapping one receipt row keeps the other product when the refresh list is empty', () => {
  const rows = [
    { product: 'Ring', category: 'Diamond', subcategory: 'Gold', sourceBranch: 'kokapet', column: 'Receipts' },
    { product: 'Chain', category: 'Diamond', subcategory: 'Gold', sourceBranch: 'kokapet', column: 'Receipts' },
  ];
  const merged = mergeReceiptReviews(rows, [], [rows[0]]);
  assert.deepEqual(merged.map((row) => row.product), ['Chain']);
});

test('mapping one opening product keeps the sibling when the next report drops the pending list', () => {
  const previous = {
    manualMappingRequired: [
      { product: 'Ring', category: 'Diamond' },
      { product: 'Chain', category: 'Diamond' },
    ],
  };
  const next = preserveManualOpeningRows(previous, {
    manualMappingRequired: [],
    fallbackMatched: [{ product: 'Ring' }],
  });
  assert.deepEqual(next.manualMappingRequired.map((row) => row.product), ['Chain']);
});

test('abstract closing balances become the opening amount and leave the pending match list', () => {
  memory.clear();
  const start = {
    ...resultWith([
      pendingRow('Gold Platinum', 'Diamond', [
        { product: 'Platinum Account', source: 'abstract', closingStockAmount: 618634, closingStockQty: 164.645 },
        { product: 'Gold Account 18K', source: 'abstract', closingStockAmount: 200, closingStockQty: 100 },
      ]),
      pendingRow('Chain', 'Diamond', [
        { product: 'Old Chain', closingStockAmount: 50, closingStockQty: 2 },
      ]),
    ]),
    openingAmountMatch: {
      manualMappingRequiredRows: [
        { product: 'Gold Platinum', category: 'Diamond' },
        { product: 'Chain', category: 'Diamond' },
      ],
      unresolvedProducts: [
        { product: 'Gold Platinum' },
        { product: 'Chain' },
      ],
    },
  };
  saveOpeningStockMapping('jubilee-hills', {
    product: 'Gold Platinum',
    previousYearProducts: ['Platinum Account', 'Gold Account 18K'],
  });
  const next = reapplyOpeningStockMappings(start, 'jubilee-hills');
  assert.equal(next.openingPivot.find((row) => row.product === 'Gold Platinum').sumOfGross, 618834);
  assert.deepEqual(
    next.openingStockReport.manualMappingRequired.map((row) => row.product),
    ['Chain']
  );
  assert.deepEqual(
    next.openingAmountMatch.manualMappingRequiredRows.map((row) => row.product),
    ['Chain']
  );
  const basheerbagh = reapplyOpeningStockMappings(start, 'basheerbagh');
  assert.deepEqual(
    basheerbagh.openingStockReport.manualMappingRequired.map((row) => row.product),
    ['Gold Platinum', 'Chain']
  );
  assert.equal(basheerbagh.openingAmountMatch, start.openingAmountMatch);
});

test('a failed receipt mapping keeps the original review row', () => {
  const rows = [{ product: 'Ring', category: 'Diamond', sourceBranch: 'basheerbagh', column: 'qty' }];
  const snapshot = rows;
  let current = withoutResolvedReceiptReviews(snapshot, [rows[0]]);
  assert.equal(current.length, 0);
  current = snapshot;
  assert.equal(current.length, 1);
  assert.equal(current[0].product, 'Ring');
});
