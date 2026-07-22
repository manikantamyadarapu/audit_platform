/**
 * @param {unknown} body
 * @returns {{
 *   ok: true,
 *   detailedRecords: object[],
 *   summaryRecords: object[],
 * } | { ok: false, detail: string }}
 */
function validateTds01ExportBody(body) {
  if (body == null || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, detail: 'Request body must be a JSON object' };
  }

  const detailedRecords = body.detailedRecords;
  const summaryRecords = body.summaryRecords;

  if (detailedRecords != null && !Array.isArray(detailedRecords)) {
    return { ok: false, detail: '"detailedRecords" must be an array' };
  }
  if (summaryRecords != null && !Array.isArray(summaryRecords)) {
    return { ok: false, detail: '"summaryRecords" must be an array' };
  }

  return {
    ok: true,
    detailedRecords: Array.isArray(detailedRecords) ? detailedRecords : [],
    summaryRecords: Array.isArray(summaryRecords) ? summaryRecords : [],
  };
}

module.exports = { validateTds01ExportBody };
