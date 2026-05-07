/**
 * Normalized API error bodies from upload validation (Python → Node → browser).
 * @param {unknown} err caught from axios or thrown Error with .details
 */
export function getProcessingErrorPayload(err) {
  if (!err) return null;
  if (err.response?.data && typeof err.response.data === 'object') return err.response.data;
  if (err.details && typeof err.details === 'object') return err.details;
  return null;
}

/**
 * Multi-line summary for toasts and inline panels.
 * @param {Record<string, unknown> | null} data
 */
export function formatProcessingErrorHuman(data) {
  if (!data || typeof data !== 'object') return '';
  /** @type {string[]} */
  const lines = [];
  if (typeof data.detail === 'string') lines.push(data.detail);

  const e = data.error;
  if (!e || typeof e !== 'object') return lines.join('\n');

  const code = typeof e.code === 'string' ? e.code : null;
  if (code) lines.push(`Code: ${code}`);

  if (typeof e.headerRowExcel === 'number') {
    lines.push(`Detected header row (Excel): ${e.headerRowExcel}`);
  }

  if (Array.isArray(e.missingColumns) && e.missingColumns.length) {
    lines.push(`Missing columns (normalized): ${e.missingColumns.join(', ')}`);
  }

  if (Array.isArray(e.expectedColumns) && e.expectedColumns.length) {
    lines.push(`Expected: ${e.expectedColumns.join(', ')}`);
  }

  if (Array.isArray(e.foundColumns) && e.foundColumns.length) {
    const preview = e.foundColumns.slice(0, 40);
    const more = e.foundColumns.length > 40 ? ` … +${e.foundColumns.length - 40} more` : '';
    lines.push(`Found on sheet: ${preview.join(', ')}${more}`);
  }

  if (Array.isArray(e.hints)) {
    for (const h of e.hints) {
      if (typeof h === 'string' && h.trim()) lines.push(`• ${h.trim()}`);
    }
  }

  return lines.join('\n');
}
