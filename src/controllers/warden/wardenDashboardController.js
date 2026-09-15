/**
 * @file controllers/warden/wardenDashboardController.js
 * @description Warden dashboard controller.
 */

'use strict';

const User = require('../../models/User');
const Room = require('../../models/Room');
const Attendance = require('../../models/Attendance');
const Permission = require('../../models/Permission');
const Violation = require('../../models/Violation');
const Visitor = require('../../models/Visitor');
const Complaint = require('../../models/Complaint');
const Emergency = require('../../models/Emergency');
const Hostel = require('../../models/Hostel');
const CurfewViolation = require('../../modules/alert/models/CurfewViolation');
const LeaveViolation = require('../../modules/alert/models/LeaveViolation');
const CurfewAutomationService = require('../../modules/alert/services/CurfewAutomationService');
const { resolveWardenHostelId } = require('./wardenHelper');

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
    let activeCurfewData = null;
    try {
      activeCurfewData = await CurfewAutomationService.getActiveSessionData(targetHostelId);
    } catch (_) {}
    const isCurfewActive = Boolean(activeCurfewData?.lifecycleState === 'In Progress' || activeCurfewData?.status === 'ACTIVE');
    const lifecycleState = activeCurfewData?.lifecycleState || (isCurfewActive ? 'In Progress' : 'Scheduled');

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
          curfewTime: activeCurfewData?.configuration?.startTime || curfewTimeStr,
          curfewEndTime: activeCurfewData?.configuration?.endTime || curfewEndTimeStr,
          weekendCurfewTime: hostelDoc?.rules?.weekendCurfewTime || '',
          gracePeriodMinutes: activeCurfewData?.configuration?.gracePeriodMinutes || hostelDoc?.rules?.gracePeriodMinutes || 15,
          isCurfewActive,
          lifecycleState,
          status: activeCurfewData?.status || (isCurfewActive ? 'ACTIVE' : 'SCHEDULED'),
          session: activeCurfewData?.session || null,
          configuration: activeCurfewData?.configuration || null,
          remainingSeconds: activeCurfewData?.remainingSeconds || 0,
          isManualCurfewActive: isCurfewActive,
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
