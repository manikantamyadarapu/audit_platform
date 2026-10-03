import {
  classifyKokapetFolderFiles,
  isFinancialsSpreadsheet,
} from './basheerbaghFolderFiles';

const EXTRA_SLOTS = Object.freeze([
  {
    key: 'salesReturn',
    label: 'Sales Return',
    phrases: ['sales return', 'sale return', 'sales returns', 'sale returns', 'salesreturn'],
  },
  {
    key: 'purchaseReturn',
    label: 'Purchase Return',
    phrases: ['purchase return', 'purchases return', 'purchasereturn'],
  },
  {
    key: 'creditNote',
    label: 'Credit notes from suppliers',
    phrases: [
      'credit notes from suppliers',
      'credit note from suppliers',
      'supplier credit notes',
      'supplier credit note',
      'credit notes',
      'credit note',
    ],
  },
  {
    key: 'debitNote',
    label: 'Debit notes from suppliers',
    phrases: [
      'debit notes from suppliers',
      'debit note from suppliers',
      'supplier debit notes',
      'supplier debit note',
      'debit notes',
      'debit note',
    ],
  },
]);

export const JUBILEE_HILLS_FOLDER_SLOTS = Object.freeze([
  { key: 'sales', label: 'Sales' },
  { key: 'purchases', label: 'Purchases' },
  { key: 'quantity', label: 'Opening Quantity' },
  { key: 'previousYear', label: 'Previous Year Financials' },
  { key: 'mr', label: 'MR' },
  { key: 'dc', label: 'DC' },
  { key: 'salesReturn', label: 'Sales Return' },
  { key: 'purchaseReturn', label: 'Purchase Return' },
  { key: 'creditNote', label: 'Credit notes from suppliers' },
  { key: 'debitNote', label: 'Debit notes from suppliers' },
]);

function fileStem(file) {
  const path = file?.webkitRelativePath || file?.name || '';
  const base = path.split(/[/\\]/).pop() || file?.name || '';
  return String(base).replace(/\.(xlsx|xlsm)$/i, '').trim();
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

function classifyExtra(file) {
  const name = normalizedBaseName(file);
  if (!name) return null;
  let best = null;
  for (const slot of EXTRA_SLOTS) {
    for (const phrase of slot.phrases) {
      if (name === phrase || phraseInName(name, phrase)) {
        if (!best || phrase.length > best.score) best = { key: slot.key, score: phrase.length };
      }
    }
  }
  return best?.key ?? null;
}

function fileLabel(file) {
  const path = file?.webkitRelativePath || file?.name || '';
  return path.split(/[/\\]/).pop() || file?.name || 'Unnamed file';
}

/**
 * Jubilee Hills folder: the six Closing Stock files plus Sales Return, Purchase Return,
 * supplier credit notes, and supplier debit notes.
 */
export function classifyJubileeHillsFolderFiles(fileList, options = {}) {
  const spreadsheets = [];
  const seen = new Set();
  for (const file of Array.from(fileList || [])) {
    if (!file) continue;
    const fingerprint = `${file.webkitRelativePath || file.name}:${file.size}:${file.lastModified}`;
    if (seen.has(fingerprint)) continue;
    seen.add(fingerprint);
    if (!isFinancialsSpreadsheet(file)) continue;
    spreadsheets.push(file);
  }

  const extraBuckets = {
    salesReturn: [],
    purchaseReturn: [],
    creditNote: [],
    debitNote: [],
  };
  const remaining = [];
  for (const file of spreadsheets) {
    const slot = classifyExtra(file);
    if (slot && extraBuckets[slot]) extraBuckets[slot].push(file);
    else remaining.push(file);
  }

  const six = classifyKokapetFolderFiles(remaining, options);
  const files = {
    ...six.files,
    salesReturn: null,
    purchaseReturn: null,
    creditNote: null,
    debitNote: null,
  };
  const issues = [...(six.issues || [])];

  for (const slot of EXTRA_SLOTS) {
    const matches = extraBuckets[slot.key];
    if (matches.length === 1) {
      files[slot.key] = matches[0];
    } else if (matches.length > 1) {
      const names = matches.map(fileLabel);
      issues.push({
        key: slot.key,
        label: slot.label,
        fileNames: names,
        message: `${slot.label} matches more than one file: ${names.join(', ')}. No file was selected.`,
      });
    }
  }

  const issueKeys = new Set(issues.map((issue) => issue.key));
  const missing = JUBILEE_HILLS_FOLDER_SLOTS.filter(
    (slot) => !files[slot.key] && !issueKeys.has(slot.key)
  ).map((slot) => slot.label);

  return {
    files,
    missing,
    issues,
    ready: missing.length === 0 && issues.length === 0,
  };
}
