const jwt = require('jsonwebtoken');

/**
 * Generates a signed JWT for an authenticated user.
 * 
 * Supports both a full User document/object or a string/ObjectId id (for backward compatibility).
 * Claims include:
 * - id: User ID
 * - role: Primary active role
 * - hostelId: Assigned hostel ID (if present)
 * - tokenVersion: Token version counter for revocation/invalidation
 * 
 * Never includes sensitive information (passwords, hashes, etc.).
 *
 * @param {Object|string} userOrId
 * @param {Object} [options]
 * @returns {string} Signed JWT
 */
const generateToken = (userOrId, options = {}) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is missing');
  }

  let payload;
  if (userOrId && typeof userOrId === 'object' && (userOrId._id || userOrId.id)) {
    const rawId = userOrId._id || userOrId.id;
    const role = userOrId.currentRole || (Array.isArray(userOrId.role) ? userOrId.role[0] : userOrId.role) || 'student';
    const hostelId = userOrId.hostelId ? String(userOrId.hostelId) : null;
    const tokenVersion = typeof userOrId.tokenVersion === 'number' ? userOrId.tokenVersion : 0;

    payload = {
      id: String(rawId),
      role: typeof role === 'string' ? role : String(role || 'student'),
      hostelId,
      tokenVersion,
      ...options.extraClaims,
    };
  } else {
    // Backward compatibility when passed only raw userId
    payload = {
      id: String(userOrId),
      role: options.role || 'student',
      tokenVersion: typeof options.tokenVersion === 'number' ? options.tokenVersion : 0,
      ...options.extraClaims,
    };
  }

  return jwt.sign(payload, secret, {
    expiresIn: options.expiresIn || process.env.JWT_EXPIRE || '7d',
  });
};

module.exports = generateToken;

