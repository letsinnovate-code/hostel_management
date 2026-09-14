/**
 * @file repositories/roomRepository.js
 * @description Repository for Room entity data access, including batched student lookups and bed assignments.
 */

'use strict';

const Room = require('../models/Room');
const User = require('../models/User');

class RoomRepository {
  /**
   * Find rooms matching filter, batch-populating assigned active students without N+1 queries.
   */
  static async findRoomsWithStudents(filter = {}, options = {}) {
    const query = Room.find(filter);
    if (options.sort) query.sort(options.sort);
    if (options.limit) query.limit(options.limit);
    if (options.skip) query.skip(options.skip);

    const rooms = await query.lean();
    if (!rooms.length) return [];

    const roomIds = rooms.map((r) => r._id);
    const students = await User.find({
      roomId: { $in: roomIds },
      role: 'student',
    })
      .select('name email phone admissionNumber roomId bedNumber parentPhone photo')
      .lean();

    const studentsByRoom = {};
    for (const student of students) {
      if (!student.roomId) continue;
      const key = student.roomId.toString();
      if (!studentsByRoom[key]) studentsByRoom[key] = [];
      studentsByRoom[key].push(student);
    }

    for (const room of rooms) {
      const assigned = studentsByRoom[room._id.toString()] || [];
      room.students = assigned;
      room.currentOccupancy = assigned.length;
      if (room.currentOccupancy >= room.capacity && room.status === 'available') {
        room.status = 'occupied';
      }
    }

    return rooms;
  }

  /**
   * Find single room by ID with attached students
   */
  static async findByIdWithStudents(roomId) {
    const room = await Room.findById(roomId).lean();
    if (!room) return null;

    const students = await User.find({
      roomId: room._id,
      role: 'student',
      isActive: true,
    })
      .select('name email phone admissionNumber roomId bedNumber parentPhone photo')
      .lean();

    room.students = students;
    room.currentOccupancy = students.length;
    return room;
  }

  /**
   * Assign a student to a room and bed atomically
   */
  static async allocateBed(roomId, studentId, bedNumber = null) {
    const room = await Room.findById(roomId);
    if (!room) throw new Error('Room not found');

    const currentStudents = await User.countDocuments({
      roomId,
      role: 'student',
      isActive: { $ne: false },
      _id: { $ne: studentId },
    });

    if (currentStudents >= room.capacity) {
      throw new Error(`Room ${room.roomNumber} is already at full capacity (${room.capacity})`);
    }

    // Update student
    const student = await User.findByIdAndUpdate(
      studentId,
      {
        roomId,
        hostelId: room.hostelId,
        bedNumber: bedNumber || `Bed-${currentStudents + 1}`,
      },
      { new: true }
    );

    // Update room occupancy & status
    const newOccupancy = currentStudents + 1;
    room.currentOccupancy = newOccupancy;
    if (newOccupancy >= room.capacity) {
      room.status = 'occupied';
    }
    await room.save();

    return { room, student };
  }

  /**
   * Vacate a student from their room
   */
  static async vacateBed(roomId, studentId) {
    const student = await User.findByIdAndUpdate(
      studentId,
      { $unset: { roomId: 1, bedNumber: 1 } },
      { new: true }
    );

    const room = await Room.findById(roomId);
    if (room) {
      const remainingCount = await User.countDocuments({
        roomId,
        role: 'student',
        isActive: { $ne: false },
      });
      room.currentOccupancy = remainingCount;
      if (remainingCount < room.capacity && room.status === 'occupied') {
        room.status = 'available';
      }
      await room.save();
    }

    return { room, student };
  }

  /**
   * Transfer student from one room to another
   */
  static async transferBed(fromRoomId, toRoomId, studentId, newBedNumber = null) {
    await this.vacateBed(fromRoomId, studentId);
    return await this.allocateBed(toRoomId, studentId, newBedNumber);
  }
}

module.exports = RoomRepository;
