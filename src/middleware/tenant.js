/**
 * @file middleware/tenant.js
 * @description Tenant isolation middleware enforcing strict access boundaries.
 */

'use strict';

const mongoose = require('mongoose');
const { WILDCARD } = require('../config/permissions');
const { getUserRoles } = require('../utils/roleHelper');

/**
 * Ensures the authenticated user has access to the tenant (Hostel) associated with the resource.
 * @param {string} modelName - The Mongoose model name of the resource being accessed (e.g., 'Hostel', 'Student', 'Room').
 * @param {string} paramName - The URL parameter name containing the resource ID (default: 'id').
 * @param {string} hostelIdField - The field on the resource model that contains the hostel ID (default: 'hostelId').
 */
const requireTenantAccess = (modelName, paramName = 'id', hostelIdField = 'hostelId') => {
  return async (req, res, next) => {
    // Superadmin bypass
    if (req.user.permissions && req.user.permissions.includes(WILDCARD)) {
      return next();
    }

    const resourceId = req.params[paramName];
    
    // If no resource ID in URL, we assume it's a global/collection route (e.g. POST /rooms, GET /rooms)
    // We should ensure that any POST/PUT payload or GET query has a valid hostelId context
    if (!resourceId) {
      // In collection routes, controllers should read from req.user.hostelId (for staff) 
      // or validate explicitly for owners. 
      return next(); 
    }

    try {
      let hostelIdToVerify = null;

      if (modelName === 'Hostel') {
         const Hostel = mongoose.model('Hostel');
         const hostel = await Hostel.findById(resourceId).lean();
         if (!hostel) return res.status(404).json({ success: false, message: 'Hostel not found' });
         
         if (getUserRoles(req.user).includes('owner')) {
             if (hostel.ownerId.toString() !== req.user.id.toString()) {
                 return res.status(403).json({ success: false, message: 'Not authorized: Tenant isolation violation. Not your hostel.' });
             }
             req.tenantContext = { hostelId: hostel._id };
             return next();
         }
         hostelIdToVerify = hostel._id.toString();
      } else {
         const Model = mongoose.model(modelName);
         const resource = await Model.findById(resourceId).lean();
         if (!resource) return res.status(404).json({ success: false, message: `${modelName} not found` });
         
         hostelIdToVerify = resource[hostelIdField]?.toString();
         if (!hostelIdToVerify && modelName === 'Visitor' && resource.visitingStudentId) {
           const studentUser = await mongoose.model('User').findById(resource.visitingStudentId).lean();
           hostelIdToVerify = studentUser?.hostelId?.toString();
         }
      }

      if (!hostelIdToVerify) {
          return res.status(403).json({ success: false, message: 'Not authorized: Resource has no tenant boundary.' });
      }

      // Owner verification: Owner must own the hostel this resource belongs to
      if (getUserRoles(req.user).includes('owner')) {
         const Hostel = mongoose.model('Hostel');
         const hostel = await Hostel.findById(hostelIdToVerify).lean();
         if (!hostel || hostel.ownerId.toString() !== req.user.id.toString()) {
            return res.status(403).json({ success: false, message: 'Not authorized: Resource belongs to another owner.' });
         }
         req.tenantContext = { hostelId: hostelIdToVerify };
         return next();
      }

      // Staff/Student verification: User's hostelId must match the resource's hostelId
      if (!req.user.hostelId || req.user.hostelId.toString() !== hostelIdToVerify) {
         return res.status(403).json({ success: false, message: 'Not authorized: Cross-tenant access denied.' });
      }

      req.tenantContext = { hostelId: hostelIdToVerify };
      next();
    } catch (err) {
      console.error('[TenantMiddleware] Error:', err);
      return res.status(500).json({ success: false, message: 'Server error during tenant verification.' });
    }
  };
};

module.exports = {
  requireTenantAccess,
};
