const assert = require('node:assert/strict');
const path = require('path');
const test = require('node:test');

const {
  absoluteFromRelative,
  buildHeldFilePaths,
  resolveHeldPath,
  sanitizeOriginalName,
} = require('./heldFinancialPath');

test('sanitizeOriginalName strips path segments and keeps workbook extension', () => {
  assert.equal(sanitizeOriginalName('../../evil.xlsx'), 'evil.xlsx');
  assert.equal(sanitizeOriginalName('Sales Report'), 'Sales Report.xlsx');
  assert.match(sanitizeOriginalName('Opening.xlsm'), /\.xlsm$/i);
});

test('resolveHeldPath rejects paths that escape the storage root', () => {
  assert.throws(() => resolveHeldPath('..', 'outside.xlsx'), /escapes storage root/);
});

test('buildHeldFilePaths nests under user, branch, and slot', () => {
  const { absolutePath, relativePath } = buildHeldFilePaths(7, 'kokapet', 'sales', 'Sales.xlsx');
  assert.match(relativePath, /^7\/kokapet\/sales\/.+_Sales\.xlsx$/);
  assert.ok(absolutePath.includes(path.join('7', 'kokapet', 'sales')));
  assert.equal(absoluteFromRelative(relativePath), absolutePath);
});
