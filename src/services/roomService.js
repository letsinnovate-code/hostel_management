/**
 * @file services/roomService.js
 * @description Domain service for Room and Bed business workflows, occupancy tracking, and pricing.
 */

'use strict';

const RoomRepository = require('../repositories/roomRepository');
const Room = require('../models/Room');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');

class RoomService {
  /**
   * Get rooms with students for a hostel
   */
  static async getRoomsWithStudents(filter = {}, options = {}) {
    return await RoomRepository.findRoomsWithStudents(filter, options);
  }

  /**
   * Get single room with students
   */
  static async getRoomById(roomId) {
    return await RoomRepository.findByIdWithStudents(roomId);
  }

  /**
   * Assign a student to a room bed
   */
  static async assignBed({ roomId, studentId, bedNumber, actorUser, reason }) {
    const student = await User.findById(studentId);
    if (!student) throw new Error('Student not found');

    const result = await RoomRepository.allocateBed(roomId, studentId, bedNumber);

    // Audit log
    if (actorUser) {
      await AuditLog.create({
        hostelId: result.room.hostelId,
        action: 'BED_ASSIGNED',
        entityType: 'Room',
        entityId: roomId,
        performedBy: actorUser._id,
        details: {
          studentId,
          bedNumber: result.student.bedNumber,
          roomNumber: result.room.roomNumber,
          reason,
        },
      });
    }

    return result;
  }

  /**
   * Transfer student to another bed/room
   */
  static async transferBed({ fromRoomId, toRoomId, studentId, newBedNumber, actorUser, reason }) {
    const result = await RoomRepository.transferBed(fromRoomId, toRoomId, studentId, newBedNumber);

    if (actorUser) {
      await AuditLog.create({
        hostelId: result.room.hostelId,
        action: 'BED_TRANSFERRED',
        entityType: 'Room',
        entityId: toRoomId,
        performedBy: actorUser._id,
        details: {
          studentId,
          fromRoomId,
          toRoomId,
          bedNumber: result.student.bedNumber,
          reason,
        },
      });
    }

    return result;
  }

  /**
   * Vacate student from bed
   */
  static async vacateBed({ roomId, studentId, actorUser, reason }) {
    const result = await RoomRepository.vacateBed(roomId, studentId);

    if (actorUser && result.room) {
      await AuditLog.create({
        hostelId: result.room.hostelId,
        action: 'BED_VACATED',
        entityType: 'Room',
        entityId: roomId,
        performedBy: actorUser._id,
        details: {
          studentId,
          roomNumber: result.room.roomNumber,
          reason,
        },
      });
    }

    return result;
  }

  /**
   * Update room status (available, maintenance, occupied)
   */
  static async updateRoomStatus(roomId, status, notes = '') {
    const room = await Room.findById(roomId);
    if (!room) throw new Error('Room not found');

    room.status = status;
    if (notes) room.description = notes;
    await room.save();
    return room;
  }
}

module.exports = RoomService;
