/**
 * @file controllers/warden/wardenStudentController.js
 * @description Warden student directory and announcements controller.
 */

'use strict';

const mongoose = require('mongoose');
const User = require('../../models/User');
const Room = require('../../models/Room');
const Notification = require('../../models/Notification');
const Attendance = require('../../models/Attendance');
const Permission = require('../../models/Permission');
const Complaint = require('../../models/Complaint');
const Violation = require('../../models/Violation');
const Visitor = require('../../models/Visitor');
const GateEvent = require('../../models/GateEvent');
const HostelAlertService = require('../../modules/alert/services/HostelAlertService');
const { resolveWardenHostelId } = require('./wardenHelper');
const { parsePagination, buildPaginationMetadata } = require('../../utils/pagination');
const { sendErrorResponse } = require('../../utils/apiError');

exports.getHostelStudents = async (req, res) => {
  try {
    const targetHostelId = await resolveWardenHostelId(req);
    if (!targetHostelId) {
      return res.status(200).json({ success: true, count: 0, data: [] });
    }

    const { page, limit, skip, isExplicit } = parsePagination(req.query, { defaultLimit: 50, maxLimit: 100 });
    const studentQuery = { hostelId: targetHostelId, role: 'student' };

    const queryBuilder = User.find(studentQuery)
      .select('name email phone roomId studentId status')
      .populate('roomId', 'roomNumber')
      .sort({ name: 1 })
      .lean();

    let students;
    let total = 0;
    if (isExplicit) {
      [students, total] = await Promise.all([
        queryBuilder.skip(skip).limit(limit),
        User.countDocuments(studentQuery),
      ]);
    } else {
      students = await queryBuilder;
      total = students.length;
    }

    const responsePayload = {
      success: true,
      count: students.length,
      data: students,
    };
    if (isExplicit) {
      responsePayload.pagination = buildPaginationMetadata(total, page, limit);
    }
    res.status(200).json(responsePayload);
  } catch (error) {
    return sendErrorResponse(res, error, 'Failed to fetch hostel students');
  }
};

// Create Announcement
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
    return sendErrorResponse(res, error, 'Failed to create announcement');
  }
};

// Get Filtered Students List with Facets and Metrics
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
    return sendErrorResponse(res, error, 'Failed to fetch warden students list');
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
      visitors,
      gateEvents,
    ] = await Promise.all([
      Attendance.find({ studentId: id }).sort({ date: -1, createdAt: -1 }).limit(60).lean(),
      Permission.find({ studentId: id }).populate('approvedBy', 'name role').sort({ createdAt: -1 }).lean(),
      Complaint.find({ raisedBy: id }).populate('assignedTo', 'name role').sort({ createdAt: -1 }).lean(),
      Violation.find({ studentId: id }).populate('reportedBy', 'name role').sort({ createdAt: -1 }).lean(),
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
    const allDisciplinary = violations.map((v) => ({
      ...v,
      recordType: v.violationType === 'curfew' ? 'curfew_violation' : 'violation',
    })).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

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
    return sendErrorResponse(res, error, 'Failed to fetch student details');
  }
};
