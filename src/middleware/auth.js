const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { normalizeRole, resolveCurrentRole, getUserRoles } = require('../utils/roleHelper');

exports.protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized to access this route' });
  }

  try {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('[AuthMiddleware] CRITICAL: JWT_SECRET environment variable is not defined.');
      return res.status(500).json({ success: false, message: 'Authentication service configuration error' });
    }
    const decoded = jwt.verify(token, jwtSecret);
    // Use .lean() to get raw document from MongoDB so role is always present (even when stored as array)
    const userDoc = await User.findById(decoded.id).select('-password').lean();

    if (!userDoc) {
      return res.status(401).json({ success: false, code: 'USER_NOT_FOUND', message: 'User not found' });
    }

    // Revoked / Inactive user check (TASK 1)
    if (userDoc.status === 'suspended' || userDoc.status === 'exited') {
      return res.status(401).json({
        success: false,
        code: 'ACCOUNT_REVOKED',
        message: 'Your account has been deactivated or suspended. Please contact administration.',
      });
    }

    // Token Version Invalidation check (TASK 1)
    const currentTokenVersion = typeof userDoc.tokenVersion === 'number' ? userDoc.tokenVersion : 0;
    const tokenVersionInJwt = typeof decoded.tokenVersion === 'number' ? decoded.tokenVersion : 0;
    if (tokenVersionInJwt < currentTokenVersion) {
      return res.status(401).json({
        success: false,
        code: 'TOKEN_INVALIDATED',
        message: 'Authentication session has expired or been invalidated. Please log in again.',
      });
    }

    const role = normalizeRole(userDoc.role);
    const rolesArray = Array.isArray(userDoc.roles) ? userDoc.roles : [];

    req.user = {
      ...userDoc,
      role: role ?? userDoc.role,
      roles: rolesArray,
      currentRole: resolveCurrentRole(userDoc),
      id: userDoc._id,
      tokenVersion: currentTokenVersion,
    };
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, code: 'TOKEN_EXPIRED', message: 'Authentication token has expired' });
    }
    return res.status(401).json({ success: false, code: 'UNAUTHORIZED', message: 'Not authorized' });
  }
};

exports.authorize = (...allowedRoles) => {
  return (req, res, next) => {
    const allRoles = getUserRoles(req.user);
    const currentRole = resolveCurrentRole(req.user);

    const hasAllowedRole = allRoles.some((r) => allowedRoles.includes(r));
    const hasCurrent = currentRole && allowedRoles.includes(currentRole);

    if (!hasAllowedRole && !hasCurrent) {
      return res.status(403).json({
        success: false,
        message: `User role ${currentRole || normalizeRole(req.user?.role)} is not authorized to access this route`,
      });
    }
    if (!req.user.currentRole) {
      req.user.currentRole = currentRole;
    }
    next();
  };
};

