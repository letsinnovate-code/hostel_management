/**
 * @file services/attendanceAnalyticsService.js
 * @description Centralized service for attendance analytics, period date ranges, trend aggregations, and metrics calculations.
 */

'use strict';

const mongoose = require('mongoose');
const Attendance = require('../models/Attendance');
const User = require('../models/User');
const Hostel = require('../models/Hostel');
const { getBusinessDate, getBusinessDateString, getBusinessDayRange } = require('./timezoneService');
const { BUSINESS_THRESHOLDS, ATTENDANCE_STATUS } = require('../constants');

class AttendanceAnalyticsService {
  /**
   * Helper: Standardize date range across attendance periods
   */
  static getDateRangeForPeriod(period = 'week', customDays = 30, timezone = 'Asia/Kolkata') {
    const now = new Date();
    const todayStr = getBusinessDateString(now, timezone);
    let startDate = new Date();

    switch (period) {
      case 'daily':
        startDate.setDate(now.getDate() - 30);
        break;
      case 'week':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(now.getMonth() - 1);
        break;
      case 'year':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      case 'custom':
      default: {
        const days = Math.min(
          BUSINESS_THRESHOLDS.MAX_ANALYTICS_PERIOD_DAYS,
          Math.max(BUSINESS_THRESHOLDS.MIN_ANALYTICS_PERIOD_DAYS, parseInt(customDays, 10) || BUSINESS_THRESHOLDS.DEFAULT_ANALYTICS_PERIOD_DAYS)
        );
        startDate.setDate(now.getDate() - days);
        break;
      }
    }

    const startDateStr = startDate.toISOString().slice(0, 10);
    return { startDate, endDate: now, startDateStr, todayStr };
  }

  /**
   * Calculate student-level attendance analytics over a given period
   */
  static async calculateStudentAttendanceAnalytics(studentId, { period = 'week', timezone, hostelId } = {}) {
    let studentHostelTimezone = timezone;
    if (!studentHostelTimezone && hostelId) {
      const hostel = await Hostel.findById(hostelId).select('timezone').lean();
      studentHostelTimezone = hostel?.timezone || 'Asia/Kolkata';
    } else if (!studentHostelTimezone) {
      studentHostelTimezone = 'Asia/Kolkata';
    }

    const { startDate } = this.getDateRangeForPeriod(period, 30, studentHostelTimezone);

    const attendanceRecords = await Attendance.find({
      studentId,
      date: { $gte: startDate },
      checkInTime: { $exists: true },
    })
      .sort({ checkInTime: -1 })
      .select('checkInTime checkOutTime date status')
      .lean();

    const totalCheckIns = attendanceRecords.length;
    const totalCheckOuts = attendanceRecords.filter((a) => a.checkOutTime).length;

    const checkInHours = attendanceRecords
      .map((a) => (a.checkInTime ? new Date(a.checkInTime).getHours() : null))
      .filter((h) => h !== null);
    const avgCheckInHour = checkInHours.length > 0
      ? checkInHours.reduce((sum, h) => sum + h, 0) / checkInHours.length
      : null;

    const durations = attendanceRecords
      .filter((a) => a.checkInTime && a.checkOutTime)
      .map((a) => {
        const checkIn = new Date(a.checkInTime);
        const checkOut = new Date(a.checkOutTime);
        return (checkOut - checkIn) / (1000 * 60 * 60); // in hours
      });
    const avgDuration = durations.length > 0
      ? durations.reduce((sum, d) => sum + d, 0) / durations.length
      : null;

    let periodData = [];

    if (period === 'daily') {
      for (let i = 29; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);
        const nextDate = new Date(date);
        nextDate.setDate(nextDate.getDate() + 1);

        const dayRecords = attendanceRecords.filter((a) => {
          const recordDate = new Date(a.date);
          recordDate.setHours(0, 0, 0, 0);
          return recordDate >= date && recordDate < nextDate;
        });

        periodData.push({
          date: date.toISOString().split('T')[0],
          checkIns: dayRecords.length,
          checkOuts: dayRecords.filter((a) => a.checkOutTime).length,
        });
      }
    } else if (period === 'week') {
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);
        const nextDate = new Date(date);
        nextDate.setDate(nextDate.getDate() + 1);

        const dayRecords = attendanceRecords.filter((a) => {
          const recordDate = new Date(a.date);
          recordDate.setHours(0, 0, 0, 0);
          return recordDate >= date && recordDate < nextDate;
        });

        periodData.push({
          date: date.toISOString().split('T')[0],
          checkIns: dayRecords.length,
          checkOuts: dayRecords.filter((a) => a.checkOutTime).length,
        });
      }
    } else if (period === 'month') {
      const weeks = [];
      for (let i = 28; i >= 0; i -= 7) {
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - i);
        weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 7);

        const weekRecords = attendanceRecords.filter((a) => {
          const recordDate = new Date(a.date);
          recordDate.setHours(0, 0, 0, 0);
          return recordDate >= weekStart && recordDate < weekEnd;
        });

        weeks.push({
          date: weekStart.toISOString().split('T')[0],
          checkIns: weekRecords.length,
          checkOuts: weekRecords.filter((a) => a.checkOutTime).length,
        });
      }
      periodData = weeks;
    } else if (period === 'year') {
      for (let i = 11; i >= 0; i--) {
        const monthStart = new Date();
        monthStart.setMonth(monthStart.getMonth() - i);
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);
        const monthEnd = new Date(monthStart);
        monthEnd.setMonth(monthEnd.getMonth() + 1);

        const monthRecords = attendanceRecords.filter((a) => {
          const recordDate = new Date(a.date);
          recordDate.setHours(0, 0, 0, 0);
          return recordDate >= monthStart && recordDate < monthEnd;
        });

        periodData.push({
          date: monthStart.toISOString().split('T')[0],
          checkIns: monthRecords.length,
          checkOuts: monthRecords.filter((a) => a.checkOutTime).length,
        });
      }
    }

    const dayRange = getBusinessDayRange(new Date(), studentHostelTimezone);
    const businessDate = getBusinessDate(new Date(), studentHostelTimezone);
    const todayRecord = await Attendance.findOne({
      studentId,
      $or: [
        { date: businessDate },
        { date: { $gte: dayRange.start, $lte: dayRange.end } },
      ],
    }).sort({ createdAt: -1 });

    return {
      totalCheckIns,
      totalCheckOuts,
      avgCheckInHour: avgCheckInHour ? Math.round(avgCheckInHour * 10) / 10 : null,
      avgDurationHours: avgDuration ? Math.round(avgDuration * 10) / 10 : null,
      periodData,
      currentStatus: todayRecord?.status || 'outside',
      recentCheckIns: attendanceRecords.slice(0, 10).map((a) => ({
        date: a.date,
        checkInTime: a.checkInTime,
        checkOutTime: a.checkOutTime,
        status: a.status,
      })),
    };
  }

  /**
   * Calculate hostel-wide attendance trends, student metrics, and absence alerts for wardens
   */
  static async calculateHostelAttendanceAnalytics(hostelId, { days = 30, threshold = 3, lowPercentageThreshold = 75, timezone = 'Asia/Kolkata' } = {}) {
    const periodDays = Math.min(
      BUSINESS_THRESHOLDS.MAX_ANALYTICS_PERIOD_DAYS,
      Math.max(BUSINESS_THRESHOLDS.MIN_ANALYTICS_PERIOD_DAYS, parseInt(days, 10) || BUSINESS_THRESHOLDS.DEFAULT_ANALYTICS_PERIOD_DAYS)
    );
    const absenceThreshold = Math.max(1, parseInt(threshold, 10) || BUSINESS_THRESHOLDS.DEFAULT_ABSENCE_THRESHOLD_DAYS);
    const lowPctLimit = Math.min(100, Math.max(1, parseInt(lowPercentageThreshold, 10) || BUSINESS_THRESHOLDS.LOW_ATTENDANCE_PERCENTAGE));

    const { startDateStr, todayStr } = this.getDateRangeForPeriod('custom', periodDays, timezone);
    const targetHostelObjId = new mongoose.Types.ObjectId(hostelId);

    const [statsByStudent, dailyTrend, totalActiveStudents] = await Promise.all([
      Attendance.aggregate([
        {
          $match: {
            hostelId: targetHostelObjId,
            businessDate: { $gte: startDateStr, $lte: todayStr },
          },
        },
        {
          $group: {
            _id: '$studentId',
            totalMarked: { $sum: 1 },
            presentCount: {
              $sum: {
                $cond: [{ $in: ['$attendanceStatus', [ATTENDANCE_STATUS.PRESENT, ATTENDANCE_STATUS.LATE]] }, 1, 0],
              },
            },
            absentCount: {
              $sum: {
                $cond: [{ $eq: ['$attendanceStatus', ATTENDANCE_STATUS.ABSENT] }, 1, 0],
              },
            },
            lateCount: {
              $sum: {
                $cond: [{ $eq: ['$attendanceStatus', ATTENDANCE_STATUS.LATE] }, 1, 0],
              },
            },
            onLeaveCount: {
              $sum: {
                $cond: [{ $eq: ['$attendanceStatus', ATTENDANCE_STATUS.ON_LEAVE] }, 1, 0],
              },
            },
            lastAbsentDate: {
              $max: {
                $cond: [{ $eq: ['$attendanceStatus', ATTENDANCE_STATUS.ABSENT] }, '$businessDate', null],
              },
            },
          },
        },
      ]),
      Attendance.aggregate([
        {
          $match: {
            hostelId: targetHostelObjId,
            businessDate: { $gte: startDateStr, $lte: todayStr },
          },
        },
        {
          $group: {
            _id: '$businessDate',
            present: {
              $sum: {
                $cond: [{ $in: ['$attendanceStatus', [ATTENDANCE_STATUS.PRESENT, ATTENDANCE_STATUS.LATE]] }, 1, 0],
              },
            },
            absent: {
              $sum: {
                $cond: [{ $eq: ['$attendanceStatus', ATTENDANCE_STATUS.ABSENT] }, 1, 0],
              },
            },
            late: {
              $sum: {
                $cond: [{ $eq: ['$attendanceStatus', ATTENDANCE_STATUS.LATE] }, 1, 0],
              },
            },
            onLeave: {
              $sum: {
                $cond: [{ $eq: ['$attendanceStatus', ATTENDANCE_STATUS.ON_LEAVE] }, 1, 0],
              },
            },
            total: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      User.countDocuments({
        hostelId,
        role: 'student',
        status: { $in: ['active', 'on-leave'] },
      }),
    ]);

    const studentIds = statsByStudent.map((s) => s._id).filter(Boolean);
    const students = await User.find({ _id: { $in: studentIds } })
      .select('name studentId phone email roomId course parentContact profileImage')
      .populate('roomId', 'roomNumber floorNumber')
      .lean();

    const studentMap = {};
    students.forEach((s) => {
      studentMap[s._id.toString()] = s;
    });

    const studentReports = statsByStudent.map((stat) => {
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

    const frequentAbsentees = studentReports
      .filter((s) => s.absentCount >= absenceThreshold)
      .sort((a, b) => b.absentCount - a.absentCount);

    const defaulters = studentReports
      .filter((s) => s.attendancePercentage < lowPctLimit && s.totalDays >= 5)
      .sort((a, b) => a.attendancePercentage - b.attendancePercentage);

    const totalPresent = statsByStudent.reduce((acc, curr) => acc + curr.presentCount, 0);
    const totalRecords = statsByStudent.reduce((acc, curr) => acc + curr.totalMarked, 0);
    const overallRate = totalRecords > 0 ? Math.round((totalPresent / totalRecords) * 100) : 0;

    return {
      periodDays,
      startDate: startDateStr,
      endDate: todayStr,
      overallRate,
      totalActiveStudents,
      trend: dailyTrend.map((t) => ({
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
      studentReports,
    };
  }

  /**
   * Calculate hostel attendance trends (inside, outside, pending) for owner dashboards
   */
  static async calculateHostelAttendanceTrends(scopedHostelIds, { startDate, endDate } = {}) {
    if (!scopedHostelIds || scopedHostelIds.length === 0) {
      return { total: 0, inside: 0, outside: 0, pending: 0 };
    }

    const filter = { hostelId: { $in: scopedHostelIds } };
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }

    const attendance = await Attendance.find(filter).select('status').lean();

    return {
      total: attendance.length,
      inside: attendance.filter((a) => a.status === 'inside').length,
      outside: attendance.filter((a) => a.status === 'outside').length,
      pending: attendance.filter((a) => a.status === 'pending').length,
    };
  }
}

module.exports = AttendanceAnalyticsService;
