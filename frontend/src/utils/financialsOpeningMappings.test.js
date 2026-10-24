import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

test('financials opening mappings are stored per branch in localStorage', () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const source = readFileSync(path.join(here, 'financialsOpeningMappings.js'), 'utf8');
  assert.match(source, /financials-opening-stock-mappings/);
  assert.match(source, /export function saveOpeningStockMapping/);
  assert.match(source, /export function reapplyOpeningStockMappings/);
  assert.match(source, /applyManualOpeningMapping/);
});

test('session slim keeps openingStockReport for Financials branches', () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const source = readFileSync(path.join(here, 'auditSessionStorage.js'), 'utf8');
  assert.match(source, /function slimOpeningStockReport/);
  assert.match(source, /openingStockReport,/);
});

test('source average rates prefer localStorage so branch switches keep rates', () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const source = readFileSync(path.join(here, 'sourceAverageRates.js'), 'utf8');
  assert.match(source, /localStorage\.setItem\(STORAGE_KEY/);
  assert.match(source, /readStore\(sessionStorage\)/);
  assert.match(source, /sessionStorage\.setItem\(STORAGE_KEY/);
});
