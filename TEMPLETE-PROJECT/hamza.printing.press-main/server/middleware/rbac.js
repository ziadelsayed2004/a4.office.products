const usersService = require('../modules/users/usersService');

/**
 * Express middleware to check if a user is logged in.
 */
function requireAuth(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication is required to access this resource.'
    });
  }
  next();
}

/**
 * Express middleware to enforce a specific permission.
 */
function checkPermission(requiredPermission) {
  return async (req, res, next) => {
    // 1. Ensure authenticated
    if (!req.session || !req.session.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication is required to access this resource.'
      });
    }

    const userId = req.session.user.id;

    try {
      // 2. Fetch user status and details from database (guard against post-login deactivation)
      const user = await usersService.findById(userId);
      if (!user || user.status !== 'active') {
        // Destroy session immediately
        if (req.session.destroy) {
          req.session.destroy();
        } else {
          req.session.user = null;
        }
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Your account has been deactivated. Please login again.'
        });
      }

      // Update session user info with latest from DB
      req.session.user = {
        id: user.id,
        username: user.username,
        fullName: user.full_name,
        status: user.status
      };

      // 3. Compile permissions
      const permissions = await usersService.getUserPermissions(userId);

      // 4. Validate permission
      const hasPermission = permissions.includes(requiredPermission);

      if (!hasPermission) {
        return res.status(403).json({
          error: 'Forbidden',
          message: `Access denied. You do not have the required permission: '${requiredPermission}'.`,
          requiredPermission
        });
      }

      next();
    } catch (err) {
      console.error(`Error in RBAC middleware checking '${requiredPermission}':`, err);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'An error occurred while validating permissions.'
      });
    }
  };
}

module.exports = {
  requireAuth,
  checkPermission
};
