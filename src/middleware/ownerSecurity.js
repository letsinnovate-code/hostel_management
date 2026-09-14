/**
 * ownerSecurity.js
 * 
 * Centralized security helper for the owner and multi-tenant controllers.
 * ALL owner data access MUST be scoped to the authenticated owner's hostels only.
 * This prevents cross-owner data leakage — a major security threat to the system.
 */

const Hostel = require('../models/Hostel');

/**
 * Gets the hostels belonging to the authenticated owner.
 * Returns array of hostel ObjectIds.
 * Always use this before querying user/room/payment/etc data.
 */
async function getOwnerHostelIds(req) {
  if (req.user?.role === 'superadmin') {
    const allHostels = await Hostel.find({}).select('_id').lean();
    return allHostels.map((h) => h._id);
  }
  if (req.user?.role === 'warden') {
    const wardenHostelId = req.user?.hostelId || req.user?.hostel;
    return wardenHostelId ? [wardenHostelId] : [];
  }
  const ownerId = req.user?._id || req.user?.id;
  if (!ownerId) return [];
  const hostels = await Hostel.find({ ownerId }).select('_id').lean();
  return hostels.map((h) => h._id);
}

/**
 * Validates that a given hostelId belongs to the authenticated owner (or warden's hostel).
 * Returns the hostel if valid, throws 403/404 error object if not.
 * If user is superadmin, allows access.
 */
async function assertOwnsHostel(req, hostelId) {
  if (!hostelId) {
    const err = new Error('Hostel ID is required');
    err.statusCode = 400;
    throw err;
  }
  const hostel = await Hostel.findById(hostelId).select('ownerId name').lean();
  if (!hostel) {
    const err = new Error('Hostel not found');
    err.statusCode = 404;
    throw err;
  }
  const userRole = req.user?.role;
  const userRoles = Array.isArray(userRole)
    ? userRole
    : (req.user?.roles && Array.isArray(req.user.roles) ? [userRole, ...req.user.roles] : [userRole]);
  const isSuperadmin = userRoles.includes('superadmin');
  const isWarden = userRoles.includes('warden') || userRoles.includes('supervisor');

  if (isSuperadmin) {
    return hostel;
  }
  if (isWarden) {
    const wardenHostelId = req.user?.hostelId || req.user?.hostel;
    if (String(wardenHostelId) === String(hostelId)) {
      return hostel;
    }
    const err = new Error('Not authorized to access this hostel');
    err.statusCode = 403;
    throw err;
  }
  const ownerId = req.user?._id || req.user?.id;
  if (String(hostel.ownerId) !== String(ownerId)) {
    const err = new Error('Not authorized to access this hostel');
    err.statusCode = 403;
    throw err;
  }
  return hostel;
}

/**
 * Validates that a given resource's hostelId belongs to the authenticated owner.
 */
async function assertHostelIdBelongsToOwner(req, hostelId) {
  return assertOwnsHostel(req, hostelId);
}

/**
 * Gets scoped hostel IDs for queries.
 * If requestedHostelId is provided, validates ownership and returns [requestedHostelId].
 * If not provided, returns all hostel IDs owned by the authenticated owner (or [] if none).
 */
async function getScopedHostelIds(req, requestedHostelId) {
  if (requestedHostelId) {
    await assertOwnsHostel(req, requestedHostelId);
    return [requestedHostelId];
  }
  return await getOwnerHostelIds(req);
}

module.exports = {
  getOwnerHostelIds,
  assertOwnsHostel,
  assertHostelIdBelongsToOwner,
  getScopedHostelIds,
};

