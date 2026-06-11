const pythonClient = require('../services/pythonClient.service');
const logger = require('../utils/logger');

async function getDiamondRateRules(req, res, next) {
  try {
    const data = await pythonClient.getDiamondRateRules({ requestId: req.requestId });
    res.json(data);
  } catch (err) {
    next(err);
  }
}

async function saveDiamondRateRules(req, res, next) {
  try {
    logger.info('Diamond rate rules save: forwarding to Python', {
      requestId: req.requestId,
    });
    const data = await pythonClient.postDiamondRateRules(req.body, { requestId: req.requestId });
    res.json(data);
  } catch (err) {
    next(err);
  }
}

module.exports = { getDiamondRateRules, saveDiamondRateRules };
