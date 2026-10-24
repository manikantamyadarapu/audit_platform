/** Pending-list helpers shared by Opening Stock and Average Rate mapping panels. */

export function receiptReviewKey(row) {
  return [
    String(row?.product || '').trim(),
    String(row?.sourceBranch || '').trim(),
    String(row?.category || '').trim(),
    String(row?.column || '').trim(),
  ].join('\u0000');
}

function resolvedKeyCounts(resolved) {
  const counts = new Map();
  const items = resolved instanceof Set ? [...resolved] : resolved || [];
  for (const item of items) {
    const key = typeof item === 'string' ? item : receiptReviewKey(item);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
}

export function withoutResolvedReceiptReviews(rows, resolved) {
  const counts = resolvedKeyCounts(resolved);
  return (Array.isArray(rows) ? rows : []).filter((row) => {
    const product = String(row?.product || '').trim();
    if (!product) return false;
    const key = receiptReviewKey(row);
    const left = counts.get(key) || 0;
    if (left > 0) {
      counts.set(key, left - 1);
      return false;
    }
    return true;
  });
}

/** Keep every still-pending receipt row when a remap payload omits siblings. */
export function mergeReceiptReviews(previous, incoming, resolved = []) {
  const counts = resolvedKeyCounts(resolved);
  const seen = new Set();
  const merged = [];
  for (const row of [...(Array.isArray(previous) ? previous : []), ...(Array.isArray(incoming) ? incoming : [])]) {
    const product = String(row?.product || '').trim();
    if (!product) continue;
    const key = receiptReviewKey(row);
    const left = counts.get(key) || 0;
    if (left > 0) {
      counts.set(key, left - 1);
      continue;
    }
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(row);
  }
  return merged;
}

export function preserveManualOpeningRows(previousReport, nextReport) {
  const previous = Array.isArray(previousReport?.manualMappingRequired)
    ? previousReport.manualMappingRequired
    : [];
  const next = Array.isArray(nextReport?.manualMappingRequired) ? nextReport.manualMappingRequired : [];
  const resolved = new Set(
    (Array.isArray(nextReport?.fallbackMatched) ? nextReport.fallbackMatched : [])
      .map((row) => String(row?.product || '').trim())
      .filter(Boolean)
  );
  const seen = new Set(next.map((row) => String(row?.product || '').trim()).filter(Boolean));
  const kept = previous.filter((row) => {
    const name = String(row?.product || '').trim();
    return name && !resolved.has(name) && !seen.has(name);
  });
  if (!kept.length) return nextReport || {};
  const manual = [...next, ...kept];
  return {
    ...(nextReport || {}),
    manualMappingRequired: manual,
    manualMappingRequiredCount: manual.length,
    previousYearMappingRequired: manual,
    previousYearMappingRequiredCount: manual.length,
  };
}

export function pendingRowId(row) {
  return [
    String(row?.product || '').trim(),
    String(row?.category || '').trim(),
    String(row?.subcategory || '').trim(),
    String(row?.openingQty ?? ''),
    String(row?.column || '').trim(),
    String(row?.sourceBranch || '').trim(),
  ].join('\u0000');
}

/** Drop only the confirmed row. Put back any other pending row a later refresh omitted. */
export function keepVisiblePendingRows(current, incoming, hiddenIds) {
  const hidden = hiddenIds instanceof Set ? hiddenIds : new Set(hiddenIds || []);
  const seen = new Set();
  const merged = [];
  for (const row of [...(Array.isArray(incoming) ? incoming : []), ...(Array.isArray(current) ? current : [])]) {
    const name = String(row?.product || '').trim();
    const id = pendingRowId(row);
    if (!name || hidden.has(id) || seen.has(id)) continue;
    seen.add(id);
    merged.push(row);
  }
  return merged;
}

export function subcategoryGroupKey(row, { includeSource = false } = {}) {
  const category = String(row?.category || '').trim() || 'Uncategorized';
  const subcategory = String(row?.subcategory || '').trim() || 'Unspecified';
  if (!includeSource) return `${category}:::${subcategory}`;
  const source = String(row?.sourceBranch || '').trim() || 'source';
  return `${category}:::${subcategory}:::${source}`;
}

export function groupPendingRows(rows, { includeSource = false } = {}) {
  const map = new Map();
  for (const row of rows || []) {
    const key = subcategoryGroupKey(row, { includeSource });
    if (!map.has(key)) map.set(key, { key, products: [] });
    map.get(key).products.push(row);
  }
  return [...map.values()];
}
