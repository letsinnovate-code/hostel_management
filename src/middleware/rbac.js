/**
 * @file middleware/rbac.js
 * @description Permission-Based Access Control middleware.
 */

'use strict';

const { WILDCARD } = require('../config/permissions');

/**
 * Middleware to require specific permissions.
 * @param {string|string[]} requiredPermissions - A single permission or an array of permissions (user must have AT LEAST ONE).
 * @returns {Function} Express middleware function
 */
const requirePermission = (requiredPermissions) => {
  return (req, res, next) => {
    if (!req.user || !req.user.permissions) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: No permissions found for user.',
      });
    }

    const userPermissions = req.user.permissions;

    // Superadmin wildcard check
    if (userPermissions.includes(WILDCARD)) {
      return next();
    }

    const permsToCheck = (Array.isArray(requiredPermissions)
      ? requiredPermissions
      : [requiredPermissions]).filter(Boolean);

    if (permsToCheck.length === 0) {
      return next();
    }

    // Check if user has at least one of the required permissions
    const hasPermission = permsToCheck.some(p => userPermissions.includes(p));

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: `Access denied: Requires permission(s) [${permsToCheck.join(', ')}]`,
      });
    }

    next();
  };
};

module.exports = {
  requirePermission,
};
