import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { OPENING_QTY_SOURCES, resolveManualOpeningQty } from './openingQtySource.js';

test('manual opening qty can come from quantity file or previous-year closing qty', () => {
  assert.equal(
    resolveManualOpeningQty({
      source: OPENING_QTY_SOURCES.quantityFile,
      quantityFileQty: 12.5,
      previousYearQty: 9,
    }),
    12.5
  );
  assert.equal(
    resolveManualOpeningQty({
      source: OPENING_QTY_SOURCES.previousYear,
      quantityFileQty: 12.5,
      previousYearQty: 9,
    }),
    9
  );
  assert.equal(
    resolveManualOpeningQty({
      source: OPENING_QTY_SOURCES.previousYear,
      quantityFileQty: 12.5,
      previousYearQty: null,
    }),
    null
  );
});

test('mapping modal exposes both opening-qty file choices', () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const source = readFileSync(
    path.join(here, '../components/audit/OpeningStockManualMappingPanel.jsx'),
    'utf8'
  );
  assert.match(source, /Quantity File/);
  assert.match(source, /Previous Year Closing Stock/);
  assert.match(source, /openingQtySource/);
  assert.match(source, /resolveManualOpeningQty/);
});
