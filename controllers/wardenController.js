const User = require('../models/User');
const Attendance = require('../models/Attendance');
const Permission = require('../models/Permission');
const Violation = require('../models/Violation');
const Complaint = require('../models/Complaint');
const Visitor = require('../models/Visitor');
const Emergency = require('../models/Emergency');
const Rule = require('../models/Rule');
const { sendViolationPushToStudent } = require('../utils/notificationService');
const { logGateEvent } = require('../utils/gateEventService');
// Alert & Automation Module — event-driven integration
const { hostelEventEmitter } = require('../modules/alert');
const { ALERT_TYPES } = require('../modules/alert/utils/constants');

// ============ LIVE DASHBOARD ============

// Get Live Dashboard
exports.getDashboard = async (req, res) => {
  try {
    const { hostelId } = req.query;
    const filter = { hostelId: hostelId || req.user.hostelId };

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
    }).populate('studentId', 'name');

    const activeViolations = await Violation.find({
      status: 'pending',
      studentId: { $in: studentIds },
    }).populate('studentId', 'name');

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
        activeViolations: activeViolations.length,
        permissions: pendingPermissions,
        violations: activeViolations,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============ CURFEW MONITORING ============

// Get Curfew Violations
exports.getCurfewViolations = async (req, res) => {
  try {
    const { hostelId } = req.query;
    const hostel = await require('../models/Hostel').findById(hostelId || req.user.hostelId);
    const curfewTime = hostel?.rules?.curfewTime || '22:00';

    const students = await User.find({
      hostelId: hostelId || req.user.hostelId,
      role: 'student',
    });
    const studentIds = students.map(s => s._id);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const violations = await Violation.find({
      studentId: { $in: studentIds },
      violationType: 'curfew',
      createdAt: { $gte: today },
    })
      .populate('studentId', 'name roomId')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, data: violations });
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
    const permissions = await Permission.find({ status: 'pending' })
      .populate('studentId', 'name roomId phone')
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: permissions });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Approve Permission
exports.approvePermission = async (req, res) => {
  try {
    const { permissionId } = req.params;
    const permission = await Permission.findById(permissionId);
    if (!permission) {
      return res.status(404).json({ success: false, message: 'Permission not found' });
    }

    permission.status = 'approved';
    permission.approvedBy = req.user.id;
    permission.approvedAt = new Date();
    await permission.save();

    res.status(200).json({ success: true, data: permission });

    // ✅ Alert Module: send approval notification to student
    hostelEventEmitter.emit(ALERT_TYPES.LEAVE_APPROVED, {
      studentId: String(permission.studentId),
      hostelId: String(req.user.hostelId),
      permissionId: String(permission._id),
      returnDate: permission.returnDate,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Reject Permission
exports.rejectPermission = async (req, res) => {
  try {
    const { permissionId } = req.params;
    const { rejectionReason } = req.body;
    const permission = await Permission.findById(permissionId);
    if (!permission) {
      return res.status(404).json({ success: false, message: 'Permission not found' });
    }

    permission.status = 'rejected';
    permission.approvedBy = req.user.id;
    permission.approvedAt = new Date();
    permission.rejectionReason = rejectionReason;
    await permission.save();

    res.status(200).json({ success: true, data: permission });

    // ✅ Alert Module: send rejection notification to student
    hostelEventEmitter.emit(ALERT_TYPES.LEAVE_REJECTED, {
      studentId: String(permission.studentId),
      hostelId: String(req.user.hostelId),
      permissionId: String(permission._id),
      reason: rejectionReason,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
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
    const incidents = await Complaint.find({ complaintType: 'safety' })
      .populate('raisedBy', 'name')
      .populate('assignedTo', 'name')
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: incidents });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============ VIOLATION MANAGEMENT ============

// Create Violation
exports.createViolation = async (req, res) => {
  try {
    const violation = await Violation.create({
      ...req.body,
      reportedBy: req.user.id,
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
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get Violations
exports.getViolations = async (req, res) => {
  try {
    const violations = await Violation.find()
      .populate('studentId', 'name roomId')
      .populate('reportedBy', 'name')
      .populate('ruleId')
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: violations });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update Violation
exports.updateViolation = async (req, res) => {
  try {
    const violation = await Violation.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!violation) {
      return res.status(404).json({ success: false, message: 'Violation not found' });
    }
    res.status(200).json({ success: true, data: violation });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Escalate Violation
exports.escalateViolation = async (req, res) => {
  try {
    const { violationId } = req.params;
    const { escalateTo } = req.body;
    const violation = await Violation.findById(violationId);
    if (!violation) {
      return res.status(404).json({ success: false, message: 'Violation not found' });
    }

    violation.escalatedTo = escalateTo;
    violation.status = 'escalated';
    await violation.save();

    res.status(200).json({ success: true, data: violation });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============ VISITOR LOG ============

// Get Visitors
exports.getVisitors = async (req, res) => {
  try {
    const visitors = await Visitor.find()
      .populate('visitingStudentId', 'name roomId')
      .populate('approvedBy', 'name')
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: visitors });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Approve Visitor
exports.approveVisitor = async (req, res) => {
  try {
    const { visitorId } = req.params;
    const visitor = await Visitor.findById(visitorId);
    if (!visitor) {
      return res.status(404).json({ success: false, message: 'Visitor not found' });
    }

    visitor.status = 'approved';
    visitor.approvedBy = req.user.id;
    visitor.entryTime = new Date();
    await visitor.save();

    res.status(200).json({ success: true, data: visitor });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Reject Visitor
exports.rejectVisitor = async (req, res) => {
  try {
    const { visitorId } = req.params;
    const { rejectionReason } = req.body;
    const visitor = await Visitor.findById(visitorId);
    if (!visitor) {
      return res.status(404).json({ success: false, message: 'Visitor not found' });
    }

    visitor.status = 'rejected';
    visitor.approvedBy = req.user.id;
    visitor.rejectionReason = rejectionReason;
    await visitor.save();

    res.status(200).json({ success: true, data: visitor });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============ EMERGENCY MODE ============

// Get Active Emergencies
exports.getActiveEmergencies = async (req, res) => {
  try {
    const emergencies = await Emergency.find({ status: 'active' })
      .populate('raisedBy', 'name roomId phone')
      .populate('acknowledgedBy', 'name')
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: emergencies });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Acknowledge Emergency
exports.acknowledgeEmergency = async (req, res) => {
  try {
    const { emergencyId } = req.params;
    const emergency = await Emergency.findById(emergencyId);
    if (!emergency) {
      return res.status(404).json({ success: false, message: 'Emergency not found' });
    }

    emergency.status = 'acknowledged';
    emergency.acknowledgedBy = req.user.id;
    emergency.acknowledgedAt = new Date();
    await emergency.save();

    res.status(200).json({ success: true, data: emergency });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

