/** Which workbook supplies Opening Qty for manual Opening Stock mapping. */
export const OPENING_QTY_SOURCES = Object.freeze({
  quantityFile: 'quantityFile',
  previousYear: 'previousYear',
});

function coerceNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

/**
 * Resolve the Opening Qty used when confirming a manual mapping.
 * @param {{ source?: string, quantityFileQty?: number|null, previousYearQty?: number|null }} options
 * @returns {number|null}
 */
export function resolveManualOpeningQty({
  source = OPENING_QTY_SOURCES.quantityFile,
  quantityFileQty = null,
  previousYearQty = null,
} = {}) {
  if (source === OPENING_QTY_SOURCES.previousYear) {
    return coerceNumber(previousYearQty);
  }
  return coerceNumber(quantityFileQty);
}
