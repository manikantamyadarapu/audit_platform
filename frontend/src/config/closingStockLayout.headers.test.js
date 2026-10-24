import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const layout = readFileSync(path.join(here, 'closingStockLayout.js'), 'utf8');
const preview = readFileSync(
  path.join(here, '../components/tables/ClosingStockPreviewTable.jsx'),
  'utf8'
);
const jubilee = readFileSync(
  path.join(here, '../pages/JubileeHillsFinancialsPage.jsx'),
  'utf8'
);
const branchResults = readFileSync(
  path.join(here, '../components/audit/FinancialsBranchResults.jsx'),
  'utf8'
);

test('preview subheaders rename Receipts and Issues totals without moving columns', () => {
  assert.match(layout, /if \(section === 'Receipts' && label === 'Receipts'\) return 'Total Receipts'/);
  assert.match(layout, /if \(section === 'Issues' && label === 'Total'\) return 'Total Issues'/);
  assert.match(layout, /\['Receipts', 'Receipts', 'Qty'\]/);
  assert.match(layout, /\['Issues', 'Total', 'Qty'\]/);
  assert.match(layout, /previewSubheaderLabel\(path\[0\] \|\| '', rename\(path\[1\] \|\| ''\)\)/);
  assert.match(preview, /getClosingStockHeaderRows\(headerLabels\)/);
  assert.match(jubilee, /headerLabels=\{JUBILEE_HILLS_HEADER_LABELS\}/);
  assert.match(branchResults, /<ClosingStockPreviewTable/);
});
