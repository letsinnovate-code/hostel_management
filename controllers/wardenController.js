const User = require('../models/User');
const Attendance = require('../models/Attendance');
const Permission = require('../models/Permission');
const Violation = require('../models/Violation');
const Complaint = require('../models/Complaint');
const Visitor = require('../models/Visitor');
const Emergency = require('../models/Emergency');
const Rule = require('../models/Rule');
// Alert module — CurfewViolation is the authoritative source for automated violations
const CurfewViolation = require('../modules/alert/models/CurfewViolation');
const CurfewAutomationService = require('../modules/alert/services/CurfewAutomationService');
const { sendViolationPushToStudent } = require('../utils/notificationService');
const { logGateEvent } = require('../utils/gateEventService');
const Hostel = require('../models/Hostel');
const Notification = require('../models/Notification');
const HostelAlertService = require('../modules/alert/services/HostelAlertService');
const { emitToUser, emitToRole } = require('../modules/alert/socket/alertSocket');
// Alert & Automation Module — event-driven integration
const { hostelEventEmitter } = require('../modules/alert');
const { ALERT_TYPES } = require('../modules/alert/utils/constants');
const { assertOwnsHostel, getOwnerHostelIds } = require('../middleware/ownerSecurity');

/**
 * Helper: Resolves the target hostel ID for warden and owner operations.
 * - Wardens are strictly restricted to their assigned hostel (req.user.hostelId).
 * - Owners can specify ?hostelId=xxx (validated by assertOwnsHostel) or default to their owned hostels.
 * - Superadmin can view any requested hostel.
 */
async function resolveWardenHostelId(req) {
  const role = req.user?.role;
  const roleStr = typeof role === 'string' ? role : Array.isArray(role) ? role[0] : '';
  const isOwner = roleStr === 'owner' || (Array.isArray(role) && role.includes('owner'));
  const isSuperadmin = roleStr === 'superadmin' || (Array.isArray(role) && role.includes('superadmin'));

  if (isSuperadmin) {
    if (req.query?.hostelId) return String(req.query.hostelId);
    if (req.body?.hostelId) return String(req.body.hostelId);
    const firstHostel = await Hostel.findOne().select('_id').lean();
    return firstHostel ? String(firstHostel._id) : null;
  }

  if (isOwner) {
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
    const uDoc = await User.findById(req.user.id || req.user._id).select('hostelId').lean();
    if (uDoc?.hostelId) wardenHostelId = uDoc.hostelId;
  }
  return wardenHostelId ? String(wardenHostelId) : null;
}

// ============ LIVE DASHBOARD ============

// Get Live Dashboard
exports.getDashboard = async (req, res) => {
  try {
    const targetHostelId = await resolveWardenHostelId(req);
    if (!targetHostelId) {
      return res.status(200).json({
        success: true,
        data: {
          summary: { totalStudents: 0, inside: 0, outside: 0, pending: 0 },
          attendance: { inside: [], outside: [], pending: [] },
          pendingPermissions: 0,
          activeViolations: 0,
          pendingVisitors: 0,
          permissions: [],
          violations: [],
          visitors: [],
          curfewStatus: {
            curfewTime: '21:00',
            curfewEndTime: '06:00',
            isCurfewActive: false,
            isManualCurfewActive: false,
          },
        },
      });
    }

    const filter = { hostelId: targetHostelId };

    const students = await User.find({ ...filter, role: 'student' });
    const studentIds = students.map(s => s._id);

    const attendance = await Attendance.find({
      studentId: { $in: studentIds },
      date: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
    }).populate('studentId', 'name roomId status');

    const inside = attendance.filter(a => a.status === 'inside');
    const outside = attendance.filter(a => a.status === 'outside');
    const pending = attendance.filter(a => a.status === 'pending');

    const pendingPermissions = await Permission.find({
      status: 'pending',
      studentId: { $in: studentIds },
    }).populate('studentId', 'name roomId phone studentId').sort({ createdAt: -1 });

    const activeDisciplinary = await Violation.find({
      status: 'pending',
      studentId: { $in: studentIds },
    }).populate('studentId', 'name roomId phone').sort({ createdAt: -1 }).lean();

    const activeCurfew = await CurfewViolation.find({
      hostelId: targetHostelId,
      status: { $in: ['open', 'pending_recheck'] },
    }).populate('studentId', 'name roomId phone studentId').sort({ createdAt: -1 }).lean();

    const combinedViolations = [
      ...activeCurfew.map((cv) => ({
        ...cv,
        violationType: 'curfew',
        description: `Curfew breach (${cv.curfewTime || 'overnight'}) - ${cv.status === 'pending_recheck' ? 'In Grace Period' : 'Open Violation'}`,
        isCurfew: true,
      })),
      ...activeDisciplinary.map((dv) => ({
        ...dv,
        isCurfew: false,
      })),
    ];

    const pendingVisitors = await Visitor.find({
      visitingStudentId: { $in: studentIds },
      status: 'pending',
    }).populate('visitingStudentId', 'name roomId phone').sort({ createdAt: -1 });

    // Curfew status
    const hostelDoc = await Hostel.findById(targetHostelId).select('rules name').lean();
    const now = new Date();
    const isWeekend = [0, 6].includes(now.getDay());
    const curfewTimeStr = (isWeekend && hostelDoc?.rules?.weekendCurfewTime) || hostelDoc?.rules?.curfewTime || '21:00';
    const curfewEndTimeStr = hostelDoc?.rules?.curfewEndTime || '06:00';
    const isManualActive = Boolean(hostelDoc?.rules?.isManualCurfewActive);
    const isCurfewActive = CurfewAutomationService.isCurfewActive(
      curfewTimeStr,
      now,
      curfewEndTimeStr,
      isManualActive,
      hostelDoc?.rules?.manualCurfewEndedAt,
      hostelDoc?.rules?.manualCurfewStartedAt
    );

    res.status(200).json({
      success: true,
      data: {
        summary: {
          totalStudents: students.length,
          inside: inside.length,
          outside: outside.length,
          pending: pending.length,
        },
        attendance: {
          inside,
          outside,
          pending,
        },
        pendingPermissions: pendingPermissions.length,
        activeViolations: combinedViolations.length,
        pendingVisitors: pendingVisitors.length,
        permissions: pendingPermissions,
        violations: combinedViolations,
        visitors: pendingVisitors,
        curfewStatus: {
          curfewTime: curfewTimeStr,
          curfewEndTime: curfewEndTimeStr,
          weekendCurfewTime: hostelDoc?.rules?.weekendCurfewTime || '',
          gracePeriodMinutes: hostelDoc?.rules?.gracePeriodMinutes || 15,
          isCurfewActive,
          isManualCurfewActive: isManualActive,
          manualCurfewEndedAt: hostelDoc?.rules?.manualCurfewEndedAt || null,
          manualCurfewStartedAt: hostelDoc?.rules?.manualCurfewStartedAt || null,
          lastCurfewSweepDate: hostelDoc?.rules?.lastCurfewSweepDate || null,
          curfewAlertConfig: hostelDoc?.rules?.curfewAlertConfig || null,
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============ CURFEW MONITORING ============

// Get Curfew Violations
// Reads from CurfewViolation (alert module) — the authoritative collection for automated
// curfew detection. Also merges any legacy Violation records tagged violationType:'curfew'
// so older data is not lost.
exports.getCurfewViolations = async (req, res) => {
  try {
    const { date, status } = req.query;
    const targetHostelId = await resolveWardenHostelId(req);
    if (!targetHostelId) {
      return res.status(200).json({ success: true, data: [], meta: { total: 0, automated: 0, legacy: 0 } });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const filterDate = date ? new Date(date) : today;
    filterDate.setHours(0, 0, 0, 0);
    const nextDay = new Date(filterDate);
    nextDay.setDate(nextDay.getDate() + 1);

    // Build query for CurfewViolation (alert module — primary source)
    const cvQuery = {
      hostelId: targetHostelId,
      violationDate: { $gte: filterDate, $lt: nextDay },
    };
    if (status && status !== 'all') cvQuery.status = status;

    // Primary: automated CurfewViolation records from alert engine
    const automatedViolations = await CurfewViolation.find(cvQuery)
      .populate('studentId', 'name roomId studentId phone')
      .populate('roomId', 'roomNumber')
      .sort({ violationDate: -1 })
      .lean();

    // Secondary: legacy Violation records tagged as 'curfew' (manual or pre-alert-module)
    // Only include those not already represented in automatedViolations (by studentId + day)
    const automatedStudentIds = new Set(
      automatedViolations.map((v) => String(v.studentId?._id ?? v.studentId))
    );

    const legacyViolations = await Violation.find({
      violationType: 'curfew',
      createdAt: { $gte: filterDate, $lt: nextDay },
    })
      .populate('studentId', 'name roomId studentId phone')
      .sort({ createdAt: -1 })
      .lean();

    // Only include legacy records for students not already in automated list
    const deduplicatedLegacy = legacyViolations.filter(
      (v) => !automatedStudentIds.has(String(v.studentId?._id ?? v.studentId))
    ).map((v) => ({
      ...v,
      _source: 'legacy',        // mark so frontend can differentiate if needed
      violationDate: v.createdAt,
      curfewTime: '22:00',       // unknown for legacy records — use sensible default
      attendanceStatus: 'outside',
    }));

    const combined = [...automatedViolations, ...deduplicatedLegacy].sort(
      (a, b) => new Date(b.violationDate).getTime() - new Date(a.violationDate).getTime()
    );

    res.status(200).json({
      success: true,
      data: combined,
      meta: {
        total: combined.length,
        automated: automatedViolations.length,
        legacy: deduplicatedLegacy.length,
        date: filterDate.toISOString().split('T')[0],
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============ PRESENCE VERIFICATION ============

// Trigger Manual Check
exports.triggerManualCheck = async (req, res) => {
  try {
    const { studentId } = req.body;
    const attendance = await Attendance.findOne({
      studentId,
      date: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
    }).sort({ createdAt: -1 });

    if (!attendance) {
      return res.status(404).json({ success: false, message: 'No attendance record found' });
    }

    attendance.status = 'pending';
    attendance.verificationMethod = 'manual';
    await attendance.save();

    res.status(200).json({ success: true, data: attendance });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Verify Presence
exports.verifyPresence = async (req, res) => {
  try {
    const { attendanceId, status } = req.body;
    const attendance = await Attendance.findById(attendanceId);
    if (!attendance) {
      return res.status(404).json({ success: false, message: 'Attendance not found' });
    }

    attendance.status = status;
    attendance.verifiedBy = req.user.id;
    attendance.verificationMethod = 'manual';
    const eventTime = new Date();
    if (status === 'inside') {
      attendance.checkInTime = eventTime;
    } else {
      attendance.checkOutTime = eventTime;
    }
    await attendance.save();

    await logGateEvent({
      studentId: attendance.studentId,
      hostelId: attendance.hostelId,
      type: status === 'inside' ? 'in' : 'out',
      time: eventTime,
      verificationMethod: 'manual',
      attendanceId: attendance._id,
      source: 'warden',
    }).catch((err) => console.warn('GateEvent log (warden):', err?.message));

    if (status === 'inside') {
      CurfewAutomationService.handleStudentReturn(String(attendance.studentId), eventTime).catch((err) =>
        console.warn('Curfew auto-resolve (warden):', err?.message)
      );
    }

    res.status(200).json({ success: true, data: attendance });

    // ✅ Alert Module: emit gate event so automation detects late check-in / occupancy change
    if (status === 'inside') {
      hostelEventEmitter.emit(hostelEventEmitter.EVENTS.CHECKIN, {
        studentId: String(attendance.studentId),
        hostelId: String(attendance.hostelId),
        time: eventTime,
        source: 'warden',
      });
    } else {
      hostelEventEmitter.emit(hostelEventEmitter.EVENTS.CHECKOUT, {
        studentId: String(attendance.studentId),
        hostelId: String(attendance.hostelId),
        time: eventTime,
        source: 'warden',
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============ PERMISSION MANAGEMENT ============

// Get Pending Permissions
exports.getPendingPermissions = async (req, res) => {
  try {
    const targetHostelId = await resolveWardenHostelId(req);
    if (!targetHostelId) {
      return res.status(200).json({ success: true, data: [] });
    }

    const students = await User.find({ hostelId: targetHostelId, role: 'student' }).select('_id').lean();
    const studentIds = students.map((s) => s._id);

    const permissions = await Permission.find({
      status: 'pending',
      studentId: { $in: studentIds },
    })
      .populate('studentId', 'name roomId phone hostelId')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, data: permissions });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// Approve Permission
exports.approvePermission = async (req, res) => {
  try {
    const { permissionId } = req.params;
    const permission = await Permission.findById(permissionId).populate('studentId', 'hostelId');
    if (!permission) {
      return res.status(404).json({ success: false, message: 'Permission not found' });
    }

    const targetHostelId = await resolveWardenHostelId(req);
    const studentHostelId = String(permission.studentId?.hostelId || '');
    if (!studentHostelId || studentHostelId !== String(targetHostelId)) {
      return res.status(403).json({ success: false, message: 'Not authorized to manage permissions for this hostel' });
    }

    permission.status = 'approved';
    permission.approvedBy = req.user.id;
    permission.approvedAt = new Date();
    await permission.save();

    res.status(200).json({ success: true, data: permission });

    // ✅ Alert Module: send approval notification to student
    hostelEventEmitter.emit(ALERT_TYPES.LEAVE_APPROVED, {
      studentId: String(permission.studentId._id || permission.studentId),
      hostelId: targetHostelId,
      permissionId: String(permission._id),
      returnDate: permission.returnDate,
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// Reject Permission
exports.rejectPermission = async (req, res) => {
  try {
    const { permissionId } = req.params;
    const { rejectionReason } = req.body;
    const permission = await Permission.findById(permissionId).populate('studentId', 'hostelId');
    if (!permission) {
      return res.status(404).json({ success: false, message: 'Permission not found' });
    }

    const targetHostelId = await resolveWardenHostelId(req);
    const studentHostelId = String(permission.studentId?.hostelId || '');
    if (!studentHostelId || studentHostelId !== String(targetHostelId)) {
      return res.status(403).json({ success: false, message: 'Not authorized to manage permissions for this hostel' });
    }

    permission.status = 'rejected';
    permission.approvedBy = req.user.id;
    permission.approvedAt = new Date();
    permission.rejectionReason = rejectionReason;
    await permission.save();

    res.status(200).json({ success: true, data: permission });

    // ✅ Alert Module: send rejection notification to student
    hostelEventEmitter.emit(ALERT_TYPES.LEAVE_REJECTED, {
      studentId: String(permission.studentId._id || permission.studentId),
      hostelId: targetHostelId,
      permissionId: String(permission._id),
      reason: rejectionReason,
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// Delete Permission
exports.deletePermission = async (req, res) => {
  try {
    const { permissionId } = req.params;
    const permission = await Permission.findById(permissionId).populate('studentId', 'hostelId');
    if (!permission) {
      return res.status(404).json({ success: false, message: 'Permission not found' });
    }

    const targetHostelId = await resolveWardenHostelId(req);
    const studentHostelId = String(permission.studentId?.hostelId || '');
    if (!studentHostelId || studentHostelId !== String(targetHostelId)) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete permissions for this hostel' });
    }

    await Permission.findByIdAndDelete(permissionId);
    res.status(200).json({ success: true, message: 'Permission request deleted successfully' });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// ============ INCIDENT REPORTING ============

// Create Incident
exports.createIncident = async (req, res) => {
  try {
    const incident = await Complaint.create({
      ...req.body,
      raisedBy: req.user.id,
      complaintType: 'safety',
      priority: 'high',
    });
    res.status(201).json({ success: true, data: incident });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get Incidents
exports.getIncidents = async (req, res) => {
  try {
    const targetHostelId = await resolveWardenHostelId(req);
    const filter = { complaintType: 'safety' };
    if (targetHostelId) filter.hostelId = targetHostelId;

    const incidents = await Complaint.find(filter)
      .populate('raisedBy', 'name')
      .populate('assignedTo', 'name')
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: incidents });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// ============ VIOLATION MANAGEMENT ============

// Create Violation
exports.createViolation = async (req, res) => {
  try {
    const targetHostelId = await resolveWardenHostelId(req);
    const violation = await Violation.create({
      ...req.body,
      reportedBy: req.user.id,
      hostelId: targetHostelId || req.body.hostelId,
    });
    const studentId = violation.studentId && (violation.studentId._id || violation.studentId);
    if (studentId) {
      const Notification = require('../models/Notification');
      setImmediate(() => {
        User.findById(studentId).select('hostelId pushToken expoPushToken').lean()
          .then((student) => {
            if (!student) return;
            const timeStr = (violation.createdAt || new Date()).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
            return Notification.create({
              title: 'Violation detected',
              message: `A violation was recorded for you at ${timeStr}. ${(violation.description || '').slice(0, 80)}`.trim(),
              type: 'alert',
              targetAudience: 'staff',
              recipients: [studentId],
              createdBy: req.user.id,
              hostelId: student.hostelId,
            }).catch((err) => console.warn('Violation notification create:', err?.message))
              .then(() => student);
          })
          .then((student) => {
            if (!student) return;
            sendViolationPushToStudent({
              pushToken: student.pushToken,
              expoPushToken: student.expoPushToken,
              violationType: violation.violationType || 'other',
              detectedAt: violation.createdAt || new Date(),
              violationId: violation._id.toString(),
            });
          })
          .catch((err) => console.warn('Violation push/notification:', err?.message));
      });
    }
    res.status(201).json({ success: true, data: violation });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// Get Violations
exports.getViolations = async (req, res) => {
  try {
    const targetHostelId = await resolveWardenHostelId(req);
    if (!targetHostelId) {
      return res.status(200).json({ success: true, data: [] });
    }

    const students = await User.find({ hostelId: targetHostelId, role: 'student' }).select('_id').lean();
    const studentIds = students.map((s) => s._id);

    const violations = await Violation.find({ studentId: { $in: studentIds } })
      .populate('studentId', 'name roomId')
      .populate('reportedBy', 'name')
      .populate('ruleId')
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: violations });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// Update Violation
exports.updateViolation = async (req, res) => {
  try {
    const violation = await Violation.findById(req.params.id).populate('studentId', 'hostelId');
    if (!violation) {
      return res.status(404).json({ success: false, message: 'Violation not found' });
    }

    const targetHostelId = await resolveWardenHostelId(req);
    const studentHostelId = String(violation.studentId?.hostelId || '');
    if (!studentHostelId || studentHostelId !== String(targetHostelId)) {
      return res.status(403).json({ success: false, message: 'Not authorized to modify violations for this hostel' });
    }

    Object.assign(violation, req.body);
    await violation.save();
    res.status(200).json({ success: true, data: violation });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// Escalate Violation
exports.escalateViolation = async (req, res) => {
  try {
    const { violationId } = req.params;
    const { escalateTo = 'owner', reason = '' } = req.body;
    const wardenId = String(req.user._id || req.user.id);

    const violation = await Violation.findById(violationId)
      .populate('studentId', 'name studentId phone hostelId')
      .populate('ruleId');

    if (!violation) {
      return res.status(404).json({ success: false, message: 'Violation not found' });
    }

    violation.escalatedTo = escalateTo;
    violation.status = 'escalated';
    await violation.save();

    const student = violation.studentId;
    const sid = String(student?._id || student || '');
    const studentName = student?.name || 'Student';
    const hostelId = String(student?.hostelId || req.user.hostelId || '');

    // Resolve owner
    let ownerId = null;
    if (hostelId) {
      const hDoc = await Hostel.findById(hostelId).select('ownerId').lean();
      if (hDoc?.ownerId) ownerId = String(hDoc.ownerId);
    }

    const title = `🚨 Violation Escalated: ${violation.violationType || 'Rule Breach'}`;
    const desc = violation.description || 'Violation escalated by warden';
    const message = `Warden escalated violation for ${studentName} (${violation.violationType}): ${desc}. ${reason ? `Note: ${reason}` : ''}`;

    // Dispatch to Owner if escalated to owner or general escalation
    if (ownerId && (escalateTo === 'owner' || !escalateTo)) {
      await HostelAlertService.send({
        type: ALERT_TYPES.DISCIPLINE,
        title: `🚨 Incident Escalated to Owner: ${studentName}`,
        message,
        hostelId,
        studentId: sid,
        recipientRole: 'owner',
        recipientIds: [ownerId],
        priority: 'high',
        triggeredByUserId: wardenId,
        metadata: {
          violationId: String(violation._id),
          studentName,
          violationType: violation.violationType,
          fineAmount: violation.fineAmount,
          reason,
        },
        sendPush: true,
      }).catch((e) => console.warn('[WardenController] Owner alert dispatch failed:', e.message));

      await Notification.create({
        title: `🚨 Violation Escalated to Owner`,
        message,
        type: 'alert',
        targetAudience: 'owner',
        recipients: [ownerId],
        createdBy: wardenId,
        hostelId,
        priority: 'high',
      }).catch(() => {});

      emitToUser(ownerId, 'violation:escalated', {
        violationId: String(violation._id),
        studentName,
        violationType: violation.violationType,
        message,
      });
    }

    // Dispatch notification to the student
    if (sid) {
      await Notification.create({
        title: `⚠️ Violation Escalated to Administration`,
        message: `Your violation (${violation.violationType}) has been escalated to ${escalateTo} by the warden.`,
        type: 'alert',
        targetAudience: 'students',
        recipients: [sid],
        createdBy: wardenId,
        hostelId,
        priority: 'high',
      }).catch(() => {});

      emitToUser(sid, 'violation:escalated', {
        violationId: String(violation._id),
        message: `Your violation has been escalated to ${escalateTo}.`,
      });
    }

    // Emit to warden room
    if (hostelId) {
      emitToRole('warden', hostelId, 'violation:escalated', {
        violationId: String(violation._id),
        studentName,
        escalateTo,
      });
    }

    res.status(200).json({ success: true, data: violation, message: `Violation escalated to ${escalateTo}` });
  } catch (error) {
    console.error('[WardenController] Error escalating violation:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete Violation (Disciplinary or Curfew)
exports.deleteViolation = async (req, res) => {
  try {
    const { id } = req.params;
    const targetHostelId = await resolveWardenHostelId(req);

    // Try finding in standard Violation
    const violation = await Violation.findById(id).populate('studentId', 'hostelId');
    if (violation) {
      const studentHostelId = String(violation.studentId?.hostelId || violation.hostelId || '');
      if (studentHostelId && studentHostelId !== String(targetHostelId)) {
        return res.status(403).json({ success: false, message: 'Not authorized to delete violations for this hostel' });
      }
      await Violation.findByIdAndDelete(id);
      return res.status(200).json({ success: true, message: 'Violation record deleted successfully' });
    }

    // Try finding in CurfewViolation
    const curfewV = await CurfewViolation.findById(id);
    if (curfewV) {
      if (String(curfewV.hostelId) !== String(targetHostelId)) {
        return res.status(403).json({ success: false, message: 'Not authorized to delete curfew records for this hostel' });
      }
      await CurfewViolation.findByIdAndDelete(id);
      return res.status(200).json({ success: true, message: 'Curfew violation deleted successfully' });
    }

    return res.status(404).json({ success: false, message: 'Violation record not found' });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// Delete Curfew Violation specifically
exports.deleteCurfewViolation = async (req, res) => {
  try {
    const { id } = req.params;
    const targetHostelId = await resolveWardenHostelId(req);

    const curfewV = await CurfewViolation.findById(id);
    if (!curfewV) {
      return res.status(404).json({ success: false, message: 'Curfew violation record not found' });
    }

    if (String(curfewV.hostelId) !== String(targetHostelId)) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete curfew records for this hostel' });
    }

    await CurfewViolation.findByIdAndDelete(id);
    res.status(200).json({ success: true, message: 'Curfew violation record deleted successfully' });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// ============ VISITOR LOG ============

// Get Visitors
exports.getVisitors = async (req, res) => {
  try {
    const targetHostelId = await resolveWardenHostelId(req);
    if (!targetHostelId) {
      return res.status(200).json({ success: true, data: [] });
    }

    const students = await User.find({ hostelId: targetHostelId, role: 'student' }).select('_id').lean();
    const studentIds = students.map((s) => s._id);

    const visitors = await Visitor.find({ visitingStudentId: { $in: studentIds } })
      .populate('visitingStudentId', 'name roomId')
      .populate('approvedBy', 'name')
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: visitors });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// Approve Visitor
exports.approveVisitor = async (req, res) => {
  try {
    const { visitorId } = req.params;
    const visitor = await Visitor.findById(visitorId).populate('visitingStudentId', 'hostelId');
    if (!visitor) {
      return res.status(404).json({ success: false, message: 'Visitor not found' });
    }

    const targetHostelId = await resolveWardenHostelId(req);
    const studentHostelId = String(visitor.visitingStudentId?.hostelId || '');
    if (!studentHostelId || studentHostelId !== String(targetHostelId)) {
      return res.status(403).json({ success: false, message: 'Not authorized to approve visitors for this hostel' });
    }

    visitor.status = 'approved';
    visitor.approvedBy = req.user.id;
    visitor.entryTime = new Date();
    await visitor.save();

    res.status(200).json({ success: true, data: visitor });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// Reject Visitor
exports.rejectVisitor = async (req, res) => {
  try {
    const { visitorId } = req.params;
    const { rejectionReason } = req.body;
    const visitor = await Visitor.findById(visitorId).populate('visitingStudentId', 'hostelId');
    if (!visitor) {
      return res.status(404).json({ success: false, message: 'Visitor not found' });
    }

    const targetHostelId = await resolveWardenHostelId(req);
    const studentHostelId = String(visitor.visitingStudentId?.hostelId || '');
    if (!studentHostelId || studentHostelId !== String(targetHostelId)) {
      return res.status(403).json({ success: false, message: 'Not authorized to reject visitors for this hostel' });
    }

    visitor.status = 'rejected';
    visitor.approvedBy = req.user.id;
    visitor.rejectionReason = rejectionReason;
    await visitor.save();

    res.status(200).json({ success: true, data: visitor });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// Delete Visitor
exports.deleteVisitor = async (req, res) => {
  try {
    const { visitorId } = req.params;
    const visitor = await Visitor.findById(visitorId).populate('visitingStudentId', 'hostelId');
    if (!visitor) {
      return res.status(404).json({ success: false, message: 'Visitor record not found' });
    }

    const targetHostelId = await resolveWardenHostelId(req);
    const studentHostelId = String(visitor.visitingStudentId?.hostelId || '');
    if (!studentHostelId || studentHostelId !== String(targetHostelId)) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete visitor records for this hostel' });
    }

    await Visitor.findByIdAndDelete(visitorId);
    res.status(200).json({ success: true, message: 'Visitor record deleted successfully' });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// ============ EMERGENCY MODE ============

// Get Active Emergencies
exports.getActiveEmergencies = async (req, res) => {
  try {
    const targetHostelId = await resolveWardenHostelId(req);
    if (!targetHostelId) {
      return res.status(200).json({ success: true, data: [] });
    }

    const students = await User.find({ hostelId: targetHostelId, role: 'student' }).select('_id').lean();
    const studentIds = students.map((s) => s._id);

    const emergencies = await Emergency.find({ status: 'active', raisedBy: { $in: studentIds } })
      .populate('raisedBy', 'name roomId phone')
      .populate('acknowledgedBy', 'name')
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: emergencies });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// Acknowledge Emergency
exports.acknowledgeEmergency = async (req, res) => {
  try {
    const { emergencyId } = req.params;
    const emergency = await Emergency.findById(emergencyId).populate('raisedBy', 'hostelId');
    if (!emergency) {
      return res.status(404).json({ success: false, message: 'Emergency not found' });
    }

    const targetHostelId = await resolveWardenHostelId(req);
    const studentHostelId = String(emergency.raisedBy?.hostelId || '');
    if (!studentHostelId || studentHostelId !== String(targetHostelId)) {
      return res.status(403).json({ success: false, message: 'Not authorized to acknowledge emergency for this hostel' });
    }

    emergency.status = 'acknowledged';
    emergency.acknowledgedBy = req.user.id;
    emergency.acknowledgedAt = new Date();
    await emergency.save();

    res.status(200).json({ success: true, data: emergency });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

