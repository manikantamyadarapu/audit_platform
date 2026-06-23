const express = require('express');
const { verifyAccessToken } = require('../utils/jwt.util');

/**
 * Attach req.user when a valid Bearer token is present; continue without user otherwise.
 */
function optionalAuth(req, _res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return next();
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer' || !parts[1]) {
    return next();
  }

  try {
    const decoded = verifyAccessToken(parts[1]);
    req.user = {
      id: decoded.id,
      userId: decoded.id,
      email: decoded.email,
      role: decoded.role,
    };
  } catch (_error) {
    // Ignore invalid tokens for optional auth routes.
  }

  return next();
}

module.exports = { optionalAuth };
