const User = require('../models/User');
const Attendance = require('../models/Attendance');
const Permission = require('../models/Permission');
const Violation = require('../models/Violation');
const Complaint = require('../models/Complaint');
const Visitor = require('../models/Visitor');
const Emergency = require('../models/Emergency');
const Rule = require('../models/Rule');
const Room = require('../models/Room');
const GateEvent = require('../models/GateEvent');
const RoomAllocationHistory = require('../models/RoomAllocationHistory');
const AuditLog = require('../models/AuditLog');
const LeaveViolation = require('../modules/alert/models/LeaveViolation');
const mongoose = require('mongoose');
const { getBusinessDate, getBusinessDateString } = require('../services/timezoneService');
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
    const userId = req.user?.id || req.user?._id;
    if (userId && mongoose.isValidObjectId(userId)) {
      const uDoc = await User.findById(userId).select('hostelId').lean();
      if (uDoc?.hostelId) wardenHostelId = uDoc.hostelId;
    }
  }
  return wardenHostelId ? String(wardenHostelId) : null;
}

// ============ LIVE DASHBOARD ============

// Get Live Dashboard with Complete Operational Overview
exports.getDashboard = async (req, res) => {
  try {
    const targetHostelId = await resolveWardenHostelId(req);
    if (!targetHostelId) {
      return res.status(200).json({
        success: true,
        data: {
          hostel: { id: null, name: 'No Hostel Assigned' },
          summary: { totalStudents: 0, inside: 0, outside: 0, pending: 0 },
          studentStats: { total: 0, active: 0, onLeave: 0, absent: 0 },
          roomStats: { totalRooms: 0, occupiedRooms: 0, partiallyOccupiedRooms: 0, vacantRooms: 0, maintenanceRooms: 0, totalCapacity: 0, totalOccupancy: 0, occupancyRate: 0 },
          attendanceOverview: { presentToday: 0, absentToday: 0, lateArrivals: 0, attendancePercentage: 0, inside: [], outside: [], pending: [] },
          leaveOverview: { pendingApplications: 0, approvedLeaves: 0, studentsOutside: 0, overdueReturns: 0, pendingList: [] },
          complaintOverview: { newComplaints: 0, pendingComplaints: 0, inProgressComplaints: 0, resolvedComplaints: 0, highPriorityComplaints: 0, recentComplaints: [] },
          maintenanceOverview: { newRequests: 0, pendingRequests: 0, inProgressRepairs: 0, completedRepairs: 0, emergencyMaintenance: 0, recentMaintenance: [] },
          visitorOverview: { todayVisitors: 0, currentInside: 0, pendingRequests: 0, recentVisitors: [] },
          disciplineOverview: { recentIncidents: [], studentsWithIssues: 0, pendingDisciplinaryActions: 0, curfewViolationsCount: 0 },
          emergencyOverview: { activeEmergencies: [], hasActiveEmergency: false, recentIncidents: [] },
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
            weekendCurfewTime: '',
            gracePeriodMinutes: 15,
            isCurfewActive: false,
            isManualCurfewActive: false,
          },
        },
      });
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);
    const now = new Date();

    // Parallel fetch of all primary collections
    const [
      students,
      rooms,
      attendanceDocs,
      pendingPermissionsDocs,
      approvedPermissionsToday,
      overdueLeaveViolations,
      activeDisciplinaryDocs,
      activeCurfewDocs,
      allVisitors,
      complaints,
      activeEmergenciesDocs,
      recentSafetyComplaints,
      hostelDoc,
    ] = await Promise.all([
      // Students in this hostel
      User.find({ hostelId: targetHostelId, role: 'student' }).select('name roomId status phone studentId email').lean(),
      // Rooms in this hostel
      Room.find({ hostelId: targetHostelId }).select('roomNumber capacity currentOccupancy status blockId floorNumber category').lean(),
      // Today's attendance for this hostel
      Attendance.find({
        hostelId: targetHostelId,
        date: { $gte: todayStart, $lt: todayEnd },
      }).populate('studentId', 'name roomId status studentId phone').lean(),
      // Pending permissions
      Permission.find({
        status: 'pending',
      }).populate({
        path: 'studentId',
        match: { hostelId: targetHostelId },
        select: 'name roomId phone studentId',
      }).sort({ createdAt: -1 }).lean(),
      // Approved permissions active today
      Permission.find({
        status: 'approved',
        requestedDate: { $lte: todayEnd },
        $or: [{ returnDate: null }, { returnDate: { $gte: todayStart } }],
      }).populate({
        path: 'studentId',
        match: { hostelId: targetHostelId },
        select: 'name roomId',
      }).lean(),
      // Overdue Leave Violations (from alert module)
      LeaveViolation.find({
        hostelId: targetHostelId,
        status: { $in: ['open', 'escalated_to_parent', 'escalated_to_owner'] },
      }).populate('studentId', 'name roomId phone').lean(),
      // Pending Disciplinary Violations
      Violation.find({
        status: 'pending',
      }).populate({
        path: 'studentId',
        match: { hostelId: targetHostelId },
        select: 'name roomId phone',
      }).sort({ createdAt: -1 }).lean(),
      // Active Curfew Violations
      CurfewViolation.find({
        hostelId: targetHostelId,
        status: { $in: ['open', 'pending_recheck'] },
      }).populate('studentId', 'name roomId phone studentId').sort({ createdAt: -1 }).lean(),
      // Visitors for students in this hostel
      Visitor.find().populate({
        path: 'visitingStudentId',
        match: { hostelId: targetHostelId },
        select: 'name roomId phone hostelId',
      }).sort({ createdAt: -1 }).limit(100).lean(),
      // Complaints in this hostel
      Complaint.find({ hostelId: targetHostelId })
        .populate('raisedBy', 'name phone roomId')
        .populate('roomId', 'roomNumber')
        .sort({ createdAt: -1 })
        .limit(100)
        .lean(),
      // Active Emergencies
      Emergency.find({ status: 'active' }).populate({
        path: 'raisedBy',
        match: { hostelId: targetHostelId },
        select: 'name roomId phone hostelId',
      }).populate('acknowledgedBy', 'name').sort({ createdAt: -1 }).lean(),
      // Recent Safety Incidents
      Complaint.find({ hostelId: targetHostelId, complaintType: 'safety' })
        .populate('raisedBy', 'name phone roomId')
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
      // Hostel configuration & rules
      Hostel.findById(targetHostelId).select('rules name timezone').lean(),
    ]);

    // Filter populated arrays where studentId / visitingStudentId / raisedBy matched hostel
    const studentIdsSet = new Set(students.map(s => String(s._id)));
    const pendingPermissions = pendingPermissionsDocs.filter(p => p.studentId != null && studentIdsSet.has(String(p.studentId._id || p.studentId)));
    const activeDisciplinary = activeDisciplinaryDocs.filter(d => d.studentId != null && studentIdsSet.has(String(d.studentId._id || d.studentId)));
    const activeEmergencies = activeEmergenciesDocs.filter(e => e.raisedBy != null && studentIdsSet.has(String(e.raisedBy._id || e.raisedBy)));
    const hostelVisitors = allVisitors.filter(v => v.visitingStudentId != null && studentIdsSet.has(String(v.visitingStudentId._id || v.visitingStudentId)));
    const approvedLeavesToday = approvedPermissionsToday.filter(p => p.studentId != null && studentIdsSet.has(String(p.studentId._id || p.studentId)));

    // Combined active violations for backward compatibility and discipline overview
    const combinedViolations = [
      ...activeCurfewDocs.map((cv) => ({
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

    // --- 1. STUDENT STATISTICS ---
    const totalStudents = students.length;
    const activeStudents = students.filter(s => s.status === 'active' || !s.status).length;
    const studentsOnLeaveDirect = students.filter(s => s.status === 'on-leave').length;
    const studentsWithApprovedLeave = approvedLeavesToday.length;
    const studentsCurrentlyOnLeave = Math.max(studentsOnLeaveDirect, studentsWithApprovedLeave);

    // --- 2. ROOM STATISTICS ---
    let totalRooms = rooms.length;
    let totalCapacity = 0;
    let totalOccupancy = 0;
    let occupiedRooms = 0;
    let partiallyOccupiedRooms = 0;
    let vacantRooms = 0;
    let maintenanceRooms = 0;

    for (const r of rooms) {
      const cap = Number(r.capacity) || 0;
      const occ = Number(r.currentOccupancy) || 0;
      totalCapacity += cap;
      totalOccupancy += occ;

      if (r.status === 'maintenance') {
        maintenanceRooms++;
      } else if (occ >= cap && cap > 0) {
        occupiedRooms++;
      } else if (occ > 0 && occ < cap) {
        partiallyOccupiedRooms++;
      } else if (occ === 0) {
        vacantRooms++;
      }
    }
    const occupancyRate = totalCapacity > 0 ? Math.round((totalOccupancy / totalCapacity) * 100) : 0;

    // --- 3. ATTENDANCE OVERVIEW ---
    const inside = attendanceDocs.filter(a => a.status === 'inside');
    const outside = attendanceDocs.filter(a => a.status === 'outside');
    const pending = attendanceDocs.filter(a => a.status === 'pending');
    const presentToday = inside.length;
    // Absent today = active students not inside and not on approved leave
    const absentToday = Math.max(0, activeStudents - presentToday - studentsCurrentlyOnLeave);
    const attendancePercentage = activeStudents > 0 ? Math.round((presentToday / activeStudents) * 100) : 0;

    // Late arrivals calculation
    const isWeekend = [0, 6].includes(now.getDay());
    const curfewTimeStr = (isWeekend && hostelDoc?.rules?.weekendCurfewTime) || hostelDoc?.rules?.curfewTime || '21:00';
    const [cHour, cMin] = curfewTimeStr.split(':').map(Number);
    const curfewThresholdToday = new Date(todayStart);
    curfewThresholdToday.setHours(cHour || 21, cMin || 0, 0, 0);

    const lateArrivals = attendanceDocs.filter(a => {
      if (!a.checkInTime) return false;
      const cin = new Date(a.checkInTime);
      return cin > curfewThresholdToday;
    }).length + activeCurfewDocs.length;

    // --- 4. LEAVE OVERVIEW ---
    const pendingLeaveCount = pendingPermissions.length;
    const approvedLeaveCount = approvedLeavesToday.length;
    const studentsOutsideCount = outside.length;
    // Overdue returns: approved leave where returnDate < now and student not inside
    const insideStudentIds = new Set(inside.map(a => String(a.studentId?._id || a.studentId)));
    const overdueApprovedLeaves = approvedLeavesToday.filter(p => {
      if (!p.returnDate) return false;
      const rDate = new Date(p.returnDate);
      const sId = String(p.studentId?._id || p.studentId);
      return rDate < now && !insideStudentIds.has(sId);
    });
    const overdueReturnsCount = Math.max(overdueLeaveViolations.length, overdueApprovedLeaves.length);

    // --- 5. COMPLAINT OVERVIEW ---
    const newComplaints = complaints.filter(c => c.status === 'open').length;
    const pendingComplaints = complaints.filter(c => ['open', 'assigned'].includes(c.status)).length;
    const inProgressComplaints = complaints.filter(c => c.status === 'in-progress').length;
    const resolvedComplaints = complaints.filter(c => ['resolved', 'closed'].includes(c.status)).length;
    const highPriorityComplaints = complaints.filter(c => ['high', 'urgent'].includes(c.priority) && !['resolved', 'closed'].includes(c.status)).length;

    // --- 6. MAINTENANCE OVERVIEW ---
    const maintenanceComplaints = complaints.filter(c => c.complaintType === 'maintenance');
    const newMaintenance = maintenanceComplaints.filter(c => c.status === 'open').length;
    const pendingMaintenance = maintenanceComplaints.filter(c => ['open', 'assigned'].includes(c.status)).length;
    const inProgressMaintenance = maintenanceComplaints.filter(c => c.status === 'in-progress').length;
    const completedMaintenance = maintenanceComplaints.filter(c => ['resolved', 'closed'].includes(c.status)).length;
    const emergencyMaintenance = maintenanceComplaints.filter(c => ['high', 'urgent'].includes(c.priority) && !['resolved', 'closed'].includes(c.status)).length;

    // --- 7. VISITOR OVERVIEW ---
    const todayVisitors = hostelVisitors.filter(v => {
      const vDate = v.visitDate ? new Date(v.visitDate) : new Date(v.createdAt);
      return vDate >= todayStart && vDate < todayEnd;
    }).length;
    const currentVisitorsInside = hostelVisitors.filter(v => v.entryTime != null && v.exitTime == null && v.status === 'approved').length;
    const pendingVisitors = hostelVisitors.filter(v => v.status === 'pending');

    // --- 8. DISCIPLINE OVERVIEW ---
    const studentsWithDisciplinarySet = new Set();
    activeCurfewDocs.forEach(c => {
      if (c.studentId) studentsWithDisciplinarySet.add(String(c.studentId._id || c.studentId));
    });
    activeDisciplinary.forEach(d => {
      if (d.studentId) studentsWithDisciplinarySet.add(String(d.studentId._id || d.studentId));
    });
    const studentsWithIssues = studentsWithDisciplinarySet.size;
    const pendingDisciplinaryActions = activeDisciplinary.length;

    // --- 9. EMERGENCY & RECENT INCIDENTS ---
    const hasActiveEmergency = activeEmergencies.length > 0;
    const recentIncidentsCombined = [
      ...activeEmergencies.map(e => ({
        _id: e._id,
        type: 'emergency',
        title: `EMERGENCY: ${e.emergencyType?.toUpperCase() || 'ALERT'}`,
        description: e.description || 'Emergency alert triggered',
        createdAt: e.createdAt,
        studentName: e.raisedBy?.name,
        roomNumber: e.raisedBy?.roomId?.roomNumber || '—',
        status: e.status,
      })),
      ...recentSafetyComplaints.map(sc => ({
        _id: sc._id,
        type: 'incident',
        title: sc.title,
        description: sc.description,
        createdAt: sc.createdAt,
        studentName: sc.raisedBy?.name,
        roomNumber: sc.roomId?.roomNumber || '—',
        status: sc.status,
      })),
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 8);

    // --- 10. CURFEW STATUS ---
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
        hostel: {
          id: targetHostelId,
          name: hostelDoc?.name || 'Hostel Campus',
        },
        studentStats: {
          total: totalStudents,
          active: activeStudents,
          onLeave: studentsCurrentlyOnLeave,
          absent: absentToday,
        },
        roomStats: {
          totalRooms,
          occupiedRooms,
          partiallyOccupiedRooms,
          vacantRooms,
          maintenanceRooms,
          totalCapacity,
          totalOccupancy,
          occupancyRate,
        },
        attendanceOverview: {
          presentToday,
          absentToday,
          lateArrivals,
          attendancePercentage,
          inside,
          outside,
          pending,
        },
        leaveOverview: {
          pendingApplications: pendingLeaveCount,
          approvedLeaves: approvedLeaveCount,
          studentsOutside: studentsOutsideCount,
          overdueReturns: overdueReturnsCount,
          pendingList: pendingPermissions.slice(0, 10),
        },
        complaintOverview: {
          newComplaints,
          pendingComplaints,
          inProgressComplaints,
          resolvedComplaints,
          highPriorityComplaints,
          recentComplaints: complaints.slice(0, 8),
        },
        maintenanceOverview: {
          newRequests: newMaintenance,
          pendingRequests: pendingMaintenance,
          inProgressRepairs: inProgressMaintenance,
          completedRepairs: completedMaintenance,
          emergencyMaintenance,
          recentMaintenance: maintenanceComplaints.slice(0, 8),
        },
        visitorOverview: {
          todayVisitors,
          currentInside: currentVisitorsInside,
          pendingRequests: pendingVisitors.length,
          recentVisitors: hostelVisitors.slice(0, 8),
        },
        disciplineOverview: {
          recentIncidents: combinedViolations.slice(0, 10),
          studentsWithIssues,
          pendingDisciplinaryActions,
          curfewViolationsCount: activeCurfewDocs.length,
        },
        emergencyOverview: {
          activeEmergencies,
          hasActiveEmergency,
          recentIncidents: recentIncidentsCombined,
        },
        // Legacy & backward compatible keys
        summary: {
          totalStudents,
          inside: presentToday,
          outside: studentsOutsideCount,
          pending: pending.length,
        },
        attendance: {
          inside,
          outside,
          pending,
        },
        pendingPermissions: pendingLeaveCount,
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
    console.error('getDashboard error:', error);
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

// ============ LEAVE & PERMISSION MANAGEMENT ============

/**
 * Get all leave applications with search, status filters, date range filters, and KPI summary
 */
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

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

    // Base query for students in this hostel
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

    // Query on Permission
    const filter = {
      $or: [
        { hostelId: targetHostelId },
        { studentId: { $in: Object.keys(studentMap) } },
      ],
    };

    if (allowedStudentIds.length === 0 && (search || floor || room)) {
      return res.status(200).json({
        success: true,
        data: [],
        stats: { total: 0, pending: 0, approved: 0, checkedOut: 0, overdue: 0, returned: 0, rejected: 0, cancelled: 0 },
        pagination: { total: 0, page: pageNum, limit: limitNum, totalPages: 0 },
      });
    }

    if (search || floor || room) {
      filter.studentId = { $in: allowedStudentIds };
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

    const [total, permissions, allHostelLeaves] = await Promise.all([
      Permission.countDocuments(filter),
      Permission.find(filter)
        .populate({
          path: 'studentId',
          select: 'name email phone studentId roomId gender course year profileImage parentContact emergencyContact status',
          populate: { path: 'roomId', select: 'roomNumber floorNumber' },
        })
        .populate('approvedBy', 'name role')
        .populate('cancelledBy', 'name role')
        .sort(sortObj)
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(),
      Permission.find({
        $or: [
          { hostelId: targetHostelId },
          { studentId: { $in: Object.keys(studentMap) } },
        ],
      }).select('status returnDate requestedDate').lean(),
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

    const permission = await Permission.findById(id).populate('studentId');
    if (!permission) {
      return res.status(404).json({ success: false, message: 'Leave application not found' });
    }

    const targetHostelId = await resolveWardenHostelId(req);
    const student = permission.studentId;
    const studentHostelId = String(student?.hostelId || permission.hostelId || '');

    if (!studentHostelId || studentHostelId !== String(targetHostelId)) {
      return res.status(403).json({ success: false, message: 'Not authorized to approve leaves for another hostel' });
    }

    if (permission.status === 'approved' || permission.status === 'checked-out') {
      return res.status(400).json({ success: false, message: 'This leave application is already approved' });
    }

    if (permission.returnDate && new Date(permission.requestedDate) > new Date(permission.returnDate)) {
      return res.status(400).json({ success: false, message: 'Invalid dates: return date cannot be before departure date' });
    }

    // Check for overlapping approved/checked-out leave for this student
    const sStart = new Date(permission.requestedDate);
    const sEnd = permission.returnDate ? new Date(permission.returnDate) : sStart;

    const overlap = await Permission.findOne({
      studentId: student._id,
      _id: { $ne: permission._id },
      status: { $in: ['approved', 'checked-out'] },
      requestedDate: { $lte: sEnd },
      $or: [
        { returnDate: { $gte: sStart } },
        { returnDate: null },
      ],
    });

    if (overlap) {
      return res.status(400).json({
        success: false,
        message: `Overlapping leave conflict: Student already has an active ${overlap.status} leave from ${new Date(overlap.requestedDate).toLocaleDateString()} to ${overlap.returnDate ? new Date(overlap.returnDate).toLocaleDateString() : 'N/A'}.`,
      });
    }

    const beforeState = permission.toObject();

    permission.status = 'approved';
    permission.approvedBy = req.user._id || req.user.id;
    permission.approvedAt = new Date();
    if (wardenRemarks !== undefined) {
      permission.wardenRemarks = String(wardenRemarks).trim();
    }
    if (!permission.hostelId) {
      permission.hostelId = targetHostelId;
    }

    await permission.save();
    await permission.populate('approvedBy', 'name role');

    // Create In-App Notification for Student
    try {
      await Notification.create({
        title: 'Leave Request Approved',
        message: `Your ${permission.permissionType} request from ${new Date(permission.requestedDate).toLocaleDateString()} to ${permission.returnDate ? new Date(permission.returnDate).toLocaleDateString() : 'N/A'} has been approved.${wardenRemarks ? ` Note: ${wardenRemarks}` : ''}`,
        type: 'alert',
        priority: 'medium',
        hostelId: targetHostelId,
        createdBy: req.user._id || req.user.id,
        recipients: [student._id],
        targetAudience: 'students',
      });
      emitToUser(String(student._id), 'notification', {
        title: 'Leave Request Approved',
        message: 'Your leave application has been approved by the Warden.',
      });
    } catch (notifErr) {
      console.warn('Notification creation warning:', notifErr.message);
    }

    // Alert Module Event
    hostelEventEmitter.emit(ALERT_TYPES.LEAVE_APPROVED, {
      studentId: String(student._id),
      hostelId: String(targetHostelId),
      permissionId: String(permission._id),
      returnDate: permission.returnDate,
    });

    // Audit Log
    try {
      await AuditLog.create({
        action: 'leave_approved',
        entityType: 'permission',
        entityId: permission._id,
        performedBy: req.user._id || req.user.id,
        changes: {
          before: beforeState,
          after: permission.toObject(),
        },
        ipAddress: req.ip || '',
        userAgent: req.headers?.['user-agent'] || '',
      });
    } catch (auditErr) {
      console.warn('AuditLog creation warning:', auditErr.message);
    }

    res.status(200).json({
      success: true,
      data: permission,
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

    const permission = await Permission.findById(id).populate('studentId');
    if (!permission) {
      return res.status(404).json({ success: false, message: 'Leave application not found' });
    }

    const targetHostelId = await resolveWardenHostelId(req);
    const student = permission.studentId;
    const studentHostelId = String(student?.hostelId || permission.hostelId || '');

    if (!studentHostelId || studentHostelId !== String(targetHostelId)) {
      return res.status(403).json({ success: false, message: 'Not authorized to reject leaves for another hostel' });
    }

    const beforeState = permission.toObject();

    permission.status = 'rejected';
    permission.rejectionReason = String(rejectionReason).trim();
    permission.approvedBy = req.user._id || req.user.id;
    permission.approvedAt = new Date();
    if (wardenRemarks) {
      permission.wardenRemarks = String(wardenRemarks).trim();
    }

    await permission.save();
    await permission.populate('approvedBy', 'name role');

    // In-App Notification for Student
    try {
      await Notification.create({
        title: 'Leave Request Rejected',
        message: `Your ${permission.permissionType} request was rejected. Reason: ${rejectionReason.trim()}`,
        type: 'alert',
        priority: 'high',
        hostelId: targetHostelId,
        createdBy: req.user._id || req.user.id,
        recipients: [student._id],
        targetAudience: 'students',
      });
      emitToUser(String(student._id), 'notification', {
        title: 'Leave Request Rejected',
        message: `Your leave request was rejected: ${rejectionReason.trim()}`,
      });
    } catch (notifErr) {
      console.warn('Notification creation warning:', notifErr.message);
    }

    // Alert Module Event
    hostelEventEmitter.emit(ALERT_TYPES.LEAVE_REJECTED, {
      studentId: String(student._id),
      hostelId: String(targetHostelId),
      permissionId: String(permission._id),
      reason: rejectionReason.trim(),
    });

    // Audit Log
    try {
      await AuditLog.create({
        action: 'leave_rejected',
        entityType: 'permission',
        entityId: permission._id,
        performedBy: req.user._id || req.user.id,
        changes: {
          before: beforeState,
          after: permission.toObject(),
        },
        ipAddress: req.ip || '',
        userAgent: req.headers?.['user-agent'] || '',
      });
    } catch (auditErr) {
      console.warn('AuditLog creation warning:', auditErr.message);
    }

    res.status(200).json({
      success: true,
      data: permission,
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

    const permission = await Permission.findById(id).populate('studentId');
    if (!permission) {
      return res.status(404).json({ success: false, message: 'Leave application not found' });
    }

    const targetHostelId = await resolveWardenHostelId(req);
    const student = permission.studentId;
    const studentHostelId = String(student?.hostelId || permission.hostelId || '');

    if (!studentHostelId || studentHostelId !== String(targetHostelId)) {
      return res.status(403).json({ success: false, message: 'Not authorized to cancel leaves for another hostel' });
    }

    const beforeState = permission.toObject();

    permission.status = 'cancelled';
    permission.cancellationReason = String(cancellationReason).trim();
    permission.cancelledBy = req.user._id || req.user.id;
    permission.cancelledAt = new Date();

    await permission.save();

    // If student was on leave in their profile, restore to active
    if (student && student.status === 'on-leave') {
      student.status = 'active';
      await student.save();
    }

    // In-App Notification
    try {
      await Notification.create({
        title: 'Leave Revoked / Cancelled',
        message: `Your leave request has been cancelled by the Warden. Reason: ${cancellationReason.trim()}`,
        type: 'alert',
        priority: 'high',
        hostelId: targetHostelId,
        createdBy: req.user._id || req.user.id,
        recipients: [student._id],
        targetAudience: 'students',
      });
      emitToUser(String(student._id), 'notification', {
        title: 'Leave Cancelled',
        message: `Your leave was cancelled by the Warden: ${cancellationReason.trim()}`,
      });
    } catch (notifErr) {
      console.warn('Notification creation warning:', notifErr.message);
    }

    // Alert Module Event
    hostelEventEmitter.emit(ALERT_TYPES.LEAVE_CANCELLED, {
      studentId: String(student._id),
      hostelId: String(targetHostelId),
      permissionId: String(permission._id),
      reason: cancellationReason.trim(),
    });

    // Audit Log
    try {
      await AuditLog.create({
        action: 'leave_cancelled',
        entityType: 'permission',
        entityId: permission._id,
        performedBy: req.user._id || req.user.id,
        changes: {
          before: beforeState,
          after: permission.toObject(),
        },
        ipAddress: req.ip || '',
        userAgent: req.headers?.['user-agent'] || '',
      });
    } catch (auditErr) {
      console.warn('AuditLog creation warning:', auditErr.message);
    }

    res.status(200).json({
      success: true,
      data: permission,
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

    const permission = await Permission.findById(id).populate('studentId');
    if (!permission) {
      return res.status(404).json({ success: false, message: 'Leave application not found' });
    }

    const targetHostelId = await resolveWardenHostelId(req);
    const student = permission.studentId;
    const studentHostelId = String(student?.hostelId || permission.hostelId || '');

    if (!studentHostelId || studentHostelId !== String(targetHostelId)) {
      return res.status(403).json({ success: false, message: 'Not authorized to manage leaves for another hostel' });
    }

    if (permission.status !== 'approved') {
      return res.status(400).json({
        success: false,
        message: `Cannot record check-out: Leave is currently '${permission.status}'. It must be 'approved' first.`,
      });
    }

    const beforeState = permission.toObject();
    const departureTime = actualCheckOutTime ? new Date(actualCheckOutTime) : new Date();

    permission.status = 'checked-out';
    permission.actualCheckOutTime = departureTime;
    if (remarks) {
      permission.wardenRemarks = (permission.wardenRemarks ? permission.wardenRemarks + ' | ' : '') + String(remarks).trim();
    }

    await permission.save();

    // Update student status to on-leave
    if (student && student.status !== 'on-leave') {
      student.status = 'on-leave';
      await student.save();
    }

    // Gate Event telemetry
    await logGateEvent({
      studentId: student._id,
      hostelId: targetHostelId,
      type: 'out',
      time: departureTime,
      verificationMethod: 'manual',
      source: 'warden',
      reason: 'leave_departure',
    }).catch((err) => console.warn('GateEvent log (recordLeaveCheckOut):', err?.message));

    // Notification
    try {
      await Notification.create({
        title: 'Departure Recorded',
        message: `Your leave departure has been verified. Expected return: ${permission.returnDate ? new Date(permission.returnDate).toLocaleString() : 'N/A'}`,
        type: 'alert',
        priority: 'medium',
        hostelId: targetHostelId,
        createdBy: req.user._id || req.user.id,
        recipients: [student._id],
        targetAudience: 'students',
      });
    } catch (notifErr) {
      console.warn('Notification warning:', notifErr.message);
    }

    // Audit Log
    try {
      await AuditLog.create({
        action: 'leave_checkout',
        entityType: 'permission',
        entityId: permission._id,
        performedBy: req.user._id || req.user.id,
        changes: {
          before: beforeState,
          after: permission.toObject(),
        },
        ipAddress: req.ip || '',
        userAgent: req.headers?.['user-agent'] || '',
      });
    } catch (auditErr) {
      console.warn('AuditLog warning:', auditErr.message);
    }

    res.status(200).json({
      success: true,
      data: permission,
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

    const permission = await Permission.findById(id).populate('studentId');
    if (!permission) {
      return res.status(404).json({ success: false, message: 'Leave application not found' });
    }

    const targetHostelId = await resolveWardenHostelId(req);
    const student = permission.studentId;
    const studentHostelId = String(student?.hostelId || permission.hostelId || '');

    if (!studentHostelId || studentHostelId !== String(targetHostelId)) {
      return res.status(403).json({ success: false, message: 'Not authorized to manage leaves for another hostel' });
    }

    if (permission.status !== 'checked-out' && permission.status !== 'approved') {
      return res.status(400).json({
        success: false,
        message: `Cannot record return: Leave is currently '${permission.status}'.`,
      });
    }

    const beforeState = permission.toObject();
    const returnTime = actualReturnTime ? new Date(actualReturnTime) : new Date();

    permission.status = 'returned';
    permission.actualReturnTime = returnTime;
    if (remarks) {
      permission.wardenRemarks = (permission.wardenRemarks ? permission.wardenRemarks + ' | ' : '') + String(remarks).trim();
    }

    await permission.save();

    // Restore student status to active
    if (student && student.status === 'on-leave') {
      student.status = 'active';
      await student.save();
    }

    // Auto-resolve any open LeaveViolation for this permission
    try {
      await LeaveViolation.updateMany(
        { permissionId: permission._id, status: 'open' },
        {
          status: 'returned',
          actualReturnTime: returnTime,
          resolvedBy: req.user._id || req.user.id,
          resolvedAt: new Date(),
          resolutionNote: remarks || 'Student returned to hostel recorded by warden',
        }
      );
    } catch (lvErr) {
      console.warn('LeaveViolation resolve warning:', lvErr.message);
    }

    // Gate Event telemetry
    await logGateEvent({
      studentId: student._id,
      hostelId: targetHostelId,
      type: 'in',
      time: returnTime,
      verificationMethod: 'manual',
      source: 'warden',
      reason: 'leave_return',
    }).catch((err) => console.warn('GateEvent log (recordLeaveReturn):', err?.message));

    // Curfew auto-resolve
    CurfewAutomationService.handleStudentReturn(String(student._id), returnTime).catch((err) =>
      console.warn('Curfew auto-resolve (recordLeaveReturn):', err?.message)
    );

    // Notification
    try {
      await Notification.create({
        title: 'Return Verified',
        message: 'Welcome back to the hostel! Your return has been verified by the Warden.',
        type: 'alert',
        priority: 'medium',
        hostelId: targetHostelId,
        createdBy: req.user._id || req.user.id,
        recipients: [student._id],
        targetAudience: 'students',
      });
      emitToUser(String(student._id), 'notification', {
        title: 'Return Verified',
        message: 'Your return to the hostel has been verified by the Warden.',
      });
    } catch (notifErr) {
      console.warn('Notification warning:', notifErr.message);
    }

    // Audit Log
    try {
      await AuditLog.create({
        action: 'leave_returned',
        entityType: 'permission',
        entityId: permission._id,
        performedBy: req.user._id || req.user.id,
        changes: {
          before: beforeState,
          after: permission.toObject(),
        },
        ipAddress: req.ip || '',
        userAgent: req.headers?.['user-agent'] || '',
      });
    } catch (auditErr) {
      console.warn('AuditLog warning:', auditErr.message);
    }

    res.status(200).json({
      success: true,
      data: permission,
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
      parentContactInfo: parentContactInfo || student.parentContact || '',
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
          }).catch(() => {});
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
      }).catch(() => {});

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
      }).catch(() => {});

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
    }).catch(() => {});

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

// ============ WARDEN QUICK ACTIONS & OPERATIONS ============

// Mark Attendance (Quick Action)
exports.markAttendance = async (req, res) => {
  try {
    const { studentId, status, notes } = req.body;
    const rawStatus = status || req.body.attendanceStatus;
    if (!studentId || !rawStatus) {
      return res.status(400).json({ success: false, message: 'Student ID and status are required' });
    }

    let mappedStatus = rawStatus;
    let attStatus = 'present';
    if (rawStatus === 'present') {
      mappedStatus = 'inside';
      attStatus = 'present';
    } else if (rawStatus === 'late') {
      mappedStatus = 'inside';
      attStatus = 'late';
    } else if (rawStatus === 'absent') {
      mappedStatus = 'outside';
      attStatus = 'absent';
    } else if (rawStatus === 'inside') {
      mappedStatus = 'inside';
      attStatus = 'present';
    } else if (rawStatus === 'outside') {
      mappedStatus = 'outside';
      attStatus = 'absent';
    } else if (rawStatus === 'on-leave') {
      mappedStatus = 'on-leave';
      attStatus = 'on-leave';
    }

    if (!['inside', 'outside', 'on-leave', 'pending'].includes(mappedStatus)) {
      return res.status(400).json({ success: false, message: 'Invalid attendance status' });
    }

    const targetHostelId = await resolveWardenHostelId(req);
    if (!targetHostelId) {
      return res.status(400).json({ success: false, message: 'Warden has no assigned hostel' });
    }

    const student = await User.findById(studentId);
    if (!student || String(student.hostelId) !== String(targetHostelId)) {
      return res.status(404).json({ success: false, message: 'Student not found in this hostel' });
    }

    const hostel = await Hostel.findById(targetHostelId).select('timezone').lean();
    const hostelTimezone = hostel?.timezone || 'Asia/Kolkata';
    const now = new Date();
    const businessDate = getBusinessDate(now, hostelTimezone);
    const businessDateStr = getBusinessDateString(now, hostelTimezone);

    let attendance = await Attendance.findOne({
      studentId: student._id,
      date: businessDate,
    });

    if (!attendance) {
      attendance = new Attendance({
        studentId: student._id,
        hostelId: targetHostelId,
        date: businessDate,
        businessDate: businessDateStr,
        source: 'warden',
        markedBy: req.user._id,
      });
    }

    attendance.status = mappedStatus;
    attendance.attendanceStatus = attStatus;
    attendance.isLate = attStatus === 'late';
    if (notes) attendance.remarks = String(notes).trim();
    attendance.verifiedBy = req.user.id;
    attendance.verificationMethod = 'manual';
    attendance.verificationStatus = 'verified';

    if (mappedStatus === 'inside') {
      attendance.checkInTime = now;
    } else if (mappedStatus === 'outside') {
      attendance.checkOutTime = now;
    }

    await attendance.save();

    // If marked on-leave, also update student profile status
    if (status === 'on-leave' && student.status !== 'on-leave') {
      student.status = 'on-leave';
      await student.save();
    } else if (status === 'inside' && student.status === 'on-leave') {
      student.status = 'active';
      await student.save();
    }

    // Gate Event log
    await logGateEvent({
      studentId: student._id,
      hostelId: targetHostelId,
      type: status === 'inside' ? 'in' : 'out',
      time: now,
      verificationMethod: 'manual',
      attendanceId: attendance._id,
      source: 'warden',
    }).catch((err) => console.warn('GateEvent log (markAttendance):', err?.message));

    // Handle curfew return if inside
    if (status === 'inside') {
      CurfewAutomationService.handleStudentReturn(String(student._id), now).catch((err) =>
        console.warn('Curfew auto-resolve (markAttendance):', err?.message)
      );
      hostelEventEmitter.emit(hostelEventEmitter.EVENTS.CHECKIN, {
        studentId: String(student._id),
        hostelId: String(targetHostelId),
        time: now,
        source: 'warden',
      });
    } else {
      hostelEventEmitter.emit(hostelEventEmitter.EVENTS.CHECKOUT, {
        studentId: String(student._id),
        hostelId: String(targetHostelId),
        time: now,
        source: 'warden',
      });
    }

    res.status(200).json({ success: true, data: attendance, message: 'Attendance updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get Hostel Students (for dropdown selectors)
exports.getHostelStudents = async (req, res) => {
  try {
    const targetHostelId = await resolveWardenHostelId(req);
    if (!targetHostelId) {
      return res.status(200).json({ success: true, data: [] });
    }

    const students = await User.find({ hostelId: targetHostelId, role: 'student' })
      .select('name email phone roomId studentId status')
      .populate('roomId', 'roomNumber')
      .sort({ name: 1 })
      .lean();

    res.status(200).json({ success: true, data: students });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Create Visitor (Quick Action)
exports.createVisitor = async (req, res) => {
  try {
    const { visitorName, visitorPhone, visitorIdProof, visitingStudentId, purpose, visitDate, autoApprove } = req.body;
    if (!visitorName || !visitorPhone || !visitingStudentId || !purpose) {
      return res.status(400).json({ success: false, message: 'Visitor name, phone, student, and purpose are required' });
    }

    const targetHostelId = await resolveWardenHostelId(req);
    const student = await User.findById(visitingStudentId);
    if (!student || String(student.hostelId) !== String(targetHostelId)) {
      return res.status(404).json({ success: false, message: 'Visiting student not found in this hostel' });
    }

    const now = new Date();
    const visitor = await Visitor.create({
      visitorName,
      visitorPhone,
      visitorIdProof: visitorIdProof || '',
      visitingStudentId,
      purpose,
      visitDate: visitDate ? new Date(visitDate) : now,
      status: autoApprove ? 'approved' : 'pending',
      approvedBy: autoApprove ? req.user.id : undefined,
      entryTime: autoApprove ? now : undefined,
    });

    const populatedVisitor = await Visitor.findById(visitor._id).populate('visitingStudentId', 'name roomId phone');
    res.status(201).json({ success: true, data: populatedVisitor, message: 'Visitor registered successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Checkout Visitor
exports.checkoutVisitor = async (req, res) => {
  try {
    const { visitorId } = req.params;
    const visitor = await Visitor.findById(visitorId).populate('visitingStudentId', 'hostelId');
    if (!visitor) {
      return res.status(404).json({ success: false, message: 'Visitor record not found' });
    }

    const targetHostelId = await resolveWardenHostelId(req);
    const studentHostelId = String(visitor.visitingStudentId?.hostelId || '');
    if (!studentHostelId || studentHostelId !== String(targetHostelId)) {
      return res.status(403).json({ success: false, message: 'Not authorized for this hostel' });
    }

    visitor.exitTime = new Date();
    visitor.status = 'completed';
    await visitor.save();

    res.status(200).json({ success: true, data: visitor, message: 'Visitor checked out successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Create Announcement (Quick Action)
exports.createAnnouncement = async (req, res) => {
  try {
    const { title, message, type = 'announcement', targetAudience = 'all', priority = 'medium' } = req.body;
    if (!title || !message) {
      return res.status(400).json({ success: false, message: 'Title and message are required' });
    }

    const targetHostelId = await resolveWardenHostelId(req);
    if (!targetHostelId) {
      return res.status(400).json({ success: false, message: 'Warden has no assigned hostel' });
    }

    let recipients = [];
    if (targetAudience === 'all') {
      const users = await User.find({ hostelId: targetHostelId }).select('_id');
      recipients = users.map(u => u._id);
    } else if (targetAudience === 'students') {
      const students = await User.find({ hostelId: targetHostelId, role: 'student' }).select('_id');
      recipients = students.map(s => s._id);
    } else if (targetAudience === 'staff') {
      const staff = await User.find({ hostelId: targetHostelId, role: { $in: ['cleaner', 'supervisor', 'security', 'warden'] } }).select('_id');
      recipients = staff.map(s => s._id);
    }

    const notification = await Notification.create({
      title,
      message,
      type,
      priority,
      targetAudience,
      recipients,
      createdBy: req.user.id,
      hostelId: targetHostelId,
    });

    res.status(201).json({ success: true, data: notification, message: 'Announcement created successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Report Maintenance Issue (Quick Action)
exports.reportMaintenance = async (req, res) => {
  try {
    const { title, description, roomId, priority = 'medium' } = req.body;
    if (!title || !description) {
      return res.status(400).json({ success: false, message: 'Title and description are required' });
    }

    const targetHostelId = await resolveWardenHostelId(req);
    if (!targetHostelId) {
      return res.status(400).json({ success: false, message: 'Warden has no assigned hostel' });
    }

    const complaint = await Complaint.create({
      raisedBy: req.user.id,
      complaintType: 'maintenance',
      title,
      description,
      roomId: roomId || undefined,
      hostelId: targetHostelId,
      priority: ['low', 'medium', 'high', 'urgent'].includes(priority) ? priority : 'medium',
      status: 'open',
    });

    const populated = await Complaint.findById(complaint._id)
      .populate('raisedBy', 'name')
      .populate('roomId', 'roomNumber');

    res.status(201).json({ success: true, data: populated, message: 'Maintenance request reported successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============ COMPLAINT MANAGEMENT MODULE ============

/**
 * Get Paginated, Searchable & Filterable Complaints List with KPI statistics
 */
exports.getComplaints = async (req, res) => {
  try {
    const targetHostelId = await resolveWardenHostelId(req);
    if (!targetHostelId) {
      return res.status(200).json({
        success: true,
        data: [],
        stats: { total: 0, open: 0, assigned: 0, inProgress: 0, resolved: 0, closed: 0, critical: 0, escalated: 0 },
        pagination: { total: 0, page: 1, limit: 20, totalPages: 1 },
      });
    }

    const {
      status,
      type,
      category,
      priority,
      isEscalated,
      search,
      startDate,
      endDate,
      page = 1,
      limit = 20,
    } = req.query;

    const filter = { hostelId: targetHostelId };

    // Status filter
    if (status && status !== 'all') {
      if (status === 'pending' || status === 'active') {
        filter.status = { $in: ['open', 'assigned', 'in-progress'] };
      } else {
        filter.status = status.trim().toLowerCase();
      }
    }

    // Category / Type filter
    const cat = category || type;
    if (cat && cat !== 'all') {
      filter.complaintType = cat.trim().toLowerCase();
    }

    // Priority filter
    if (priority && priority !== 'all') {
      const p = priority.trim().toLowerCase();
      if (p === 'critical' || p === 'urgent') {
        filter.priority = { $in: ['critical', 'urgent'] };
      } else {
        filter.priority = p;
      }
    }

    // Escalated filter
    if (isEscalated !== undefined && isEscalated !== '') {
      filter.isEscalated = isEscalated === 'true' || isEscalated === true;
    }

    // Date range filter
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) {
        filter.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }

    // Keyword Search
    if (search && String(search).trim()) {
      const q = String(search).trim();
      const regex = new RegExp(q, 'i');

      // Search matching users (students)
      const matchingStudents = await User.find({
        hostelId: targetHostelId,
        $or: [{ name: regex }, { studentId: regex }, { phone: regex }],
      }).select('_id').lean();
      const studentIds = matchingStudents.map((s) => s._id);

      // Search matching rooms
      const RoomModel = mongoose.model('Room');
      const matchingRooms = await RoomModel.find({
        hostelId: targetHostelId,
        roomNumber: regex,
      }).select('_id').lean();
      const roomIds = matchingRooms.map((r) => r._id);

      filter.$or = [
        { title: regex },
        { description: regex },
        { assignedStaffName: regex },
        { raisedBy: { $in: studentIds } },
        { roomId: { $in: roomIds } },
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    // Fetch complaints with pagination
    const [complaints, totalMatching] = await Promise.all([
      Complaint.find(filter)
        .populate({
          path: 'raisedBy',
          select: 'name email phone studentId roomId gender course year profileImage',
          populate: { path: 'roomId', select: 'roomNumber floorNumber' },
        })
        .populate('roomId', 'roomNumber floorNumber')
        .populate('assignedTo', 'name email phone role')
        .populate('resolvedBy', 'name role')
        .populate('closedBy', 'name role')
        .populate('escalatedBy', 'name role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Complaint.countDocuments(filter),
    ]);

    // Aggregate hostel-wide stats
    const allHostelComplaints = await Complaint.find({ hostelId: targetHostelId })
      .select('status priority isEscalated')
      .lean();

    let openCount = 0;
    let assignedCount = 0;
    let inProgressCount = 0;
    let resolvedCount = 0;
    let closedCount = 0;
    let criticalCount = 0;
    let escalatedCount = 0;

    for (const c of allHostelComplaints) {
      if (c.status === 'open') openCount++;
      else if (c.status === 'assigned') assignedCount++;
      else if (c.status === 'in-progress' || c.status === 'reopened') inProgressCount++;
      else if (c.status === 'resolved') resolvedCount++;
      else if (c.status === 'closed') closedCount++;

      if (c.priority === 'critical' || c.priority === 'urgent') criticalCount++;
      if (c.isEscalated) escalatedCount++;
    }

    res.status(200).json({
      success: true,
      data: complaints,
      stats: {
        total: allHostelComplaints.length,
        open: openCount,
        assigned: assignedCount,
        inProgress: inProgressCount,
        resolved: resolvedCount,
        closed: closedCount,
        critical: criticalCount,
        escalated: escalatedCount,
      },
      pagination: {
        total: totalMatching,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(totalMatching / limitNum) || 1,
      },
    });
  } catch (error) {
    console.error('Error in getComplaints:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

/**
 * Get full complaint details by ID
 */
exports.getComplaintDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const complaint = await Complaint.findById(id)
      .populate({
        path: 'raisedBy',
        select: 'name email phone studentId roomId gender course year profileImage parentContact emergencyContact',
        populate: { path: 'roomId', select: 'roomNumber floorNumber' },
      })
      .populate('roomId', 'roomNumber floorNumber')
      .populate('assignedTo', 'name email phone role')
      .populate('resolvedBy', 'name role')
      .populate('closedBy', 'name role')
      .populate('reopenedBy', 'name role')
      .populate('escalatedBy', 'name role')
      .populate('timeline.performedBy', 'name role')
      .populate('remarks.author', 'name role')
      .lean();

    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found' });
    }

    const targetHostelId = await resolveWardenHostelId(req);
    if (String(complaint.hostelId) !== String(targetHostelId)) {
      return res.status(403).json({ success: false, message: 'Not authorized for this hostel complaint' });
    }

    res.status(200).json({ success: true, data: complaint });
  } catch (error) {
    console.error('Error in getComplaintDetails:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

const getComplaintActorRole = (u) => (Array.isArray(u?.role) ? u.role[0] || 'warden' : String(u?.role || 'warden'));
const getComplaintActorName = (u) => String(u?.name || 'Warden');

/**
 * Assign Complaint to a staff user or external technician
 */
exports.assignComplaint = async (req, res) => {
  try {
    const { id } = req.params;
    const { assignedTo, assignedStaffName, assignedStaffPhone, assignedStaffRole, remarks } = req.body;

    const complaint = await Complaint.findById(id);
    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found' });
    }

    const targetHostelId = await resolveWardenHostelId(req);
    if (String(complaint.hostelId) !== String(targetHostelId)) {
      return res.status(403).json({ success: false, message: 'Not authorized for this hostel complaint' });
    }

    const beforeState = complaint.toObject();
    let staffName = assignedStaffName || '';
    let staffRole = assignedStaffRole || 'Staff';

    if (assignedTo) {
      const staffUser = await User.findById(assignedTo).select('name role phone').lean();
      if (staffUser) {
        complaint.assignedTo = staffUser._id;
        staffName = staffUser.name;
        staffRole = getComplaintActorRole(staffUser);
        if (staffUser.phone && !assignedStaffPhone) {
          complaint.assignedStaffPhone = staffUser.phone;
        }
      }
    } else {
      complaint.assignedTo = undefined;
    }

    if (assignedStaffName) complaint.assignedStaffName = String(assignedStaffName).trim();
    if (assignedStaffPhone) complaint.assignedStaffPhone = String(assignedStaffPhone).trim();
    if (assignedStaffRole) complaint.assignedStaffRole = String(assignedStaffRole).trim();
    complaint.assignedAt = new Date();

    // Auto-advance status to assigned if currently open
    const prevStatus = complaint.status;
    if (complaint.status === 'open') {
      complaint.status = 'assigned';
    }

    // Add timeline entry
    complaint.timeline.push({
      action: 'assigned',
      performedBy: req.user._id || req.user.id,
      performedByName: getComplaintActorName(req.user),
      performedByRole: getComplaintActorRole(req.user),
      notes: `Assigned to ${staffName || 'staff member'} (${staffRole}). ${remarks ? `Remarks: ${remarks}` : ''}`.trim(),
      fromStatus: prevStatus,
      toStatus: complaint.status,
      timestamp: new Date(),
    });

    // If remarks provided, add to remarks
    if (remarks && String(remarks).trim()) {
      complaint.remarks.push({
        author: req.user._id || req.user.id,
        authorName: getComplaintActorName(req.user),
        authorRole: getComplaintActorRole(req.user),
        comment: `Assignment note: ${String(remarks).trim()}`,
        createdAt: new Date(),
      });
    }

    complaint.updatedAt = new Date();
    await complaint.save();

    // In-App Notification for student
    try {
      await Notification.create({
        title: 'Complaint Assigned',
        message: `Your complaint "${complaint.title}" has been assigned to ${staffName || 'hostel staff'}.`,
        type: 'alert',
        priority: 'medium',
        hostelId: targetHostelId,
        createdBy: req.user._id || req.user.id,
        recipients: [complaint.raisedBy],
        targetAudience: 'students',
      });
      emitToUser(String(complaint.raisedBy), 'notification', {
        title: 'Complaint Assigned',
        message: `Your complaint "${complaint.title}" has been assigned to ${staffName || 'maintenance'}.`,
      });
    } catch (notifErr) {
      console.warn('Notification error (assignComplaint):', notifErr.message);
    }

    // Audit Log
    try {
      await AuditLog.create({
        action: 'complaint_assigned',
        entityType: 'complaint',
        entityId: complaint._id,
        performedBy: req.user._id || req.user.id,
        changes: { before: beforeState, after: complaint.toObject() },
        ipAddress: req.ip || '',
        userAgent: req.headers?.['user-agent'] || '',
      });
    } catch (auditErr) {
      console.warn('AuditLog error (assignComplaint):', auditErr.message);
    }

    const populated = await Complaint.findById(complaint._id)
      .populate('assignedTo', 'name email phone role')
      .populate('raisedBy', 'name phone studentId')
      .lean();

    res.status(200).json({
      success: true,
      data: populated,
      message: 'Complaint assigned successfully',
    });
  } catch (error) {
    console.error('Error in assignComplaint:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

/**
 * Update Complaint Status (Workflow transition)
 */
exports.updateComplaintStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, resolutionNotes, remarks, assignedTo } = req.body;

    const complaint = await Complaint.findById(id);
    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found' });
    }

    const targetHostelId = await resolveWardenHostelId(req);
    if (String(complaint.hostelId) !== String(targetHostelId)) {
      return res.status(403).json({ success: false, message: 'Not authorized for this hostel complaint' });
    }

    const beforeState = complaint.toObject();
    const prevStatus = complaint.status;

    if (status) {
      const validStatuses = ['open', 'assigned', 'in-progress', 'resolved', 'closed', 'reopened'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `Invalid status: '${status}'. Must be one of: ${validStatuses.join(', ')}`,
        });
      }

      if (status === 'resolved') {
        if (!resolutionNotes || !String(resolutionNotes).trim()) {
          return res.status(400).json({
            success: false,
            message: 'Resolution notes are required when marking a complaint as resolved',
          });
        }
        complaint.resolvedAt = new Date();
        complaint.resolvedBy = req.user._id || req.user.id;
        complaint.resolutionNotes = String(resolutionNotes).trim();
      } else if (status === 'closed') {
        complaint.closedAt = new Date();
        complaint.closedBy = req.user._id || req.user.id;
      } else if (status === 'reopened') {
        complaint.reopenedAt = new Date();
        complaint.reopenedBy = req.user._id || req.user.id;
        complaint.status = 'in-progress';
      }

      complaint.status = status === 'reopened' ? 'in-progress' : status;
    }

    if (resolutionNotes !== undefined && resolutionNotes !== null) {
      complaint.resolutionNotes = String(resolutionNotes).trim();
    }

    if (assignedTo !== undefined) {
      complaint.assignedTo = assignedTo || undefined;
    }

    // Timeline event
    complaint.timeline.push({
      action: 'status_changed',
      performedBy: req.user._id || req.user.id,
      performedByName: getComplaintActorName(req.user),
      performedByRole: getComplaintActorRole(req.user),
      notes: remarks || resolutionNotes || `Status updated from ${prevStatus} to ${complaint.status}`,
      fromStatus: prevStatus,
      toStatus: complaint.status,
      timestamp: new Date(),
    });

    // Remarks
    if (remarks && String(remarks).trim()) {
      complaint.remarks.push({
        author: req.user._id || req.user.id,
        authorName: getComplaintActorName(req.user),
        authorRole: getComplaintActorRole(req.user),
        comment: String(remarks).trim(),
        createdAt: new Date(),
      });
    }

    complaint.updatedAt = new Date();
    await complaint.save();

    // In-App Notification for student
    try {
      await Notification.create({
        title: `Complaint ${complaint.status.toUpperCase()}`,
        message: `Your complaint "${complaint.title}" status changed to ${complaint.status}.${resolutionNotes ? ` Note: ${resolutionNotes}` : ''}`,
        type: 'alert',
        priority: 'medium',
        hostelId: targetHostelId,
        createdBy: req.user._id || req.user.id,
        recipients: [complaint.raisedBy],
        targetAudience: 'students',
      });
      emitToUser(String(complaint.raisedBy), 'notification', {
        title: `Complaint ${complaint.status}`,
        message: `Your complaint "${complaint.title}" is now ${complaint.status}.`,
      });
    } catch (notifErr) {
      console.warn('Notification error (updateComplaintStatus):', notifErr.message);
    }

    // Audit Log
    try {
      await AuditLog.create({
        action: 'complaint_status_updated',
        entityType: 'complaint',
        entityId: complaint._id,
        performedBy: req.user._id || req.user.id,
        changes: { before: beforeState, after: complaint.toObject() },
        ipAddress: req.ip || '',
        userAgent: req.headers?.['user-agent'] || '',
      });
    } catch (auditErr) {
      console.warn('AuditLog error (updateComplaintStatus):', auditErr.message);
    }

    const populated = await Complaint.findById(complaint._id)
      .populate('raisedBy', 'name phone studentId')
      .populate('assignedTo', 'name role')
      .lean();

    res.status(200).json({
      success: true,
      data: populated,
      message: 'Complaint updated successfully',
    });
  } catch (error) {
    console.error('Error in updateComplaintStatus:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

/**
 * Resolve Complaint (Dedicated endpoint with mandatory resolution notes)
 */
exports.resolveComplaint = async (req, res) => {
  try {
    const { id } = req.params;
    const { resolutionNotes, remarks } = req.body;

    if (!resolutionNotes || !String(resolutionNotes).trim()) {
      return res.status(400).json({
        success: false,
        message: 'Resolution notes are required to resolve a complaint',
      });
    }

    req.body.status = 'resolved';
    return exports.updateComplaintStatus(req, res);
  } catch (error) {
    console.error('Error in resolveComplaint:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

/**
 * Reopen a resolved or closed complaint
 */
exports.reopenComplaint = async (req, res) => {
  try {
    const { id } = req.params;
    const { reopenReason, remarks } = req.body;

    if (!reopenReason || !String(reopenReason).trim()) {
      return res.status(400).json({
        success: false,
        message: 'A reason is required to reopen a complaint',
      });
    }

    const complaint = await Complaint.findById(id);
    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found' });
    }

    const targetHostelId = await resolveWardenHostelId(req);
    if (String(complaint.hostelId) !== String(targetHostelId)) {
      return res.status(403).json({ success: false, message: 'Not authorized for this hostel complaint' });
    }

    const beforeState = complaint.toObject();
    const prevStatus = complaint.status;

    complaint.status = 'in-progress';
    complaint.reopenedAt = new Date();
    complaint.reopenedBy = req.user._id || req.user.id;
    complaint.reopenReason = String(reopenReason).trim();

    // Timeline event
    complaint.timeline.push({
      action: 'reopened',
      performedBy: req.user._id || req.user.id,
      performedByName: getComplaintActorName(req.user),
      performedByRole: getComplaintActorRole(req.user),
      notes: `Complaint reopened. Reason: ${reopenReason.trim()}`,
      fromStatus: prevStatus,
      toStatus: 'in-progress',
      timestamp: new Date(),
    });

    if (remarks && String(remarks).trim()) {
      complaint.remarks.push({
        author: req.user._id || req.user.id,
        authorName: getComplaintActorName(req.user),
        authorRole: getComplaintActorRole(req.user),
        comment: `Reopen note: ${String(remarks).trim()}`,
        createdAt: new Date(),
      });
    }

    complaint.updatedAt = new Date();
    await complaint.save();

    // In-App Notification
    try {
      await Notification.create({
        title: 'Complaint Reopened',
        message: `Your complaint "${complaint.title}" was reopened for further action. Reason: ${reopenReason.trim()}`,
        type: 'alert',
        priority: 'high',
        hostelId: targetHostelId,
        createdBy: req.user._id || req.user.id,
        recipients: [complaint.raisedBy],
        targetAudience: 'students',
      });
      emitToUser(String(complaint.raisedBy), 'notification', {
        title: 'Complaint Reopened',
        message: `Your complaint "${complaint.title}" has been reopened.`,
      });
    } catch (notifErr) {
      console.warn('Notification error (reopenComplaint):', notifErr.message);
    }

    // Audit Log
    try {
      await AuditLog.create({
        action: 'complaint_reopened',
        entityType: 'complaint',
        entityId: complaint._id,
        performedBy: req.user._id || req.user.id,
        changes: { before: beforeState, after: complaint.toObject() },
        ipAddress: req.ip || '',
        userAgent: req.headers?.['user-agent'] || '',
      });
    } catch (auditErr) {
      console.warn('AuditLog error (reopenComplaint):', auditErr.message);
    }

    res.status(200).json({
      success: true,
      data: complaint,
      message: 'Complaint reopened successfully',
    });
  } catch (error) {
    console.error('Error in reopenComplaint:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

/**
 * Add internal remark / comment to complaint
 */
exports.addComplaintRemark = async (req, res) => {
  try {
    const { id } = req.params;
    const { comment } = req.body;

    if (!comment || !String(comment).trim()) {
      return res.status(400).json({ success: false, message: 'Comment content is required' });
    }

    const complaint = await Complaint.findById(id);
    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found' });
    }

    const targetHostelId = await resolveWardenHostelId(req);
    if (String(complaint.hostelId) !== String(targetHostelId)) {
      return res.status(403).json({ success: false, message: 'Not authorized for this hostel complaint' });
    }

    const remarkObj = {
      author: req.user._id || req.user.id,
      authorName: getComplaintActorName(req.user),
      authorRole: getComplaintActorRole(req.user),
      comment: String(comment).trim(),
      createdAt: new Date(),
    };

    complaint.remarks.push(remarkObj);

    complaint.timeline.push({
      action: 'remark_added',
      performedBy: req.user._id || req.user.id,
      performedByName: getComplaintActorName(req.user),
      performedByRole: getComplaintActorRole(req.user),
      notes: `Remark added: ${String(comment).trim()}`,
      fromStatus: complaint.status,
      toStatus: complaint.status,
      timestamp: new Date(),
    });

    complaint.updatedAt = new Date();
    await complaint.save();

    // Audit Log
    try {
      await AuditLog.create({
        action: 'complaint_remark_added',
        entityType: 'complaint',
        entityId: complaint._id,
        performedBy: req.user._id || req.user.id,
        changes: { newRemark: remarkObj },
        ipAddress: req.ip || '',
        userAgent: req.headers?.['user-agent'] || '',
      });
    } catch (auditErr) {
      console.warn('AuditLog error (addComplaintRemark):', auditErr.message);
    }

    res.status(200).json({
      success: true,
      data: complaint,
      message: 'Remark added successfully',
    });
  } catch (error) {
    console.error('Error in addComplaintRemark:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

/**
 * Escalate complaint to Owner or SuperAdmin
 */
exports.escalateComplaint = async (req, res) => {
  try {
    const { id } = req.params;
    const { escalateTo = 'owner', escalationReason } = req.body;

    if (!escalationReason || !String(escalationReason).trim()) {
      return res.status(400).json({
        success: false,
        message: 'Escalation reason is required',
      });
    }

    const complaint = await Complaint.findById(id);
    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found' });
    }

    const targetHostelId = await resolveWardenHostelId(req);
    if (String(complaint.hostelId) !== String(targetHostelId)) {
      return res.status(403).json({ success: false, message: 'Not authorized for this hostel complaint' });
    }

    const beforeState = complaint.toObject();

    complaint.isEscalated = true;
    complaint.escalatedTo = escalateTo;
    complaint.escalatedAt = new Date();
    complaint.escalatedBy = req.user._id || req.user.id;
    complaint.escalationReason = String(escalationReason).trim();
    complaint.priority = 'critical';

    // Timeline event
    complaint.timeline.push({
      action: 'escalated',
      performedBy: req.user._id || req.user.id,
      performedByName: getComplaintActorName(req.user),
      performedByRole: getComplaintActorRole(req.user),
      notes: `Complaint escalated to ${escalateTo.toUpperCase()}. Reason: ${escalationReason.trim()}`,
      fromStatus: complaint.status,
      toStatus: complaint.status,
      timestamp: new Date(),
    });

    complaint.updatedAt = new Date();
    await complaint.save();

    // In-App Notification for Owner
    try {
      const owners = await User.find({ role: 'owner' }).select('_id').lean();
      const ownerIds = owners.map((o) => o._id);
      if (ownerIds.length > 0) {
        await Notification.create({
          title: 'Critical Complaint Escalated',
          message: `Complaint "${complaint.title}" at hostel was escalated by Warden. Reason: ${escalationReason.trim()}`,
          type: 'alert',
          priority: 'high',
          hostelId: targetHostelId,
          createdBy: req.user._id || req.user.id,
          recipients: ownerIds,
          targetAudience: 'staff',
        });
      }

      // Notify student
      await Notification.create({
        title: 'Complaint Escalated to Management',
        message: `Your complaint "${complaint.title}" has been escalated for priority handling.`,
        type: 'alert',
        priority: 'medium',
        hostelId: targetHostelId,
        createdBy: req.user._id || req.user.id,
        recipients: [complaint.raisedBy],
        targetAudience: 'students',
      });
      emitToUser(String(complaint.raisedBy), 'notification', {
        title: 'Complaint Escalated',
        message: `Your complaint "${complaint.title}" was escalated to management.`,
      });
    } catch (notifErr) {
      console.warn('Notification error (escalateComplaint):', notifErr.message);
    }

    // Audit Log
    try {
      await AuditLog.create({
        action: 'complaint_escalated',
        entityType: 'complaint',
        entityId: complaint._id,
        performedBy: req.user._id || req.user.id,
        changes: { before: beforeState, after: complaint.toObject() },
        ipAddress: req.ip || '',
        userAgent: req.headers?.['user-agent'] || '',
      });
    } catch (auditErr) {
      console.warn('AuditLog error (escalateComplaint):', auditErr.message);
    }

    res.status(200).json({
      success: true,
      data: complaint,
      message: 'Complaint escalated successfully',
    });
  } catch (error) {
    console.error('Error in escalateComplaint:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

/**
 * Get available staff users in hostel for assignment dropdown
 */
exports.getHostelStaffForAssignment = async (req, res) => {
  try {
    const targetHostelId = await resolveWardenHostelId(req);
    if (!targetHostelId) {
      return res.status(200).json({ success: true, data: [] });
    }

    const staffUsers = await User.find({
      hostelId: targetHostelId,
      role: { $in: ['warden', 'cleaner', 'maintenance', 'staff', 'owner'] },
    })
      .select('name email phone role')
      .sort({ role: 1, name: 1 })
      .lean();

    res.status(200).json({ success: true, data: staffUsers });
  } catch (error) {
    console.error('Error in getHostelStaffForAssignment:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};


// ============ STUDENT MANAGEMENT MODULE ============

// Get Paginated, Searchable & Filterable Students List
exports.getStudentsList = async (req, res) => {
  try {
    const targetHostelId = await resolveWardenHostelId(req);
    if (!targetHostelId) {
      return res.status(200).json({
        success: true,
        data: {
          students: [],
          pagination: { total: 0, page: 1, limit: 10, totalPages: 0 },
          facets: { rooms: [], floors: [], courses: [], years: [] },
          metrics: { total: 0, active: 0, onLeave: 0, suspended: 0, exited: 0 },
        },
      });
    }

    const {
      page = 1,
      limit = 10,
      search = '',
      room = '',
      floor = '',
      course = '',
      year = '',
      status = 'all',
      gender = 'all',
      sortBy = 'name',
      sortOrder = 'asc',
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));

    // Base filter: All students belonging to this hostel
    const filter = {
      hostelId: targetHostelId,
      role: 'student',
    };

    if (status && status !== 'all') {
      filter.status = status;
    }

    if (gender && gender !== 'all') {
      filter.gender = gender;
    }

    if (course && course !== 'all') {
      const escapedCourse = course.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.course = { $regex: escapedCourse, $options: 'i' };
    }

    if (year && year !== 'all') {
      filter.year = String(year).trim();
    }

    // Room / Floor sub-query filtering
    if (room || floor) {
      const roomQuery = { hostelId: targetHostelId };
      if (room && room !== 'all') {
        if (mongoose.isValidObjectId(room)) {
          roomQuery._id = room;
        } else {
          const escapedRoom = room.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          roomQuery.roomNumber = { $regex: escapedRoom, $options: 'i' };
        }
      }
      if (floor && floor !== 'all') {
        roomQuery.floorNumber = Number(floor);
      }
      const roomsFound = await Room.find(roomQuery).select('_id').lean();
      const matchingRoomIds = roomsFound.map((r) => r._id);
      filter.roomId = { $in: matchingRoomIds };
    }

    // Search filter across name, studentId, email, phone, and roomNumber
    if (search && search.trim()) {
      const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(escaped, 'i');

      const searchRooms = await Room.find({
        hostelId: targetHostelId,
        roomNumber: searchRegex,
      }).select('_id').lean();
      const searchRoomIds = searchRooms.map((r) => r._id);

      const orConditions = [
        { name: searchRegex },
        { studentId: searchRegex },
        { email: searchRegex },
        { phone: searchRegex },
      ];
      if (searchRoomIds.length > 0) {
        orConditions.push({ roomId: { $in: searchRoomIds } });
      }

      if (filter.$and) {
        filter.$and.push({ $or: orConditions });
      } else {
        filter.$or = orConditions;
      }
    }

    // Sorting
    const sortFieldMap = {
      name: 'name',
      studentId: 'studentId',
      status: 'status',
      createdAt: 'createdAt',
      joinedDate: 'createdAt',
    };
    const sortFieldName = sortFieldMap[sortBy] || 'name';
    const sortDirection = sortOrder === 'desc' ? -1 : 1;
    const sortObj = { [sortFieldName]: sortDirection };

    // Execute query and total count
    const [total, students] = await Promise.all([
      User.countDocuments(filter),
      User.find(filter)
        .populate('roomId', 'roomNumber floorNumber capacity currentOccupancy category')
        .populate('blockId', 'name')
        .select('name email phone studentId status gender course year roomId blockId hostelId parentContact profileImage createdAt')
        .sort(sortObj)
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(),
    ]);

    // Query live presence from Attendance for this batch of students
    const studentIds = students.map((s) => s._id);
    const todayAttendance = await Attendance.aggregate([
      { $match: { studentId: { $in: studentIds } } },
      { $sort: { date: -1, createdAt: -1 } },
      { $group: { _id: '$studentId', doc: { $first: '$$ROOT' } } },
      { $replaceRoot: { newRoot: '$doc' } },
    ]);

    const attMap = {};
    todayAttendance.forEach((att) => {
      attMap[String(att.studentId)] = att;
    });

    const studentsWithPresence = students.map((s) => {
      const att = attMap[String(s._id)];
      let presenceStatus = 'unknown';
      if (s.status === 'on-leave') {
        presenceStatus = 'on-leave';
      } else if (att) {
        presenceStatus = att.status === 'inside' ? 'inside' : att.status === 'outside' ? 'outside' : att.status === 'on-leave' ? 'on-leave' : 'unknown';
      }
      return {
        ...s,
        presenceStatus,
        lastCheckIn: att?.checkInTime || null,
        lastCheckOut: att?.checkOutTime || null,
      };
    });

    // Compute metrics across all students in this hostel
    const [allStudentsInHostel, allRoomsInHostel] = await Promise.all([
      User.find({ hostelId: targetHostelId, role: 'student' }).select('status gender course year').lean(),
      Room.find({ hostelId: targetHostelId }).select('roomNumber floorNumber').sort({ roomNumber: 1 }).lean(),
    ]);

    const metrics = {
      total: allStudentsInHostel.length,
      active: allStudentsInHostel.filter((s) => s.status === 'active' || !s.status).length,
      onLeave: allStudentsInHostel.filter((s) => s.status === 'on-leave').length,
      suspended: allStudentsInHostel.filter((s) => s.status === 'suspended').length,
      exited: allStudentsInHostel.filter((s) => s.status === 'exited').length,
    };

    // Extract unique filter facets
    const uniqueFloors = Array.from(new Set(allRoomsInHostel.map((r) => r.floorNumber).filter((f) => f != null))).sort((a, b) => a - b);
    const uniqueRooms = allRoomsInHostel.map((r) => ({ _id: String(r._id), roomNumber: r.roomNumber, floorNumber: r.floorNumber }));
    const uniqueCourses = Array.from(new Set(allStudentsInHostel.map((s) => s.course).filter((c) => !!c && String(c).trim()))).sort();
    const uniqueYears = Array.from(new Set(allStudentsInHostel.map((s) => s.year).filter((y) => !!y && String(y).trim()))).sort();

    res.status(200).json({
      success: true,
      data: {
        students: studentsWithPresence,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum) || 1,
        },
        facets: {
          rooms: uniqueRooms,
          floors: uniqueFloors,
          courses: uniqueCourses,
          years: uniqueYears,
        },
        metrics,
      },
    });
  } catch (error) {
    console.error('Error fetching warden students list:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get Full Student Detail (Profile, Room/Bed, Attendance, Leaves, Complaints, Discipline, Visitors, Gate events)
exports.getStudentDetails = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || !mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Invalid student ID format' });
    }

    const targetHostelId = await resolveWardenHostelId(req);
    if (!targetHostelId) {
      return res.status(403).json({ success: false, message: 'No hostel assigned to your profile' });
    }

    // Find student strictly in target hostel
    const student = await User.findOne({
      _id: id,
      role: 'student',
      hostelId: targetHostelId,
    })
      .populate('hostelId', 'name address contactNumber rules')
      .populate('blockId', 'name')
      .populate({
        path: 'roomId',
        select: 'roomNumber floorNumber capacity currentOccupancy category pricing amenities students description',
        populate: {
          path: 'students',
          select: 'name studentId phone status profileImage',
        },
      })
      .select('-password -__v')
      .lean();

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found in your assigned hostel' });
    }

    // Parallel fetch of all related records for this student
    const [
      attendanceRecords,
      permissions,
      complaints,
      violations,
      curfewViolations,
      visitors,
      gateEvents,
    ] = await Promise.all([
      Attendance.find({ studentId: id }).sort({ date: -1, createdAt: -1 }).limit(60).lean(),
      Permission.find({ studentId: id }).populate('approvedBy', 'name role').sort({ createdAt: -1 }).lean(),
      Complaint.find({ raisedBy: id }).populate('assignedTo', 'name role').sort({ createdAt: -1 }).lean(),
      Violation.find({ studentId: id }).populate('reportedBy', 'name role').sort({ createdAt: -1 }).lean(),
      CurfewViolation.find({ studentId: id }).sort({ createdAt: -1 }).lean(),
      Visitor.find({ visitingStudentId: id }).populate('approvedBy', 'name role').sort({ createdAt: -1 }).lean(),
      GateEvent.find({ studentId: id, hostelId: targetHostelId }).sort({ time: -1 }).limit(50).lean(),
    ]);

    // Attendance summary calculation
    const totalDaysTracked = attendanceRecords.length;
    const daysInside = attendanceRecords.filter((a) => a.status === 'inside').length;
    const daysOutside = attendanceRecords.filter((a) => a.status === 'outside').length;
    const daysOnLeave = attendanceRecords.filter((a) => a.status === 'on-leave').length;
    const attendancePercentage = totalDaysTracked > 0 ? Math.round((daysInside / totalDaysTracked) * 100) : 100;
    const totalMinutesInside = attendanceRecords.reduce((acc, curr) => acc + (curr.totalMinutesInside || 0), 0);
    const totalHoursInside = Math.round(totalMinutesInside / 60);

    const latestAttendance = attendanceRecords[0] || null;
    let livePresenceStatus = 'unknown';
    if (student.status === 'on-leave') {
      livePresenceStatus = 'on-leave';
    } else if (latestAttendance) {
      livePresenceStatus = latestAttendance.status === 'inside' ? 'inside' : latestAttendance.status === 'outside' ? 'outside' : latestAttendance.status === 'on-leave' ? 'on-leave' : 'unknown';
    }

    // Leave summary
    const leaveSummary = {
      total: permissions.length,
      approved: permissions.filter((p) => p.status === 'approved').length,
      pending: permissions.filter((p) => p.status === 'pending').length,
      rejected: permissions.filter((p) => p.status === 'rejected').length,
      history: permissions,
    };

    // Disciplinary summary
    const allDisciplinary = [
      ...violations.map((v) => ({ ...v, recordType: 'violation' })),
      ...curfewViolations.map((cv) => ({
        _id: cv._id,
        violationType: 'curfew',
        description: `Curfew breached at ${cv.curfewTime || 'curfew'}. Delay: ${cv.minutesLate || 0} mins`,
        status: cv.status || 'pending',
        warningLevel: cv.warningLevel || 'warning',
        fineAmount: cv.fineAmount || 0,
        createdAt: cv.createdAt,
        recordType: 'curfew_violation',
      })),
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const totalFines = allDisciplinary.reduce((sum, item) => sum + (item.fineAmount || 0), 0);

    // Complaint summary
    const complaintSummary = {
      total: complaints.length,
      resolved: complaints.filter((c) => c.status === 'resolved' || c.status === 'closed').length,
      pending: complaints.filter((c) => c.status === 'open' || c.status === 'assigned' || c.status === 'in-progress').length,
      history: complaints,
    };

    // Roommates info (exclude this student)
    const roommates = (student.roomId?.students || []).filter(
      (roommate) => String(roommate._id) !== String(student._id)
    );

    // Redact sensitive / admin-only fields
    const { password, pushToken, expoPushToken, ...sanitizedStudent } = student;

    res.status(200).json({
      success: true,
      data: {
        student: sanitizedStudent,
        roommates,
        livePresence: {
          status: livePresenceStatus,
          lastCheckIn: latestAttendance?.checkInTime || null,
          lastCheckOut: latestAttendance?.checkOutTime || null,
          lastBusinessDate: latestAttendance?.businessDate || null,
        },
        attendanceSummary: {
          totalDaysTracked,
          daysInside,
          daysOutside,
          daysOnLeave,
          attendancePercentage,
          totalHoursInside,
          recentRecords: attendanceRecords.slice(0, 30),
        },
        leaveSummary,
        complaintSummary,
        disciplinarySummary: {
          total: allDisciplinary.length,
          totalFines,
          history: allDisciplinary,
        },
        visitorHistory: visitors,
        gateEvents,
      },
    });
  } catch (error) {
    console.error('Error fetching warden student details:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============ ROOM & BED MANAGEMENT MODULE ============

// Get all rooms for Warden's hostel with occupied/vacant metrics and students
exports.getWardenRooms = async (req, res) => {
  try {
    const targetHostelId = await resolveWardenHostelId(req);
    if (!targetHostelId) {
      return res.status(200).json({
        success: true,
        data: {
          rooms: [],
          floors: [],
          blocks: [],
          metrics: {
            totalRooms: 0,
            totalBeds: 0,
            occupiedBeds: 0,
            vacantBeds: 0,
            occupancyRate: 0,
            maintenanceRooms: 0,
          },
        },
      });
    }

    const { floor, block, status, category, search } = req.query;

    const filter = { hostelId: targetHostelId };

    if (floor && floor !== 'all') {
      filter.floorNumber = Number(floor);
    }
    if (block && block !== 'all') {
      filter.blockId = block;
    }
    if (status && status !== 'all') {
      filter.status = status;
    }
    if (category && category !== 'all') {
      filter.category = category;
    }

    if (search && search.trim()) {
      const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.roomNumber = { $regex: escaped, $options: 'i' };
    }

    let rooms = await Room.find(filter)
      .populate('blockId', 'name')
      .populate('hostelId', 'name')
      .populate({
        path: 'students',
        select: 'name studentId phone email gender course year status profileImage',
      })
      .sort({ floorNumber: 1, roomNumber: 1 })
      .lean();

    // Fallback sync: If room.students is empty but Users have this roomId, keep synchronized
    for (let r of rooms) {
      if (!r.students || r.students.length === 0) {
        const activeResidents = await User.find({
          roomId: r._id,
          role: 'student',
          status: { $in: ['active', 'on-leave'] },
        })
          .select('name studentId phone email gender course year status profileImage')
          .lean();

        if (activeResidents.length > 0) {
          r.students = activeResidents;
          Room.updateOne({ _id: r._id }, {
            students: activeResidents.map(s => s._id),
            currentOccupancy: activeResidents.length,
            status: activeResidents.length >= r.capacity ? 'occupied' : (r.status === 'maintenance' || r.status === 'unavailable' ? r.status : 'available'),
          }).exec().catch(() => {});
        }
      }

      // Calculate available beds safely
      const occupied = r.students ? r.students.length : (r.currentOccupancy || 0);
      r.currentOccupancy = occupied;
      r.availableBeds = Math.max(0, (r.capacity || 0) - occupied);
    }

    // Compute hostel-wide metrics
    const allHostelRooms = await Room.find({ hostelId: targetHostelId })
      .populate('students', '_id')
      .lean();

    let totalBeds = 0;
    let occupiedBeds = 0;
    let maintenanceRooms = 0;
    const floorSet = new Set();
    const blockMap = new Map();

    allHostelRooms.forEach((r) => {
      if (r.floorNumber != null) floorSet.add(r.floorNumber);
      if (r.blockId) {
        const bId = String(r.blockId._id || r.blockId);
        blockMap.set(bId, r.blockId.name || 'Block');
      }
      const cap = r.capacity || 0;
      const occ = r.students ? r.students.length : (r.currentOccupancy || 0);
      totalBeds += cap;
      occupiedBeds += occ;
      if (r.status === 'maintenance' || r.status === 'unavailable') {
        maintenanceRooms += 1;
      }
    });

    const vacantBeds = Math.max(0, totalBeds - occupiedBeds);
    const occupancyRate = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

    res.status(200).json({
      success: true,
      data: {
        rooms,
        floors: Array.from(floorSet).sort((a, b) => a - b),
        blocks: Array.from(blockMap.entries()).map(([id, name]) => ({ _id: id, name })),
        metrics: {
          totalRooms: allHostelRooms.length,
          totalBeds,
          occupiedBeds,
          vacantBeds,
          occupancyRate,
          maintenanceRooms,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching warden rooms:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get Unassigned Students in this hostel
exports.getUnassignedStudents = async (req, res) => {
  try {
    const targetHostelId = await resolveWardenHostelId(req);
    if (!targetHostelId) {
      return res.status(200).json({ success: true, data: [] });
    }

    const students = await User.find({
      hostelId: targetHostelId,
      role: 'student',
      status: { $in: ['active', 'on-leave'] },
      $or: [{ roomId: null }, { roomId: { $exists: false } }],
    })
      .select('name studentId phone email gender course year status profileImage')
      .sort({ name: 1 })
      .lean();

    res.status(200).json({ success: true, count: students.length, data: students });
  } catch (error) {
    console.error('Error fetching unassigned students:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Assign Student to Available Bed
exports.assignBed = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { studentId, reason = '' } = req.body;

    if (!studentId || !mongoose.isValidObjectId(studentId)) {
      return res.status(400).json({ success: false, message: 'Valid student ID is required' });
    }
    if (!roomId || !mongoose.isValidObjectId(roomId)) {
      return res.status(400).json({ success: false, message: 'Valid room ID is required' });
    }

    const targetHostelId = await resolveWardenHostelId(req);
    if (!targetHostelId) {
      return res.status(403).json({ success: false, message: 'No hostel assigned' });
    }

    // 1. Fetch Room & verify ownership
    const room = await Room.findOne({ _id: roomId, hostelId: targetHostelId });
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found in your assigned hostel' });
    }

    // Safeguard: Room status must not be maintenance or unavailable
    if (room.status === 'maintenance' || room.status === 'unavailable') {
      return res.status(400).json({
        success: false,
        message: `Cannot assign student: Room ${room.roomNumber} is currently marked as ${room.status}.`,
      });
    }

    // Safeguard: Capacity check
    const currentOccupancy = room.students ? room.students.length : 0;
    if (currentOccupancy >= room.capacity) {
      return res.status(400).json({
        success: false,
        message: `Cannot assign student: Room ${room.roomNumber} is already at full capacity (${room.capacity}/${room.capacity} beds occupied).`,
      });
    }

    // 2. Fetch Student & verify hostel membership
    const student = await User.findOne({ _id: studentId, role: 'student', hostelId: targetHostelId });
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found in your assigned hostel' });
    }

    // Safeguard: Prevent duplicate active allocations
    if (student.roomId) {
      const existingRoom = await Room.findById(student.roomId).select('roomNumber');
      return res.status(400).json({
        success: false,
        message: `Student is already allocated to Room ${existingRoom?.roomNumber || student.roomId}. Use the Transfer action instead of Assign.`,
      });
    }

    // Safeguard: Double check student is not in room's array
    if (room.students.some(s => String(s) === String(studentId))) {
      return res.status(400).json({
        success: false,
        message: `Student is already recorded in Room ${room.roomNumber}.`,
      });
    }

    // 3. Update Room
    room.students.push(studentId);
    room.currentOccupancy = room.students.length;
    if (room.currentOccupancy >= room.capacity) {
      room.status = 'occupied';
    } else {
      room.status = 'available';
    }
    await room.save();

    // 4. Update Student
    student.roomId = room._id;
    if (room.blockId) student.blockId = room.blockId;
    await student.save();

    // 5. Create Room Allocation History
    const historyEntry = await RoomAllocationHistory.create({
      hostelId: targetHostelId,
      studentId: student._id,
      toRoomId: room._id,
      action: 'assign',
      reason: reason.trim() || 'Assigned bed by Warden',
      performedBy: req.user._id || req.user.id,
      details: {
        roomNumber: room.roomNumber,
        occupancyAfter: room.currentOccupancy,
        capacity: room.capacity,
      },
    });

    const populatedRoom = await Room.findById(room._id)
      .populate('students', 'name studentId phone email gender course year status profileImage')
      .populate('blockId', 'name')
      .lean();

    res.status(200).json({
      success: true,
      message: `Student ${student.name} successfully assigned to Room ${room.roomNumber}`,
      data: {
        room: populatedRoom,
        history: historyEntry,
      },
    });
  } catch (error) {
    console.error('Error assigning bed:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Transfer Student to another Room
exports.transferBed = async (req, res) => {
  try {
    const { studentId, fromRoomId, toRoomId, reason = '' } = req.body;

    if (!studentId || !mongoose.isValidObjectId(studentId)) {
      return res.status(400).json({ success: false, message: 'Valid student ID is required' });
    }
    if (!fromRoomId || !mongoose.isValidObjectId(fromRoomId)) {
      return res.status(400).json({ success: false, message: 'Valid source room ID is required' });
    }
    if (!toRoomId || !mongoose.isValidObjectId(toRoomId)) {
      return res.status(400).json({ success: false, message: 'Valid target room ID is required' });
    }

    if (String(fromRoomId) === String(toRoomId)) {
      return res.status(400).json({ success: false, message: 'Source and target room cannot be the same' });
    }

    const targetHostelId = await resolveWardenHostelId(req);
    if (!targetHostelId) {
      return res.status(403).json({ success: false, message: 'No hostel assigned' });
    }

    // 1. Fetch source room & target room
    const [sourceRoom, targetRoom, student] = await Promise.all([
      Room.findOne({ _id: fromRoomId, hostelId: targetHostelId }),
      Room.findOne({ _id: toRoomId, hostelId: targetHostelId }),
      User.findOne({ _id: studentId, role: 'student', hostelId: targetHostelId }),
    ]);

    if (!sourceRoom) {
      return res.status(404).json({ success: false, message: 'Source room not found in your assigned hostel' });
    }
    if (!targetRoom) {
      return res.status(404).json({ success: false, message: 'Target room not found in your assigned hostel' });
    }
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found in your assigned hostel' });
    }

    // Safeguard: Verify student is currently in source room
    if (String(student.roomId) !== String(fromRoomId) && !sourceRoom.students.some(s => String(s) === String(studentId))) {
      return res.status(400).json({
        success: false,
        message: `Student is not currently allocated to source Room ${sourceRoom.roomNumber}.`,
      });
    }

    // Safeguard: Target room status must not be maintenance/unavailable
    if (targetRoom.status === 'maintenance' || targetRoom.status === 'unavailable') {
      return res.status(400).json({
        success: false,
        message: `Cannot transfer student: Target Room ${targetRoom.roomNumber} is currently under ${targetRoom.status}.`,
      });
    }

    // Safeguard: Target room must have available beds
    const targetOccupancy = targetRoom.students ? targetRoom.students.length : 0;
    if (targetOccupancy >= targetRoom.capacity) {
      return res.status(400).json({
        success: false,
        message: `Cannot transfer student: Target Room ${targetRoom.roomNumber} is at full capacity (${targetRoom.capacity}/${targetRoom.capacity} beds occupied).`,
      });
    }

    // 2. Remove from Source Room
    sourceRoom.students = sourceRoom.students.filter(s => String(s) !== String(studentId));
    sourceRoom.currentOccupancy = sourceRoom.students.length;
    if (sourceRoom.status === 'occupied' && sourceRoom.currentOccupancy < sourceRoom.capacity) {
      sourceRoom.status = 'available';
    }
    await sourceRoom.save();

    // 3. Add to Target Room
    targetRoom.students.push(studentId);
    targetRoom.currentOccupancy = targetRoom.students.length;
    if (targetRoom.currentOccupancy >= targetRoom.capacity) {
      targetRoom.status = 'occupied';
    } else {
      targetRoom.status = 'available';
    }
    await targetRoom.save();

    // 4. Update Student
    student.roomId = targetRoom._id;
    if (targetRoom.blockId) student.blockId = targetRoom.blockId;
    await student.save();

    // 5. Create History
    const historyEntry = await RoomAllocationHistory.create({
      hostelId: targetHostelId,
      studentId: student._id,
      fromRoomId: sourceRoom._id,
      toRoomId: targetRoom._id,
      action: 'transfer',
      reason: reason.trim() || 'Room transfer by Warden',
      performedBy: req.user._id || req.user.id,
      details: {
        fromRoomNumber: sourceRoom.roomNumber,
        toRoomNumber: targetRoom.roomNumber,
      },
    });

    res.status(200).json({
      success: true,
      message: `Student ${student.name} successfully transferred from Room ${sourceRoom.roomNumber} to Room ${targetRoom.roomNumber}`,
      data: {
        fromRoom: sourceRoom,
        toRoom: targetRoom,
        history: historyEntry,
      },
    });
  } catch (error) {
    console.error('Error transferring bed:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Vacate Bed (Remove student from room)
exports.vacateBed = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { studentId, reason = '' } = req.body;

    if (!studentId || !mongoose.isValidObjectId(studentId)) {
      return res.status(400).json({ success: false, message: 'Valid student ID is required' });
    }
    if (!roomId || !mongoose.isValidObjectId(roomId)) {
      return res.status(400).json({ success: false, message: 'Valid room ID is required' });
    }

    const targetHostelId = await resolveWardenHostelId(req);
    if (!targetHostelId) {
      return res.status(403).json({ success: false, message: 'No hostel assigned' });
    }

    const [room, student] = await Promise.all([
      Room.findOne({ _id: roomId, hostelId: targetHostelId }),
      User.findOne({ _id: studentId, role: 'student', hostelId: targetHostelId }),
    ]);

    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found in your assigned hostel' });
    }
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found in your assigned hostel' });
    }

    // Remove from room students
    room.students = (room.students || []).filter(s => String(s) !== String(studentId));
    room.currentOccupancy = room.students.length;
    if (room.status === 'occupied' && room.currentOccupancy < room.capacity) {
      room.status = 'available';
    }
    await room.save();

    // Clear student's room
    student.roomId = undefined;
    await student.save();

    // Create history
    const historyEntry = await RoomAllocationHistory.create({
      hostelId: targetHostelId,
      studentId: student._id,
      fromRoomId: room._id,
      action: 'vacate',
      reason: reason.trim() || 'Bed vacated by Warden',
      performedBy: req.user._id || req.user.id,
      details: {
        roomNumber: room.roomNumber,
        occupancyAfter: room.currentOccupancy,
      },
    });

    res.status(200).json({
      success: true,
      message: `Student ${student.name} vacated from Room ${room.roomNumber}`,
      data: {
        room,
        history: historyEntry,
      },
    });
  } catch (error) {
    console.error('Error vacating bed:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update Room Status (Available, Maintenance, Unavailable)
exports.updateRoomStatus = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { status, reason = '' } = req.body;

    const allowed = ['available', 'maintenance', 'unavailable'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, message: `Status must be one of: ${allowed.join(', ')}` });
    }

    const targetHostelId = await resolveWardenHostelId(req);
    if (!targetHostelId) {
      return res.status(403).json({ success: false, message: 'No hostel assigned' });
    }

    const room = await Room.findOne({ _id: roomId, hostelId: targetHostelId });
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found in your assigned hostel' });
    }

    const previousStatus = room.status;

    if (status === 'available') {
      const occ = room.students ? room.students.length : (room.currentOccupancy || 0);
      room.status = occ >= room.capacity ? 'occupied' : 'available';
    } else {
      room.status = status;
    }

    await room.save();

    const historyEntry = await RoomAllocationHistory.create({
      hostelId: targetHostelId,
      toRoomId: room._id,
      action: status === 'maintenance' ? 'maintenance' : 'status_change',
      reason: reason.trim() || `Status changed from ${previousStatus} to ${room.status}`,
      performedBy: req.user._id || req.user.id,
      details: {
        roomNumber: room.roomNumber,
        previousStatus,
        newStatus: room.status,
      },
    });

    res.status(200).json({
      success: true,
      message: `Room ${room.roomNumber} status updated to ${room.status}`,
      data: {
        room,
        history: historyEntry,
      },
    });
  } catch (error) {
    console.error('Error updating room status:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Report Room Problem (Maintenance Complaint)
exports.reportRoomProblem = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { title, description, priority = 'medium', complaintType = 'maintenance' } = req.body;

    if (!title || !description) {
      return res.status(400).json({ success: false, message: 'Title and description are required' });
    }

    const targetHostelId = await resolveWardenHostelId(req);
    if (!targetHostelId) {
      return res.status(403).json({ success: false, message: 'No hostel assigned' });
    }

    const room = await Room.findOne({ _id: roomId, hostelId: targetHostelId });
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found in your assigned hostel' });
    }

    const complaint = await Complaint.create({
      raisedBy: req.user._id || req.user.id,
      hostelId: targetHostelId,
      blockId: room.blockId,
      roomId: room._id,
      title: `[Room ${room.roomNumber}] ${title.trim()}`,
      description: description.trim(),
      complaintType,
      priority,
      status: 'open',
    });

    res.status(201).json({
      success: true,
      message: `Room problem reported successfully for Room ${room.roomNumber}`,
      data: complaint,
    });
  } catch (error) {
    console.error('Error reporting room problem:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get Room Allocation History
exports.getRoomAllocationHistory = async (req, res) => {
  try {
    const targetHostelId = await resolveWardenHostelId(req);
    if (!targetHostelId) {
      return res.status(200).json({ success: true, data: [], pagination: { total: 0, page: 1, limit: 20 } });
    }

    const { roomId, studentId, page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

    const filter = { hostelId: targetHostelId };
    if (roomId && mongoose.isValidObjectId(roomId)) {
      filter.$or = [{ toRoomId: roomId }, { fromRoomId: roomId }];
    }
    if (studentId && mongoose.isValidObjectId(studentId)) {
      filter.studentId = studentId;
    }

    const [total, history] = await Promise.all([
      RoomAllocationHistory.countDocuments(filter),
      RoomAllocationHistory.find(filter)
        .populate('studentId', 'name studentId phone email profileImage')
        .populate('fromRoomId', 'roomNumber floorNumber')
        .populate('toRoomId', 'roomNumber floorNumber')
        .populate('performedBy', 'name role')
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(),
    ]);

    res.status(200).json({
      success: true,
      data: history,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum) || 1,
      },
    });
  } catch (error) {
    console.error('Error fetching room allocation history:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============ ATTENDANCE MANAGEMENT MODULE ============

/**
 * Helper: Log an attendance audit entry
 */
async function logAttendanceAudit({ action, entityId, performedBy, before, after, req }) {
  try {
    await AuditLog.create({
      action,
      entityType: 'attendance',
      entityId: entityId || (after?._id) || new mongoose.Types.ObjectId(),
      performedBy,
      changes: {
        before: before ? (before.toObject ? before.toObject() : before) : null,
        after: after ? (after.toObject ? after.toObject() : after) : null,
      },
      ipAddress: req?.ip || req?.headers?.['x-forwarded-for'] || '',
      userAgent: req?.headers?.['user-agent'] || '',
      timestamp: new Date(),
    });
  } catch (err) {
    console.warn('Failed to write attendance audit log:', err.message);
  }
}

/**
 * Get daily attendance sheet for roll call
 * Supports filtering by date, room, floor, course, status, search query
 */
exports.getDailyAttendanceSheet = async (req, res) => {
  try {
    const targetHostelId = await resolveWardenHostelId(req);
    if (!targetHostelId) {
      return res.status(400).json({ success: false, message: 'No hostel assigned or authorized' });
    }

    const hostel = await Hostel.findById(targetHostelId).select('timezone name').lean();
    const hostelTimezone = hostel?.timezone || 'Asia/Kolkata';
    const now = new Date();
    const todayStr = getBusinessDateString(now, hostelTimezone);

    let requestedDateStr = req.query.date ? String(req.query.date).trim() : todayStr;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(requestedDateStr)) {
      return res.status(400).json({ success: false, message: 'Invalid date format. Expected YYYY-MM-DD' });
    }
    if (requestedDateStr > todayStr) {
      return res.status(400).json({ success: false, message: 'Cannot view or mark attendance for future dates' });
    }

    const isHistorical = requestedDateStr < todayStr;
    const requestedDateObj = getBusinessDate(new Date(requestedDateStr + 'T12:00:00.000Z'), hostelTimezone);

    // Fetch all active/on-leave students in this hostel
    const students = await User.find({
      hostelId: targetHostelId,
      role: 'student',
      status: { $in: ['active', 'on-leave'] },
    })
      .select('name email phone studentId roomId status gender course year profileImage parentContact emergencyContact')
      .populate('roomId', 'roomNumber floorNumber capacity')
      .sort({ 'roomId.floorNumber': 1, 'roomId.roomNumber': 1, name: 1 })
      .lean();

    const studentIds = students.map(s => s._id);

    // Fetch attendance records for this date and hostel
    const attendances = await Attendance.find({
      hostelId: targetHostelId,
      $or: [
        { businessDate: requestedDateStr },
        { date: requestedDateObj }
      ]
    })
      .populate('markedBy', 'name role')
      .populate('lastEditedBy', 'name role')
      .lean();

    const attendanceByStudent = {};
    attendances.forEach(a => {
      attendanceByStudent[a.studentId.toString()] = a;
    });

    // Check for approved leaves on this date
    const dayStart = new Date(requestedDateStr + 'T00:00:00.000Z');
    const dayEnd = new Date(requestedDateStr + 'T23:59:59.999Z');
    const approvedLeaves = await Permission.find({
      studentId: { $in: studentIds },
      status: 'approved',
      requestedDate: { $lte: dayEnd },
      $or: [
        { returnDate: { $gte: dayStart } },
        { returnDate: null }
      ]
    }).lean();

    const leavesByStudent = {};
    approvedLeaves.forEach(l => {
      leavesByStudent[l.studentId.toString()] = l;
    });

    // Calculate rolling 30-day attendance metrics for each student
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().slice(0, 10);

    const pastStats = await Attendance.aggregate([
      {
        $match: {
          hostelId: new mongoose.Types.ObjectId(targetHostelId),
          businessDate: { $gte: thirtyDaysAgoStr, $lte: todayStr }
        }
      },
      {
        $group: {
          _id: '$studentId',
          totalMarkedDays: { $sum: 1 },
          presentCount: {
            $sum: {
              $cond: [{ $in: ['$attendanceStatus', ['present', 'late']] }, 1, 0]
            }
          },
          absentCount: {
            $sum: {
              $cond: [{ $eq: ['$attendanceStatus', 'absent'] }, 1, 0]
            }
          },
          lateCount: {
            $sum: {
              $cond: [{ $eq: ['$attendanceStatus', 'late'] }, 1, 0]
            }
          }
        }
      }
    ]);

    const studentPastStats = {};
    pastStats.forEach(ps => {
      const total = ps.totalMarkedDays || 0;
      const present = ps.presentCount || 0;
      const pct = total > 0 ? Math.round((present / total) * 100) : 100;
      studentPastStats[ps._id.toString()] = {
        totalMarkedDays: total,
        presentCount: present,
        absentCount: ps.absentCount || 0,
        lateCount: ps.lateCount || 0,
        percentage: pct,
      };
    });

    // Merge student roster with daily attendance state
    const rawSheet = students.map(student => {
      const sId = student._id.toString();
      const att = attendanceByStudent[sId];
      const leave = leavesByStudent[sId];
      const past = studentPastStats[sId] || { totalMarkedDays: 0, presentCount: 0, absentCount: 0, lateCount: 0, percentage: 100 };

      let status = 'unmarked';
      let isLate = false;
      let remarks = '';
      let attendanceId = null;
      let markedBy = null;
      let lastEditedBy = null;
      let lastEditedAt = null;
      let editReason = '';
      let checkInTime = null;
      let checkOutTime = null;

      if (att) {
        attendanceId = att._id;
        status = att.attendanceStatus || (att.status === 'inside' ? 'present' : att.status === 'outside' ? 'absent' : att.status === 'on-leave' ? 'on-leave' : 'unmarked');
        isLate = !!att.isLate;
        remarks = att.remarks || '';
        markedBy = att.markedBy;
        lastEditedBy = att.lastEditedBy;
        lastEditedAt = att.lastEditedAt;
        editReason = att.editReason || '';
        checkInTime = att.checkInTime;
        checkOutTime = att.checkOutTime;
      } else if (leave) {
        status = 'on-leave';
        remarks = `Approved leave: ${leave.reason || leave.permissionType}`;
      }

      return {
        student: {
          _id: student._id,
          name: student.name,
          studentId: student.studentId || '',
          email: student.email,
          phone: student.phone,
          profileImage: student.profileImage,
          parentContact: student.parentContact,
          emergencyContact: student.emergencyContact,
          room: student.roomId ? {
            _id: student.roomId._id,
            roomNumber: student.roomId.roomNumber,
            floorNumber: student.roomId.floorNumber,
          } : null,
          course: student.course || '',
          year: student.year || '',
        },
        attendanceId,
        attendanceStatus: status,
        isLate,
        remarks,
        markedBy,
        lastEditedBy,
        lastEditedAt,
        editReason,
        checkInTime,
        checkOutTime,
        isOnLeave: !!leave,
        leaveDetails: leave ? { reason: leave.reason, returnDate: leave.returnDate, permissionType: leave.permissionType } : null,
        thirtyDayStats: past,
      };
    });

    // Summary statistics over entire student body for this date
    const totalStudents = rawSheet.length;
    const presentCount = rawSheet.filter(s => s.attendanceStatus === 'present').length;
    const lateCount = rawSheet.filter(s => s.attendanceStatus === 'late' || s.isLate).length;
    const absentCount = rawSheet.filter(s => s.attendanceStatus === 'absent').length;
    const onLeaveCount = rawSheet.filter(s => s.attendanceStatus === 'on-leave').length;
    const unmarkedCount = rawSheet.filter(s => s.attendanceStatus === 'unmarked').length;
    const markedCount = totalStudents - unmarkedCount;
    const presentPercentage = totalStudents > 0 ? Math.round(((presentCount + lateCount) / totalStudents) * 100) : 0;

    // Filter dropdown options
    const floors = [...new Set(rawSheet.map(s => s.student.room?.floorNumber).filter(f => f !== undefined && f !== null))].sort((a, b) => a - b);
    const rooms = [...new Set(rawSheet.map(s => s.student.room?.roomNumber).filter(Boolean))].sort();
    const courses = [...new Set(rawSheet.map(s => s.student.course).filter(Boolean))].sort();

    // Apply filters
    const { search, roomId, floor, course, status, page, limit } = req.query;
    let filteredSheet = rawSheet;

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      filteredSheet = filteredSheet.filter(s =>
        s.student.name.toLowerCase().includes(q) ||
        s.student.studentId.toLowerCase().includes(q) ||
        s.student.phone.includes(q) ||
        (s.student.room?.roomNumber && s.student.room.roomNumber.toLowerCase().includes(q))
      );
    }

    if (roomId) {
      filteredSheet = filteredSheet.filter(s => s.student.room?._id?.toString() === roomId || s.student.room?.roomNumber === roomId);
    }

    if (floor !== undefined && floor !== '') {
      const fNum = parseInt(floor, 10);
      filteredSheet = filteredSheet.filter(s => s.student.room?.floorNumber === fNum);
    }

    if (course && course.trim()) {
      filteredSheet = filteredSheet.filter(s => s.student.course.toLowerCase() === course.trim().toLowerCase());
    }

    if (status && status.trim() && status !== 'all') {
      filteredSheet = filteredSheet.filter(s => s.attendanceStatus === status.trim().toLowerCase());
    }

    // Pagination (optional)
    let pagedData = filteredSheet;
    let pagination = null;
    if (page || limit) {
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(500, Math.max(1, parseInt(limit, 10) || 50));
      const totalFiltered = filteredSheet.length;
      pagedData = filteredSheet.slice((pageNum - 1) * limitNum, pageNum * limitNum);
      pagination = {
        total: totalFiltered,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(totalFiltered / limitNum) || 1,
      };
    }

    return res.status(200).json({
      success: true,
      date: requestedDateStr,
      today: todayStr,
      isHistorical,
      stats: {
        totalStudents,
        markedCount,
        unmarkedCount,
        presentCount,
        lateCount,
        absentCount,
        onLeaveCount,
        presentPercentage,
      },
      facets: {
        floors,
        rooms,
        courses,
      },
      data: pagedData,
      pagination: pagination || {
        total: filteredSheet.length,
        page: 1,
        limit: filteredSheet.length,
        totalPages: 1,
      },
    });
  } catch (error) {
    console.error('Error fetching daily attendance sheet:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Mark or update attendance for a single student
 * Enforces business rules:
 * - Date cannot be in the future
 * - Historical changes or overwriting existing records require an editReason
 * - Status mapping ensures gate and alert compatibility
 * - Writes AuditLog record
 */
exports.markSingleAttendance = async (req, res) => {
  try {
    const { studentId, attendanceStatus, isLate, remarks, date, editReason } = req.body;
    if (!studentId || !attendanceStatus) {
      return res.status(400).json({ success: false, message: 'studentId and attendanceStatus are required' });
    }

    const validStatuses = ['present', 'absent', 'late', 'on-leave'];
    if (!validStatuses.includes(attendanceStatus)) {
      return res.status(400).json({ success: false, message: `Invalid attendanceStatus. Must be one of: ${validStatuses.join(', ')}` });
    }

    const targetHostelId = await resolveWardenHostelId(req);
    if (!targetHostelId) {
      return res.status(400).json({ success: false, message: 'No hostel assigned or authorized' });
    }

    // Verify student belongs to this hostel
    const student = await User.findById(studentId);
    if (!student || String(student.hostelId) !== String(targetHostelId)) {
      return res.status(404).json({ success: false, message: 'Student not found in this hostel' });
    }

    const hostel = await Hostel.findById(targetHostelId).select('timezone').lean();
    const hostelTimezone = hostel?.timezone || 'Asia/Kolkata';
    const now = new Date();
    const todayStr = getBusinessDateString(now, hostelTimezone);

    const requestedDateStr = date ? String(date).trim() : todayStr;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(requestedDateStr)) {
      return res.status(400).json({ success: false, message: 'Invalid date format. Expected YYYY-MM-DD' });
    }
    if (requestedDateStr > todayStr) {
      return res.status(400).json({ success: false, message: 'Cannot mark attendance for future dates' });
    }

    const isHistorical = requestedDateStr < todayStr;
    const businessDateObj = getBusinessDate(new Date(requestedDateStr + 'T12:00:00.000Z'), hostelTimezone);

    // Look for existing attendance record
    let attendance = await Attendance.findOne({
      studentId: student._id,
      $or: [
        { businessDate: requestedDateStr },
        { date: businessDateObj }
      ]
    });

    const isExisting = !!attendance;
    if (isExisting || isHistorical) {
      if (!editReason || typeof editReason !== 'string' || editReason.trim().length < 3) {
        return res.status(400).json({
          success: false,
          message: 'An edit rationale (min 3 characters) is required when modifying existing or historical attendance records.'
        });
      }
    }

    const beforeState = attendance ? attendance.toObject() : null;

    // Physical status mapping for backward compatibility
    let physStatus = 'inside';
    let flagLate = attendanceStatus === 'late' || !!isLate;
    if (attendanceStatus === 'present') {
      physStatus = 'inside';
    } else if (attendanceStatus === 'late') {
      physStatus = 'inside';
      flagLate = true;
    } else if (attendanceStatus === 'absent') {
      physStatus = 'outside';
    } else if (attendanceStatus === 'on-leave') {
      physStatus = 'on-leave';
    }

    if (!attendance) {
      attendance = new Attendance({
        studentId: student._id,
        hostelId: targetHostelId,
        date: businessDateObj,
        businessDate: requestedDateStr,
        source: 'warden',
        markedBy: req.user._id,
        verificationMethod: 'manual',
        verificationStatus: 'verified',
      });
    } else {
      attendance.lastEditedBy = req.user._id;
      attendance.lastEditedAt = new Date();
      attendance.editReason = (editReason || '').trim();
    }

    attendance.attendanceStatus = attendanceStatus;
    attendance.status = physStatus;
    attendance.isLate = flagLate;
    if (remarks !== undefined) {
      attendance.remarks = (remarks || '').trim();
    }

    if (physStatus === 'inside' && !attendance.checkInTime) {
      attendance.checkInTime = requestedDateStr === todayStr ? now : new Date(requestedDateStr + 'T08:00:00.000Z');
    } else if (physStatus === 'outside' && !attendance.checkOutTime) {
      attendance.checkOutTime = requestedDateStr === todayStr ? now : new Date(requestedDateStr + 'T08:00:00.000Z');
    }

    await attendance.save();

    // Populate for response
    await attendance.populate('markedBy', 'name role');
    await attendance.populate('lastEditedBy', 'name role');

    // Create Audit Log
    await logAttendanceAudit({
      action: isExisting ? 'attendance_edited' : 'attendance_marked',
      entityId: attendance._id,
      performedBy: req.user._id,
      before: beforeState,
      after: attendance.toObject(),
      req,
    });

    // If today, handle curfew return or gate event telemetry
    if (requestedDateStr === todayStr) {
      if (physStatus === 'inside') {
        CurfewAutomationService.handleStudentReturn(String(student._id), now).catch(err =>
          console.warn('Curfew auto-resolve (markSingleAttendance):', err?.message)
        );
        hostelEventEmitter.emit(hostelEventEmitter.EVENTS.CHECKIN, {
          studentId: String(student._id),
          hostelId: String(targetHostelId),
          time: now,
          source: 'warden',
        });
      } else {
        hostelEventEmitter.emit(hostelEventEmitter.EVENTS.CHECKOUT, {
          studentId: String(student._id),
          hostelId: String(targetHostelId),
          time: now,
          source: 'warden',
        });
      }
    }

    return res.status(200).json({
      success: true,
      data: attendance,
      message: isExisting ? 'Attendance record updated successfully' : 'Attendance marked successfully',
    });
  } catch (error) {
    console.error('Error in markSingleAttendance:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Bulk mark attendance for multiple students
 * Allows fast roll-call completion with bulkWrite
 * Enforces business rules:
 * - Date cannot be future date
 * - If historical or updating existing records, require editReason
 * - Audit logs the batch event
 */
exports.bulkMarkAttendance = async (req, res) => {
  try {
    const { records, date, editReason } = req.body;
    if (!records || !Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ success: false, message: 'records array is required and cannot be empty' });
    }

    if (records.length > 500) {
      return res.status(400).json({ success: false, message: 'Batch size cannot exceed 500 records at a time' });
    }

    const targetHostelId = await resolveWardenHostelId(req);
    if (!targetHostelId) {
      return res.status(400).json({ success: false, message: 'No hostel assigned or authorized' });
    }

    const hostel = await Hostel.findById(targetHostelId).select('timezone').lean();
    const hostelTimezone = hostel?.timezone || 'Asia/Kolkata';
    const now = new Date();
    const todayStr = getBusinessDateString(now, hostelTimezone);

    const requestedDateStr = date ? String(date).trim() : todayStr;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(requestedDateStr)) {
      return res.status(400).json({ success: false, message: 'Invalid date format. Expected YYYY-MM-DD' });
    }
    if (requestedDateStr > todayStr) {
      return res.status(400).json({ success: false, message: 'Cannot mark attendance for future dates' });
    }

    const isHistorical = requestedDateStr < todayStr;
    const businessDateObj = getBusinessDate(new Date(requestedDateStr + 'T12:00:00.000Z'), hostelTimezone);

    const studentIds = records.map(r => r.studentId).filter(Boolean);
    const validStudents = await User.find({
      _id: { $in: studentIds },
      hostelId: targetHostelId,
      role: 'student',
    }).select('_id name').lean();

    const validStudentIdSet = new Set(validStudents.map(s => s._id.toString()));

    // Check existing attendance records
    const existingRecords = await Attendance.find({
      hostelId: targetHostelId,
      studentId: { $in: studentIds },
      $or: [
        { businessDate: requestedDateStr },
        { date: businessDateObj }
      ]
    }).lean();

    const existingStudentSet = new Set(existingRecords.map(a => a.studentId.toString()));
    const hasExisting = existingRecords.length > 0;

    if ((isHistorical || hasExisting) && (!editReason || typeof editReason !== 'string' || editReason.trim().length < 3)) {
      return res.status(400).json({
        success: false,
        message: 'An edit rationale (min 3 characters) is required when updating existing or historical records.'
      });
    }

    const bulkOps = [];
    const validStatuses = ['present', 'absent', 'late', 'on-leave'];

    for (const rec of records) {
      const sIdStr = String(rec.studentId);
      if (!validStudentIdSet.has(sIdStr)) continue;

      const attStatus = validStatuses.includes(rec.attendanceStatus) ? rec.attendanceStatus : 'present';
      let physStatus = 'inside';
      let isLate = attStatus === 'late' || !!rec.isLate;

      if (attStatus === 'present') {
        physStatus = 'inside';
      } else if (attStatus === 'late') {
        physStatus = 'inside';
        isLate = true;
      } else if (attStatus === 'absent') {
        physStatus = 'outside';
      } else if (attStatus === 'on-leave') {
        physStatus = 'on-leave';
      }

      const isRecordExisting = existingStudentSet.has(sIdStr);

      const updateFields = {
        hostelId: targetHostelId,
        attendanceStatus: attStatus,
        status: physStatus,
        isLate,
        businessDate: requestedDateStr,
        source: 'warden',
        verificationMethod: 'manual',
        verificationStatus: 'verified',
      };

      if (rec.remarks !== undefined) {
        updateFields.remarks = String(rec.remarks).trim();
      }

      if (isRecordExisting) {
        updateFields.lastEditedBy = req.user._id;
        updateFields.lastEditedAt = new Date();
        updateFields.editReason = (editReason || 'Bulk attendance update').trim();
      }

      bulkOps.push({
        updateOne: {
          filter: {
            studentId: rec.studentId,
            date: businessDateObj,
          },
          update: {
            $set: updateFields,
            $setOnInsert: {
              studentId: rec.studentId,
              date: businessDateObj,
              markedBy: req.user._id,
              checkInTime: physStatus === 'inside' ? now : null,
              checkOutTime: physStatus === 'outside' ? now : null,
            },
          },
          upsert: true,
        },
      });
    }

    if (bulkOps.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid student records provided for this hostel' });
    }

    const bulkResult = await Attendance.bulkWrite(bulkOps);

    // Audit Log for bulk action
    await logAttendanceAudit({
      action: 'bulk_attendance_marked',
      entityId: targetHostelId,
      performedBy: req.user._id,
      before: { countExisting: existingRecords.length },
      after: {
        date: requestedDateStr,
        recordsProcessed: bulkOps.length,
        upsertedCount: bulkResult.upsertedCount,
        modifiedCount: bulkResult.modifiedCount,
        editReason: editReason || 'Bulk attendance submission',
      },
      req,
    });

    return res.status(200).json({
      success: true,
      message: `Successfully processed ${bulkOps.length} attendance records (${bulkResult.upsertedCount} created, ${bulkResult.modifiedCount} updated)`,
      result: {
        processed: bulkOps.length,
        created: bulkResult.upsertedCount,
        updated: bulkResult.modifiedCount,
      },
    });
  } catch (error) {
    console.error('Error in bulkMarkAttendance:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Edit a specific attendance record with mandatory audit rationale
 */
exports.editAttendanceRecord = async (req, res) => {
  try {
    const { id } = req.params;
    const { attendanceStatus, remarks, isLate, editReason } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Invalid attendance record ID' });
    }

    if (!editReason || typeof editReason !== 'string' || editReason.trim().length < 3) {
      return res.status(400).json({
        success: false,
        message: 'A mandatory edit reason (min 3 characters) is required when modifying attendance records.'
      });
    }

    const targetHostelId = await resolveWardenHostelId(req);
    const attendance = await Attendance.findById(id);

    if (!attendance) {
      return res.status(404).json({ success: false, message: 'Attendance record not found' });
    }

    if (String(attendance.hostelId) !== String(targetHostelId)) {
      return res.status(403).json({ success: false, message: 'Unauthorized: attendance record belongs to another hostel' });
    }

    const beforeState = attendance.toObject();

    const validStatuses = ['present', 'absent', 'late', 'on-leave'];
    if (attendanceStatus) {
      if (!validStatuses.includes(attendanceStatus)) {
        return res.status(400).json({ success: false, message: `Invalid attendanceStatus. Must be one of: ${validStatuses.join(', ')}` });
      }
      attendance.attendanceStatus = attendanceStatus;
      if (attendanceStatus === 'present') {
        attendance.status = 'inside';
        attendance.isLate = false;
      } else if (attendanceStatus === 'late') {
        attendance.status = 'inside';
        attendance.isLate = true;
      } else if (attendanceStatus === 'absent') {
        attendance.status = 'outside';
        attendance.isLate = false;
      } else if (attendanceStatus === 'on-leave') {
        attendance.status = 'on-leave';
        attendance.isLate = false;
      }
    }

    if (isLate !== undefined) {
      attendance.isLate = !!isLate;
    }

    if (remarks !== undefined) {
      attendance.remarks = String(remarks).trim();
    }

    attendance.lastEditedBy = req.user._id;
    attendance.lastEditedAt = new Date();
    attendance.editReason = editReason.trim();

    await attendance.save();
    await attendance.populate('markedBy', 'name role');
    await attendance.populate('lastEditedBy', 'name role');

    // Audit Log
    await logAttendanceAudit({
      action: 'attendance_edited',
      entityId: attendance._id,
      performedBy: req.user._id,
      before: beforeState,
      after: attendance.toObject(),
      req,
    });

    return res.status(200).json({
      success: true,
      data: attendance,
      message: 'Attendance record updated successfully with audit trail',
    });
  } catch (error) {
    console.error('Error in editAttendanceRecord:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get attendance analytics, frequent absences, and defaulter list
 */
exports.getAttendanceAnalytics = async (req, res) => {
  try {
    const targetHostelId = await resolveWardenHostelId(req);
    if (!targetHostelId) {
      return res.status(400).json({ success: false, message: 'No hostel assigned or authorized' });
    }

    const { days = 30, threshold = 3, lowPercentageThreshold = 75 } = req.query;
    const periodDays = Math.min(90, Math.max(7, parseInt(days, 10) || 30));
    const absenceThreshold = Math.max(1, parseInt(threshold, 10) || 3);
    const lowPctLimit = Math.min(100, Math.max(1, parseInt(lowPercentageThreshold, 10) || 75));

    const hostel = await Hostel.findById(targetHostelId).select('timezone name').lean();
    const hostelTimezone = hostel?.timezone || 'Asia/Kolkata';
    const now = new Date();
    const todayStr = getBusinessDateString(now, hostelTimezone);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - periodDays);
    const startDateStr = startDate.toISOString().slice(0, 10);

    // Aggregate attendance over period
    const [statsByStudent, dailyTrend, totalActiveStudents] = await Promise.all([
      Attendance.aggregate([
        {
          $match: {
            hostelId: new mongoose.Types.ObjectId(targetHostelId),
            businessDate: { $gte: startDateStr, $lte: todayStr }
          }
        },
        {
          $group: {
            _id: '$studentId',
            totalMarked: { $sum: 1 },
            presentCount: {
              $sum: {
                $cond: [{ $in: ['$attendanceStatus', ['present', 'late']] }, 1, 0]
              }
            },
            absentCount: {
              $sum: {
                $cond: [{ $eq: ['$attendanceStatus', 'absent'] }, 1, 0]
              }
            },
            lateCount: {
              $sum: {
                $cond: [{ $eq: ['$attendanceStatus', 'late'] }, 1, 0]
              }
            },
            onLeaveCount: {
              $sum: {
                $cond: [{ $eq: ['$attendanceStatus', 'on-leave'] }, 1, 0]
              }
            },
            lastAbsentDate: {
              $max: {
                $cond: [{ $eq: ['$attendanceStatus', 'absent'] }, '$businessDate', null]
              }
            }
          }
        }
      ]),
      Attendance.aggregate([
        {
          $match: {
            hostelId: new mongoose.Types.ObjectId(targetHostelId),
            businessDate: { $gte: startDateStr, $lte: todayStr }
          }
        },
        {
          $group: {
            _id: '$businessDate',
            present: {
              $sum: {
                $cond: [{ $in: ['$attendanceStatus', ['present', 'late']] }, 1, 0]
              }
            },
            absent: {
              $sum: {
                $cond: [{ $eq: ['$attendanceStatus', 'absent'] }, 1, 0]
              }
            },
            late: {
              $sum: {
                $cond: [{ $eq: ['$attendanceStatus', 'late'] }, 1, 0]
              }
            },
            onLeave: {
              $sum: {
                $cond: [{ $eq: ['$attendanceStatus', 'on-leave'] }, 1, 0]
              }
            },
            total: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      User.countDocuments({
        hostelId: targetHostelId,
        role: 'student',
        status: { $in: ['active', 'on-leave'] }
      })
    ]);

    // Fetch user details for aggregated students
    const studentIds = statsByStudent.map(s => s._id);
    const students = await User.find({ _id: { $in: studentIds } })
      .select('name studentId phone email roomId course parentContact profileImage')
      .populate('roomId', 'roomNumber floorNumber')
      .lean();

    const studentMap = {};
    students.forEach(s => {
      studentMap[s._id.toString()] = s;
    });

    const studentReports = statsByStudent.map(stat => {
      const student = studentMap[stat._id.toString()] || {};
      const total = stat.totalMarked || 0;
      const present = stat.presentCount || 0;
      const pct = total > 0 ? Math.round((present / total) * 100) : 100;

      return {
        student: {
          _id: stat._id,
          name: student.name || 'Unknown',
          studentId: student.studentId || '',
          phone: student.phone || '',
          email: student.email || '',
          parentContact: student.parentContact || null,
          profileImage: student.profileImage || null,
          room: student.roomId ? {
            roomNumber: student.roomId.roomNumber,
            floorNumber: student.roomId.floorNumber,
          } : null,
          course: student.course || '',
        },
        totalDays: total,
        presentCount: present,
        absentCount: stat.absentCount,
        lateCount: stat.lateCount,
        onLeaveCount: stat.onLeaveCount,
        attendancePercentage: pct,
        lastAbsentDate: stat.lastAbsentDate,
      };
    });

    // Identify frequent absentees
    const frequentAbsentees = studentReports
      .filter(s => s.absentCount >= absenceThreshold)
      .sort((a, b) => b.absentCount - a.absentCount);

    // Identify defaulters (< lowPercentageThreshold)
    const defaulters = studentReports
      .filter(s => s.attendancePercentage < lowPctLimit && s.totalDays >= 5)
      .sort((a, b) => a.attendancePercentage - b.attendancePercentage);

    // Overall metrics
    const totalPresent = statsByStudent.reduce((acc, curr) => acc + curr.presentCount, 0);
    const totalRecords = statsByStudent.reduce((acc, curr) => acc + curr.totalMarked, 0);
    const overallRate = totalRecords > 0 ? Math.round((totalPresent / totalRecords) * 100) : 0;

    return res.status(200).json({
      success: true,
      periodDays,
      startDate: startDateStr,
      endDate: todayStr,
      overallRate,
      totalActiveStudents,
      trend: dailyTrend.map(t => ({
        date: t._id,
        present: t.present,
        absent: t.absent,
        late: t.late,
        onLeave: t.onLeave,
        total: t.total,
        percentage: t.total > 0 ? Math.round((t.present / t.total) * 100) : 0,
      })),
      frequentAbsentees,
      defaulters,
    });
  } catch (error) {
    console.error('Error fetching attendance analytics:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get detailed attendance history for an individual student
 */
exports.getStudentAttendanceHistory = async (req, res) => {
  try {
    const { studentId } = req.params;
    if (!mongoose.isValidObjectId(studentId)) {
      return res.status(400).json({ success: false, message: 'Invalid student ID' });
    }

    const targetHostelId = await resolveWardenHostelId(req);
    const student = await User.findById(studentId)
      .select('name studentId phone email roomId course status parentContact profileImage hostelId')
      .populate('roomId', 'roomNumber floorNumber')
      .lean();

    if (!student || String(student.hostelId) !== String(targetHostelId)) {
      return res.status(404).json({ success: false, message: 'Student not found in this hostel' });
    }

    const { page = 1, limit = 50, startDate, endDate } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));

    const filter = { studentId: student._id };
    if (startDate && endDate) {
      filter.businessDate = { $gte: String(startDate), $lte: String(endDate) };
    }

    const [total, records, allStudentStats] = await Promise.all([
      Attendance.countDocuments(filter),
      Attendance.find(filter)
        .populate('markedBy', 'name role')
        .populate('lastEditedBy', 'name role')
        .sort({ businessDate: -1, date: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(),
      Attendance.aggregate([
        { $match: { studentId: student._id } },
        {
          $group: {
            _id: null,
            totalDays: { $sum: 1 },
            presentCount: {
              $sum: {
                $cond: [{ $in: ['$attendanceStatus', ['present', 'late']] }, 1, 0]
              }
            },
            absentCount: {
              $sum: {
                $cond: [{ $eq: ['$attendanceStatus', 'absent'] }, 1, 0]
              }
            },
            lateCount: {
              $sum: {
                $cond: [{ $eq: ['$attendanceStatus', 'late'] }, 1, 0]
              }
            },
          }
        }
      ])
    ]);

    const stats = allStudentStats[0] || { totalDays: 0, presentCount: 0, absentCount: 0, lateCount: 0 };
    const percentage = stats.totalDays > 0 ? Math.round((stats.presentCount / stats.totalDays) * 100) : 100;

    return res.status(200).json({
      success: true,
      student,
      stats: {
        totalDays: stats.totalDays,
        presentCount: stats.presentCount,
        absentCount: stats.absentCount,
        lateCount: stats.lateCount,
        percentage,
      },
      records,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum) || 1,
      }
    });
  } catch (error) {
    console.error('Error fetching student attendance history:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Export attendance records to CSV
 */
exports.exportAttendanceCSV = async (req, res) => {
  try {
    const targetHostelId = await resolveWardenHostelId(req);
    if (!targetHostelId) {
      return res.status(400).json({ success: false, message: 'No hostel assigned or authorized' });
    }

    const hostel = await Hostel.findById(targetHostelId).select('timezone name').lean();
    const hostelTimezone = hostel?.timezone || 'Asia/Kolkata';
    const now = new Date();
    const todayStr = getBusinessDateString(now, hostelTimezone);

    const { date, startDate, endDate, roomId, floor, course, status } = req.query;

    const filter = { hostelId: targetHostelId };
    if (date) {
      filter.businessDate = String(date).trim();
    } else if (startDate && endDate) {
      filter.businessDate = { $gte: String(startDate).trim(), $lte: String(endDate).trim() };
    } else {
      filter.businessDate = todayStr;
    }

    if (status && status !== 'all') {
      filter.attendanceStatus = status.trim().toLowerCase();
    }

    const records = await Attendance.find(filter)
      .populate({
        path: 'studentId',
        select: 'name studentId phone email roomId course year',
        populate: { path: 'roomId', select: 'roomNumber floorNumber' }
      })
      .populate('markedBy', 'name')
      .populate('lastEditedBy', 'name')
      .sort({ businessDate: -1, 'studentId.name': 1 })
      .lean();

    // In-memory filter for room / floor / course if query specified
    let filteredRecords = records.filter(r => r.studentId);
    if (roomId) {
      filteredRecords = filteredRecords.filter(r =>
        r.studentId.roomId?._id?.toString() === roomId || r.studentId.roomId?.roomNumber === roomId
      );
    }
    if (floor !== undefined && floor !== '') {
      const fNum = parseInt(floor, 10);
      filteredRecords = filteredRecords.filter(r => r.studentId.roomId?.floorNumber === fNum);
    }
    if (course) {
      filteredRecords = filteredRecords.filter(r =>
        r.studentId.course?.toLowerCase() === course.trim().toLowerCase()
      );
    }

    // Generate CSV
    const csvHeaders = [
      'Student Name',
      'Student ID',
      'Room Number',
      'Floor',
      'Course',
      'Date',
      'Attendance Status',
      'Is Late',
      'Check-In Time',
      'Check-Out Time',
      'Remarks',
      'Marked By',
      'Last Edited By',
      'Edit Reason'
    ];

    const escapeCsv = (val) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const csvRows = [csvHeaders.join(',')];

    for (const r of filteredRecords) {
      const s = r.studentId || {};
      const room = s.roomId || {};
      const checkIn = r.checkInTime ? new Date(r.checkInTime).toLocaleTimeString() : '';
      const checkOut = r.checkOutTime ? new Date(r.checkOutTime).toLocaleTimeString() : '';

      csvRows.push([
        escapeCsv(s.name || ''),
        escapeCsv(s.studentId || ''),
        escapeCsv(room.roomNumber || 'Unassigned'),
        escapeCsv(room.floorNumber !== undefined ? room.floorNumber : ''),
        escapeCsv(s.course || ''),
        escapeCsv(r.businessDate || ''),
        escapeCsv(r.attendanceStatus || r.status || 'present'),
        escapeCsv(r.isLate ? 'YES' : 'NO'),
        escapeCsv(checkIn),
        escapeCsv(checkOut),
        escapeCsv(r.remarks || ''),
        escapeCsv(r.markedBy?.name || 'System'),
        escapeCsv(r.lastEditedBy?.name || ''),
        escapeCsv(r.editReason || ''),
      ].join(','));
    }

    const filename = `attendance_${filter.businessDate?.toString?.() || todayStr}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(csvRows.join('\r\n'));
  } catch (error) {
    console.error('Error exporting attendance CSV:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};




