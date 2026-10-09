/**
 * Financials held-file branches and slot → multer field mapping.
 * Slot keys match the frontend folder classifiers.
 */

const BRANCHES = Object.freeze(['basheerbagh', 'kokapet', 'jubilee-hills']);

/** @type {Readonly<Record<string, string>>} */
const SLOT_TO_FIELD = Object.freeze({
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
});

/** @type {Readonly<Record<string, string>>} */
const FIELD_TO_SLOT = Object.freeze(
  Object.fromEntries(Object.entries(SLOT_TO_FIELD).map(([slot, field]) => [field, slot]))
);

const SIX_FILE_REQUIRED_SLOTS = Object.freeze([
  'sales',
  'purchases',
  'quantity',
  'previousYear',
  'mr',
  'dc',
]);

const JUBILEE_REQUIRED_SLOTS = Object.freeze([
  'sales',
  'purchases',
  'quantity',
  'previousYear',
  'salesReturn',
  'purchaseReturn',
  'creditNote',
  'debitNote',
]);

const JUBILEE_OPTIONAL_SLOTS = Object.freeze(['mr', 'dc']);

/**
 * @param {string} branch
 * @returns {boolean}
 */
function isValidBranch(branch) {
  return BRANCHES.includes(branch);
}

/**
 * @param {string} branch
 * @returns {readonly string[]}
 */
function requiredSlotsForBranch(branch) {
  if (branch === 'jubilee-hills') return JUBILEE_REQUIRED_SLOTS;
  return SIX_FILE_REQUIRED_SLOTS;
}

/**
 * @param {string} branch
 * @returns {readonly string[]}
 */
function allowedSlotsForBranch(branch) {
  if (branch === 'jubilee-hills') {
    return [...JUBILEE_REQUIRED_SLOTS, ...JUBILEE_OPTIONAL_SLOTS];
  }
  return SIX_FILE_REQUIRED_SLOTS;
}

module.exports = {
  BRANCHES,
  SLOT_TO_FIELD,
  FIELD_TO_SLOT,
  SIX_FILE_REQUIRED_SLOTS,
  JUBILEE_REQUIRED_SLOTS,
  JUBILEE_OPTIONAL_SLOTS,
  isValidBranch,
  requiredSlotsForBranch,
  allowedSlotsForBranch,
};
