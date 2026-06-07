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
  limits: { fileSize: UPLOAD_MAX_BYTES, files: 2 },
  fileFilter: panFileFilter,
});

const singlePanFile = upload.single('file');

const singleSalesReturnFile = upload.single('file');

const dualSalesReturnFiles = upload.fields([
  { name: 'salesFile', maxCount: 1 },
  { name: 'salesReturnFile', maxCount: 1 },
]);

module.exports = { singlePanFile, singleSalesReturnFile, dualSalesReturnFiles };
