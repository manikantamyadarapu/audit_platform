import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '../../..');

test('jubilee hills folds internal MR/DC into the Basheerbagh receipt column', () => {
  const placement = readFileSync(
    path.join(root, 'python-service/app/engines/financials_engine/engine/jubilee_hills_placement.py'),
    'utf8'
  );
  const receiptAmounts = readFileSync(
    path.join(root, 'python-service/app/engines/financials_engine/engine/receipt_amounts.py'),
    'utf8'
  );
  assert.match(placement, /def _with_internal_as_jubilee_hills/);
  assert.match(placement, /receipt_rate_mappings=receipt_rate_mappings/);
  assert.match(receiptAmounts, /dest == 'jubileeHills'/);
  assert.match(receiptAmounts, /qty_key == 'receiptsJubileeHillsQty'/);
  assert.match(receiptAmounts, /return 'basheerbagh'/);
  assert.match(receiptAmounts, /def normalize_receipt_rate_mappings/);
  assert.match(receiptAmounts, /def _mapped_rate/);
});

test('basheerbagh and kokapet still use raw MR/DC location nets', () => {
  const qty = readFileSync(
    path.join(root, 'python-service/app/engines/financials_engine/engine/mr_dc_closing_qty.py'),
    'utf8'
  );
  const ruleBook = readFileSync(
    path.join(root, 'python-service/app/engines/financials_engine/config/product_rule_book.py'),
    'utf8'
  );
  assert.match(qty, /Net = SUM\(MR Quantity\) - SUM\(DC Quantity\)/);
  assert.match(qty, /\('jubileeHills', 'receiptsJubileeHillsQty', 'issuesBanjaraHillsQty'\)/);
  assert.match(qty, /\('kokapet', 'receiptsKokapetQty', 'issuesKokapetQty'\)/);
  assert.match(qty, /\('internalBasheerbagh', 'receiptsInternalQty', 'issuesInternalQty'\)/);
  assert.match(ruleBook, /receipt_rate_mappings=receipt_rate_mappings/);
});

test('frontend mapping helpers remain wired for opening stock and receipt rates', () => {
  const opening = readFileSync(path.join(here, 'financialsOpeningMappings.js'), 'utf8');
  const receipt = readFileSync(path.join(here, 'receiptRateMappings.js'), 'utf8');
  const branchResults = readFileSync(
    path.join(here, '../components/audit/FinancialsBranchResults.jsx'),
    'utf8'
  );
  const jubileePage = readFileSync(
    path.join(here, '../pages/JubileeHillsFinancialsPage.jsx'),
    'utf8'
  );
  assert.match(opening, /export function applyManualOpeningMapping/);
  assert.match(opening, /export function reapplyOpeningStockMappings/);
  assert.match(opening, /export function restoreFinancialsMappings/);
  assert.match(receipt, /export function saveReceiptRateMapping/);
  assert.match(branchResults, /maybeFillCrossBranchReceiptAmounts/);
  assert.match(branchResults, /saveOpeningStockMapping/);
  assert.match(jubileePage, /function pickMrDcPivots/);
  assert.match(jubileePage, /jubileeTransferRowCount\(result\) > 0/);
  assert.match(jubileePage, /scopeFinancialsMappingsForProcess\('jubilee-hills', \{ rerun \}\)/);
  assert.match(jubileePage, /maybeFillCrossBranchReceiptAmounts/);
});
