const partyWiseTdsService = require('../services/partyWiseTds.service');
const { validatePartyWiseTdsExportBody } = require('../validators/partyWiseTds.validator');
const logger = require('../utils/logger');

async function validatePartyWiseTds(req, res, next) {
  try {
    const purchaseFile = partyWiseTdsService.pickFile(req.files, 'purchaseGoodsFile');
    const payableFile = partyWiseTdsService.pickFile(req.files, 'tdsPayableFile');

    if (!purchaseFile?.buffer) {
      return res.status(400).json({
        success: false,
        detail: 'Missing file field "purchaseGoodsFile"',
        requestId: req.requestId,
      });
    }
    if (!payableFile?.buffer) {
      return res.status(400).json({
        success: false,
        detail: 'Missing file field "tdsPayableFile"',
        requestId: req.requestId,
      });
    }

    logger.info('Party Wise TDS: forwarding to Python', {
      requestId: req.requestId,
      purchaseFile: purchaseFile.originalname,
      payableFile: payableFile.originalname,
    });

    const { data, auditRunId } = await partyWiseTdsService.validatePartyWiseTds(req);
    return res.json({ ...data, auditRunId });
  } catch (err) {
    partyWiseTdsService.notifyPartyWiseTdsFailure(req, err);
    return next(err);
  }
}

async function exportPartyWiseTds(req, res, next) {
  try {
    const parsed = validatePartyWiseTdsExportBody(req.body);
    if (!parsed.ok) {
      return res.status(400).json({
        success: false,
        detail: parsed.detail,
        requestId: req.requestId,
      });
    }

    logger.info('Party Wise TDS export: forwarding to Python', {
      requestId: req.requestId,
      purchaseCount: parsed.purchaseSummary.length,
      payableCount: parsed.payableSummary.length,
    });

    const { buffer, contentDisposition, contentType } = await partyWiseTdsService.exportPartyWiseTds(
      {
        purchaseSummary: parsed.purchaseSummary,
        payableSummary: parsed.payableSummary,
      },
      { requestId: req.requestId }
    );

    if (contentType) res.setHeader('Content-Type', contentType);
    if (contentDisposition) {
      res.setHeader('Content-Disposition', contentDisposition);
    } else {
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="Party_Wise_TDS_Summary.xlsx"'
      );
    }

    return res.send(buffer);
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  validatePartyWiseTds,
  exportPartyWiseTds,
};
