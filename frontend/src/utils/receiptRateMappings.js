const STORAGE_KEY = 'financials-receipt-rate-mappings';

function readAll() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function readReceiptRateMappings(branch) {
  const rows = readAll()[branch];
  return Array.isArray(rows) ? rows : [];
}

export function saveReceiptRateMapping(branch, mapping) {
  if (!branch || !mapping?.product || !mapping?.sourceProduct || !mapping?.sourceBranch) {
    return readReceiptRateMappings(branch);
  }
  const all = readAll();
  const current = Array.isArray(all[branch]) ? all[branch] : [];
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
  all[branch] = next;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  return next;
}
