const form269Service = require('../services/form269.service');

async function processForm269(req, res, next) {
  try {
    const inputFiles = req.files?.inputFiles || [];

    if (!inputFiles.length) {
      return res.status(400).json({ error: 'At least one input Excel file is required' });
    }

    const { data, auditRunId } = await form269Service.processForm269(req, inputFiles);
    return res.json({ ...data, auditRunId });
  } catch (err) {
    return next(err);
  }
}

module.exports = { processForm269 };
