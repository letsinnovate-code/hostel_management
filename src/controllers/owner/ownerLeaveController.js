/**
 * @file controllers/owner/ownerLeaveController.js
 * @description Owner leave requests controller.
 */

'use strict';

const mongoose = require('mongoose');
const Permission = require('../../models/Permission');
const Hostel = require('../../models/Hostel');
const { assertOwnsHostel, getOwnerHostelIds, getScopedHostelIds } = require('./ownerHelper');
const { sendLeaveNotification, sendLeaveRequestUpdateToStudent } = require('../../utils/notificationService');

exports.getLeaveRequests = async (req, res) => {
  try {
    const { hostelId, status } = req.query;
    const scopedHostelIds = await getScopedHostelIds(req, hostelId);
    if (scopedHostelIds.length === 0) {
      return res.status(200).json({ success: true, data: [] });
    }
    const students = await User.find({ hostelId: { $in: scopedHostelIds }, role: 'student' }).select('_id').lean();
    const studentIds = students.map((s) => s._id);
    if (studentIds.length === 0) {
      return res.status(200).json({ success: true, data: [] });
    }
    const filter = { studentId: { $in: studentIds } };
    if (status) filter.status = status;
    const list = await Permission.find(filter)
      .populate('studentId', 'name email phone')
      .populate('approvedBy', 'name')
      .sort({ createdAt: -1 })
      .lean();
    res.status(200).json({ success: true, data: list });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};


exports.approveLeaveRequest = async (req, res) => {
  try {
    const { permissionId } = req.params;
    const permission = await Permission.findById(permissionId).populate('studentId', 'hostelId pushToken expoPushToken');
    if (!permission) return res.status(404).json({ success: false, message: 'Leave request not found' });
    await assertOwnsHostel(req, permission.studentId?.hostelId);
    permission.status = 'approved';
    permission.approvedBy = req.user.id;
    permission.approvedAt = new Date();
    await permission.save();

    const studentId = permission.studentId._id || permission.studentId;
    const title = 'Leave request approved';
    const message = `Your ${(permission.permissionType || 'leave').replace(/-/g, ' ')} request has been approved.`;
    await Notification.create({
      title,
      message,
      type: 'alert',
      targetAudience: 'staff', // so only recipients see it (not "all" students); recipient is the applicant only
      recipients: [studentId],
      createdBy: req.user.id,
      hostelId: permission.studentId.hostelId,
    });

    setImmediate(() => {
      const student = permission.studentId;
      sendLeaveRequestUpdateToStudent({
        pushToken: student.pushToken,
        expoPushToken: student.expoPushToken,
        approved: true,
        permissionType: permission.permissionType,
        requestedDate: permission.requestedDate ? new Date(permission.requestedDate).toISOString().slice(0, 10) : undefined,
        permissionId: permission._id.toString(),
      }).catch((e) => console.warn('Leave approved push failed:', e.message));
    });

    res.status(200).json({ success: true, data: permission });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};


exports.rejectLeaveRequest = async (req, res) => {
  try {
    const { permissionId } = req.params;
    const { rejectionReason } = req.body;
    const permission = await Permission.findById(permissionId).populate('studentId', 'hostelId pushToken expoPushToken');
    if (!permission) return res.status(404).json({ success: false, message: 'Leave request not found' });
    await assertOwnsHostel(req, permission.studentId?.hostelId);
    permission.status = 'rejected';
    permission.approvedBy = req.user.id;
    permission.approvedAt = new Date();
    permission.rejectionReason = rejectionReason || '';
    await permission.save();

    const studentId = permission.studentId._id || permission.studentId;
    const reason = rejectionReason || '';
    const title = 'Leave request not approved';
    const message = `Your ${(permission.permissionType || 'leave').replace(/-/g, ' ')} request was not approved.${reason ? ` Reason: ${reason}` : ''}`;
    await Notification.create({
      title,
      message,
      type: 'alert',
      targetAudience: 'staff', // so only recipients see it (not "all" students); recipient is the applicant only
      recipients: [studentId],
      createdBy: req.user.id,
      hostelId: permission.studentId.hostelId,
    });

    setImmediate(() => {
      const student = permission.studentId;
      sendLeaveRequestUpdateToStudent({
        pushToken: student.pushToken,
        expoPushToken: student.expoPushToken,
        approved: false,
        permissionType: permission.permissionType,
        requestedDate: permission.requestedDate ? new Date(permission.requestedDate).toISOString().slice(0, 10) : undefined,
        rejectionReason: reason,
        permissionId: permission._id.toString(),
      }).catch((e) => console.warn('Leave rejected push failed:', e.message));
    });

    res.status(200).json({ success: true, data: permission });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// ============ MAINTENANCE / ROOM REQUESTS (Owner) ============