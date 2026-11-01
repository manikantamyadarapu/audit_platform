import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { displayedAbstractAmount, formatAbstractAmount } from './abstractLayout.js';

test('abstract amounts round 0.5 or less down and above 0.5 up', () => {
  assert.equal(displayedAbstractAmount(123.4567), 123);
  assert.equal(displayedAbstractAmount(123.5678), 124);
  assert.equal(displayedAbstractAmount(123.5), 123);
  assert.equal(displayedAbstractAmount(0.49), 0);
  assert.equal(displayedAbstractAmount(0.5), 0);
  assert.equal(displayedAbstractAmount(0.51), 1);
  assert.equal(formatAbstractAmount(123.4567), '123');
  assert.equal(formatAbstractAmount(123.5678), '124');
});

test('abstract preview and export round only Amount columns', () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const preview = readFileSync(path.join(here, '../components/tables/AbstractPreviewTable.jsx'), 'utf8');
  const template = readFileSync(
    path.join(here, '../../../python-service/app/engines/financials_engine/engine/abstract_template.py'),
    'utf8'
  );
  assert.match(preview, /formatAbstractAmount/);
  assert.match(preview, /displayAmount/);
  assert.match(preview, /ABSTRACT_PERCENT_GROUPS/);
  assert.match(template, /def displayed_abstract_amount/);
  assert.match(template, /_write_amount/);
  assert.match(template, /round_amount_whole/);
});
