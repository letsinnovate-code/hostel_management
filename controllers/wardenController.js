const User = require('../models/User');
const Attendance = require('../models/Attendance');
const Permission = require('../models/Permission');
const Violation = require('../models/Violation');
const Complaint = require('../models/Complaint');
const Visitor = require('../models/Visitor');
const Emergency = require('../models/Emergency');
const Rule = require('../models/Rule');
const Room = require('../models/Room');
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

// ============ WARDEN QUICK ACTIONS & OPERATIONS ============

// Mark Attendance (Quick Action)
exports.markAttendance = async (req, res) => {
  try {
    const { studentId, status, notes } = req.body;
    if (!studentId || !status) {
      return res.status(400).json({ success: false, message: 'Student ID and status are required' });
    }

    if (!['inside', 'outside', 'on-leave', 'pending'].includes(status)) {
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
      });
    }

    attendance.status = status;
    attendance.verifiedBy = req.user.id;
    attendance.verificationMethod = 'manual';
    attendance.verificationStatus = 'verified';

    if (status === 'inside') {
      attendance.checkInTime = now;
    } else if (status === 'outside') {
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

// Get Complaints (Warden view)
exports.getComplaints = async (req, res) => {
  try {
    const targetHostelId = await resolveWardenHostelId(req);
    if (!targetHostelId) {
      return res.status(200).json({ success: true, data: [] });
    }

    const { status, type, priority } = req.query;
    const filter = { hostelId: targetHostelId };

    if (status && status !== 'all') {
      filter.status = status;
    }
    if (type && type !== 'all') {
      filter.complaintType = type;
    }
    if (priority && priority !== 'all') {
      filter.priority = priority;
    }

    const complaints = await Complaint.find(filter)
      .populate('raisedBy', 'name phone roomId')
      .populate('roomId', 'roomNumber')
      .populate('assignedTo', 'name')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    res.status(200).json({ success: true, data: complaints });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update Complaint Status (Warden resolution)
exports.updateComplaintStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, resolutionNotes, assignedTo } = req.body;

    const complaint = await Complaint.findById(id);
    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found' });
    }

    const targetHostelId = await resolveWardenHostelId(req);
    if (String(complaint.hostelId) !== String(targetHostelId)) {
      return res.status(403).json({ success: false, message: 'Not authorized for this hostel complaint' });
    }

    if (status) complaint.status = status;
    if (resolutionNotes != null) complaint.resolutionNotes = resolutionNotes;
    if (assignedTo) complaint.assignedTo = assignedTo;
    if (status === 'resolved' || status === 'closed') {
      complaint.resolvedAt = new Date();
    }
    complaint.updatedAt = new Date();
    await complaint.save();

    res.status(200).json({ success: true, data: complaint, message: 'Complaint updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


