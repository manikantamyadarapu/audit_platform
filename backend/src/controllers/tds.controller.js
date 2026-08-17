const tdsService = require('../services/tds.service');
const { validateTdsRulesBody } = require('../validators/tds.validator');
const logger = require('../utils/logger');

async function getTdsRules(req, res, next) {
  try {
    const data = await tdsService.getTdsRules({ requestId: req.requestId });
    res.json(data);
  } catch (err) {
    next(err);
  }
}

async function saveTdsRules(req, res, next) {
  try {
    const parsed = validateTdsRulesBody(req.body);
    if (!parsed.ok) {
      return res.status(400).json({
        success: false,
        detail: parsed.detail,
        requestId: req.requestId,
      });
    }

    logger.info('TDS rules save: forwarding to Python', {
      requestId: req.requestId,
      body: req.body,
    });
    const data = await tdsService.saveTdsRules(parsed.body, { requestId: req.requestId });
    res.json(data);
  } catch (err) {
    next(err);
  }
}

module.exports = { getTdsRules, saveTdsRules };
