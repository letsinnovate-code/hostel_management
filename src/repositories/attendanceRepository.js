/**
 * @file repositories/attendanceRepository.js
 * @description Repository for Attendance and StudentLocation complex queries and aggregations.
 */

'use strict';

const mongoose = require('mongoose');
const Attendance = require('../models/Attendance');
const StudentLocation = require('../models/StudentLocation');

class AttendanceRepository {
  /**
   * Find attendance records for given students and businessDate
   */
  static async findByStudentsAndDate(studentIds, businessDate, hostelId = null) {
    const filter = {
      studentId: { $in: studentIds },
      businessDate,
    };
    if (hostelId) filter.hostelId = hostelId;

    return await Attendance.find(filter)
      .populate('studentId', 'name email phone admissionNumber roomId bedNumber')
      .populate('markedBy', 'name email role')
      .lean();
  }

  /**
   * Get the latest location record for each student in the provided array of student IDs
   * Uses single aggregation pipeline instead of N+1 queries (Phase 3 optimization pattern).
   */
  static async getLatestStudentLocations(studentIds) {
    if (!studentIds || !studentIds.length) return new Map();

    const objectIds = studentIds
      .filter(Boolean)
      .map((id) => (typeof id === 'string' ? new mongoose.Types.ObjectId(id) : id));

    const pipeline = [
      { $match: { studentId: { $in: objectIds } } },
      { $sort: { timestamp: -1 } },
      {
        $group: {
          _id: '$studentId',
          latestLocation: { $first: '$$ROOT' },
        },
      },
    ];

    const results = await StudentLocation.aggregate(pipeline);
    const locationMap = new Map();
    for (const r of results) {
      locationMap.set(r._id.toString(), r.latestLocation);
    }
    return locationMap;
  }

  /**
   * Find attendance records in a date range for a specific student
   */
  static async findStudentHistory(studentId, startDate, endDate) {
    const filter = {
      studentId,
      date: { $gte: startDate, $lte: endDate },
    };
    return await Attendance.find(filter)
      .sort({ date: -1 })
      .populate('markedBy', 'name')
      .lean();
  }

  /**
   * Upsert single student attendance record for a business date
   */
  static async recordAttendance({
    studentId,
    hostelId,
    businessDate,
    date = new Date(),
    status,
    attendanceStatus,
    checkInTime,
    checkOutTime,
    markedBy,
    remarks,
  }) {
    const updateData = {
      date,
      status,
      attendanceStatus,
      updatedAt: new Date(),
    };
    if (checkInTime !== undefined) updateData.checkInTime = checkInTime;
    if (checkOutTime !== undefined) updateData.checkOutTime = checkOutTime;
    if (markedBy) updateData.markedBy = markedBy;
    if (remarks !== undefined) updateData.remarks = remarks;

    return await Attendance.findOneAndUpdate(
      { studentId, businessDate },
      {
        $set: updateData,
        $setOnInsert: {
          studentId,
          hostelId,
          businessDate,
          createdAt: new Date(),
        },
      },
      { upsert: true, new: true, runValidators: true }
    );
  }
}

module.exports = AttendanceRepository;
