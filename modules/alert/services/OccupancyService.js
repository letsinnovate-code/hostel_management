/**
 * @file OccupancyService.js
 * @description Real-time hostel occupancy computation and monitoring.
 *
 * WHY THIS IS SEPARATE:
 * Occupancy data is queried frequently (dashboard, warden view) and needs
 * to be fast. This service provides both real-time computation (from Attendance)
 * and limit-breach detection.
 *
 * PERFORMANCE STRATEGY:
 * - Uses aggregation pipeline for batch computation
 * - lean() on all reads
 * - Can be cached with Redis (if available) — cache key: `occupancy:{hostelId}`
 * - Cache TTL: 60 seconds (fresh enough for dashboard, cheap enough for DB)
 */

'use strict';

const Hostel = require('../../../models/Hostel');
const User = require('../../../models/User');
const Attendance = require('../../../models/Attendance');
const Room = require('../../../models/Room');
const HostelAlertService = require('./HostelAlertService');
const { emitOccupancyUpdate } = require('../socket/alertSocket');
const { ALERT_TYPES } = require('../utils/constants');

// Try to get Redis/IoRedis for caching (optional)
let redis = null;
try {
  if (process.env.REDIS_URL) {
    const IORedis = require('ioredis');
    redis = new IORedis(process.env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1 });
  }
} catch (_) {
  redis = null;
}

const CACHE_TTL_SECONDS = 60;

class OccupancyService {
  /**
   * Get current occupancy status for a hostel.
   * Uses Redis cache if available, falls back to live DB query.
   *
   * @param {string} hostelId
   * @param {boolean} [forceRefresh=false] - bypass cache
   * @returns {Promise<Object>} Occupancy data
   */
  static async getOccupancy(hostelId, forceRefresh = false) {
    const cacheKey = `occupancy:${hostelId}`;

    // Try cache first
    if (redis && !forceRefresh) {
      try {
        const cached = await redis.get(cacheKey);
        if (cached) return JSON.parse(cached);
      } catch (_) {}
    }

    const data = await this._computeOccupancy(hostelId);

    // Write to cache
    if (redis) {
      try {
        await redis.setex(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(data));
      } catch (_) {}
    }

    return data;
  }

  /**
   * Compute occupancy from live DB data.
   *
   * @param {string} hostelId
   * @returns {Promise<Object>}
   */
  static async _computeOccupancy(hostelId) {
    const hostel = await Hostel.findById(hostelId)
      .select('capacity name')
      .lean();

    const students = await User.find({
      hostelId,
      role: 'student',
      status: 'active',
    })
      .select('_id')
      .lean();

    const studentIds = students.map((s) => s._id);
    const totalStudents = studentIds.length;

    // Get today's attendance
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayAttendance = await Attendance.find({
      hostelId,
      studentId: { $in: studentIds },
      date: { $gte: today },
    })
      .select('studentId status')
      .lean();

    const insideCount = todayAttendance.filter((a) => a.status === 'inside').length;
    const outsideCount = todayAttendance.filter((a) => a.status === 'outside').length;
    const pendingCount = totalStudents - todayAttendance.length; // No record = unknown

    // Room stats
    const roomStats = await Room.aggregate([
      { $match: { hostelId: hostel?._id } },
      {
        $group: {
          _id: null,
          totalRooms: { $sum: 1 },
          totalCapacity: { $sum: '$capacity' },
          currentOccupancy: { $sum: '$currentOccupancy' },
          availableRooms: {
            $sum: {
              $cond: [{ $eq: ['$status', 'available'] }, 1, 0],
            },
          },
        },
      },
    ]);

    const rooms = roomStats[0] || {
      totalRooms: 0,
      totalCapacity: 0,
      currentOccupancy: 0,
      availableRooms: 0,
    };

    const capacity = hostel?.capacity || rooms.totalCapacity || totalStudents;
    const occupancyPercent = capacity > 0 ? Math.round((insideCount / capacity) * 100) : 0;

    return {
      hostelId,
      hostelName: hostel?.name,
      capacity,
      totalStudents,
      currentOccupants: insideCount,
      studentsOutside: outsideCount,
      studentsUnknown: pendingCount,
      occupancyPercent,
      rooms: {
        total: rooms.totalRooms,
        available: rooms.availableRooms,
        occupied: rooms.totalRooms - rooms.availableRooms,
      },
      computedAt: new Date().toISOString(),
    };
  }

  /**
   * Check for occupancy violations and fire alerts.
   * Called after any check-in event.
   *
   * @param {string} hostelId
   */
  static async checkOccupancyLimits(hostelId) {
    try {
      const data = await this._computeOccupancy(hostelId);

      // Invalidate cache since occupancy changed
      if (redis) {
        try { await redis.del(`occupancy:${hostelId}`); } catch (_) {}
      }

      // Emit real-time update to warden dashboard
      emitOccupancyUpdate(hostelId, data);

      // Alert if over capacity
      if (data.currentOccupants > data.capacity && data.capacity > 0) {
        await HostelAlertService.send({
          type: ALERT_TYPES.OCCUPANCY_LIMIT_EXCEEDED,
          title: 'Hostel Occupancy Limit Exceeded',
          message: `Current occupancy (${data.currentOccupants}) has exceeded hostel capacity (${data.capacity}). Immediate action required.`,
          hostelId,
          recipientRole: 'warden',
          metadata: {
            currentOccupants: data.currentOccupants,
            capacity: data.capacity,
            occupancyPercent: data.occupancyPercent,
          },
          priority: 'high',
          sendPush: true,
        });
      }
    } catch (err) {
      console.error('[OccupancyService] checkOccupancyLimits error:', err.message);
    }
  }
}

module.exports = OccupancyService;
