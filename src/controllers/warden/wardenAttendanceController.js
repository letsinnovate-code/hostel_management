/**
 * @file controllers/warden/wardenAttendanceController.js
 * @description Warden attendance marking, sheets, CSV export, and analytics controller.
 */

'use strict';

const mongoose = require('mongoose');
const Attendance = require('../../models/Attendance');
const User = require('../../models/User');
const Room = require('../../models/Room');
const Hostel = require('../../models/Hostel');
const { getBusinessDateString } = require('../../services/timezoneService');
const { getTodayRange } = require('../../utils/dateRange');
const AttendanceAnalyticsService = require('../../services/attendanceAnalyticsService');
const AttendanceRepository = require('../../repositories/attendanceRepository');
const { parsePagination, buildPaginationMetadata } = require('../../utils/pagination');
const { resolveWardenHostelId } = require('./wardenHelper');

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
    const hostel = await Hostel.findById(targetHostelId).select('timezone name').lean();
    const hostelTimezone = hostel?.timezone || 'Asia/Kolkata';

    const analytics = await AttendanceAnalyticsService.calculateHostelAttendanceAnalytics(targetHostelId, {
      days,
      threshold,
      lowPercentageThreshold,
      timezone: hostelTimezone,
    });

    return res.status(200).json({
      success: true,
      periodDays: analytics.periodDays,
      startDate: analytics.startDate,
      endDate: analytics.endDate,
      overallRate: analytics.overallRate,
      totalActiveStudents: analytics.totalActiveStudents,
      trend: analytics.trend,
      frequentAbsentees: analytics.frequentAbsentees,
      defaulters: analytics.defaulters,
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





