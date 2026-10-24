import { readSourceAverageRates } from './sourceAverageRates.js';
import {
  readSessionReceiptMappings,
  writeSessionReceiptMappings,
} from './financialsMappingSession.js';

function sourceProductStillValid(mapping) {
  const rates = readSourceAverageRates();
  const source = String(mapping?.sourceBranch || '').trim();
  const list = rates?.[source];
  if (!Array.isArray(list) || !list.length) return true;
  const product = String(mapping?.sourceProduct || '').trim();
  const category = String(mapping?.category || '').trim();
  return list.some((row) => {
    const name = String(row?.product || '').trim();
    const rowCategory = String(row?.category || '').trim();
    if (name !== product) return false;
    if (category && rowCategory && rowCategory !== category) return false;
    return row?.averageRateAmt != null && row.averageRateAmt !== '';
  });
}

export function readReceiptRateMappings(branch) {
  if (!branch) return [];
  return readSessionReceiptMappings(branch).filter(sourceProductStillValid);
}

export function saveReceiptRateMapping(branch, mapping) {
  if (!branch || !mapping?.product || !mapping?.sourceProduct || !mapping?.sourceBranch) {
    return readReceiptRateMappings(branch);
  }
  const current = readSessionReceiptMappings(branch);
  const product = String(mapping.product).trim();
  const source = String(mapping.sourceBranch).trim();
  const category = String(mapping.category || '').trim();
  const next = current.filter((row) => {
    const sameProduct = String(row?.product || '').trim() === product;
    const sameSource = String(row?.sourceBranch || '').trim() === source;
    const sameCategory = String(row?.category || '').trim() === category;
    return !(sameProduct && sameSource && sameCategory);
  });
  next.push({
    product,
    category,
    subcategory: mapping.subcategory || null,
    column: mapping.column || null,
    sourceBranch: source,
    sourceBranchLabel: mapping.sourceBranchLabel || source,
    sourceProduct: String(mapping.sourceProduct).trim(),
    averageRateAmt: mapping.averageRateAmt ?? null,
    receiptQty: mapping.receiptQty ?? null,
  });
  writeSessionReceiptMappings(branch, next);
  return next;
}
