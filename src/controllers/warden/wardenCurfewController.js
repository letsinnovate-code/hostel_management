/**
 * @file controllers/warden/wardenCurfewController.js
 * @description Warden curfew, violations, incidents, and emergency controller.
 */

'use strict';

const mongoose = require('mongoose');
const User = require('../../models/User');
const Violation = require('../../models/Violation');
const Emergency = require('../../models/Emergency');
const Notification = require('../../models/Notification');
const AuditLog = require('../../models/AuditLog');
const CurfewViolation = require('../../modules/alert/models/CurfewViolation');
const CurfewAutomationService = require('../../modules/alert/services/CurfewAutomationService');
const { sendViolationPushToStudent } = require('../../utils/notificationService');
const { emitToUser, emitToRole } = require('../../modules/alert/socket/alertSocket');
const { parsePagination, buildPaginationMetadata } = require('../../utils/pagination');
const { resolveWardenHostelId } = require('./wardenHelper');

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

// ============ LEAVE & PERMISSION MANAGEMENT ============

/**
 * Get all leave applications with search, status filters, date range filters, and KPI summary
 */

exports.createIncident = async (req, res) => {
  try {
    const { title, description, roomId, blockId, priority, images } = req.body;
    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Incident title is required' });
    }
    if (!description || typeof description !== 'string' || !description.trim()) {
      return res.status(400).json({ success: false, message: 'Incident description is required' });
    }

    const targetHostelId = await resolveWardenHostelId(req);
    const validPriorities = ['low', 'medium', 'high', 'urgent', 'critical'];
    const resolvedPriority = validPriorities.includes(priority) ? priority : 'high';

    const incident = await Complaint.create({
      title: title.trim().slice(0, 200),
      description: description.trim().slice(0, 2000),
      roomId: roomId || undefined,
      blockId: blockId || undefined,
      images: Array.isArray(images) ? images.filter((img) => typeof img === 'string').slice(0, 5) : [],
      raisedBy: req.user.id,
      hostelId: targetHostelId,
      complaintType: 'safety',
      priority: resolvedPriority,
      status: 'open',
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

// ============ DISCIPLINARY / VIOLATION MANAGEMENT ============

// Create Violation / Disciplinary Incident
exports.createViolation = async (req, res) => {
  try {
    const targetHostelId = await resolveWardenHostelId(req);
    const wardenId = req.user._id || req.user.id;
    const wardenName = req.user.name || 'Warden';
    const wardenRole = Array.isArray(req.user.role) ? req.user.role[0] : (req.user.role || 'warden');

    const {
      studentId,
      ruleId,
      title,
      violationType = 'other',
      severity = 'low',
      description,
      incidentDate,
      location,
      involvedStudents = [],
      witnesses = [],
      evidence = [],
      fineAmount = 0,
      warningLevel = 'warning',
      actionTaken = 'none',
      actionDetails,
      parentNotified = false,
      parentNotificationMethod,
      parentNotificationNotes,
      parentContactInfo,
      remarks,
    } = req.body;

    if (!studentId) {
      return res.status(400).json({ success: false, message: 'Primary student is required to log an incident' });
    }
    if (!description || !description.trim()) {
      return res.status(400).json({ success: false, message: 'Incident description is required' });
    }

    const student = await User.findById(studentId).select('name hostelId email phone pushToken expoPushToken parentContact parentName').lean();
    if (!student) {
      return res.status(404).json({ success: false, message: 'Designated primary student not found' });
    }

    if (targetHostelId && student.hostelId && String(student.hostelId) !== String(targetHostelId)) {
      return res.status(403).json({ success: false, message: 'Student belongs to a different hostel' });
    }

    const initialStatus = actionTaken && actionTaken !== 'none' ? 'action_taken' : 'pending';

    const timeline = [
      {
        action: 'incident_reported',
        performedBy: wardenId,
        performedByName: wardenName,
        performedByRole: wardenRole,
        notes: `Disciplinary incident recorded: ${title || violationType}. Severity: ${severity.toUpperCase()}`,
        toStatus: initialStatus,
        timestamp: new Date(),
      },
    ];

    if (actionTaken && actionTaken !== 'none') {
      timeline.push({
        action: 'action_recorded',
        performedBy: wardenId,
        performedByName: wardenName,
        performedByRole: wardenRole,
        notes: `Disciplinary Action Taken: ${actionTaken.replace(/_/g, ' ')}. ${actionDetails || ''}`,
        fromStatus: 'pending',
        toStatus: 'action_taken',
        timestamp: new Date(),
      });
    }

    if (parentNotified) {
      timeline.push({
        action: 'parent_notified',
        performedBy: wardenId,
        performedByName: wardenName,
        performedByRole: wardenRole,
        notes: `Parent/guardian notification logged via ${parentNotificationMethod || 'contact'}. ${parentNotificationNotes || ''}`,
        timestamp: new Date(),
      });
    }

    const initialRemarksList = [];
    if (remarks && typeof remarks === 'string' && remarks.trim()) {
      initialRemarksList.push({
        author: wardenId,
        authorName: wardenName,
        authorRole: wardenRole,
        comment: remarks.trim(),
        createdAt: new Date(),
      });
    }

    const violation = await Violation.create({
      hostelId: targetHostelId || student.hostelId,
      studentId,
      ruleId: ruleId || undefined,
      title: title || `${violationType.replace(/-/g, ' ').toUpperCase()} Incident`,
      violationType,
      severity,
      description: description.trim(),
      incidentDate: incidentDate ? new Date(incidentDate) : new Date(),
      location: location || '',
      involvedStudents: Array.isArray(involvedStudents) ? involvedStudents : [],
      witnesses: Array.isArray(witnesses) ? witnesses : [],
      evidence: Array.isArray(evidence) ? evidence : [],
      reportedBy: wardenId,
      fineAmount: Number(fineAmount) || 0,
      warningLevel,
      actionTaken,
      actionDetails: actionDetails || '',
      actionDate: actionTaken && actionTaken !== 'none' ? new Date() : undefined,
      actionBy: actionTaken && actionTaken !== 'none' ? wardenId : undefined,
      parentNotified: !!parentNotified,
      parentNotifiedAt: parentNotified ? new Date() : undefined,
      parentNotificationMethod: parentNotified ? parentNotificationMethod : undefined,
      parentNotificationNotes: parentNotified ? parentNotificationNotes : undefined,
      parentContactInfo: (function() {
        if (parentContactInfo) {
          return typeof parentContactInfo === 'object'
            ? `${parentContactInfo.name || ''} ${parentContactInfo.phone || ''}`.trim()
            : String(parentContactInfo);
        }
        if (student.parentContact) {
          if (typeof student.parentContact === 'object') {
            const parts = [
              student.parentContact.name,
              student.parentContact.relation ? `(${student.parentContact.relation})` : '',
              student.parentContact.phone ? `Ph: ${student.parentContact.phone}` : '',
              student.parentContact.email ? `Email: ${student.parentContact.email}` : ''
            ].filter(Boolean);
            return parts.join(' ') || '';
          }
          return String(student.parentContact);
        }
        return '';
      })(),
      status: initialStatus,
      remarks: initialRemarksList,
      timeline,
    });

    // Notify Student
    const sid = String(student._id);
    const timeStr = (violation.createdAt || new Date()).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

    Notification.create({
      title: `Disciplinary Incident Logged: ${violation.severity.toUpperCase()}`,
      message: `A disciplinary record has been logged for you: ${violation.title || violation.violationType}. ${(violation.description || '').slice(0, 100)}`,
      type: 'alert',
      targetAudience: 'students',
      recipients: [sid],
      createdBy: wardenId,
      hostelId: targetHostelId || student.hostelId,
      priority: violation.severity === 'critical' || violation.severity === 'high' ? 'high' : 'normal',
    }).catch((err) => console.warn('[Discipline] Student notification error:', err?.message));

    sendViolationPushToStudent({
      pushToken: student.pushToken,
      expoPushToken: student.expoPushToken,
      violationType: violation.violationType || 'other',
      detectedAt: violation.createdAt || new Date(),
      violationId: violation._id.toString(),
    });

    emitToUser(sid, 'violation:created', {
      violationId: String(violation._id),
      title: violation.title,
      severity: violation.severity,
      message: 'A disciplinary incident has been recorded in your profile.',
    });

    // Notify Involved Students if any
    if (Array.isArray(involvedStudents) && involvedStudents.length > 0) {
      for (const inv of involvedStudents) {
        if (inv.studentId && String(inv.studentId) !== sid) {
          Notification.create({
            title: `Hostel Incident Record`,
            message: `You were noted as an involved party in an incident: ${violation.title || violation.violationType}.`,
            type: 'alert',
            targetAudience: 'students',
            recipients: [String(inv.studentId)],
            createdBy: wardenId,
            hostelId: targetHostelId || student.hostelId,
          }).catch((err) => {
        console.error('[wardenCurfewController] Asynchronous operation failed:', err.message);
      });
        }
      }
    }

    // Emit to warden room
    if (targetHostelId) {
      emitToRole('warden', String(targetHostelId), 'violation:created', {
        violationId: String(violation._id),
        studentName: student.name,
        severity: violation.severity,
      });
    }

    // Write AuditLog
    AuditLog.create({
      action: 'DISCIPLINARY_INCIDENT_CREATED',
      entityType: 'Violation',
      entityId: violation._id,
      performedBy: wardenId,
      changes: {
        after: {
          title: violation.title,
          severity: violation.severity,
          studentId: violation.studentId,
          actionTaken: violation.actionTaken,
        },
      },
      ipAddress: req.ip || '127.0.0.1',
    }).catch((auditErr) => console.warn('[Discipline] AuditLog creation warning:', auditErr.message));

    const populatedViolation = await Violation.findById(violation._id)
      .populate({ path: 'studentId', select: 'name email phone roomId roomNumber rollNumber studentId profileImage parentContact parentName', populate: { path: 'roomId', select: 'roomNumber block floor' } })
      .populate('reportedBy', 'name role')
      .populate('actionBy', 'name role');

    res.status(201).json({
      success: true,
      data: populatedViolation,
      message: 'Disciplinary incident recorded successfully',
    });
  } catch (error) {
    console.error('[WardenController] Error creating violation:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// Get Violations (Advanced search, filters, pagination, and KPI statistics)
exports.getViolations = async (req, res) => {
  try {
    const targetHostelId = await resolveWardenHostelId(req);
    if (!targetHostelId) {
      return res.status(200).json({
        success: true,
        data: [],
        stats: { total: 0, pending: 0, investigating: 0, actionTaken: 0, critical: 0, escalated: 0, resolved: 0 },
      });
    }

    const {
      search = '',
      status,
      severity,
      violationType,
      warningLevel,
      studentId,
      startDate,
      endDate,
      page = 1,
      limit = 50,
    } = req.query;

    const query = {
      $or: [
        { hostelId: targetHostelId },
        { hostelId: { $exists: false } },
      ],
    };

    // Constrain by residents in target hostel
    const hostelStudents = await User.find({ hostelId: targetHostelId, role: 'student' }).select('_id').lean();
    const studentIds = hostelStudents.map((s) => s._id);
    query.studentId = { $in: studentIds };

    if (studentId) {
      query.studentId = studentId;
    }

    if (status && status !== 'ALL') {
      if (status.toLowerCase() === 'active') {
        query.status = { $in: ['pending', 'investigating', 'action_taken', 'escalated'] };
      } else {
        query.status = status.toLowerCase();
      }
    }

    if (severity && severity !== 'ALL') {
      query.severity = severity.toLowerCase();
    }

    if (violationType && violationType !== 'ALL') {
      query.violationType = violationType.toLowerCase();
    }

    if (warningLevel && warningLevel !== 'ALL') {
      query.warningLevel = warningLevel.toLowerCase();
    }

    if (startDate || endDate) {
      query.incidentDate = {};
      if (startDate) query.incidentDate.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.incidentDate.$lte = end;
      }
    }

    let records = await Violation.find(query)
      .populate({ path: 'studentId', select: 'name email phone roomId roomNumber rollNumber studentId profileImage parentContact parentName', populate: { path: 'roomId', select: 'roomNumber block floor' } })
      .populate('reportedBy', 'name role')
      .populate('actionBy', 'name role')
      .populate('resolvedBy', 'name role')
      .populate('escalatedBy', 'name role')
      .populate('ruleId')
      .sort({ createdAt: -1 })
      .lean();

    // In-memory multi-field matching
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      records = records.filter((item) => {
        const sName = item.studentId?.name || '';
        const roll = item.studentId?.rollNumber || item.studentId?.studentId || '';
        const room = item.studentId?.roomId?.roomNumber || String(item.studentId?.roomId || '');
        const title = item.title || '';
        const desc = item.description || '';
        const loc = item.location || '';
        const vType = item.violationType || '';
        return (
          sName.toLowerCase().includes(q) ||
          roll.toLowerCase().includes(q) ||
          room.toLowerCase().includes(q) ||
          title.toLowerCase().includes(q) ||
          desc.toLowerCase().includes(q) ||
          loc.toLowerCase().includes(q) ||
          vType.toLowerCase().includes(q)
        );
      });
    }

    // Compute comprehensive stats for target hostel
    const allHostelViolations = await Violation.find({ studentId: { $in: studentIds } }).select('status severity isEscalated').lean();
    const stats = {
      total: allHostelViolations.length,
      pending: allHostelViolations.filter((v) => v.status === 'pending').length,
      investigating: allHostelViolations.filter((v) => v.status === 'investigating').length,
      actionTaken: allHostelViolations.filter((v) => v.status === 'action_taken').length,
      critical: allHostelViolations.filter((v) => v.severity === 'critical' && v.status !== 'resolved' && v.status !== 'closed').length,
      escalated: allHostelViolations.filter((v) => v.isEscalated || v.status === 'escalated').length,
      resolved: allHostelViolations.filter((v) => v.status === 'resolved' || v.status === 'closed').length,
    };

    const totalCount = records.length;
    let paginatedRecords = records;
    if (limit !== 'all') {
      const numLimit = parseInt(limit, 10) || 50;
      const numPage = parseInt(page, 10) || 1;
      const skip = (numPage - 1) * numLimit;
      paginatedRecords = records.slice(skip, skip + numLimit);
    }

    res.status(200).json({
      success: true,
      data: paginatedRecords,
      stats,
      pagination: {
        total: totalCount,
        page: parseInt(page, 10) || 1,
        limit: limit === 'all' ? totalCount : parseInt(limit, 10) || 50,
      },
    });
  } catch (error) {
    console.error('[WardenController] Error getting violations:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// Get Single Violation Details with Timeline & Remarks
exports.getViolationDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const targetHostelId = await resolveWardenHostelId(req);

    const violation = await Violation.findById(id)
      .populate({ path: 'studentId', select: 'name email phone roomId roomNumber rollNumber studentId profileImage parentContact parentName guardianPhone guardianName', populate: { path: 'roomId', select: 'roomNumber block floor' } })
      .populate('reportedBy', 'name email role')
      .populate('actionBy', 'name email role')
      .populate('resolvedBy', 'name email role')
      .populate('escalatedBy', 'name email role')
      .populate('remarks.author', 'name role')
      .populate('timeline.performedBy', 'name role')
      .populate('involvedStudents.studentId', 'name email rollNumber studentId roomId')
      .populate('ruleId');

    if (!violation) {
      return res.status(404).json({ success: false, message: 'Disciplinary violation record not found' });
    }

    const studentHostelId = String(violation.studentId?.hostelId || violation.hostelId || '');
    if (studentHostelId && targetHostelId && studentHostelId !== String(targetHostelId)) {
      return res.status(403).json({ success: false, message: 'Not authorized to view records from another hostel' });
    }

    res.status(200).json({ success: true, data: violation });
  } catch (error) {
    console.error('[WardenController] Error getting violation details:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// Record Disciplinary Action
exports.recordDisciplinaryAction = async (req, res) => {
  try {
    const { id } = req.params;
    const { actionTaken, actionDetails, warningLevel, fineAmount } = req.body;
    const wardenId = req.user._id || req.user.id;
    const wardenName = req.user.name || 'Warden';
    const wardenRole = Array.isArray(req.user.role) ? req.user.role[0] : (req.user.role || 'warden');
    const targetHostelId = await resolveWardenHostelId(req);

    if (!actionTaken) {
      return res.status(400).json({ success: false, message: 'Action taken type is required' });
    }

    const violation = await Violation.findById(id).populate('studentId', 'name hostelId email pushToken expoPushToken');
    if (!violation) {
      return res.status(404).json({ success: false, message: 'Violation not found' });
    }

    const studentHostelId = String(violation.studentId?.hostelId || violation.hostelId || '');
    if (studentHostelId && targetHostelId && studentHostelId !== String(targetHostelId)) {
      return res.status(403).json({ success: false, message: 'Not authorized to modify records for another hostel' });
    }

    const oldStatus = violation.status;
    const newStatus = oldStatus === 'resolved' || oldStatus === 'closed' ? oldStatus : 'action_taken';

    violation.actionTaken = actionTaken;
    violation.actionDetails = actionDetails || violation.actionDetails || '';
    violation.actionDate = new Date();
    violation.actionBy = wardenId;
    violation.status = newStatus;

    if (warningLevel) violation.warningLevel = warningLevel;
    if (fineAmount !== undefined && !isNaN(Number(fineAmount))) {
      violation.fineAmount = Number(fineAmount);
    }

    const formattedAction = actionTaken.replace(/_/g, ' ').toUpperCase();
    violation.timeline.push({
      action: 'action_recorded',
      performedBy: wardenId,
      performedByName: wardenName,
      performedByRole: wardenRole,
      notes: `Disciplinary Action Taken: ${formattedAction}.${actionDetails ? ' Details: ' + actionDetails : ''}${fineAmount ? ' Fine: ₹' + fineAmount : ''}${warningLevel ? ' Warning Level: ' + warningLevel : ''}`,
      fromStatus: oldStatus,
      toStatus: newStatus,
      timestamp: new Date(),
    });

    await violation.save();

    // Notify Student
    const student = violation.studentId;
    const sid = String(student?._id || '');
    if (sid) {
      Notification.create({
        title: `Disciplinary Action Recorded: ${formattedAction}`,
        message: `An action has been formally registered regarding your incident (${violation.title || violation.violationType}): ${actionDetails || formattedAction}`,
        type: 'alert',
        targetAudience: 'students',
        recipients: [sid],
        createdBy: wardenId,
        hostelId: targetHostelId || violation.hostelId,
        priority: 'high',
      }).catch((err) => {
        console.error('[wardenCurfewController] Asynchronous operation failed:', err.message);
      });

      emitToUser(sid, 'violation:action_taken', {
        violationId: String(violation._id),
        actionTaken,
        warningLevel: violation.warningLevel,
        fineAmount: violation.fineAmount,
        message: `Disciplinary action: ${formattedAction}`,
      });
    }

    // Write AuditLog
    AuditLog.create({
      action: 'DISCIPLINARY_ACTION_RECORDED',
      entityType: 'Violation',
      entityId: violation._id,
      performedBy: wardenId,
      changes: {
        before: { actionTaken: oldStatus, status: oldStatus },
        after: { actionTaken, status: newStatus, fineAmount: violation.fineAmount, warningLevel: violation.warningLevel },
      },
      ipAddress: req.ip || '127.0.0.1',
    }).catch((auditErr) => console.warn('[Discipline] AuditLog warning:', auditErr.message));

    const updated = await Violation.findById(id)
      .populate({ path: 'studentId', select: 'name email phone roomId roomNumber rollNumber studentId profileImage parentContact parentName', populate: { path: 'roomId', select: 'roomNumber block floor' } })
      .populate('reportedBy', 'name role')
      .populate('actionBy', 'name role')
      .populate('resolvedBy', 'name role');

    res.status(200).json({
      success: true,
      data: updated,
      message: 'Disciplinary action recorded successfully',
    });
  } catch (error) {
    console.error('[WardenController] Error recording disciplinary action:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// Record Parent/Guardian Notification
exports.recordParentNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const { method = 'call', parentContactInfo, notes = '' } = req.body;
    const wardenId = req.user._id || req.user.id;
    const wardenName = req.user.name || 'Warden';
    const wardenRole = Array.isArray(req.user.role) ? req.user.role[0] : (req.user.role || 'warden');
    const targetHostelId = await resolveWardenHostelId(req);

    const violation = await Violation.findById(id).populate('studentId', 'name hostelId parentContact parentName');
    if (!violation) {
      return res.status(404).json({ success: false, message: 'Violation not found' });
    }

    const studentHostelId = String(violation.studentId?.hostelId || violation.hostelId || '');
    if (studentHostelId && targetHostelId && studentHostelId !== String(targetHostelId)) {
      return res.status(403).json({ success: false, message: 'Not authorized to modify records for another hostel' });
    }

    violation.parentNotified = true;
    violation.parentNotifiedAt = new Date();
    violation.parentNotificationMethod = method;
    violation.parentNotificationNotes = notes;
    if (parentContactInfo) {
      violation.parentContactInfo = parentContactInfo;
    }

    violation.timeline.push({
      action: 'parent_notified',
      performedBy: wardenId,
      performedByName: wardenName,
      performedByRole: wardenRole,
      notes: `Parent/Guardian notified via ${method.toUpperCase()}${parentContactInfo ? ` (${parentContactInfo})` : ''}. Notes: ${notes || 'No remarks provided'}`,
      timestamp: new Date(),
    });

    await violation.save();

    AuditLog.create({
      action: 'PARENT_NOTIFICATION_RECORDED',
      entityType: 'Violation',
      entityId: violation._id,
      performedBy: wardenId,
      changes: {
        after: { method, parentContactInfo, notes },
      },
      ipAddress: req.ip || '127.0.0.1',
    }).catch((auditErr) => console.warn('[Discipline] AuditLog warning:', auditErr.message));

    const updated = await Violation.findById(id)
      .populate({ path: 'studentId', select: 'name email phone roomId roomNumber rollNumber studentId profileImage parentContact parentName', populate: { path: 'roomId', select: 'roomNumber block floor' } })
      .populate('actionBy', 'name role');

    res.status(200).json({
      success: true,
      data: updated,
      message: 'Parent notification recorded successfully',
    });
  } catch (error) {
    console.error('[WardenController] Error recording parent notification:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// Add Internal Inquiry / Warden Remark
exports.addViolationRemark = async (req, res) => {
  try {
    const { id } = req.params;
    const { comment } = req.body;
    const wardenId = req.user._id || req.user.id;
    const wardenName = req.user.name || 'Warden';
    const wardenRole = Array.isArray(req.user.role) ? req.user.role[0] : (req.user.role || 'warden');
    const targetHostelId = await resolveWardenHostelId(req);

    if (!comment || !comment.trim()) {
      return res.status(400).json({ success: false, message: 'Remark comment is required' });
    }

    const violation = await Violation.findById(id).populate('studentId', 'hostelId');
    if (!violation) {
      return res.status(404).json({ success: false, message: 'Violation not found' });
    }

    const studentHostelId = String(violation.studentId?.hostelId || violation.hostelId || '');
    if (studentHostelId && targetHostelId && studentHostelId !== String(targetHostelId)) {
      return res.status(403).json({ success: false, message: 'Not authorized for another hostel' });
    }

    violation.remarks.push({
      author: wardenId,
      authorName: wardenName,
      authorRole: wardenRole,
      comment: comment.trim(),
      createdAt: new Date(),
    });

    violation.timeline.push({
      action: 'remark_added',
      performedBy: wardenId,
      performedByName: wardenName,
      performedByRole: wardenRole,
      notes: comment.trim().slice(0, 120),
      timestamp: new Date(),
    });

    await violation.save();

    res.status(200).json({
      success: true,
      data: violation,
      message: 'Remark added to disciplinary file',
    });
  } catch (error) {
    console.error('[WardenController] Error adding violation remark:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// Resolve Disciplinary Incident
exports.resolveViolation = async (req, res) => {
  try {
    const { id } = req.params;
    const { resolutionNotes } = req.body;
    const wardenId = req.user._id || req.user.id;
    const wardenName = req.user.name || 'Warden';
    const wardenRole = Array.isArray(req.user.role) ? req.user.role[0] : (req.user.role || 'warden');
    const targetHostelId = await resolveWardenHostelId(req);

    if (!resolutionNotes || !resolutionNotes.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Resolution notes are required to formally close a disciplinary matter',
      });
    }

    const violation = await Violation.findById(id).populate('studentId', 'name hostelId email pushToken expoPushToken');
    if (!violation) {
      return res.status(404).json({ success: false, message: 'Violation not found' });
    }

    const studentHostelId = String(violation.studentId?.hostelId || violation.hostelId || '');
    if (studentHostelId && targetHostelId && studentHostelId !== String(targetHostelId)) {
      return res.status(403).json({ success: false, message: 'Not authorized for another hostel' });
    }

    const oldStatus = violation.status;
    violation.status = 'resolved';
    violation.resolvedAt = new Date();
    violation.resolvedBy = wardenId;
    violation.resolutionNotes = resolutionNotes.trim();

    violation.timeline.push({
      action: 'case_resolved',
      performedBy: wardenId,
      performedByName: wardenName,
      performedByRole: wardenRole,
      notes: `Disciplinary matter resolved and closed. Resolution: ${resolutionNotes.trim()}`,
      fromStatus: oldStatus,
      toStatus: 'resolved',
      timestamp: new Date(),
    });

    await violation.save();

    // Notify Student
    const student = violation.studentId;
    const sid = String(student?._id || '');
    if (sid) {
      Notification.create({
        title: `Disciplinary Case Resolved`,
        message: `Your disciplinary matter (${violation.title || violation.violationType}) has been resolved. Note: ${resolutionNotes.trim()}`,
        type: 'alert',
        targetAudience: 'students',
        recipients: [sid],
        createdBy: wardenId,
        hostelId: targetHostelId || violation.hostelId,
      }).catch((err) => {
        console.error('[wardenCurfewController] Asynchronous operation failed:', err.message);
      });

      emitToUser(sid, 'violation:resolved', {
        violationId: String(violation._id),
        message: 'Your disciplinary matter has been resolved.',
      });
    }

    // Write AuditLog
    AuditLog.create({
      action: 'DISCIPLINARY_CASE_RESOLVED',
      entityType: 'Violation',
      entityId: violation._id,
      performedBy: wardenId,
      changes: {
        before: { status: oldStatus },
        after: { status: 'resolved', resolutionNotes },
      },
      ipAddress: req.ip || '127.0.0.1',
    }).catch((auditErr) => console.warn('[Discipline] AuditLog warning:', auditErr.message));

    const updated = await Violation.findById(id)
      .populate({ path: 'studentId', select: 'name email phone roomId roomNumber rollNumber studentId profileImage parentContact parentName', populate: { path: 'roomId', select: 'roomNumber block floor' } })
      .populate('reportedBy', 'name role')
      .populate('actionBy', 'name role')
      .populate('resolvedBy', 'name role');

    res.status(200).json({
      success: true,
      data: updated,
      message: 'Disciplinary matter marked as resolved',
    });
  } catch (error) {
    console.error('[WardenController] Error resolving violation:', error);
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
    const studentHostelId = String(violation.studentId?.hostelId || violation.hostelId || '');
    if (!studentHostelId || (targetHostelId && studentHostelId !== String(targetHostelId))) {
      return res.status(403).json({ success: false, message: 'Not authorized to modify violations for this hostel' });
    }

    const oldStatus = violation.status;
    const { title, violationType, severity, description, location, fine, actionTaken, notes, status } = req.body;

    if (title !== undefined) violation.title = String(title).trim().slice(0, 150);
    if (violationType && ['curfew', 'late-entry', 'unauthorized-visitor', 'noise', 'damage', 'improper-checkout', 'substance', 'fighting', 'ragging', 'theft', 'misconduct', 'other'].includes(violationType)) {
      violation.violationType = violationType;
    }
    if (severity && ['low', 'medium', 'high', 'critical'].includes(severity)) {
      violation.severity = severity;
    }
    if (description !== undefined) violation.description = String(description).trim().slice(0, 2000);
    if (location !== undefined) violation.location = String(location).trim().slice(0, 200);
    if (fine !== undefined && typeof fine === 'object' && fine.amount !== undefined) {
      violation.fine = {
        amount: Math.max(0, Number(fine.amount) || 0),
        status: ['pending', 'paid', 'waived'].includes(fine.status) ? fine.status : 'pending',
      };
    }
    if (actionTaken !== undefined) violation.actionTaken = String(actionTaken).trim().slice(0, 500);
    if (notes !== undefined) violation.notes = String(notes).trim().slice(0, 2000);
    if (status && ['pending', 'investigating', 'action-taken', 'resolved', 'dismissed', 'appealed'].includes(status)) {
      violation.status = status;
    }
    violation.updatedAt = new Date();

    if (status && status !== oldStatus) {
      violation.timeline.push({
        action: 'status_changed',
        performedBy: req.user._id,
        performedByName: req.user.name,
        notes: `Status changed from ${oldStatus} to ${status}`,
        fromStatus: oldStatus,
        toStatus: status,
        timestamp: new Date(),
      });
    }

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
    const wardenName = req.user.name || 'Warden';

    const violation = await Violation.findById(violationId)
      .populate('studentId', 'name studentId phone hostelId')
      .populate('ruleId');

    if (!violation) {
      return res.status(404).json({ success: false, message: 'Violation not found' });
    }

    const oldStatus = violation.status;
    violation.escalatedTo = escalateTo;
    violation.status = 'escalated';
    violation.isEscalated = true;
    violation.severity = 'critical'; // Escalated matters require critical priority
    violation.escalationReason = reason;
    violation.escalatedAt = new Date();
    violation.escalatedBy = wardenId;

    violation.timeline.push({
      action: 'case_escalated',
      performedBy: wardenId,
      performedByName: wardenName,
      notes: `Violation escalated to ${escalateTo}. Reason: ${reason || 'Critical disciplinary violation requiring intervention'}`,
      fromStatus: oldStatus,
      toStatus: 'escalated',
      timestamp: new Date(),
    });

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

    const title = `🚨 Violation Escalated: ${violation.title || violation.violationType || 'Rule Breach'}`;
    const desc = violation.description || 'Violation escalated by warden';
    const message = `Warden escalated disciplinary incident for ${studentName} (${violation.violationType}): ${desc}. ${reason ? `Note: ${reason}` : ''}`;

    // Dispatch to Owner if escalated to owner or general escalation
    if (ownerId && (escalateTo === 'owner' || !escalateTo || escalateTo === 'management')) {
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
      }).catch((err) => {
        console.error('[wardenCurfewController] Asynchronous operation failed:', err.message);
      });

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
      }).catch((err) => {
        console.error('[wardenCurfewController] Asynchronous operation failed:', err.message);
      });

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

    // Write AuditLog
    AuditLog.create({
      action: 'DISCIPLINARY_INCIDENT_ESCALATED',
      entityType: 'Violation',
      entityId: violation._id,
      performedBy: wardenId,
      changes: {
        before: { status: oldStatus },
        after: { status: 'escalated', escalateTo, reason },
      },
      ipAddress: req.ip || '127.0.0.1',
    }).catch((err) => {
        console.error('[wardenCurfewController] Asynchronous operation failed:', err.message);
      });

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

// ============ WARDEN QUICK ACTIONS & OPERATIONS ============

// Mark Attendance (Quick Action)
