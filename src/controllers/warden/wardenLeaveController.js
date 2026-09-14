/**
 * @file controllers/warden/wardenLeaveController.js
 * @description Warden leave applications and permission workflow controller.
 */

'use strict';

const mongoose = require('mongoose');
const User = require('../../models/User');
const Permission = require('../../models/Permission');
const LeaveViolation = require('../../modules/alert/models/LeaveViolation');
const { hostelEventEmitter } = require('../../modules/alert');
const { ALERT_TYPES } = require('../../modules/alert/utils/constants');
const { getBusinessDateString } = require('../../services/timezoneService');
const PermissionService = require('../../services/permissionService');
const { PERMISSION_STATUS } = require('../../constants');
const { parsePagination, buildPaginationMetadata } = require('../../utils/pagination');
const { resolveWardenHostelId } = require('./wardenHelper');

exports.getLeaveApplications = async (req, res) => {
  try {
    const targetHostelId = await resolveWardenHostelId(req);
    if (!targetHostelId) {
      return res.status(200).json({
        success: true,
        data: [],
        stats: { total: 0, pending: 0, approved: 0, checkedOut: 0, overdue: 0, returned: 0, rejected: 0, cancelled: 0 },
        pagination: { total: 0, page: 1, limit: 20, totalPages: 1 },
      });
    }

    const {
      search,
      status,
      permissionType,
      startDate,
      endDate,
      floor,
      room,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      page = 1,
      limit = 20,
    } = req.query;

    const { page: pageNum, limit: limitNum, skip } = parsePagination(req.query, { defaultLimit: 20, maxLimit: 100 });

    const hasStudentFilter = Boolean(
      (search && search.trim()) ||
      (floor !== undefined && floor !== '' && floor !== 'all') ||
      (room && room !== 'all')
    );

    let filter = { hostelId: targetHostelId };
    let statsQuery = { hostelId: targetHostelId };

    if (hasStudentFilter) {
      // Query students only when filtering by student name, ID, phone, floor, or room
      const studentFilter = { hostelId: targetHostelId, role: 'student' };
      const studentsInHostel = await User.find(studentFilter)
        .select('_id name studentId phone roomId course')
        .populate('roomId', 'roomNumber floorNumber')
        .lean();

      const studentMap = {};
      studentsInHostel.forEach((s) => {
        studentMap[s._id.toString()] = s;
      });

      let allowedStudentIds = Object.keys(studentMap);

      // Apply search filter on student name, studentId, phone, room, or floor
      if (search && search.trim()) {
        const q = search.trim().toLowerCase();
        allowedStudentIds = allowedStudentIds.filter((sId) => {
          const s = studentMap[sId];
          if (!s) return false;
          const nameMatch = (s.name || '').toLowerCase().includes(q);
          const idMatch = (s.studentId || '').toLowerCase().includes(q);
          const phoneMatch = (s.phone || '').includes(q);
          const roomMatch = (s.roomId?.roomNumber || '').toLowerCase().includes(q);
          return nameMatch || idMatch || phoneMatch || roomMatch;
        });
      }

      // Floor filter
      if (floor !== undefined && floor !== '' && floor !== 'all') {
        const fNum = parseInt(floor, 10);
        allowedStudentIds = allowedStudentIds.filter((sId) => {
          const s = studentMap[sId];
          return s?.roomId?.floorNumber === fNum;
        });
      }

      // Room filter
      if (room && room !== 'all') {
        allowedStudentIds = allowedStudentIds.filter((sId) => {
          const s = studentMap[sId];
          return s?.roomId?.roomNumber === room || s?.roomId?._id?.toString() === room;
        });
      }

      if (allowedStudentIds.length === 0) {
        return res.status(200).json({
          success: true,
          data: [],
          stats: { total: 0, pending: 0, approved: 0, checkedOut: 0, overdue: 0, returned: 0, rejected: 0, cancelled: 0 },
          pagination: { total: 0, page: pageNum, limit: limitNum, totalPages: 0 },
        });
      }

      filter = { studentId: { $in: allowedStudentIds } };
      statsQuery = { studentId: { $in: allowedStudentIds } };
    }

    const now = new Date();

    // Status filter
    if (status && status !== 'all') {
      if (status === 'overdue') {
        filter.status = 'checked-out';
        filter.returnDate = { $lt: now };
      } else {
        filter.status = status;
      }
    }

    // Permission Type filter
    if (permissionType && permissionType !== 'all') {
      filter.permissionType = permissionType;
    }

    // Date range filter
    if (startDate && endDate) {
      const sDate = new Date(startDate);
      const eDate = new Date(endDate);
      eDate.setHours(23, 59, 59, 999);
      filter.requestedDate = { $lte: eDate };
      filter.$or = [
        { returnDate: { $gte: sDate } },
        { returnDate: null },
      ];
    } else if (startDate) {
      filter.requestedDate = { $gte: new Date(startDate) };
    } else if (endDate) {
      const eDate = new Date(endDate);
      eDate.setHours(23, 59, 59, 999);
      filter.requestedDate = { $lte: eDate };
    }

    // Sorting
    const sortObj = {};
    if (sortBy === 'returnDate') {
      sortObj.returnDate = sortOrder === 'asc' ? 1 : -1;
    } else if (sortBy === 'requestedDate') {
      sortObj.requestedDate = sortOrder === 'asc' ? 1 : -1;
    } else {
      sortObj.createdAt = sortOrder === 'asc' ? 1 : -1;
    }

    const [{ permissions, total }, allHostelLeaves] = await Promise.all([
      PermissionService.listPermissions({
        filter,
        skip,
        limit: limitNum,
        sort: sortObj,
        populate: [
          {
            path: 'studentId',
            select: 'name email phone studentId roomId gender course year profileImage parentContact emergencyContact status',
            populate: { path: 'roomId', select: 'roomNumber floorNumber' },
          },
          { path: 'approvedBy', select: 'name role' },
          { path: 'cancelledBy', select: 'name role' },
        ],
        lean: true,
      }),
      Permission.find(statsQuery).select('status returnDate requestedDate').lean(),
    ]);

    let pendingCount = 0;
    let approvedCount = 0;
    let checkedOutCount = 0;
    let overdueCount = 0;
    let returnedCount = 0;
    let rejectedCount = 0;
    let cancelledCount = 0;

    allHostelLeaves.forEach((l) => {
      if (l.status === 'pending') pendingCount++;
      else if (l.status === 'approved') approvedCount++;
      else if (l.status === 'checked-out') {
        checkedOutCount++;
        if (l.returnDate && new Date(l.returnDate) < now) {
          overdueCount++;
        }
      } else if (l.status === 'returned') returnedCount++;
      else if (l.status === 'rejected') rejectedCount++;
      else if (l.status === 'cancelled') cancelledCount++;
    });

    const enhancedData = permissions.map((p) => {
      let isOverdue = false;
      let hoursOverdue = 0;

      if (p.status === 'checked-out' && p.returnDate && new Date(p.returnDate) < now) {
        isOverdue = true;
        const diffMs = now.getTime() - new Date(p.returnDate).getTime();
        hoursOverdue = Math.max(1, Math.round(diffMs / (1000 * 60 * 60)));
      }

      return {
        ...p,
        isOverdue,
        hoursOverdue,
      };
    });

    res.status(200).json({
      success: true,
      data: enhancedData,
      stats: {
        total: allHostelLeaves.length,
        pending: pendingCount,
        approved: approvedCount,
        checkedOut: checkedOutCount,
        overdue: overdueCount,
        returned: returnedCount,
        rejected: rejectedCount,
        cancelled: cancelledCount,
      },
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum) || 1,
      },
    });
  } catch (error) {
    console.error('Error fetching leave applications:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

/**
 * Get pending permissions (Backward-compatible alias)
 */
exports.getPendingPermissions = async (req, res) => {
  req.query.status = 'pending';
  return exports.getLeaveApplications(req, res);
};

/**
 * Get students currently absent on leave (checked-out)
 */
exports.getCurrentlyAbsentStudents = async (req, res) => {
  try {
    const targetHostelId = await resolveWardenHostelId(req);
    if (!targetHostelId) {
      return res.status(200).json({ success: true, data: [], count: 0 });
    }

    const students = await User.find({ hostelId: targetHostelId, role: 'student' }).select('_id').lean();
    const studentIds = students.map((s) => s._id);

    const now = new Date();
    const absentLeaves = await Permission.find({
      studentId: { $in: studentIds },
      status: 'checked-out',
    })
      .populate({
        path: 'studentId',
        select: 'name email phone studentId roomId gender course year profileImage parentContact emergencyContact status',
        populate: { path: 'roomId', select: 'roomNumber floorNumber' },
      })
      .populate('approvedBy', 'name role')
      .sort({ returnDate: 1 })
      .lean();

    const formatted = absentLeaves.map((l) => {
      const isOverdue = l.returnDate && new Date(l.returnDate) < now;
      let hoursOverdue = 0;
      if (isOverdue) {
        const diffMs = now.getTime() - new Date(l.returnDate).getTime();
        hoursOverdue = Math.max(1, Math.round(diffMs / (1000 * 60 * 60)));
      }
      return {
        ...l,
        isOverdue,
        hoursOverdue,
      };
    });

    res.status(200).json({
      success: true,
      data: formatted,
      count: formatted.length,
    });
  } catch (error) {
    console.error('Error in getCurrentlyAbsentStudents:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

/**
 * Get overdue leaves (checked-out and returnDate passed)
 */
exports.getOverdueLeaves = async (req, res) => {
  try {
    const targetHostelId = await resolveWardenHostelId(req);
    if (!targetHostelId) {
      return res.status(200).json({ success: true, data: [], count: 0 });
    }

    const students = await User.find({ hostelId: targetHostelId, role: 'student' }).select('_id').lean();
    const studentIds = students.map((s) => s._id);

    const now = new Date();
    const overdueLeaves = await Permission.find({
      studentId: { $in: studentIds },
      status: 'checked-out',
      returnDate: { $lt: now },
    })
      .populate({
        path: 'studentId',
        select: 'name email phone studentId roomId gender course year profileImage parentContact emergencyContact status',
        populate: { path: 'roomId', select: 'roomNumber floorNumber' },
      })
      .populate('approvedBy', 'name role')
      .sort({ returnDate: 1 })
      .lean();

    const formatted = overdueLeaves.map((l) => {
      const diffMs = now.getTime() - new Date(l.returnDate).getTime();
      const hoursOverdue = Math.max(1, Math.round(diffMs / (1000 * 60 * 60)));
      return {
        ...l,
        isOverdue: true,
        hoursOverdue,
      };
    });

    res.status(200).json({
      success: true,
      data: formatted,
      count: formatted.length,
    });
  } catch (error) {
    console.error('Error in getOverdueLeaves:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

/**
 * Approve leave application with validations:
 * - Student belongs to warden's hostel
 * - Date validation (requestedDate <= returnDate)
 * - Overlapping leave prevention (no existing approved/checked-out leave for this student on overlapping dates)
 * - Notification dispatch & AuditLog
 */
exports.approveLeaveApplication = async (req, res) => {
  try {
    const id = req.params.id || req.params.permissionId;
    const { wardenRemarks } = req.body;

    const permission = await PermissionService.getPermissionById(id, { populate: 'studentId' });
    if (!permission) {
      return res.status(404).json({ success: false, message: 'Leave application not found' });
    }

    const targetHostelId = await resolveWardenHostelId(req);
    const student = permission.studentId;
    const studentHostelId = String(student?.hostelId || permission.hostelId || '');

    if (!studentHostelId || studentHostelId !== String(targetHostelId)) {
      return res.status(403).json({ success: false, message: 'Not authorized to approve leaves for another hostel' });
    }

    const updated = await PermissionService.approvePermission(id, {
      user: req.user,
      wardenRemarks,
      ip: req.ip || '',
      userAgent: req.headers?.['user-agent'] || '',
    });

    res.status(200).json({
      success: true,
      data: updated,
      message: 'Leave application approved successfully',
    });
  } catch (error) {
    console.error('Error approving leave:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// Backward-compatible alias
exports.approvePermission = exports.approveLeaveApplication;

/**
 * Reject leave application with mandatory reason
 */
exports.rejectLeaveApplication = async (req, res) => {
  try {
    const id = req.params.id || req.params.permissionId;
    const { rejectionReason, wardenRemarks } = req.body;

    if (!rejectionReason || !String(rejectionReason).trim()) {
      return res.status(400).json({ success: false, message: 'Rejection reason is required' });
    }

    const permission = await PermissionService.getPermissionById(id, { populate: 'studentId' });
    if (!permission) {
      return res.status(404).json({ success: false, message: 'Leave application not found' });
    }

    const targetHostelId = await resolveWardenHostelId(req);
    const student = permission.studentId;
    const studentHostelId = String(student?.hostelId || permission.hostelId || '');

    if (!studentHostelId || studentHostelId !== String(targetHostelId)) {
      return res.status(403).json({ success: false, message: 'Not authorized to reject leaves for another hostel' });
    }

    const updated = await PermissionService.rejectPermission(id, {
      user: req.user,
      rejectionReason,
      wardenRemarks,
      ip: req.ip || '',
      userAgent: req.headers?.['user-agent'] || '',
    });

    res.status(200).json({
      success: true,
      data: updated,
      message: 'Leave application rejected',
    });
  } catch (error) {
    console.error('Error rejecting leave:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// Backward-compatible alias
exports.rejectPermission = exports.rejectLeaveApplication;

/**
 * Cancel or revoke a leave application
 */
exports.cancelLeaveApplication = async (req, res) => {
  try {
    const { id } = req.params;
    const { cancellationReason } = req.body;

    if (!cancellationReason || !String(cancellationReason).trim()) {
      return res.status(400).json({ success: false, message: 'Cancellation reason is required' });
    }

    const permission = await PermissionService.getPermissionById(id, { populate: 'studentId' });
    if (!permission) {
      return res.status(404).json({ success: false, message: 'Leave application not found' });
    }

    const targetHostelId = await resolveWardenHostelId(req);
    const student = permission.studentId;
    const studentHostelId = String(student?.hostelId || permission.hostelId || '');

    if (!studentHostelId || studentHostelId !== String(targetHostelId)) {
      return res.status(403).json({ success: false, message: 'Not authorized to cancel leaves for another hostel' });
    }

    const updated = await PermissionService.cancelPermission(id, {
      user: req.user,
      cancellationReason,
      ip: req.ip || '',
      userAgent: req.headers?.['user-agent'] || '',
      isStudent: false,
    });

    res.status(200).json({
      success: true,
      data: updated,
      message: 'Leave application cancelled successfully',
    });
  } catch (error) {
    console.error('Error cancelling leave:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

/**
 * Record student physical departure (Check Out)
 */
exports.recordLeaveCheckOut = async (req, res) => {
  try {
    const { id } = req.params;
    const { actualCheckOutTime, remarks } = req.body;

    const permission = await PermissionService.getPermissionById(id, { populate: 'studentId' });
    if (!permission) {
      return res.status(404).json({ success: false, message: 'Leave application not found' });
    }

    const targetHostelId = await resolveWardenHostelId(req);
    const student = permission.studentId;
    const studentHostelId = String(student?.hostelId || permission.hostelId || '');

    if (!studentHostelId || studentHostelId !== String(targetHostelId)) {
      return res.status(403).json({ success: false, message: 'Not authorized to manage leaves for another hostel' });
    }

    const updated = await PermissionService.recordLeaveCheckOut(id, {
      user: req.user,
      actualCheckOutTime,
      remarks,
      ip: req.ip || '',
      userAgent: req.headers?.['user-agent'] || '',
    });

    res.status(200).json({
      success: true,
      data: updated,
      message: 'Student departure recorded successfully',
    });
  } catch (error) {
    console.error('Error recording leave checkout:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

/**
 * Record student physical arrival back at hostel (Return)
 */
exports.recordLeaveReturn = async (req, res) => {
  try {
    const { id } = req.params;
    const { actualReturnTime, remarks } = req.body;

    const permission = await PermissionService.getPermissionById(id, { populate: 'studentId' });
    if (!permission) {
      return res.status(404).json({ success: false, message: 'Leave application not found' });
    }

    const targetHostelId = await resolveWardenHostelId(req);
    const student = permission.studentId;
    const studentHostelId = String(student?.hostelId || permission.hostelId || '');

    if (!studentHostelId || studentHostelId !== String(targetHostelId)) {
      return res.status(403).json({ success: false, message: 'Not authorized to manage leaves for another hostel' });
    }

    const updated = await PermissionService.recordLeaveReturn(id, {
      user: req.user,
      actualReturnTime,
      remarks,
      ip: req.ip || '',
      userAgent: req.headers?.['user-agent'] || '',
    });

    const returnTime = actualReturnTime ? new Date(actualReturnTime) : new Date();
    CurfewAutomationService.handleStudentReturn(String(student?._id || permission.studentId), returnTime).catch((err) =>
      console.warn('Curfew auto-resolve (recordLeaveReturn):', err?.message)
    );

    res.status(200).json({
      success: true,
      data: updated,
      message: 'Student return recorded successfully',
    });
  } catch (error) {
    console.error('Error recording leave return:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

/**
 * Get leave history for an individual student
 */
exports.getStudentLeaveHistory = async (req, res) => {
  try {
    const { studentId } = req.params;
    const targetHostelId = await resolveWardenHostelId(req);

    const student = await User.findById(studentId)
      .select('name studentId phone email roomId gender course year profileImage parentContact emergencyContact hostelId')
      .populate('roomId', 'roomNumber floorNumber')
      .lean();

    if (!student || String(student.hostelId) !== String(targetHostelId)) {
      return res.status(404).json({ success: false, message: 'Student not found in this hostel' });
    }

    const leaves = await Permission.find({ studentId: student._id })
      .populate('approvedBy', 'name role')
      .populate('cancelledBy', 'name role')
      .sort({ createdAt: -1 })
      .lean();

    let approvedCount = 0;
    let returnedCount = 0;
    let overdueCount = 0;
    let rejectedCount = 0;
    let cancelledCount = 0;

    const now = new Date();
    const enhancedLeaves = leaves.map((l) => {
      if (l.status === 'approved') approvedCount++;
      else if (l.status === 'returned') {
        returnedCount++;
        if (l.actualReturnTime && l.returnDate && new Date(l.actualReturnTime) > new Date(l.returnDate)) {
          overdueCount++;
        }
      } else if (l.status === 'checked-out') {
        if (l.returnDate && new Date(l.returnDate) < now) {
          overdueCount++;
        }
      } else if (l.status === 'rejected') rejectedCount++;
      else if (l.status === 'cancelled') cancelledCount++;

      const isOverdue =
        (l.status === 'checked-out' && l.returnDate && new Date(l.returnDate) < now) ||
        (l.status === 'returned' && l.actualReturnTime && l.returnDate && new Date(l.actualReturnTime) > new Date(l.returnDate));

      return {
        ...l,
        isOverdue,
      };
    });

    res.status(200).json({
      success: true,
      student,
      stats: {
        total: leaves.length,
        approved: approvedCount,
        returned: returnedCount,
        overdue: overdueCount,
        rejected: rejectedCount,
        cancelled: cancelledCount,
      },
      data: enhancedLeaves,
    });
  } catch (error) {
    console.error('Error in getStudentLeaveHistory:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

/**
 * Update warden remarks on a leave application
 */
exports.updateLeaveRemarks = async (req, res) => {
  try {
    const { id } = req.params;
    const { wardenRemarks } = req.body;

    const permission = await Permission.findById(id);
    if (!permission) {
      return res.status(404).json({ success: false, message: 'Leave application not found' });
    }

    const targetHostelId = await resolveWardenHostelId(req);
    const student = await User.findById(permission.studentId).select('hostelId').lean();
    if (!student || String(student.hostelId) !== String(targetHostelId)) {
      return res.status(403).json({ success: false, message: 'Unauthorized for this hostel' });
    }

    permission.wardenRemarks = String(wardenRemarks || '').trim();
    await permission.save();

    res.status(200).json({
      success: true,
      data: permission,
      message: 'Remarks updated successfully',
    });
  } catch (error) {
    console.error('Error updating leave remarks:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// Delete Permission
exports.deletePermission = async (req, res) => {
  try {
    const id = req.params.id || req.params.permissionId;
    const permission = await Permission.findById(id).populate('studentId', 'hostelId');
    if (!permission) {
      return res.status(404).json({ success: false, message: 'Permission not found' });
    }

    const targetHostelId = await resolveWardenHostelId(req);
    const studentHostelId = String(permission.studentId?.hostelId || '');
    if (!studentHostelId || studentHostelId !== String(targetHostelId)) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete permissions for this hostel' });
    }

    await Permission.findByIdAndDelete(id);
    res.status(200).json({ success: true, message: 'Permission request deleted successfully' });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// ============ INCIDENT REPORTING ============

// Create Incident
