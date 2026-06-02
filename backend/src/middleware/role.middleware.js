/**
 * Role authorization middleware
 * @param {string[]} allowedRoles - Array of allowed roles
 * @returns {Function} Express middleware
 */
function authorize(allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Insufficient permissions.',
      });
    }

    next();
  };
}

module.exports = {
  authorize,
};
