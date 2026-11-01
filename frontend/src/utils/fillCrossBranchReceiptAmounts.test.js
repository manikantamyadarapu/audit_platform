import assert from 'node:assert/strict';
import test from 'node:test';

const memory = new Map();
globalThis.localStorage = {
  getItem: (key) => (memory.has(key) ? memory.get(key) : null),
  setItem: (key, value) => memory.set(key, String(value)),
  removeItem: (key) => memory.delete(key),
};
globalThis.sessionStorage = {
  getItem: (key) => (memory.has(`s:${key}`) ? memory.get(`s:${key}`) : null),
  setItem: (key, value) => memory.set(`s:${key}`, String(value)),
  removeItem: (key) => memory.delete(`s:${key}`),
};

const {
  applyReadyReceiptRates,
  buildCrossBranchExportFields,
  maybeFillCrossBranchReceiptAmounts,
  readyAverageRates,
  receiptRateBranchKey,
} = await import('./fillCrossBranchReceiptAmounts.js');
const { openingMappingPendingCount } = await import('./mappingPendingLists.js');

function branchResult({ pending = 0, product = 'Di. RA 10', rate = 10 } = {}) {
  const manual = Array.from({ length: pending }, (_, index) => ({
    product: `Pending ${index + 1}`,
    openingQty: 1,
    candidateProducts: [],
  }));
  return {
    salesPivot: [{ product, sumOfQuantity: 1, sumOfGross: 100 }],
    purchasesPivot: [],
    openingPivot: [{ product, sumOfQuantity: 2, sumOfGross: 20 }],
    layoutByCategory: {
      Diamond: [{ kind: 'product', label: product, receiptsKokapetQty: 1 }],
    },
    productAverageRates: [{ product, averageRateAmt: rate }],
    openingStockReport: {
      manualMappingRequired: manual,
      manualMappingRequiredCount: manual.length,
    },
  };
}

test('export fields include this branch layout and other branch issue layouts', async () => {
  const dest = branchResult({ pending: 0, rate: 5 });
  dest.layoutByCategory.Diamond[0].receiptsJubileeHillsQty = 2;
  const fields = await buildCrossBranchExportFields('basheerbagh', dest, {
    loadBranchResult: async (sessionKey) => {
      if (sessionKey.includes('jubilee')) {
        const source = branchResult({ pending: 0, rate: 9 });
        source.layoutByCategory = {
          Diamond: [{ kind: 'product', label: 'Di. RA 10', issuesBanjaraHillsQty: 4 }],
        };
        return source;
      }
      return null;
    },
  });
  assert.equal(fields.layoutByCategory.Diamond[0].receiptsJubileeHillsQty, 2);
  assert.equal(
    fields.sourceIssueLayouts.jubileeHills.Diamond[0].issuesBanjaraHillsQty,
    4
  );
  assert.equal(fields.sourceOpeningComplete.jubileeHills, true);
});

test('receiptRateBranchKey maps jubilee aliases', () => {
  assert.equal(receiptRateBranchKey('jubilee-hills'), 'jubileeHills');
  assert.equal(receiptRateBranchKey('kokapet'), 'kokapet');
  assert.equal(receiptRateBranchKey('basheerbagh'), 'basheerbagh');
});

test('opening pending count uses the remaining manual list', () => {
  assert.equal(openingMappingPendingCount(branchResult({ pending: 2 })), 2);
  assert.equal(openingMappingPendingCount(branchResult({ pending: 0 })), 0);
});

test('ready rates skip products that still need opening mapping', () => {
  const result = branchResult({ pending: 1, product: 'Pending 1', rate: 8 });
  result.productAverageRates = [
    { product: 'Pending 1', averageRateAmt: 8 },
    { product: 'Di. RA 10', averageRateAmt: 5 },
  ];
  assert.deepEqual(
    readyAverageRates(result).map((row) => row.product),
    ['Di. RA 10']
  );
});

test('fills destinations as soon as the source branch is processed, even if other products still need mapping', async () => {
  const sourceRates = [];
  const filled = await maybeFillCrossBranchReceiptAmounts(
    'jubileeHills',
    branchResult({ pending: 1, rate: 9 }),
    {
      loadBranchResult: async (sessionKey) => {
        if (sessionKey.includes('sales-purchases')) {
          return branchResult({ pending: 0, rate: 5 });
        }
        return null;
      },
      persistBranchResult: async () => {},
      fillReceiptAmountsFromLayout: async (payload) => {
        sourceRates.push(payload.sourceAverageRates?.jubileeHills || []);
        return {
          layoutByCategory: {
            Diamond: [{ kind: 'product', label: 'Di. RA 10', receiptsJubileeHillsAmt: 9 }],
          },
          receiptAmountReview: [],
          productAverageRates: [{ product: 'Di. RA 10', averageRateAmt: 5 }],
        };
      },
      placeJubileeHillsFromPivots: async () => ({
        layoutByCategory: { Diamond: [{ kind: 'product', label: 'Di. RA 10' }] },
        receiptAmountReview: [],
        productAverageRates: [{ product: 'Di. RA 10', averageRateAmt: 9 }],
      }),
    }
  );
  assert.equal(openingMappingPendingCount(filled), 1);
  assert.ok(sourceRates.some((rows) => rows.some((row) => row.product === 'Di. RA 10')));
});

test('Basheerbagh preview fill uses stored Jubilee Hills average rates', async () => {
  const filled = await applyReadyReceiptRates(
    'basheerbagh',
    branchResult({ pending: 0, rate: 5 }),
    {
      loadBranchResult: async (sessionKey) => {
        if (sessionKey.includes('jubilee')) return branchResult({ pending: 0, rate: 9 });
        return null;
      },
      fillReceiptAmountsFromLayout: async (payload) => {
        assert.equal(payload.destinationBranch, 'basheerbagh');
        assert.equal(payload.sourceAverageRates.jubileeHills[0].averageRateAmt, 9);
        assert.equal(payload.sourceOpeningComplete.jubileeHills, true);
        assert.ok(payload.sourceIssueLayouts.jubileeHills);
        return {
          layoutByCategory: {
            Diamond: [{ kind: 'product', label: 'Di. RA 10', receiptsJubileeHillsAmt: 9 }],
          },
          receiptAmountReview: [],
          productAverageRates: [{ product: 'Di. RA 10', averageRateAmt: 5 }],
        };
      },
    }
  );
  assert.equal(filled.layoutByCategory.Diamond[0].receiptsJubileeHillsAmt, 9);
});

test('does not mark a source complete for issue drop while opening mapping is pending', async () => {
  let seen = null;
  await applyReadyReceiptRates('jubileeHills', branchResult({ pending: 0, rate: 9 }), {
    loadBranchResult: async (sessionKey) => {
      if (sessionKey.includes('sales-purchases')) return branchResult({ pending: 2, rate: 5 });
      return null;
    },
    fillReceiptAmountsFromLayout: async (payload) => {
      seen = payload;
      return {
        layoutByCategory: payload.layoutByCategory,
        receiptAmountReview: [],
        productAverageRates: [{ product: 'Di. RA 10', averageRateAmt: 9 }],
      };
    },
  });
  assert.equal(seen.sourceOpeningComplete.basheerbagh, false);
  assert.equal(seen.sourceOpeningComplete.jubileeHills, true);
  assert.deepEqual(seen.sourceOpeningPending.basheerbagh.sort(), ['Pending 1', 'Pending 2']);
});

test('fills every processed branch from stored pivots using rates that are already ready', async () => {
  const stored = {
    kokapet: branchResult({ pending: 0, rate: 7 }),
    jubileeHills: branchResult({ pending: 0, rate: 9 }),
  };
  const persisted = {};
  const remapCalls = [];

  const filled = await maybeFillCrossBranchReceiptAmounts(
    'basheerbagh',
    branchResult({ pending: 0, rate: 5 }),
    {
      loadBranchResult: async (sessionKey) => {
        if (sessionKey.includes('kokapet')) return stored.kokapet;
        if (sessionKey.includes('jubilee')) return stored.jubileeHills;
        return null;
      },
      persistBranchResult: async (sessionKey, result) => {
        persisted[sessionKey] = result;
      },
      fillReceiptAmountsFromLayout: async (payload) => {
        remapCalls.push(payload.destinationBranch);
        return {
          layoutByCategory: { Diamond: [{ kind: 'product', label: 'Di. RA 10', receiptsKokapetAmt: 7 }] },
          receiptAmountReview: [],
          productAverageRates: [
            {
              product: 'Di. RA 10',
              averageRateAmt: payload.destinationBranch === 'kokapet' ? 7 : 5,
            },
          ],
        };
      },
      placeJubileeHillsFromPivots: async () => {
        remapCalls.push('jubileeHills');
        return {
          layoutByCategory: { Diamond: [{ kind: 'product', label: 'Di. RA 10', receiptsKokapetAmt: 7 }] },
          receiptAmountReview: [],
          productAverageRates: [{ product: 'Di. RA 10', averageRateAmt: 9 }],
        };
      },
    }
  );

  assert.deepEqual(remapCalls.sort(), [
    'basheerbagh',
    'basheerbagh',
    'jubileeHills',
    'jubileeHills',
    'kokapet',
    'kokapet',
  ]);
  assert.equal(filled.receiptAmountReview.length, 0);
  assert.equal(filled.layoutByCategory.Diamond[0].receiptsKokapetAmt, 7);
  assert.ok(persisted['financials-kokapet']);
  assert.ok(persisted['financials-jubilee-hills']);
  assert.equal(persisted['financials-kokapet'].receiptAmountReview.length, 0);
});
