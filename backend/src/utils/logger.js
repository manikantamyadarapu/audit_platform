function formatMessage(level, message, meta) {
  const ts = new Date().toISOString();
  const base = `[${ts}] [${level}] ${message}`;
  if (meta && Object.keys(meta).length > 0) {
    return `${base} ${JSON.stringify(meta)}`;
  }
  return base;
}

function info(message, meta) {
  // eslint-disable-next-line no-console
  console.log(formatMessage('INFO', message, meta));
}

function warn(message, meta) {
  // eslint-disable-next-line no-console
  console.warn(formatMessage('WARN', message, meta));
}

function error(message, meta) {
  // eslint-disable-next-line no-console
  console.error(formatMessage('ERROR', message, meta));
}

module.exports = { info, warn, error };
