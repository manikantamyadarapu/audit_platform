const pythonClient = require('../services/pythonClient.service');

async function getDiamondRates(req, res, next) {
  try {
    const data = await pythonClient.getRateBookDiamonds({ requestId: req.requestId });
    res.json(data);
  } catch (err) {
    next(err);
  }
}

async function saveDiamondRates(req, res, next) {
  try {
    const data = await pythonClient.saveRateBookDiamonds(req.body, { requestId: req.requestId });
    res.json(data);
  } catch (err) {
    next(err);
  }
}

module.exports = { getDiamondRates, saveDiamondRates };
