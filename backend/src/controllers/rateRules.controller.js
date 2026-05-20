const pythonClient = require('../services/pythonClient.service');
const { getLogger } = require('../utils/logger');

async function getRateRules(req, res, next) {
  try {
    const data = await pythonClient.getRateRules({ requestId: req.requestId });
    res.json(data);
  } catch (err) {
    next(err);
  }
}

async function saveRateRules(req, res, next) {
  try {
    const log = getLogger(req.requestId);
    log.info('Rate rules save: forwarding to Python', { body: req.body });
    const data = await pythonClient.postRateRules(req.body, { requestId: req.requestId });
    res.json(data);
  } catch (err) {
    next(err);
  }
}

module.exports = { getRateRules, saveRateRules };
