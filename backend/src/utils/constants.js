/** Allowed Excel extensions for PAN upload (aligned with python-service). */
const ALLOWED_PAN_EXTENSIONS = new Set(['.xlsx', '.xlsm', '.xls']);

const ALLOWED_PAN_MIME_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel.sheet.macroEnabled.12',
  'application/vnd.ms-excel',
]);

module.exports = {
  ALLOWED_PAN_EXTENSIONS,
  ALLOWED_PAN_MIME_TYPES,
};
