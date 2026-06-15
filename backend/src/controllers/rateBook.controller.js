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
    const data = await pythonClient.postRateBookDiamonds(req.body, { requestId: req.requestId });
    res.json(data);
  } catch (err) {
    next(err);
  }
}

async function getGemstoneRates(req, res, next) {
  try {
    const data = await pythonClient.getRateBookGemstones({ requestId: req.requestId });
    res.json(data);
  } catch (err) {
    next(err);
  }
}

async function saveGemstoneRates(req, res, next) {
  try {
    const data = await pythonClient.postRateBookGemstones(req.body, { requestId: req.requestId });
    res.json(data);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getDiamondRates,
  saveDiamondRates,
  getGemstoneRates,
  saveGemstoneRates,
};
