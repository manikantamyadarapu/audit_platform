const pythonClient = require('../services/pythonClient.service');
const logger = require('../utils/logger');

async function getTdsRules(req, res, next) {
  try {
    const data = await pythonClient.getTdsRules({ requestId: req.requestId });
    res.json(data);
  } catch (err) {
    next(err);
  }
}

async function saveTdsRules(req, res, next) {
  try {
    logger.info('TDS rules save: forwarding to Python', {
      requestId: req.requestId,
      body: req.body,
    });
    const data = await pythonClient.postTdsRules(req.body, { requestId: req.requestId });
    res.json(data);
  } catch (err) {
    next(err);
  }
}

module.exports = { getTdsRules, saveTdsRules };
