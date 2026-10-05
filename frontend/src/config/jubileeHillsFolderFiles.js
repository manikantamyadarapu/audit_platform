import {
  classifyKokapetFolderFiles,
  isFinancialsSpreadsheet,
} from './basheerbaghFolderFiles';

const OPTIONAL_SLOTS = Object.freeze([
  {
    key: 'mr',
    label: 'MR',
    phrases: ['material receipt', 'material receipts', 'mr'],
  },
  {
    key: 'dc',
    label: 'DC',
    phrases: ['delivery challan', 'delivery challans', 'dc'],
  },
]);

const REQUIRED_EXTRA_SLOTS = Object.freeze([
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
    label: 'Credit Notes from Suppliers',
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
    label: 'Debit Notes from Suppliers',
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
  { key: 'salesReturn', label: 'Sales Return' },
  { key: 'purchaseReturn', label: 'Purchase Return' },
  { key: 'creditNote', label: 'Credit Notes from Suppliers' },
  { key: 'debitNote', label: 'Debit Notes from Suppliers' },
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

function classifyNamed(file, slots) {
  const name = normalizedBaseName(file);
  if (!name) return null;
  let best = null;
  for (const slot of slots) {
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
 * Jubilee Hills uses Sales, Purchases, Opening Quantity, Previous Year Financials,
 * Sales Return, Purchase Return, Credit Notes from Suppliers, and Debit Notes from
 * Suppliers. MR and DC are optional.
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
  const optionalBuckets = {
    mr: [],
    dc: [],
  };
  const remaining = [];
  for (const file of spreadsheets) {
    const optional = classifyNamed(file, OPTIONAL_SLOTS);
    if (optional && optionalBuckets[optional]) {
      optionalBuckets[optional].push(file);
      continue;
    }
    const slot = classifyNamed(file, REQUIRED_EXTRA_SLOTS);
    if (slot && extraBuckets[slot]) extraBuckets[slot].push(file);
    else remaining.push(file);
  }

  const six = classifyKokapetFolderFiles(remaining, options);
  const files = {
    sales: six.files?.sales ?? null,
    purchases: six.files?.purchases ?? null,
    quantity: six.files?.quantity ?? null,
    previousYear: six.files?.previousYear ?? null,
    salesReturn: null,
    purchaseReturn: null,
    creditNote: null,
    debitNote: null,
    mr: null,
    dc: null,
  };
  const issues = (six.issues || []).filter((issue) =>
    ['sales', 'purchases', 'quantity', 'previousYear'].includes(issue.key)
  );

  for (const slot of OPTIONAL_SLOTS) {
    const matches = optionalBuckets[slot.key];
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

  for (const slot of REQUIRED_EXTRA_SLOTS) {
    const matches = extraBuckets[slot.key];
    const listing = matches.filter((file) => !normalizedBaseName(file).includes('invoice'));
    const pool = listing.length ? listing : matches;
    if (pool.length) {
      files[slot.key] = pool.reduce((best, file) => (file.size > best.size ? file : best));
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
