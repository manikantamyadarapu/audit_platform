const express = require('express');
const { verifyAccessToken } = require('../utils/jwt.util');

/**
 * Authentication middleware — verifies short-lived access JWT.
 */
function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: 'Access token required',
      });
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer' || !parts[1]) {
      return res.status(401).json({
        success: false,
        message: 'Access token required',
      });
    }

    const token = parts[1];
    const decoded = verifyAccessToken(token);

    req.user = {
      id: decoded.id,
      userId: decoded.id,
      email: decoded.email,
      role: decoded.role,
    };

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError' || error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token',
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
}

module.exports = {
  authenticate,
  authMiddleware: authenticate,
};
