const pythonClient = require('./pythonClient.service');

/**
 * Process Form 269 folder upload: forward ledger Excel files to Python.
 *
 * @param {import('express').Request} req
 * @param {Array} inputFiles
 * @returns {Promise<{ data: object, auditRunId: null }>}
 */
async function processForm269(req, inputFiles) {
  const { requestId } = req;
  const data = await pythonClient.postForm269Process(inputFiles, { requestId });
  return { data, auditRunId: null };
}

module.exports = { processForm269 };
