/**
 * @file repositories/studentRepository.js
 * @description Repository for Student entity queries and relations.
 */

'use strict';

const User = require('../models/User');

class StudentRepository {
  /**
   * Find active students of a hostel with populated room and block
   */
  static async findHostelStudents(hostelId, options = {}) {
    const filter = {
      hostelId,
      role: 'student',
    };
    if (options.isActive !== undefined) {
      filter.isActive = options.isActive;
    } else {
      filter.isActive = { $ne: false };
    }
    if (options.roomId) filter.roomId = options.roomId;
    if (options.floorNumber !== undefined) filter.floorNumber = options.floorNumber;

    let query = User.find(filter)
      .populate('roomId', 'roomNumber floorNumber capacity currentOccupancy')
      .populate('blockId', 'name');

    if (options.sort) query = query.sort(options.sort);
    if (options.select) query = query.select(options.select);
    if (options.limit) query = query.limit(options.limit);
    if (options.skip) query = query.skip(options.skip);

    return await query.lean();
  }

  /**
   * Convenience alias to find students by hostel ID
   */
  static async findByHostelId(hostelId, options = {}) {
    return await this.findHostelStudents(hostelId, options);
  }

  /**
   * Find students without an assigned room
   */
  static async findUnassignedStudents(hostelId) {
    return await User.find({
      hostelId,
      role: 'student',
      isActive: { $ne: false },
      $or: [{ roomId: { $exists: false } }, { roomId: null }],
    })
      .select('name email phone admissionNumber course year')
      .sort({ createdAt: -1 })
      .lean();
  }

  /**
   * Find student by ID with populated room and hostel
   */
  static async findByIdWithContext(studentId) {
    return await User.findById(studentId)
      .populate('roomId', 'roomNumber floorNumber capacity currentOccupancy category pricing')
      .populate('hostelId', 'name address rules')
      .lean();
  }
}

module.exports = StudentRepository;
