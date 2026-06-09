/** Badge tone for audit issue codes (PAN-style colouring across scrutiny modules). */
export function auditIssueTone(code) {
  if (!code || typeof code !== 'string') return 'blue';
  if (code.includes('MISSING')) return 'amber';
  if (
    code.includes('INVALID') ||
    code.includes('NEGATIVE') ||
    code.includes('OUTSIDE') ||
    code.includes('VIOLATION')
  )
    return 'rose';
  if (code.includes('CONFLICT') || code.includes('MISMATCH')) return 'amber';
  return 'blue';
}
