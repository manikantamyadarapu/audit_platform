const express = require('express');
const grossWeightController = require('../controllers/grossWeight.controller');
const { singlePanFile } = require('../middleware/upload.middleware');
const { REQUEST_BODY_JSON_LIMIT } = require('../config');

const router = express.Router();

/**
 * @swagger
 * /api/v1/process/gross-weight/validate:
 *   post:
 *     summary: Validate gross weight file
 *     tags: [Gross Weight]
 *     security: [bearerAuth: []]
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file: { type: string, format: binary }
 *     responses:
 *       200: { description: Validation successful }
 *       400: { description: Validation error }
 *       401: { description: Unauthorized }
 */
router.post('/validate', singlePanFile, grossWeightController.validate);

/**
 * @swagger
 * /api/v1/process/gross-weight/export-invalid:
 *   post:
 *     summary: Export invalid gross weight rows
 *     tags: [Gross Weight]
 *     security: [bearerAuth: []]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               records: { type: array }
 *     responses:
 *       200: { description: Export successful }
 *       400: { description: Error }
 *       401: { description: Unauthorized }
 */
router.post(
  '/export-invalid',
  express.json({ limit: REQUEST_BODY_JSON_LIMIT }),
  grossWeightController.exportInvalid
);

module.exports = router;
