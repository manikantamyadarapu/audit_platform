const SLOT_TO_FIELD = {
  sales: 'salesFile',
  purchases: 'purchasesFile',
  quantity: 'openingQtyFile',
  previousYear: 'previousYearFile',
  mr: 'mrFile',
  dc: 'dcFile',
  salesReturn: 'salesReturnFile',
  purchaseReturn: 'purchaseReturnFile',
  creditNote: 'creditNoteFile',
  debitNote: 'debitNoteFile',
};

/** Slots the hold API accepts for each branch. */
export const HOLD_SLOTS_BY_BRANCH = Object.freeze({
  basheerbagh: Object.freeze([
    'sales',
    'purchases',
    'quantity',
    'previousYear',
    'mr',
    'dc',
  ]),
  kokapet: Object.freeze([
    'sales',
    'purchases',
    'quantity',
    'previousYear',
    'mr',
    'dc',
  ]),
  'jubilee-hills': Object.freeze([
    'sales',
    'purchases',
    'quantity',
    'previousYear',
    'salesReturn',
    'purchaseReturn',
    'creditNote',
    'debitNote',
    'mr',
    'dc',
  ]),
});

export function normalizeFinancialsHoldBranch(destinationBranch) {
  if (destinationBranch === 'kokapet') return 'kokapet';
  if (destinationBranch === 'jubilee-hills' || destinationBranch === 'jubileeHills') {
    return 'jubilee-hills';
  }
  return 'basheerbagh';
}

/**
 * Build hold upload parts for a branch. Classifier extras (Basheerbagh Sales Return,
 * Purchase Return) are omitted so six-file hold multer does not reject the request.
 * @param {string} branch
 * @param {Record<string, File|Blob|null|undefined>} slotFiles
 * @returns {{ field: string, slotKey: string, file: File|Blob }[]}
 */
export function buildHoldUploadParts(branch, slotFiles) {
  const normalized = normalizeFinancialsHoldBranch(branch);
  const allowed = HOLD_SLOTS_BY_BRANCH[normalized] || HOLD_SLOTS_BY_BRANCH.basheerbagh;
  const parts = [];
  for (const slotKey of allowed) {
    const file = slotFiles?.[slotKey];
    const field = SLOT_TO_FIELD[slotKey];
    if (!field || !file) continue;
    parts.push({ field, slotKey, file });
  }
  return parts;
}
