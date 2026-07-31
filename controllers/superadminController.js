const Hostel = require('../models/Hostel');
const SupportTicket = require('../models/SupportTicket');
const User = require('../models/User');
const Payment = require('../models/Payment');
const Complaint = require('../models/Complaint');
const Room = require('../models/Room');

// Get all support tickets (for superadmin)
exports.getAllSupportTickets = async (req, res) => {
  try {
    const { status, hostelId } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (hostelId) filter.hostelId = hostelId;

    const tickets = await SupportTicket.find(filter)
      .populate('raisedBy', 'name email')
      .populate('hostelId', 'name')
      .populate('assignedTo', 'name email')
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({ success: true, data: tickets });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update support ticket (status, assignedTo, add response)
exports.updateSupportTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, assignedTo, message } = req.body;

    const ticket = await SupportTicket.findById(id);
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    if (status) {
      ticket.status = status;
      if (status === 'resolved' || status === 'closed') {
        ticket.resolvedAt = new Date();
      }
    }
    if (assignedTo !== undefined) ticket.assignedTo = assignedTo || null;
    if (message && typeof message === 'string' && message.trim()) {
      ticket.responses = ticket.responses || [];
      ticket.responses.push({
        from: req.user.id,
        message: message.trim(),
        timestamp: new Date(),
      });
    }

    await ticket.save();

    const updated = await SupportTicket.findById(id)
      .populate('raisedBy', 'name email')
      .populate('hostelId', 'name')
      .populate('assignedTo', 'name email');

    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get all hostels (for superadmin)
exports.getAllHostels = async (req, res) => {
  try {
    const hostels = await Hostel.find({})
      .populate('ownerId', 'name email phone')
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({ success: true, data: hostels });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get dashboard stats (counts for superadmin) – full DB overview
exports.getDashboardStats = async (req, res) => {
  try {
    const [
      hostelCount,
      ticketCount,
      openTicketCount,
      ownerCount,
      studentCount,
      wardenCount,
      cleanerCount,
      securityCount,
      totalUsers,
      totalPayments,
      totalComplaints,
      totalRooms,
    ] = await Promise.all([
      Hostel.countDocuments(),
      SupportTicket.countDocuments(),
      SupportTicket.countDocuments({ status: 'open' }),
      User.countDocuments({ role: 'owner' }),
      User.countDocuments({ role: 'student' }),
      User.countDocuments({ role: 'warden' }),
      User.countDocuments({ role: 'cleaner' }),
      User.countDocuments({ role: 'security' }),
      User.countDocuments(),
      Payment.countDocuments(),
      Complaint.countDocuments(),
      Room.countDocuments(),
    ]);

    res.status(200).json({
      success: true,
      data: {
        hostels: hostelCount,
        supportTickets: ticketCount,
        openTickets: openTicketCount,
        owners: ownerCount,
        students: studentCount,
        wardens: wardenCount,
        cleaners: cleanerCount,
        security: securityCount,
        totalUsers,
        totalPayments,
        totalComplaints,
        totalRooms,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Create hostel owner (superadmin only)
exports.createOwner = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    if (!name || !email || !password || !phone) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, password and phone are required',
      });
    }

    const userExists = await User.findOne({ email: email.toLowerCase().trim() });
    if (userExists) {
      return res.status(400).json({ success: false, message: 'User with this email already exists' });
    }

    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      role: ['owner'],
      currentRole: 'owner',
      phone: String(phone).trim(),
    });

    res.status(201).json({
      success: true,
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: 'owner',
        phone: user.phone,
        message: 'Hostel owner created. They can log in with the provided credentials.',
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
