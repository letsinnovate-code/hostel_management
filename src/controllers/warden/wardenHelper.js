/**
 * @file controllers/warden/wardenHelper.js
 * @description Helper functions for warden operations, tenant scoping, and authorization checks.
 */

'use strict';

const mongoose = require('mongoose');
const User = require('../../models/User');
const Hostel = require('../../models/Hostel');
const { assertOwnsHostel, getOwnerHostelIds } = require('../../middleware/ownerSecurity');
const { isSuperadmin: checkSuperadmin, isOwner: checkOwner } = require('../../utils/roleHelper');

/**
 * Resolves the target hostel ID for warden and owner operations.
 * - Wardens are strictly restricted to their assigned hostel (req.user.hostelId).
 * - Owners can specify ?hostelId=xxx (validated by assertOwnsHostel) or default to their owned hostels.
 * - Superadmin can view any requested hostel.
 */
async function resolveWardenHostelId(req) {
  if (checkSuperadmin(req.user)) {
    if (req.query?.hostelId) return String(req.query.hostelId);
    if (req.body?.hostelId) return String(req.body.hostelId);
    const firstHostel = await Hostel.findOne().select('_id').lean();
    return firstHostel ? String(firstHostel._id) : null;
  }

  if (checkOwner(req.user)) {
    const qHostelId = req.query?.hostelId || req.body?.hostelId;
    if (qHostelId) {
      await assertOwnsHostel(req, qHostelId);
      return String(qHostelId);
    }
    const ownerHostels = await getOwnerHostelIds(req);
    return ownerHostels.length > 0 ? String(ownerHostels[0]) : null;
  }

  // Warden role: strictly bound to assigned hostel
  let wardenHostelId = req.user?.hostelId;
  if (!wardenHostelId) {
    const userId = req.user?.id || req.user?._id;
    if (userId && mongoose.isValidObjectId(userId)) {
      const uDoc = await User.findById(userId).select('hostelId').lean();
      if (uDoc?.hostelId) wardenHostelId = uDoc.hostelId;
    }
  }
  return wardenHostelId ? String(wardenHostelId) : null;
}

module.exports = {
  resolveWardenHostelId,
};
