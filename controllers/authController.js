const User = require('../models/User');
const generateToken = require('../utils/generateToken');
const crypto = require('crypto');
const { sendWelcomeEmail } = require('../utils/emailService');
const Hostel = require('../models/Hostel');

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public (for students) / Private (for owner creating users)
exports.register = async (req, res) => {
  try {
    const { name, email, password, role, phone, hostelId, blockId, roomId, studentId, parentContact } = req.body;

    // Type validation
    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ success: false, message: 'Please provide a valid email and password' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Security: Restrict role assignment on public registration endpoint
    // Public self-registration is strictly for students. Non-student roles (owner, warden, cleaner, etc.)
    // must be created through authorized admin endpoints (/api/owner/users, /api/superadmin/create-owner).
    let assignedRole = 'student';
    if (role) {
      const requestedRole = Array.isArray(role) ? role[0] : String(role);
      if (requestedRole !== 'student') {
        // Only authenticated superadmin or owner can register non-student roles
        const callerRole = req.user?.role;
        const isAuthorized = callerRole === 'superadmin' || callerRole === 'owner';
        if (!isAuthorized) {
          return res.status(403).json({
            success: false,
            message: 'Forbidden: Public registration is restricted to students. Staff and owner accounts must be created by an administrator.',
          });
        }
        assignedRole = requestedRole;
      }
    }

    const userExists = await User.findOne({ email: normalizedEmail });
    if (userExists) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }

    const rolesArray = [assignedRole];
    const currentRole = assignedRole;

    const user = await User.create({
      name,
      email: normalizedEmail,
      password,
      role: rolesArray,
      currentRole: currentRole,
      phone,
      hostelId,
      blockId,
      roomId,
      studentId: studentId || undefined,
      parentContact,
    });

    // Trigger welcome email asynchronously without blocking registration response
    sendWelcomeEmail({ user }).catch((emailErr) => {
      console.error(`[Auth] Welcome email delivery failed for ${user.email}:`, emailErr.message);
    });

    const userRoles = Array.isArray(user.role) ? user.role : [user.role];

    res.status(201).json({
      success: true,
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: currentRole,
        roles: userRoles,
        currentRole: currentRole,
        hasMultipleRoles: userRoles.length > 1,
        token: generateToken(user._id),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ success: false, message: 'Please provide valid email and password' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail }).select('+password');

    if (!user) {
      console.log(`Login attempt failed: User not found for email: ${normalizedEmail}`);
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const isPasswordValid = await user.matchPassword(password);
    if (!isPasswordValid) {
      console.log(`Login attempt failed: Invalid password for email: ${normalizedEmail}`);
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Update lastLogin without re-validating the whole document (avoids error when role is stored as array)
    await User.findByIdAndUpdate(user._id, { $set: { lastLogin: new Date() } });

    // Read role from raw document (Mongoose may hide it when stored as array or invalid type)
    const raw = user.toObject ? user.toObject() : user;
    const roleRaw = raw.role;
    let role = roleRaw != null
      ? (Array.isArray(roleRaw) ? roleRaw[0] : String(roleRaw))
      : null;
    // If still missing, get from DB with lean() to avoid schema casting
    if (role == null) {
      const doc = await User.findById(user._id).select('role').lean();
      if (doc?.role != null) {
        role = Array.isArray(doc.role) ? doc.role[0] : String(doc.role);
      }
    }
    const hostelId = raw.hostelId != null ? raw.hostelId : null;
    // Include roles array for staff with multiple roles (used for select-role page)
    const roles = raw.roles && Array.isArray(raw.roles) && raw.roles.length > 0
      ? raw.roles.filter((r) => ['warden', 'cleaner', 'supervisor'].includes(r))
      : null;

    // Handle multiple roles
    const userRoles = Array.isArray(user.role) ? user.role : [user.role];
    const currentRole = user.currentRole || userRoles[0];
    const hasMultipleRoles = userRoles.length > 1;

    console.log(`Login successful: ${email}, roles: ${userRoles.join(', ')}, currentRole: ${currentRole}, hasMultipleRoles: ${hasMultipleRoles}`);

    res.status(200).json({
      success: true,
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: currentRole,
        roles: userRoles,
        currentRole: currentRole,
        hasMultipleRoles: hasMultipleRoles,
        hostelId: hostelId ?? user.hostelId ?? null,
        token: generateToken(user._id),
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .populate('hostelId')
      .populate('blockId')
      .populate('roomId');

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Set current role for user with multiple roles
// @route   POST /api/auth/set-role
// @access  Private
exports.setCurrentRole = async (req, res) => {
  try {
    const { role } = req.body;
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const userRoles = Array.isArray(user.role) ? user.role : [user.role];

    if (!userRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: `Role ${role} is not assigned to this user. Available roles: ${userRoles.join(', ')}`,
      });
    }

    user.currentRole = role;
    await user.save();

    res.status(200).json({
      success: true,
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: role,
        roles: userRoles,
        currentRole: role,
        hostelId: user.hostelId,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============ QR-BASED STUDENT SELF-REGISTRATION ============

// @desc    Register student via QR invite — auto-generates username & password, emails credentials
// @route   POST /api/auth/register-student-qr
// @access  Public (verified by invite token in body)
exports.registerStudentViaQR = async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      hostelId,
      dateOfBirth,
      gender,
      course,
      address,
      parentContact,
      emergencyContact,
    } = req.body;

    // --- Basic validation ---
    if (!name || !email || !phone || !hostelId) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, phone and hostelId are required',
      });
    }

    // --- Duplicate check ---
    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res.status(400).json({ success: false, message: 'An account with this email already exists' });
    }

    // --- Auto-generate credentials ---
    const firstNameRaw = name.trim().split(' ')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
    const suffix = Math.floor(1000 + Math.random() * 9000); // 4-digit number
    const username = `${firstNameRaw}_${suffix}`;

    // Password: Hostel@<6 random alphanumeric chars>
    const pwdChars = crypto.randomBytes(4).toString('hex'); // 8 hex chars
    const autoPassword = `Hostel@${pwdChars.slice(0, 4).toUpperCase()}${suffix}`;

    // --- Create user ---
    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: autoPassword,        // pre-save hook will hash this
      phone,
      role: ['student'],
      currentRole: 'student',
      hostelId,
      studentId: username,
      dateOfBirth: dateOfBirth || undefined,
      gender: gender || undefined,
      course: course || req.body.course || undefined,
      year: req.body.year || undefined,
      address: address && Object.values(address).some((v) => v && v.trim && v.trim() !== '') ? address : undefined,
      parentContact: parentContact && Object.values(parentContact).some((v) => v && v.trim && v.trim() !== '') ? parentContact : undefined,
      emergencyContact: emergencyContact && Object.values(emergencyContact).some((v) => v && v.trim && v.trim() !== '') ? emergencyContact : undefined,
      status: 'active',
    });

    // --- Fetch hostel name for welcome email ---
    let hostelName = 'Your Hostel';
    try {
      const hostel = await Hostel.findById(hostelId).select('name');
      if (hostel) hostelName = hostel.name;
    } catch (_) { /* swallow — non-critical */ }

    // --- Send welcome email with credentials ---
    try {
      await sendWelcomeEmail({
        user,
        temporaryPassword: autoPassword,
        loginId: username,
        hostelName,
      });
    } catch (emailErr) {
      console.error('Welcome email failed (non-fatal):', emailErr.message);
    }

    // --- Return JWT so the client can immediately upload documents ---
    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      message: 'Registration successful! Check your email for login credentials.',
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        username,
        role: 'student',
        token,
      },
    });
  } catch (error) {
    console.error('QR registration error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Change own password (student or any authenticated user)
// @route   PUT /api/auth/change-password
// @access  Private
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Current password and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters' });
    }

    const user = await User.findById(req.user.id).select('+password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    }

    user.password = newPassword; // pre-save hook will hash
    await user.save();

    res.status(200).json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

