/**
 * @file services/studentManagementService.js
 * @description Domain service for Student lifecycle management, status updates, bulk uploads, and student profiles.
 */

'use strict';

const User = require('../models/User');
const StudentRepository = require('../repositories/studentRepository');
const AuditLog = require('../models/AuditLog');

class StudentManagementService {
  /**
   * Get student details with complete room and hostel context
   */
  static async getStudentDetails(studentId) {
    return await StudentRepository.findByIdWithContext(studentId);
  }

  /**
   * List hostel students with filtering
   */
  static async listHostelStudents(hostelId, options = {}) {
    return await StudentRepository.findHostelStudents(hostelId, options);
  }

  /**
   * Get unassigned students for a hostel
   */
  static async getUnassignedStudents(hostelId) {
    return await StudentRepository.findUnassignedStudents(hostelId);
  }

  /**
   * Update student status (active, suspended, inactive)
   */
  static async updateStudentStatus(studentId, { status, isActive, actorUser, reason }) {
    const student = await User.findById(studentId);
    if (!student) throw new Error('Student not found');

    if (isActive !== undefined) student.isActive = Boolean(isActive);
    if (status) student.status = status;
    await student.save();

    if (actorUser) {
      await AuditLog.create({
        hostelId: student.hostelId,
        action: 'STUDENT_STATUS_UPDATED',
        entityType: 'User',
        entityId: student._id,
        performedBy: actorUser._id,
        details: { status, isActive, reason },
      });
    }

    return student;
  }
}

module.exports = StudentManagementService;
