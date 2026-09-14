/**
 * @file controllers/owner/ownerDisciplineController.js
 * @description Owner rules, geofencing, and discipline management controller.
 */

'use strict';

const mongoose = require('mongoose');
const Rule = require('../../models/Rule');
const Violation = require('../../models/Violation');
const GeoFence = require('../../models/GeoFence');
const Hostel = require('../../models/Hostel');
const User = require('../../models/User');
const { assertOwnsHostel, getOwnerHostelIds, getScopedHostelIds } = require('./ownerHelper');
const { validateGeoFenceConfig } = require('../../services/locationValidationService');

exports.createRule = async (req, res) => {
  try {
    const { hostelId, ...ruleData } = req.body;

    if (!hostelId) {
      return res.status(400).json({ success: false, message: 'Hostel ID is required' });
    }

    await assertOwnsHostel(req, hostelId);
    const hostel = await Hostel.findById(hostelId);
    if (!hostel) {
      return res.status(404).json({ success: false, message: 'Hostel not found' });
    }

    // Update hostel rules
    hostel.rules = { ...hostel.rules, ...ruleData };
    await hostel.save();

    // Return with structure expected by frontend
    const ruleResponse = {
      _id: hostel._id, // Use hostel ID as rule ID for mapping
      hostelId: hostel,
      ...hostel.rules.toObject(),
      status: 'active' // Dummy status since embedded doesn't have it
    };

    res.status(201).json({ success: true, data: ruleResponse });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// Get Rules (Fetches from Hostels)

exports.getRules = async (req, res) => {
  try {
    const hostelId = req.params.hostelId || req.query.hostelId;
    const scopedHostelIds = await getScopedHostelIds(req, hostelId);
    if (scopedHostelIds.length === 0) {
      return res.status(200).json({ success: true, count: 0, data: [] });
    }

    const hostels = await Hostel.find({ _id: { $in: scopedHostelIds } }).select('name type address rules');

    // Map hostels to rule objects
    const rules = hostels
      .filter(h => h.rules && Object.keys(h.rules.toObject()).length > 0) // Only return if rules exist
      .map(h => ({
        _id: h._id,
        hostelId: h, // Populate hostel details
        ...h.rules.toObject(),
        status: 'active'
      }));

    res.status(200).json({ success: true, count: rules.length, data: rules });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// Update Rule (Updates Hostel Rules)

exports.updateRule = async (req, res) => {
  try {
    // req.params.id is treated as hostelId here since we map 1:1
    const hostelId = req.params.id;
    const ruleData = req.body;

    await assertOwnsHostel(req, hostelId);
    const hostel = await Hostel.findById(hostelId);
    if (!hostel) {
      return res.status(404).json({ success: false, message: 'Hostel not found' });
    }

    // Update fields
    if (ruleData.hostelId) delete ruleData.hostelId; // Don't update reference

    hostel.rules = { ...hostel.rules.toObject(), ...ruleData };
    await hostel.save();

    const ruleResponse = {
      _id: hostel._id,
      hostelId: hostel,
      ...hostel.rules.toObject(),
      status: 'active'
    };

    res.status(200).json({ success: true, data: ruleResponse });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// Delete Rule (Resets Hostel Rules)

exports.deleteRule = async (req, res) => {
  try {
    const hostelId = req.params.id;
    await assertOwnsHostel(req, hostelId);
    const hostel = await Hostel.findById(hostelId);

    if (!hostel) {
      return res.status(404).json({ success: false, message: 'Hostel/Rules not found' });
    }

    // Reset rules to defaults/empty
    hostel.rules = {
      lateEntryAllowed: false,
      lateEntryFine: 0,
      visitorAllowed: true,
      smokingAllowed: false,
      alcoholAllowed: false,
      petsAllowed: false,
      oppositeGenderAllowed: false,
      customRules: []
    };

    await hostel.save();

    res.status(200).json({ success: true, message: 'Rules reset successfully' });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// ============ USER MANAGEMENT ============

// Create User (Warden, Cleaner, Supervisor)

exports.getRecentViolations = async (req, res) => {
  try {
    const { hostelId, from, to } = req.query;
    const scopedHostelIds = await getScopedHostelIds(req, hostelId);
    if (scopedHostelIds.length === 0) {
      return res.status(200).json({ success: true, data: [] });
    }
    const students = await User.find({ hostelId: { $in: scopedHostelIds }, role: 'student' }).select('_id');
    const studentIds = students.map((s) => s._id);
    if (studentIds.length === 0) {
      return res.status(200).json({ success: true, data: [] });
    }
    const filter = { studentId: { $in: studentIds } };
    if (from || to) {
      filter.createdAt = {};
      if (from) {
        const fromDate = new Date(from);
        fromDate.setHours(0, 0, 0, 0);
        filter.createdAt.$gte = fromDate;
      }
      if (to) {
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = toDate;
      }
    }
    const limit = Math.min(parseInt(req.query.limit, 10) || 200, 500);
    const violations = await Violation.find(filter)
      .populate('studentId', 'name email studentId')
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    res.status(200).json({ success: true, data: violations });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// Violation Heatmap

exports.getViolationHeatmap = async (req, res) => {
  try {
    const { hostelId, startDate, endDate } = req.query;
    const scopedHostelIds = await getScopedHostelIds(req, hostelId);
    if (scopedHostelIds.length === 0) {
      return res.status(200).json({ success: true, data: {} });
    }
    const students = await User.find({ hostelId: { $in: scopedHostelIds }, role: 'student' }).select('_id');
    const studentIds = students.map(s => s._id);
    if (studentIds.length === 0) {
      return res.status(200).json({ success: true, data: {} });
    }
    const filter = { studentId: { $in: studentIds } };
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const violations = await Violation.find(filter)
      .populate('studentId', 'name roomId')
      .populate('ruleId');

    const heatmap = violations.reduce((acc, v) => {
      const key = v.violationType;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    res.status(200).json({ success: true, data: heatmap });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// Monthly Discipline Report

exports.getMonthlyDisciplineReport = async (req, res) => {
  try {
    const { hostelId, month, year } = req.query;
    const scopedHostelIds = await getScopedHostelIds(req, hostelId);
    if (scopedHostelIds.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          violations: 0,
          complaints: 0,
          violationsList: [],
          complaintsList: [],
        },
      });
    }
    const startDate = new Date(year || new Date().getFullYear(), (month || new Date().getMonth()) - 1, 1);
    const endDate = new Date(year || new Date().getFullYear(), month || new Date().getMonth(), 0);

    const students = await User.find({ hostelId: { $in: scopedHostelIds }, role: 'student' }).select('_id');
    const studentIds = students.map(s => s._id);

    const violationFilter = { createdAt: { $gte: startDate, $lte: endDate }, studentId: { $in: studentIds } };
    const complaintFilter = { createdAt: { $gte: startDate, $lte: endDate }, hostelId: { $in: scopedHostelIds } };

    const violations = studentIds.length > 0 ? await Violation.find(violationFilter).populate('studentId', 'name') : [];
    const complaints = await Complaint.find(complaintFilter).populate('raisedBy', 'name');

    res.status(200).json({
      success: true,
      data: {
        violations: violations.length,
        complaints: complaints.length,
        violationsList: violations,
        complaintsList: complaints,
      },
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// ============ NOTIFICATION BROADCAST ============

// Send Notification
// Send Notification/Notice with Email

exports.createCurfewRule = async (req, res) => {
  try {
    const { hostelId, weekday, weekend, specialDays } = req.body;
    await assertOwnsHostel(req, hostelId);
    const rule = await Rule.create({
      hostelId,
      ruleType: 'curfew',
      title: 'Curfew Policy',
      curfewConfig: { weekday, weekend, specialDays: specialDays || [] },
    });
    res.status(201).json({ success: true, data: rule });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};


exports.createLateEntryRule = async (req, res) => {
  try {
    const { hostelId, allowedTimes, fineAmount, maxViolations, escalationAfter } = req.body;
    await assertOwnsHostel(req, hostelId);
    const rule = await Rule.create({
      hostelId,
      ruleType: 'late-entry',
      title: 'Late Entry Policy',
      lateEntryConfig: { allowedTimes, fineAmount, maxViolations, escalationAfter },
    });
    res.status(201).json({ success: true, data: rule });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};


exports.createLeavePolicy = async (req, res) => {
  try {
    const { hostelId, maxLeaveDays, maxConsecutiveDays, requireParentApproval, autoExpiry, expiryDays } = req.body;
    await assertOwnsHostel(req, hostelId);
    const rule = await Rule.create({
      hostelId,
      ruleType: 'leave',
      title: 'Leave Policy',
      leaveConfig: { maxLeaveDays, maxConsecutiveDays, requireParentApproval, autoExpiry, expiryDays },
    });
    res.status(201).json({ success: true, data: rule });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};


exports.createDisciplineMatrix = async (req, res) => {
  try {
    const { hostelId, violationType, actions } = req.body;
    await assertOwnsHostel(req, hostelId);
    const rule = await Rule.create({
      hostelId,
      ruleType: 'discipline',
      title: `Discipline Matrix - ${violationType}`,
      disciplineMatrix: { violationType, actions },
    });
    res.status(201).json({ success: true, data: rule });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};


exports.createGeoFence = async (req, res) => {
  try {
    const { hostelId, name, type, polygon, bounds, center, radius, isActive } = req.body;
    if (!hostelId || !name || !type) {
      return res.status(400).json({ success: false, message: 'hostelId, name and type are required' });
    }
    await assertOwnsHostel(req, hostelId);

    // Issue 24: Validate geometry parameters rigorously
    const geomValidation = validateGeoFenceConfig(type, { center, radius, polygon, bounds });
    if (!geomValidation.valid) {
      return res.status(400).json({ success: false, message: geomValidation.error });
    }

    // Build payload for the single active boundary; clear other-type fields so only one shape is stored
    const setPayload = {
      hostelId,
      name,
      type,
      isActive: isActive !== false,
      ...geomValidation.normalized,
    };
    const unsetPayload = {};
    if (type === 'polygon') {
      unsetPayload.bounds = '';
      unsetPayload.center = '';
      unsetPayload.radius = '';

      // Sync hostel location to center of boundary (centroid of polygon)
      const sumLat = setPayload.polygon.reduce((s, p) => s + p.latitude, 0);
      const sumLng = setPayload.polygon.reduce((s, p) => s + p.longitude, 0);
      const centroidLat = sumLat / setPayload.polygon.length;
      const centroidLng = sumLng / setPayload.polygon.length;
      await Hostel.findByIdAndUpdate(hostelId, {
        $set: {
          'address.coordinates': {
            latitude: centroidLat,
            longitude: centroidLng,
          },
        },
      });
    } else if (type === 'rectangle') {
      unsetPayload.polygon = '';
      unsetPayload.center = '';
      unsetPayload.radius = '';

      const centroidLat = (setPayload.bounds.north + setPayload.bounds.south) / 2;
      const centroidLng = (setPayload.bounds.east + setPayload.bounds.west) / 2;
      await Hostel.findByIdAndUpdate(hostelId, {
        $set: {
          'address.coordinates': {
            latitude: centroidLat,
            longitude: centroidLng,
          },
        },
      });
    } else if (type === 'circle') {
      unsetPayload.polygon = '';
      unsetPayload.bounds = '';

      await Hostel.findByIdAndUpdate(hostelId, {
        $set: {
          'address.coordinates': {
            latitude: setPayload.center.latitude,
            longitude: setPayload.center.longitude,
          },
        },
      });
    }

    // Issue 25: Ensure only one active geo-fence per hostel: deactivate all others
    if (setPayload.isActive) {
      await GeoFence.updateMany({ hostelId }, { $set: { isActive: false } });
    }

    const existing = await GeoFence.findOne({ hostelId });
    let geoFence;
    if (existing) {
      const updateOp = { $set: setPayload };
      if (Object.keys(unsetPayload).length) updateOp.$unset = unsetPayload;
      geoFence = await GeoFence.findByIdAndUpdate(
        existing._id,
        updateOp,
        { new: true, runValidators: true }
      );
      return res.status(200).json({ success: true, data: geoFence });
    }
    geoFence = await GeoFence.create(setPayload);
    res.status(201).json({ success: true, data: geoFence });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};


exports.getGeoFences = async (req, res) => {
  try {
    const hostelId = req.params.hostelId || req.query.hostelId;
    if (!hostelId) {
      return res.status(400).json({ success: false, message: 'Hostel ID is required' });
    }
    await assertOwnsHostel(req, hostelId);
    // Return only the current active boundary (one per hostel)
    const current = await GeoFence.findOne({ hostelId, isActive: true });
    const data = current ? [current] : [];
    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};


exports.updateGeoFence = async (req, res) => {
  try {
    const existing = await GeoFence.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Geo-fence not found' });
    }
    await assertOwnsHostel(req, existing.hostelId);

    const type = req.body.type || existing.type;
    // Issue 24: If geometry fields are being updated, validate them
    if (req.body.type || req.body.center || req.body.radius || req.body.polygon || req.body.bounds) {
      const geomValidation = validateGeoFenceConfig(type, {
        center: req.body.center || existing.center,
        radius: req.body.radius !== undefined ? req.body.radius : existing.radius,
        polygon: req.body.polygon || existing.polygon,
        bounds: req.body.bounds || existing.bounds,
      });
      if (!geomValidation.valid) {
        return res.status(400).json({ success: false, message: geomValidation.error });
      }
      Object.assign(req.body, geomValidation.normalized);
    }

    // Issue 25: If activating this geofence, deactivate all others for this hostel
    if (req.body.isActive === true) {
      await GeoFence.updateMany({ hostelId: existing.hostelId, _id: { $ne: existing._id } }, { $set: { isActive: false } });
    }

    const geoFence = await GeoFence.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    res.status(200).json({ success: true, data: geoFence });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};
