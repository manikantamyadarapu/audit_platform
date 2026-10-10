import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { FINANCIALS_SESSION_KEYS, isFinancialsSessionKey } from './financialsSessionKeys.js';

test('isFinancialsSessionKey covers Basheerbagh, Kokapet, and Jubilee Hills', () => {
  assert.deepEqual([...FINANCIALS_SESSION_KEYS], [
    'financials-sales-purchases',
    'financials-kokapet',
    'financials-jubilee-hills',
  ]);
  assert.equal(isFinancialsSessionKey('financials-sales-purchases'), true);
  assert.equal(isFinancialsSessionKey('financials-kokapet'), true);
  assert.equal(isFinancialsSessionKey('financials-jubilee-hills'), true);
  assert.equal(isFinancialsSessionKey('pan-audit'), false);
});

test('session storage routes Financials keys through closing-stock aggressive slim', () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const source = readFileSync(path.join(here, 'auditSessionStorage.js'), 'utf8');
  assert.match(source, /isFinancialsSessionKey\(registryKey\)/);
  assert.match(source, /aggressiveSlimJubileeHillsSnapshot\(snapshot\)/);
  // Generic ledger slim must not be the Financials fallback path.
  assert.doesNotMatch(
    source,
    /case 'financials-sales-purchases':\s*return aggressiveSlimAuditSnapshot/
  );
});

test('session persistence hook overflows all Financials branches, not only Jubilee', () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const source = readFileSync(
    path.join(here, '../hooks/useAuditSessionPersistence.js'),
    'utf8'
  );
  assert.match(source, /isFinancialsSessionKey\(registryKey\)/);
  assert.match(source, /saveAuditSessionOverflow/);
  assert.doesNotMatch(
    source,
    /registryKey === 'financials-jubilee-hills' && payloadForStorage\?\.result/
  );
});
