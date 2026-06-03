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

    const userRoleUpper = req.user.role?.toUpperCase();
    const allowedRolesUpper = allowedRoles.map(r => r.toUpperCase());
    if (!allowedRolesUpper.includes(userRoleUpper)) {
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
