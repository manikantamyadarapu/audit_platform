const path = require('path');
const multer = require('multer');
const { UPLOAD_MAX_BYTES } = require('../config');
const { ALLOWED_PAN_EXTENSIONS, ALLOWED_PAN_MIME_TYPES } = require('../utils/constants');

const storage = multer.memoryStorage();

function panFileFilter(_req, file, cb) {
  const ext = path.extname(file.originalname || '').toLowerCase();
  const mime = (file.mimetype || '').toLowerCase();

  if (ext && ALLOWED_PAN_EXTENSIONS.has(ext)) {
    return cb(null, true);
  }
  if (mime && ALLOWED_PAN_MIME_TYPES.has(mime)) {
    return cb(null, true);
  }
  const err = new Error(
    `Unsupported file type. Allowed extensions: ${[...ALLOWED_PAN_EXTENSIONS].join(', ')}`
  );
  err.status = 400;
  return cb(err);
}

const upload = multer({
  storage,
  limits: { fileSize: UPLOAD_MAX_BYTES, files: 4 },
  fileFilter: panFileFilter,
});

/** Section 44AB allows many cash/bank ledgers in one request. */
const section44abUpload = multer({
  storage,
  limits: { fileSize: UPLOAD_MAX_BYTES, files: 60 },
  fileFilter: panFileFilter,
});

const singlePanFile = upload.single('file');

const singleSalesReturnFile = upload.single('file');

const singleCashLedgerFile = upload.single('file');

const singleTds01File = upload.single('file');

const dualSalesReturnFiles = upload.fields([
  { name: 'salesFile', maxCount: 1 },
  { name: 'salesReturnFile', maxCount: 1 },
]);

const dualPartyWiseTdsFiles = upload.fields([
  { name: 'purchaseGoodsFile', maxCount: 1 },
  { name: 'tdsPayableFile', maxCount: 1 },
]);

const section44abFiles = section44abUpload.fields([
  { name: 'cashFiles', maxCount: 10 },
  { name: 'bankFiles', maxCount: 50 },
]);

const financialsPivotFiles = upload.fields([
  { name: 'salesFile', maxCount: 1 },
  { name: 'purchasesFile', maxCount: 1 },
  { name: 'openingQtyFile', maxCount: 1 },
  { name: 'previousYearFile', maxCount: 1 },
]);

function handleMulterError(err, req, res, next) {
  if (!err) {
    return next();
  }

  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: err.message });
  }

  if (err.status) {
    return res.status(err.status).json({ error: err.message });
  }

  return next(err);
}

module.exports = {
  singlePanFile,
  singleSalesReturnFile,
  singleCashLedgerFile,
  singleTds01File,
  dualSalesReturnFiles,
  dualPartyWiseTdsFiles,
  section44abFiles,
  financialsPivotFiles,
  handleMulterError,
};
