const pythonClient = require('./pythonClient.service');

/**
 * @param {{ requestId?: string }} [options]
 */
async function getTdsRules(options = {}) {
  return pythonClient.getTdsRules(options);
}

/**
 * @param {object} body
 * @param {{ requestId?: string }} [options]
 */
async function saveTdsRules(body, options = {}) {
  return pythonClient.postTdsRules(body, options);
}

module.exports = { getTdsRules, saveTdsRules };
