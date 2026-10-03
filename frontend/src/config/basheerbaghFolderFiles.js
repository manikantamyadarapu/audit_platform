const SPREADSHEET_EXT = /\.(xlsx|xlsm)$/i;
const YEAR_SEP = '[-_./\\s]*';

const SLOT_PHRASES = Object.freeze([
  { key: 'salesReturn', phrases: ['sales return', 'sale return', 'sales returns', 'sale returns', 'salesreturn'] },
  { key: 'purchaseReturn', phrases: ['purchase return', 'purchases return', 'purchasereturn'] },
  { key: 'quantity', phrases: ['quantity file', 'opening quantity', 'opening qty', 'opening balance', 'quantity', 'qty'] },
  { key: 'mr', phrases: ['material receipt', 'material receipts', 'mr'] },
  { key: 'dc', phrases: ['delivery challan', 'delivery challans', 'dc'] },
  { key: 'sales', phrases: ['sales', 'sale'] },
  { key: 'purchases', phrases: ['purchases', 'purchase'] },
]);

export const BASHEERBAGH_FOLDER_SLOTS = Object.freeze([
  { key: 'sales', processKey: 'salesFile', label: 'Sales' },
  { key: 'purchases', processKey: 'purchasesFile', label: 'Purchases' },
  { key: 'quantity', processKey: 'openingQtyFile', label: 'Quantity File' },
  { key: 'previousYear', processKey: 'previousYearFile', label: 'Previous Year Financials' },
  { key: 'mr', processKey: 'mrFile', label: 'MR' },
  { key: 'dc', processKey: 'dcFile', label: 'DC' },
]);

/** Kokapet folder inputs. Sales Return and Purchase Return are not inputs. */
export const KOKAPET_FOLDER_SLOTS = Object.freeze([
  { key: 'sales', label: 'Sales' },
  { key: 'purchases', label: 'Purchases' },
  { key: 'mr', label: 'MR' },
  { key: 'dc', label: 'DC' },
  { key: 'previousYear', label: 'Previous Year Financials' },
  { key: 'quantity', label: 'Opening Quantity' },
]);

const KOKAPET_IGNORED_SLOTS = new Set(['salesReturn', 'purchaseReturn']);

function emptyAssigned() {
  return {
    sales: null,
    purchases: null,
    quantity: null,
    previousYear: null,
    mr: null,
    dc: null,
    salesReturn: null,
    purchaseReturn: null,
  };
}

export function parseAuditYear(financialYear) {
  const text = String(financialYear || '').trim();
  const kMatch = text.match(/2k(\d{2})/i);
  if (kMatch) return 2000 + Number(kMatch[1]);
  const four = text.match(/(?:19|20)\d{2}/);
  if (four) return Number(four[0]);
  return new Date().getFullYear();
}

function fileStem(file) {
  const path = file?.webkitRelativePath || file?.name || '';
  const base = path.split(/[/\\]/).pop() || file?.name || '';
  return String(base).replace(SPREADSHEET_EXT, '').trim();
}

function normalizedBaseName(file) {
  return fileStem(file)
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function phraseInName(name, phrase) {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`).test(name);
}

function classifyByPhrase(file) {
  const name = normalizedBaseName(file);
  if (!name) return null;
  let best = null;
  for (const rule of SLOT_PHRASES) {
    for (const phrase of rule.phrases) {
      if (name === phrase) return rule.key;
      if (phraseInName(name, phrase)) {
        const score = phrase.length;
        if (!best || score > best.score) best = { key: rule.key, score };
      }
    }
  }
  return best?.key ?? null;
}

function stemForYearMatch(file) {
  return fileStem(file).replace(/\s*(?:\((\d+)\)|(?:[-_ ]+)?(?:copy|final)|(?:[-_ ]+v\d+))$/i, '');
}

function previousYearRank(file, currentYear) {
  const stem = stemForYearMatch(file);
  const y = Number(currentYear);
  if (!stem || !Number.isFinite(y) || y < 1900 || y > 2100) return 0;
  const prev = y - 1;
  const yy = String(y).slice(-2);
  const py = String(prev).slice(-2);
  const ranked = [
    [4, `${prev}${YEAR_SEP}${y}`],
    [4, `2k${py}${YEAR_SEP}2k${yy}`],
    [3, `${prev}${YEAR_SEP}${yy}`],
    [3, `2k${py}${YEAR_SEP}${yy}`],
    [3, `${py}${YEAR_SEP}${yy}`],
    [2, String(y)],
    [2, `2k${yy}`],
  ];
  for (const [rank, pattern] of ranked) {
    if (new RegExp(`(?:^|[^0-9])${pattern}$`, 'i').test(stem)) return rank;
  }
  return 0;
}

function pickPreviousYearFile(files, currentYear) {
  let best = null;
  for (const file of files) {
    const rank = previousYearRank(file, currentYear);
    if (!rank) continue;
    if (!best || rank > best.rank) best = { file, rank };
  }
  return best?.file ?? null;
}

const PREVIOUS_YEAR_PHRASES = [
  'previous year',
  'prev year',
  'last year',
  'closing stock',
  'financials',
];

export function isFinancialsSpreadsheet(file) {
  const name = file?.name || '';
  if (name.startsWith('~$')) return false;
  return SPREADSHEET_EXT.test(name);
}

/**
 * Identify Basheerbagh folder files by name. Previous Year is matched by a year token
 * at the end of the filename (e.g. 2024-2025, 2025, 2k24-2k25, 2k25).
 */
export function classifyBasheerbaghFolderFiles(fileList, options = {}) {
  const assigned = emptyAssigned();
  const leftovers = [];
  const seen = new Set();
  const currentYear = parseAuditYear(options.financialYear ?? options.currentYear);

  for (const file of Array.from(fileList || [])) {
    if (!file) continue;
    const fingerprint = `${file.webkitRelativePath || file.name}:${file.size}:${file.lastModified}`;
    if (seen.has(fingerprint)) continue;
    seen.add(fingerprint);
    if (!isFinancialsSpreadsheet(file)) continue;
    const slot = classifyByPhrase(file);
    if (!slot) {
      leftovers.push(file);
      continue;
    }
    if (!assigned[slot]) assigned[slot] = file;
  }

  const yearsToTry = [currentYear];
  const fallbackYear = parseAuditYear('AY 2025-26');
  if (!yearsToTry.includes(fallbackYear)) yearsToTry.push(fallbackYear);

  for (const year of yearsToTry) {
    assigned.previousYear = pickPreviousYearFile(leftovers, year);
    if (assigned.previousYear) break;
  }

  if (!assigned.previousYear) {
    for (const file of leftovers) {
      const name = normalizedBaseName(file);
      if (PREVIOUS_YEAR_PHRASES.some((phrase) => phraseInName(name, phrase))) {
        assigned.previousYear = file;
        break;
      }
    }
  }

  return assigned;
}

function dedupedSpreadsheets(fileList) {
  const files = [];
  const seen = new Set();
  for (const file of Array.from(fileList || [])) {
    if (!file) continue;
    const fingerprint = `${file.webkitRelativePath || file.name}:${file.size}:${file.lastModified}`;
    if (seen.has(fingerprint)) continue;
    seen.add(fingerprint);
    if (!isFinancialsSpreadsheet(file)) continue;
    files.push(file);
  }
  return files;
}

function auditYearsToTry(options = {}) {
  const currentYear = parseAuditYear(options.financialYear ?? options.currentYear);
  const yearsToTry = [currentYear];
  const fallbackYear = parseAuditYear('AY 2025-26');
  if (!yearsToTry.includes(fallbackYear)) yearsToTry.push(fallbackYear);
  return yearsToTry;
}

function bestPreviousYearMatches(files, year) {
  let bestRank = 0;
  const winners = [];
  for (const file of files) {
    const rank = previousYearRank(file, year);
    if (!rank) continue;
    if (rank > bestRank) {
      bestRank = rank;
      winners.length = 0;
      winners.push(file);
    } else if (rank === bestRank) {
      winners.push(file);
    }
  }
  return winners;
}

function previousYearPhraseMatches(files) {
  return files.filter((file) => {
    const name = normalizedBaseName(file);
    return PREVIOUS_YEAR_PHRASES.some((phrase) => phraseInName(name, phrase));
  });
}

function fileLabel(file) {
  const path = file?.webkitRelativePath || file?.name || '';
  return path.split(/[/\\]/).pop() || file?.name || 'Unnamed file';
}

/**
 * Identify Kokapet folder files with the same name rules as Basheerbagh.
 * Sales Return and Purchase Return are ignored and never become inputs.
 * More than one match for a required file is reported; none of those files is selected.
 */
export function classifyKokapetFolderFiles(fileList, options = {}) {
  const buckets = {
    sales: [],
    purchases: [],
    quantity: [],
    mr: [],
    dc: [],
  };
  const leftovers = [];

  for (const file of dedupedSpreadsheets(fileList)) {
    const slot = classifyByPhrase(file);
    if (slot && KOKAPET_IGNORED_SLOTS.has(slot)) continue;
    if (slot && buckets[slot]) {
      buckets[slot].push(file);
      continue;
    }
    leftovers.push(file);
  }

  const files = {
    sales: null,
    purchases: null,
    mr: null,
    dc: null,
    previousYear: null,
    quantity: null,
  };
  const issues = [];

  for (const slot of KOKAPET_FOLDER_SLOTS) {
    if (slot.key === 'previousYear') continue;
    const matches = buckets[slot.key] || [];
    if (matches.length === 1) {
      files[slot.key] = matches[0];
      continue;
    }
    if (matches.length > 1) {
      const names = matches.map(fileLabel);
      issues.push({
        key: slot.key,
        label: slot.label,
        fileNames: names,
        message: `${slot.label} matches more than one file: ${names.join(', ')}. No file was selected.`,
      });
    }
  }

  let previousYearResolved = false;
  for (const year of auditYearsToTry(options)) {
    const winners = bestPreviousYearMatches(leftovers, year);
    if (!winners.length) continue;
    previousYearResolved = true;
    if (winners.length === 1) {
      files.previousYear = winners[0];
    } else {
      const names = winners.map(fileLabel);
      issues.push({
        key: 'previousYear',
        label: 'Previous Year Financials',
        fileNames: names,
        message: `Previous Year Financials matches more than one file: ${names.join(', ')}. No file was selected.`,
      });
    }
    break;
  }

  if (!previousYearResolved) {
    const phraseHits = previousYearPhraseMatches(leftovers);
    if (phraseHits.length === 1) {
      files.previousYear = phraseHits[0];
    } else if (phraseHits.length > 1) {
      const names = phraseHits.map(fileLabel);
      issues.push({
        key: 'previousYear',
        label: 'Previous Year Financials',
        fileNames: names,
        message: `Previous Year Financials matches more than one file: ${names.join(', ')}. No file was selected.`,
      });
    }
  }

  const issueKeys = new Set(issues.map((issue) => issue.key));
  const missing = KOKAPET_FOLDER_SLOTS.filter(
    (slot) => !files[slot.key] && !issueKeys.has(slot.key)
  ).map((slot) => slot.label);

  return {
    files,
    missing,
    issues,
    ready: missing.length === 0 && issues.length === 0,
  };
}
