import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { roundHalfUpWhole } from './format.js';

test('average rate rounds below, at, and above 0.5', () => {
  assert.equal(roundHalfUpWhole(10.49), 10);
  assert.equal(roundHalfUpWhole(10.5), 11);
  assert.equal(roundHalfUpWhole(10.51), 11);
  assert.equal(roundHalfUpWhole(0.49), 0);
  assert.equal(roundHalfUpWhole(0.5), 1);
});

test('closing stock preview and export round only the Average Rate display', () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const layout = readFileSync(path.join(here, '../config/closingStockLayout.js'), 'utf8');
  const preview = readFileSync(path.join(here, '../components/tables/ClosingStockPreviewTable.jsx'), 'utf8');
  const template = readFileSync(
    path.join(here, '../../../python-service/app/engines/financials_engine/engine/closing_stock_template.py'),
    'utf8'
  );
  assert.match(layout, /field === 'averageRateAmt'/);
  assert.match(layout, /formatClosingStockAverageRate/);
  assert.match(layout, /Stored Average Rate/);
  assert.match(preview, /closingStockCellTitle/);
  assert.match(template, /def displayed_average_rate/);
  assert.match(template, /measure_key == 'averageRateAmt'/);
  assert.match(template, /ROUND_HALF_UP/);
});
