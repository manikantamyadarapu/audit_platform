const pythonClient = require('../services/pythonClient.service');
const logger = require('../utils/logger');

async function validate(req, res, next) {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({
        success: false,
        detail: 'Missing file field "file"',
        requestId: req.requestId,
      });
    }

    logger.info('Gross weight: forwarding to Python', {
      requestId: req.requestId,
      filename: req.file.originalname,
      size: req.file.size,
    });

    const data = await pythonClient.postGrossWeightValidate(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      { requestId: req.requestId }
    );
    return res.json(data);
  } catch (err) {
    return next(err);
  }
}

module.exports = { validate };
