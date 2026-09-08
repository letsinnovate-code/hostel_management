const jwt = require('jsonwebtoken');
const User = require('../models/User');

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
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    const roleRaw = userDoc.role;
    const role = roleRaw != null
      ? (Array.isArray(roleRaw) ? roleRaw[0] : String(roleRaw))
      : null;
    const rolesArray = userDoc.roles && Array.isArray(userDoc.roles) ? userDoc.roles : [];

    req.user = {
      ...userDoc,
      role: role ?? roleRaw,
      roles: rolesArray,
      currentRole: userDoc.currentRole || role || rolesArray[0],
      id: userDoc._id,
    };
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Not authorized' });
  }
};

exports.authorize = (...allowedRoles) => {
  return (req, res, next) => {
    const userRole = req.user?.role;
    const roleStr = userRole != null
      ? (Array.isArray(userRole) ? userRole[0] : String(userRole))
      : null;
    const userRoles = req.user?.roles && Array.isArray(req.user.roles) ? req.user.roles : (Array.isArray(userRole) ? userRole : userRole ? [userRole] : []);
    const currentRole = req.user?.currentRole || roleStr || userRoles[0];

    const hasPrimary = roleStr && allowedRoles.includes(roleStr);
    const hasAnyRole = userRoles.some((r) => allowedRoles.includes(r));
    const hasCurrent = currentRole && allowedRoles.includes(currentRole);

    if (!hasPrimary && !hasAnyRole && !hasCurrent) {
      return res.status(403).json({
        success: false,
        message: `User role ${currentRole || roleStr || userRole} is not authorized to access this route`,
      });
    }
    if (!req.user.currentRole) {
      req.user.currentRole = currentRole;
    }
    next();
  };
};

