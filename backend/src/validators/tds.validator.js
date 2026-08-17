/**
 * TDS rules are validated by the Python service; this is a lightweight
 * shape guard so the Node layer fails fast on obviously malformed bodies.
 *
 * @param {unknown} body
 * @returns {{ ok: true, body: object } | { ok: false, detail: string }}
 */
function validateTdsRulesBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, detail: 'Body must be a JSON object' };
  }
  return { ok: true, body };
}

module.exports = { validateTdsRulesBody };
