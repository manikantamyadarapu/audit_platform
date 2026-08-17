function escapeCell(val) {
  const s = val === null || val === undefined ? '' : String(val);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export const EMPTY_EXPORT_MESSAGE = 'No eligible suppliers found.';

export function exportRowsToCsv(filename, columns, rows) {
  const header = columns.map((c) => escapeCell(c.header)).join(',');
  const lines = rows.map((row) =>
    columns.map((c) => escapeCell(c.accessor(row))).join(',')
  );
  const body = rows.length ? lines : [escapeCell(EMPTY_EXPORT_MESSAGE)];
  const csv = [header, ...body].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
