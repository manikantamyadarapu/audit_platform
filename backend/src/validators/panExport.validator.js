/**
 * @param {unknown} body
 * @returns {{ ok: true, records: object[] } | { ok: false, detail: string }}
 */
function validateExportInvalidBody(body) {
  if (!body || typeof body !== 'object') {
    return { ok: false, detail: 'Body must be a JSON object' };
  }
  const { records } = body;
  if (!Array.isArray(records)) {
    return { ok: false, detail: 'Body must include JSON array "records"' };
  }
  if (records.length === 0) {
    return { ok: false, detail: 'records array must not be empty' };
  }
  for (let i = 0; i < records.length; i += 1) {
    const row = records[i];
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      return { ok: false, detail: `records[${i}] must be an object` };
    }
  }
  return { ok: true, records };
}

module.exports = { validateExportInvalidBody };
