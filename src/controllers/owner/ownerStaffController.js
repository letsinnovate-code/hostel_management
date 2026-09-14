/**
 * @file controllers/owner/ownerStaffController.js
 * @description Owner staff management and registration invite controller.
 */

'use strict';

const mongoose = require('mongoose');
const User = require('../../models/User');
const Hostel = require('../../models/Hostel');
const { assertOwnsHostel, getOwnerHostelIds, getScopedHostelIds } = require('./ownerHelper');
const { normalizeRole, resolveCurrentRole } = require('../../utils/roleHelper');
const { sendWelcomeEmail, sendStaffWelcomeEmail } = require('../../services/email.service');
const jwt = require('jsonwebtoken');
const QRCode = require('qrcode');

exports.createUser = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      role,
      roles,
      currentRole,
      phone,
      hostelId,
      blockId,
      roomId,
      planId,
      studentId,
      address,
      parentContact,
      emergencyContact,
      dateOfBirth,
      gender,
      course,
      year,
    } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Name is required' });
    }
    if (!email || typeof email !== 'string' || !email.trim()) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }
    const normalizedEmail = email.toLowerCase().trim();
    const rfcEmailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
    if (!rfcEmailRegex.test(normalizedEmail)) {
      return res.status(400).json({ success: false, message: 'Please provide a valid email address' });
    }

    // Role escalation protection: non-superadmins CANNOT create 'owner' or 'superadmin' accounts
    const userRole = Array.isArray(req.user?.role) ? req.user.role[0] : req.user?.role;
    const isSuperAdmin = userRole === 'superadmin' || (Array.isArray(req.user?.roles) && req.user.roles.includes('superadmin'));
    const isOwner = userRole === 'owner' || (Array.isArray(req.user?.roles) && req.user.roles.includes('owner'));
    const rawRoles = Array.isArray(roles) && roles.length > 0
      ? roles
      : (Array.isArray(role) ? role : [role || 'student']);

    const forbiddenPrivilegedRoles = ['owner', 'superadmin'];
    if (!isSuperAdmin && rawRoles.some((r) => forbiddenPrivilegedRoles.includes(String(r).toLowerCase()))) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You are not authorized to create owner or superadmin accounts.',
      });
    }

    const allowedStaffRoles = ['warden', 'cleaner', 'supervisor', 'security', 'student'];
    const sanitizedRoles = isSuperAdmin
      ? rawRoles.map(String)
      : rawRoles.filter((r) => allowedStaffRoles.includes(String(r).toLowerCase()));

    if (sanitizedRoles.length === 0) {
      sanitizedRoles.push('student');
    }

    const finalRole = sanitizedRoles;
    const finalCurrentRole = (currentRole && sanitizedRoles.includes(currentRole)) ? currentRole : sanitizedRoles[0];

    // Check duplicate email
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(400).json({ success: false, message: 'User already exists with this email' });
    }

    let resolvedHostelId = hostelId || undefined;
    // Security: Validate hostelId for owner
    if (isOwner) {
      if (!resolvedHostelId) {
        const ownerHostelIds = await getOwnerHostelIds(req);
        if (ownerHostelIds.length === 1) {
          resolvedHostelId = ownerHostelIds[0];
        } else if (ownerHostelIds.length === 0) {
          return res.status(400).json({ success: false, message: 'You do not own any hostels yet. Please create a hostel first.' });
        } else {
          return res.status(400).json({ success: false, message: 'hostelId is required' });
        }
      }
      await assertOwnsHostel(req, resolvedHostelId);
    }

    // Password handling
    const originalPassword = password;
    let tempPassword = null;
    let finalPassword = password;
    if (!finalPassword) {
      tempPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8).toUpperCase() + '123';
      finalPassword = tempPassword;
    }

    const userData = {
      name: name.trim().slice(0, 100),
      email: normalizedEmail,
      password: finalPassword,
      role: finalRole,
      roles: finalRole,
      currentRole: finalCurrentRole,
      phone: phone ? String(phone).trim() : '0000000000',
      hostelId: resolvedHostelId,
      blockId: blockId || undefined,
      roomId: roomId || undefined,
      planId: planId || undefined,
      studentId: studentId ? String(studentId).trim() : undefined,
      status: 'active',
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
      gender: gender || undefined,
      course: course ? String(course).trim() : undefined,
      year: year ? String(year).trim() : undefined,
      address: address && typeof address === 'object' && Object.values(address).some(Boolean) ? address : undefined,
      parentContact: parentContact && typeof parentContact === 'object' && Object.values(parentContact).some(Boolean) ? parentContact : undefined,
      emergencyContact: emergencyContact && typeof emergencyContact === 'object' && Object.values(emergencyContact).some(Boolean) ? emergencyContact : undefined,
    };

    const user = await User.create(userData);

    // Send welcome email
    if (user.email) {
      const hostel = user.hostelId ? await Hostel.findById(user.hostelId).catch(() => null) : null;
      const hostelName = hostel?.name || 'Hostel';
      const passwordForEmail = tempPassword || originalPassword || 'Please contact admin for password';
      const isStudent = Array.isArray(user.role) ? user.role.includes('student') : user.role === 'student';

      if (isStudent) {
        await sendWelcomeEmail(
          user.email,
          user.name,
          hostelName,
          {
            email: user.email,
            password: passwordForEmail,
          }
        ).catch(err => console.error(`Welcome email failed for ${user.email}:`, err.message));
      } else {
        // Send staff welcome email for non-student staff
        await sendStaffWelcomeEmail(
          user.email,
          user.name,
          hostelName,
          {
            email: user.email,
            password: passwordForEmail,
          },
          user.role
        ).catch(err => console.error(`Staff welcome email failed for ${user.email}:`, err.message));
      }
    }

    // Don't send password in response
    const userResponse = user.toObject();
    delete userResponse.password;

    res.status(201).json({ success: true, data: userResponse });
  } catch (error) {
    console.error('[OwnerController] createUser error:', error);
    let statusCode = error.statusCode;
    if (!statusCode) {
      if (error.name === 'ValidationError' || error.name === 'CastError') {
        statusCode = 400;
      } else if (error.code === 11000) {
        statusCode = 409;
      } else {
        statusCode = 500;
      }
    }
    res.status(statusCode).json({ success: false, message: error.message });
  }
};

// Get All Users

exports.getUsers = async (req, res) => {
  try {
    const { role, hostelId, status } = req.query;
    const filter = {};

    // Security: ALWAYS scope to owner's own hostels only
    const scopedHostelIds = await getScopedHostelIds(req, hostelId);
    if (scopedHostelIds.length === 0) {
      return res.status(200).json({ success: true, count: 0, data: [] });
    }
    filter.hostelId = { $in: scopedHostelIds };

    if (role) {
      const rolesArray = Array.isArray(role) ? role : [role];
      filter.$or = [{ role: { $in: rolesArray } }, { role: rolesArray[0] }, { roles: { $in: rolesArray } }];
    }
    if (status) filter.status = status;

    const users = await User.find(filter)
      .populate('hostelId')
      .populate('blockId')
      .populate('roomId')
      .populate('planId')
      .select('-password');
    res.status(200).json({ success: true, count: users.length, data: users });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// Get Single User

exports.getUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .populate('hostelId')
      .populate('blockId')
      .populate('roomId')
      .populate('planId')
      .select('-password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    // Security: owner can only view users of their own hostels
    if (user.hostelId) {
      const userHostelId = user.hostelId?._id || user.hostelId;
      await assertOwnsHostel(req, userHostelId);
    } else if (req.user?.role === 'owner') {
      return res.status(403).json({ success: false, message: 'Not authorized to access this user' });
    }
    res.status(200).json({ success: true, data: user });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// Update User

exports.updateUser = async (req, res) => {
  try {
    const updateData = { ...req.body };
    const userId = req.params.id;

    const existingUser = await User.findById(userId);
    if (!existingUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    const userRole = Array.isArray(req.user?.role) ? req.user.role[0] : req.user?.role;
    const isSuperAdmin = userRole === 'superadmin' || (Array.isArray(req.user?.roles) && req.user.roles.includes('superadmin'));
    const isOwner = userRole === 'owner' || (Array.isArray(req.user?.roles) && req.user.roles.includes('owner'));

    if (existingUser.hostelId) {
      await assertOwnsHostel(req, existingUser.hostelId);
    } else if (isOwner) {
      return res.status(403).json({ success: false, message: 'Not authorized to modify this user' });
    }
    if (updateData.hostelId) {
      await assertOwnsHostel(req, updateData.hostelId);
    }

    // Check if modifying an owner or superadmin by non-superadmin
    const targetRoles = Array.isArray(existingUser.role) ? existingUser.role : [existingUser.role];
    if (!isSuperAdmin && targetRoles.some(r => ['owner', 'superadmin'].includes(String(r).toLowerCase()))) {
      return res.status(403).json({ success: false, message: 'Not authorized to modify owner or superadmin accounts' });
    }

    if (updateData.password !== undefined && (updateData.password === '' || updateData.password == null)) {
      delete updateData.password;
    }

    // Don't send empty string for ObjectId fields – causes BSON cast error
    const objectIdFields = ['hostelId', 'blockId', 'roomId', 'planId'];
    objectIdFields.forEach((field) => {
      if (updateData[field] === '' || updateData[field] === null) {
        updateData[field] = null;
      }
    });

    const set = {};

    // Validate email if changing
    if (updateData.email !== undefined) {
      if (typeof updateData.email !== 'string' || !updateData.email.trim()) {
        return res.status(400).json({ success: false, message: 'Email cannot be empty' });
      }
      const normalizedEmail = updateData.email.toLowerCase().trim();
      const rfcEmailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
      if (!rfcEmailRegex.test(normalizedEmail)) {
        return res.status(400).json({ success: false, message: 'Please provide a valid email address' });
      }
      const duplicate = await User.findOne({ email: normalizedEmail, _id: { $ne: userId } });
      if (duplicate) {
        return res.status(400).json({ success: false, message: 'Email is already in use by another account' });
      }
      set.email = normalizedEmail;
    }

    // Role escalation check
    const requestedRoles = updateData.roles || (updateData.role !== undefined ? (Array.isArray(updateData.role) ? updateData.role : [updateData.role]) : null);
    if (requestedRoles) {
      const forbiddenPrivilegedRoles = ['owner', 'superadmin'];
      if (!isSuperAdmin && requestedRoles.some(r => forbiddenPrivilegedRoles.includes(String(r).toLowerCase()))) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: You are not authorized to assign owner or superadmin roles.',
        });
      }
      const allowedStaffRoles = ['warden', 'cleaner', 'supervisor', 'security', 'student'];
      const sanitizedRoles = isSuperAdmin
        ? requestedRoles.map(String)
        : requestedRoles.filter(r => allowedStaffRoles.includes(String(r).toLowerCase()));
      if (sanitizedRoles.length === 0) sanitizedRoles.push('student');
      set.role = sanitizedRoles;
      set.roles = sanitizedRoles;
      set.currentRole = (updateData.currentRole && sanitizedRoles.includes(updateData.currentRole)) ? updateData.currentRole : sanitizedRoles[0];
    }

    const safeScalarFields = ['name', 'phone', 'hostelId', 'blockId', 'roomId', 'planId', 'status', 'parentContact', 'emergencyContact', 'address', 'dateOfBirth'];
    safeScalarFields.forEach((field) => {
      if (updateData[field] !== undefined) {
        set[field] = updateData[field];
      }
    });

    if (updateData.password && typeof updateData.password === 'string' && updateData.password.length > 0) {
      if (updateData.password.length < 8) {
        return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
      }
      const salt = await bcrypt.genSalt(10);
      set.password = await bcrypt.hash(updateData.password, salt);
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: set },
      { new: true, runValidators: true }
    ).select('-password');

    const userObj = user.toObject ? user.toObject() : user;
    res.status(200).json({ success: true, data: userObj });
  } catch (error) {
    console.error('[OwnerController] updateUser error:', error);
    let statusCode = error.statusCode;
    if (!statusCode) {
      if (error.name === 'ValidationError' || error.name === 'CastError') {
        statusCode = 400;
      } else if (error.code === 11000) {
        statusCode = 409;
      } else {
        statusCode = 500;
      }
    }
    res.status(statusCode).json({ success: false, message: error.message });
  }
};

// Delete User

exports.deleteUser = async (req, res) => {
  try {
    // Security: only allow deleting users that belong to owner's hostels
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    if (user.hostelId) {
      await assertOwnsHostel(req, user.hostelId);
    } else if (req.user?.role === 'owner') {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this user' });
    }

    // Clean up room occupancy if deleting a student assigned to a room
    if (user.roomId) {
      await Room.findByIdAndUpdate(user.roomId, {
        $pull: { students: user._id },
        $inc: { currentOccupancy: -1 },
      }).catch((err) => console.warn('Room occupancy cleanup on user delete:', err.message));
    }

    await User.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: 'User deleted' });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// ============ STUDENT LIFECYCLE ============

// Get Students by Status

exports.getStaffPerformance = async (req, res) => {
  try {
    const { hostelId, startDate, endDate } = req.query;
    const scopedHostelIds = await getScopedHostelIds(req, hostelId);
    if (scopedHostelIds.length === 0) {
      return res.status(200).json({ success: true, data: [] });
    }
    const filter = { hostelId: { $in: scopedHostelIds } };

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const wardens = await User.find({ ...filter, role: 'warden' });
    const performance = await Promise.all(
      wardens.map(async (warden) => {
        const violations = await Violation.find({
          reportedBy: warden._id,
          ...filter,
        });
        const permissions = await Permission.find({
          approvedBy: warden._id,
          ...filter,
        });

        return {
          wardenId: warden._id,
          wardenName: warden.name,
          violationsHandled: violations.length,
          permissionsProcessed: permissions.length,
          averageResponseTime: 'N/A', // Calculate based on timestamps
        };
      })
    );

    res.status(200).json({ success: true, data: performance });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};


exports.generateRegistrationInviteQR = async (req, res) => {
  try {
    if (!QRCode) {
      return res.status(503).json({ success: false, message: 'QR library not installed on server. Run: npm install qrcode' });
    }

    const ownerId = req.user._id || req.user.id;
    const { hostelId } = req.query;

    if (!hostelId) {
      return res.status(400).json({ success: false, message: 'hostelId is required as a query parameter' });
    }

    await assertOwnsHostel(req, hostelId);
    const hostel = await Hostel.findById(hostelId).lean();
    if (!hostel) {
      return res.status(404).json({ success: false, message: 'Hostel not found' });
    }

    // Create a signed invite token (7 days expiry)
    const inviteToken = jwt.sign(
      { hostelId: String(hostelId), ownerId: String(ownerId), role: 'student', type: 'registration-invite' },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Build the invite URL pointing to the frontend registration page
    const frontendBase = process.env.FRONTEND_URL;
    const inviteUrl = `${frontendBase}/register?invite=${inviteToken}`;

    // Generate QR as base64 PNG data URL
    const qrDataUrl = await QRCode.toDataURL(inviteUrl, {
      width: 300,
      margin: 2,
      color: { dark: '#1e3a5f', light: '#ffffff' },
    });

    res.status(200).json({
      success: true,
      data: {
        qrDataUrl,
        inviteUrl,
        hostelName: hostel.name,
        hostelId: String(hostelId),
        expiresIn: '7 days',
      },
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

/**
 * Get Student Identity QR Code
 * Returns a QR code encoding the student's identity for gate check-in scanning.
 * GET /api/owner/students/:id/qr
 */