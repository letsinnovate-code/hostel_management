/**
 * @file controllers/owner/ownerStudentController.js
 * @description Owner student directory, bulk upload, and profile controller.
 */

'use strict';

const mongoose = require('mongoose');
const User = require('../../models/User');
const Hostel = require('../../models/Hostel');
const Room = require('../../models/Room');
const { assertOwnsHostel, getOwnerHostelIds, getScopedHostelIds } = require('./ownerHelper');
const { uploadImageToS3, deleteImageFromS3 } = require('../../utils/s3Upload');
const { sendWelcomeEmail, sendApprovalEmail } = require('../../services/email.service');
const QRCode = require('qrcode');

exports.getStudentsByStatus = async (req, res) => {
  try {
    const { status } = req.params;
    // Security: scope to owner's hostels only
    const scopedHostelIds = await getScopedHostelIds(req);
    if (scopedHostelIds.length === 0) {
      return res.status(200).json({ success: true, count: 0, data: [] });
    }
    const students = await User.find({
      role: { $in: ['student'] },
      status,
      hostelId: { $in: scopedHostelIds }, // CRITICAL security filter
    })
      .populate('hostelId')
      .populate('blockId')
      .populate('roomId')
      .populate('planId')
      .select('-password');
    res.status(200).json({ success: true, count: students.length, data: students });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// ============ ANALYTICS & REPORTS ============

// Attendance Trends

exports.bulkUploadStudents = async (req, res) => {
  try {
    if (!XLSX) {
      return res.status(500).json({ success: false, message: 'xlsx package not installed. Run: npm install xlsx' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    await assertOwnsHostel(req, req.body.hostelId);

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    const students = [];
    const errors = [];
    const emailQueue = [];

    const hostel = await Hostel.findById(req.body.hostelId);
    const hostelName = hostel?.name || 'Hostel';

    for (const row of data) {
      try {
        const tempPassword = row.password || Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8).toUpperCase() + '123';

        const student = await User.create({
          name: row.name,
          email: row.email,
          password: tempPassword,
          role: ['student'],
          currentRole: 'student',
          phone: row.phone,
          studentId: row.studentId,
          hostelId: req.body.hostelId,
          status: 'active',
        });

        // Queue welcome email for non-blocking asynchronous delivery
        if (student.email) {
          emailQueue.push(
            sendWelcomeEmail(
              student.email,
              student.name,
              hostelName,
              {
                email: student.email,
                password: tempPassword,
              }
            ).catch(err => console.error(`Bulk welcome email failed for ${student.email}:`, err.message))
          );
        }

        students.push(student);
      } catch (error) {
        errors.push({ row, error: error.message });
      }
    }

    // Trigger emails asynchronously without blocking the client response
    if (emailQueue.length > 0) {
      Promise.allSettled(emailQueue).then(() => {
        console.log(`[BulkUpload] Finished sending ${emailQueue.length} welcome emails.`);
      });
    }

    res.status(201).json({
      success: true,
      data: { created: students.length, students, errors },
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};


exports.approveStudentOnboarding = async (req, res) => {
  try {
    const student = await User.findById(req.params.id).populate('hostelId');
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }
    await assertOwnsHostel(req, student.hostelId?._id || student.hostelId);

    student.status = 'active';
    await student.save();

    // Send approval email
    if (student.email) {
      const hostelName = student.hostelId?.name || 'Hostel';
      await sendApprovalEmail(student.email, student.name, hostelName);
    }

    res.status(200).json({ success: true, data: student });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// Resend Welcome Email

exports.resendWelcomeEmail = async (req, res) => {
  try {
    const { id } = req.params;
    const student = await User.findById(id).select('+password');

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }
    await assertOwnsHostel(req, student.hostelId);

    if (student.role !== 'student') {
      return res.status(400).json({ success: false, message: 'User is not a student' });
    }

    // Generate new password
    const crypto = require('crypto');
    const tempPassword = crypto.randomBytes(8).toString('hex');

    // Update student password
    student.password = tempPassword;
    await student.save();

    // Get hostel name
    const hostel = await Hostel.findById(student.hostelId);
    const hostelName = hostel ? hostel.name : 'Hostel';

    // Send welcome email with new password (force: true bypasses duplicate check for explicit resend)
    await sendWelcomeEmail({
      user: student,
      temporaryPassword: tempPassword,
      loginId: student.studentId || student.email,
      hostelName,
      force: true,
    });

    res.status(200).json({
      success: true,
      message: 'Welcome email sent successfully with new password',
    });
  } catch (error) {
    console.error('Error in resendWelcomeEmail:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Failed to resend welcome email' });
  }
};

// Upload Student Profile Image

exports.uploadStudentProfileImage = async (req, res) => {
  try {
    const { studentId } = req.params;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ success: false, message: 'No image provided' });
    }

    const student = await User.findById(studentId);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }
    await assertOwnsHostel(req, student.hostelId);

    const imageUrl = await uploadImageToS3(file, 'students/profile');
    student.profileImage = imageUrl;
    await student.save();

    res.status(200).json({
      success: true,
      data: {
        profileImage: student.profileImage,
      },
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// Upload Student Documents

exports.uploadStudentDocuments = async (req, res) => {
  try {
    const { studentId } = req.params;
    const files = req.files;

    if (!files || files.length === 0) {
      return res.status(400).json({ success: false, message: 'No documents provided' });
    }

    const student = await User.findById(studentId);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }
    await assertOwnsHostel(req, student.hostelId);

    const documentData = req.body.documents || []; // Array of {type, name} objects
    const uploadedDocuments = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const docInfo = documentData[i] || {};

      const imageUrl = await uploadImageToS3(file, 'students/documents');
      uploadedDocuments.push({
        type: docInfo.type || 'other',
        name: docInfo.name || file.originalname,
        url: imageUrl,
        uploadedAt: new Date(),
      });
    }

    student.documents = [...(student.documents || []), ...uploadedDocuments];
    await student.save();

    res.status(200).json({
      success: true,
      data: {
        documents: student.documents,
      },
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// Delete Student Document

exports.deleteStudentDocument = async (req, res) => {
  try {
    const { studentId, documentId } = req.params;

    const student = await User.findById(studentId);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }
    await assertOwnsHostel(req, student.hostelId);

    const document = student.documents?.id(documentId);
    if (!document) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    // Delete from S3
    if (document.url) {
      await deleteImageFromS3(document.url);
    }

    student.documents.pull(documentId);
    await student.save();

    res.status(200).json({
      success: true,
      message: 'Document deleted successfully',
      data: {
        documents: student.documents,
      },
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};


exports.updateStudentStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const student = await User.findById(req.params.id);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }
    await assertOwnsHostel(req, student.hostelId);
    student.status = status;
    await student.save();
    res.status(200).json({ success: true, data: student });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};


exports.getStudentQR = async (req, res) => {
  try {
    if (!QRCode) {
      return res.status(503).json({ success: false, message: 'QR library not installed on server. Run: npm install qrcode' });
    }

    const student = await User.findById(req.params.id).select('name email phone studentId hostelId role status').lean();

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    // Verify this student belongs to a hostel owned by the requesting owner
    if (student.hostelId) {
      await assertOwnsHostel(req, student.hostelId);
    }

    // QR payload — encode student identity data
    const qrPayload = JSON.stringify({
      userId: String(student._id),
      studentId: student.studentId || null,
      name: student.name,
      hostelId: student.hostelId ? String(student.hostelId) : null,
    });

    const qrDataUrl = await QRCode.toDataURL(qrPayload, {
      width: 300,
      margin: 2,
      color: { dark: '#1e3a5f', light: '#ffffff' },
    });

    res.status(200).json({
      success: true,
      data: {
        qrDataUrl,
        student: {
          id: String(student._id),
          name: student.name,
          email: student.email,
          studentId: student.studentId,
          status: student.status,
        },
      },
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};



