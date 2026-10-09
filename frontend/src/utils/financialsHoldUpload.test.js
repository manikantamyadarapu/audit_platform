import assert from 'node:assert/strict';
import test from 'node:test';
import { buildHoldUploadParts, normalizeFinancialsHoldBranch } from './financialsHoldUpload.js';

function file(name) {
  return { name, size: 10 };
}

test('normalizeFinancialsHoldBranch maps aliases', () => {
  assert.equal(normalizeFinancialsHoldBranch('basheerbagh'), 'basheerbagh');
  assert.equal(normalizeFinancialsHoldBranch('kokapet'), 'kokapet');
  assert.equal(normalizeFinancialsHoldBranch('jubileeHills'), 'jubilee-hills');
  assert.equal(normalizeFinancialsHoldBranch('jubilee-hills'), 'jubilee-hills');
});

test('Basheerbagh hold omits Sales Return and Purchase Return classifier extras', () => {
  const parts = buildHoldUploadParts('basheerbagh', {
    sales: file('sales.xlsx'),
    purchases: file('purchases.xlsx'),
    quantity: file('qty.xlsx'),
    previousYear: file('prev.xlsx'),
    mr: file('mr.xlsx'),
    dc: file('dc.xlsx'),
    salesReturn: file('sales-return.xlsx'),
    purchaseReturn: file('purchase-return.xlsx'),
  });
  const fields = parts.map((part) => part.field).sort();
  assert.deepEqual(fields, [
    'dcFile',
    'mrFile',
    'openingQtyFile',
    'previousYearFile',
    'purchasesFile',
    'salesFile',
  ]);
  assert.equal(
    parts.some((part) => part.field === 'salesReturnFile' || part.field === 'purchaseReturnFile'),
    false
  );
});

test('Kokapet hold keeps the six required slots only', () => {
  const parts = buildHoldUploadParts('kokapet', {
    sales: file('sales.xlsx'),
    purchases: file('purchases.xlsx'),
    quantity: file('qty.xlsx'),
    previousYear: file('prev.xlsx'),
    mr: file('mr.xlsx'),
    dc: file('dc.xlsx'),
    salesReturn: file('should-ignore.xlsx'),
  });
  assert.equal(parts.length, 6);
  assert.equal(
    parts.some((part) => part.field === 'salesReturnFile'),
    false
  );
});

test('Jubilee Hills hold includes return and note slots', () => {
  const parts = buildHoldUploadParts('jubilee-hills', {
    sales: file('sales.xlsx'),
    purchases: file('purchases.xlsx'),
    quantity: file('qty.xlsx'),
    previousYear: file('prev.xlsx'),
    salesReturn: file('sr.xlsx'),
    purchaseReturn: file('pr.xlsx'),
    creditNote: file('cn.xlsx'),
    debitNote: file('dn.xlsx'),
    mr: file('mr.xlsx'),
    dc: file('dc.xlsx'),
  });
  const fields = new Set(parts.map((part) => part.field));
  assert.equal(parts.length, 10);
  assert.ok(fields.has('salesReturnFile'));
  assert.ok(fields.has('creditNoteFile'));
});
