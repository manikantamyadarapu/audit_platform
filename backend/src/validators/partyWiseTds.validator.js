/**
 * @param {unknown} body
 * @returns {{
 *   ok: true,
 *   purchaseSummary: object[],
 *   payableSummary: object[],
 * } | { ok: false, detail: string }}
 */
function validatePartyWiseTdsExportBody(body) {
  if (body == null || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, detail: 'Request body must be a JSON object' };
  }

  const purchaseSummary = body.purchaseSummary;
  const payableSummary = body.payableSummary;

  if (purchaseSummary != null && !Array.isArray(purchaseSummary)) {
    return { ok: false, detail: '"purchaseSummary" must be an array' };
  }
  if (payableSummary != null && !Array.isArray(payableSummary)) {
    return { ok: false, detail: '"payableSummary" must be an array' };
  }

  return {
    ok: true,
    purchaseSummary: Array.isArray(purchaseSummary) ? purchaseSummary : [],
    payableSummary: Array.isArray(payableSummary) ? payableSummary : [],
  };
}

module.exports = { validatePartyWiseTdsExportBody };
