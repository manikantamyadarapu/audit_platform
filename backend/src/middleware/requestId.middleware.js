const crypto = require('crypto');

function requestIdMiddleware(req, res, next) {
  const incoming = req.get('x-request-id');
  const id = incoming && String(incoming).trim() ? String(incoming).trim() : crypto.randomUUID();
  req.requestId = id;
  res.setHeader('x-request-id', id);
  next();
}

module.exports = { requestIdMiddleware };
