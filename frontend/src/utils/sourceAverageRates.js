const STORAGE_KEY = 'financials-source-average-rates';

export function readSourceAverageRates() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function saveBranchAverageRates(branch, rows) {
  if (!branch) return readSourceAverageRates();
  const all = readSourceAverageRates();
  all[branch] = Array.isArray(rows) ? rows : [];
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  return all;
}
