const assert = require('node:assert/strict');
const test = require('node:test');

const { validateClosingStockExportBody } = require('./financials.validator');

test('closing-stock export keeps destinationBranch, sourceAverageRates, and receiptRateMappings', () => {
  const parsed = validateClosingStockExportBody({
    salesPivot: [{ product: 'Di. RA 10' }],
    purchasesPivot: [],
    openingPivot: [],
    destinationBranch: 'kokapet',
    sourceAverageRates: {
      jubileeHills: [{ product: 'Di. RA 10', averageRateAmt: 12.5 }],
    },
    receiptRateMappings: [{ product: 'Di. RA 10', sourceProduct: 'Di RA 10' }],
    companyName: 'X',
    address: 'Y',
    financialYear: 'AY 2025-26',
  });
  assert.equal(parsed.ok, true);
  assert.equal(parsed.destinationBranch, 'kokapet');
  assert.equal(parsed.sourceAverageRates.jubileeHills[0].averageRateAmt, 12.5);
  assert.equal(parsed.receiptRateMappings[0].sourceProduct, 'Di RA 10');
});

test('closing-stock export keeps preview layout and source issue layouts', () => {
  const parsed = validateClosingStockExportBody({
    salesPivot: [{ product: 'Di. RA 10' }],
    destinationBranch: 'basheerbagh',
    layoutByCategory: {
      Diamond: [{ kind: 'product', label: 'Di. RA 10', receiptsJubileeHillsQty: 3 }],
    },
    sourceIssueLayouts: {
      jubileeHills: { Diamond: [{ kind: 'product', label: 'Di. RA 10', issuesBanjaraHillsQty: 3 }] },
    },
    sourceOpeningComplete: { jubileeHills: true },
  });
  assert.equal(parsed.ok, true);
  assert.equal(parsed.layoutByCategory.Diamond[0].receiptsJubileeHillsQty, 3);
  assert.equal(parsed.sourceIssueLayouts.jubileeHills.Diamond[0].issuesBanjaraHillsQty, 3);
  assert.equal(parsed.sourceOpeningComplete.jubileeHills, true);
});

test('closing-stock export treats missing rates and mappings as empty without dropping pivots', () => {
  const parsed = validateClosingStockExportBody({
    salesPivot: [{ product: 'A' }],
  });
  assert.equal(parsed.ok, true);
  assert.equal(parsed.destinationBranch, '');
  assert.deepEqual(parsed.sourceAverageRates, {});
  assert.deepEqual(parsed.receiptRateMappings, []);
  assert.equal(parsed.salesPivot[0].product, 'A');
});
