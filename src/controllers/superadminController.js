const Hostel = require('../models/Hostel');
const SupportTicket = require('../models/SupportTicket');
const User = require('../models/User');
const Payment = require('../models/Payment');
const Complaint = require('../models/Complaint');
const Room = require('../models/Room');
const asyncHandler = require('../utils/asyncHandler');
const { buildRoleQuery } = require('../utils/roleHelper');

// Get all support tickets (for superadmin)
exports.getAllSupportTickets = asyncHandler(async (req, res) => {
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
});

// Update support ticket (status, assignedTo, add response)
exports.updateSupportTicket = asyncHandler(async (req, res) => {
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
});

// Get all hostels (for superadmin) with rich real-time data & dummy users list
exports.getAllHostels = asyncHandler(async (req, res) => {
  const hostels = await Hostel.find({})
    .populate('ownerId', 'name email phone status')
    .sort({ createdAt: -1 })
    .lean();

  const hostelIds = hostels.map((h) => h._id);

  // Fetch real-time rooms, students, and active complaints
  const [rooms, students, complaints] = await Promise.all([
    Room.find({ hostelId: { $in: hostelIds } }).lean(),
    User.find({
      hostelId: { $in: hostelIds },
      ...buildRoleQuery('student'),
    })
      .select('name email phone studentId roomId status hostelId createdAt')
      .populate('roomId', 'roomNumber floorNumber category capacity currentOccupancy')
      .sort({ createdAt: -1 })
      .lean(),
    Complaint.find({ hostelId: { $in: hostelIds }, status: { $ne: 'resolved' } }).lean(),
  ]);

  const enrichedHostels = hostels.map((hostel) => {
    const hId = hostel._id.toString();
    const hostelRooms = rooms.filter((r) => r.hostelId && r.hostelId.toString() === hId);
    const hostelStudents = students.filter((s) => s.hostelId && s.hostelId.toString() === hId);
    const activeComplaints = complaints.filter((c) => c.hostelId && c.hostelId.toString() === hId);

    const calculatedCapacity = hostelRooms.reduce((sum, r) => sum + (r.capacity || 2), 0);
    const finalCapacity = hostel.capacity || calculatedCapacity || 20;
    const finalOccupancy = hostelStudents.length;

    return {
      ...hostel,
      totalRoomsInDb: hostelRooms.length,
      totalStudents: finalOccupancy,
      capacity: finalCapacity,
      currentOccupancy: finalOccupancy,
      availableBeds: Math.max(0, finalCapacity - finalOccupancy),
      occupancyRate: finalCapacity > 0 ? Math.round((finalOccupancy / finalCapacity) * 100) : 0,
      activeComplaintsCount: activeComplaints.length,
      roomsList: hostelRooms.map((r) => ({
        _id: r._id,
        roomNumber: r.roomNumber,
        floorNumber: r.floorNumber,
        capacity: r.capacity,
        currentOccupancy: r.currentOccupancy,
        category: r.category,
        status: r.status,
      })),
      dummyUsers: hostelStudents.map((s) => ({
        _id: s._id,
        name: s.name,
        email: s.email,
        phone: s.phone,
        studentId: s.studentId,
        status: s.status,
        roomNumber: s.roomId?.roomNumber || 'Unassigned',
        roomFloor: s.roomId?.floorNumber,
        roomCategory: s.roomId?.category,
        joinedAt: s.createdAt,
      })),
    };
  });

  res.status(200).json({ success: true, count: enrichedHostels.length, data: enrichedHostels });
});

// Get all hostel owners (for superadmin) with real-time statistics
exports.getAllOwners = asyncHandler(async (req, res) => {
  const ownerQuery = buildRoleQuery('owner');
  const owners = await User.find(ownerQuery)
    .select('-password')
    .sort({ createdAt: -1 })
    .lean();

  const ownerIds = owners.map((o) => o._id);
  const hostels = await Hostel.find({ ownerId: { $in: ownerIds } }).lean();
  const hostelIds = hostels.map((h) => h._id);

  const [rooms, students] = await Promise.all([
    Room.find({ hostelId: { $in: hostelIds } }).lean(),
    User.find({
      hostelId: { $in: hostelIds },
      ...buildRoleQuery('student'),
    })
      .select('_id hostelId')
      .lean(),
  ]);

  const ownersWithStats = owners.map((owner) => {
    const ownerHostels = hostels.filter(
      (h) => h.ownerId && h.ownerId.toString() === owner._id.toString()
    );
    const hIds = ownerHostels.map((h) => h._id.toString());
    const ownerRooms = rooms.filter((r) => r.hostelId && hIds.includes(r.hostelId.toString()));
    const ownerStudents = students.filter((s) => s.hostelId && hIds.includes(s.hostelId.toString()));
    const totalCapacity = ownerHostels.reduce((sum, h) => sum + (h.capacity || 0), 0);

    return {
      ...owner,
      hostelsCount: ownerHostels.length,
      hostels: ownerHostels.map((h) => ({
        _id: h._id,
        name: h.name,
        type: h.type,
        city: h.address?.city,
        state: h.address?.state,
        capacity: h.capacity,
        currentOccupancy: h.currentOccupancy,
        totalRooms: h.totalRooms,
        status: h.status,
      })),
      totalRooms: ownerRooms.length,
      totalStudents: ownerStudents.length,
      totalCapacity,
    };
  });

  res.status(200).json({ success: true, count: ownersWithStats.length, data: ownersWithStats });
});

// Get all users (dummy students, wardens, staff) across all hostels
exports.getAllUsers = asyncHandler(async (req, res) => {
  const { hostelId, role, search } = req.query;
  const filter = {};

  if (hostelId) {
    filter.hostelId = hostelId;
  }
  if (role) {
    Object.assign(filter, buildRoleQuery(role));
  }
  if (search && search.trim()) {
    const regex = new RegExp(search.trim(), 'i');
    filter.$and = [
      ...(filter.$and || []),
      {
        $or: [
          { name: regex },
          { email: regex },
          { phone: regex },
          { studentId: regex },
        ],
      },
    ];
  }

  const users = await User.find(filter)
    .select('-password')
    .populate('hostelId', 'name address type')
    .populate('roomId', 'roomNumber floorNumber category')
    .sort({ createdAt: -1 })
    .lean();

  const { normalizeRole } = require('../utils/roleHelper');
  const formattedUsers = users.map((u) => {
    const r = normalizeRole(u.role);
    return {
      ...u,
      primaryRole: u.currentRole || r || 'student',
      hostelName: u.hostelId?.name || 'Unassigned',
      roomNumber: u.roomId?.roomNumber || 'Unassigned',
    };
  });

  res.status(200).json({ success: true, count: formattedUsers.length, data: formattedUsers });
});

// Get dashboard stats (counts for superadmin) – full DB overview with realtime summaries
exports.getDashboardStats = asyncHandler(async (req, res) => {
  const ownerQuery = buildRoleQuery('owner');
  const studentQuery = buildRoleQuery('student');
  const wardenQuery = buildRoleQuery('warden');
  const cleanerQuery = buildRoleQuery('cleaner');
  const securityQuery = buildRoleQuery('security');

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
    hostelsList,
    ownersList,
  ] = await Promise.all([
    Hostel.countDocuments(),
    SupportTicket.countDocuments(),
    SupportTicket.countDocuments({ status: 'open' }),
    User.countDocuments(ownerQuery),
    User.countDocuments(studentQuery),
    User.countDocuments(wardenQuery),
    User.countDocuments(cleanerQuery),
    User.countDocuments(securityQuery),
    User.countDocuments(),
    Payment.countDocuments(),
    Complaint.countDocuments(),
    Room.countDocuments(),
    Hostel.find({}).populate('ownerId', 'name email phone').sort({ createdAt: -1 }).limit(5).lean(),
    User.find(ownerQuery).select('name email phone createdAt status').sort({ createdAt: -1 }).limit(5).lean(),
  ]);

  // Calculate total capacity and active residents across all hostels
  const allHostels = await Hostel.find({}).select('capacity currentOccupancy').lean();
  const totalCapacity = allHostels.reduce((acc, h) => acc + (h.capacity || 0), 0);
  const totalOccupancy = allHostels.reduce((acc, h) => acc + (h.currentOccupancy || 0), 0);

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
      totalCapacity,
      totalOccupancy,
      occupancyRate: totalCapacity > 0 ? Math.round((totalOccupancy / totalCapacity) * 100) : 0,
      recentHostels: hostelsList,
      recentOwners: ownersList,
    },
  });
});

// Seed / Link dummy users to all hostels in database
exports.seedDummyUsers = asyncHandler(async (req, res) => {
  const allHostels = await Hostel.find({});
  if (allHostels.length === 0) {
    return res.status(400).json({ success: false, message: 'No hostels found in database to assign dummy users.' });
  }

  const sampleRooms = [
    { roomNumber: '101', floorNumber: 1, capacity: 2, category: 'AC', pricing: { monthly: 12000 } },
    { roomNumber: '102', floorNumber: 1, capacity: 2, category: 'AC', pricing: { monthly: 12000 } },
    { roomNumber: '103', floorNumber: 1, capacity: 2, category: 'Non-AC', pricing: { monthly: 8500 } },
    { roomNumber: '104', floorNumber: 1, capacity: 2, category: 'Non-AC', pricing: { monthly: 8500 } },
    { roomNumber: '201', floorNumber: 2, capacity: 3, category: 'Deluxe', pricing: { monthly: 15000 } },
    { roomNumber: '202', floorNumber: 2, capacity: 3, category: 'Standard', pricing: { monthly: 9500 } },
  ];

  const dummyProfiles = [
    { name: 'Aarav Sharma', email: 'aarav.sharma@example.com', phone: '9823101122', studentId: 'STU-1001' },
    { name: 'Pooja Verma', email: 'pooja.verma@example.com', phone: '9823101123', studentId: 'STU-1002' },
    { name: 'Rohan Mehta', email: 'rohan.mehta@example.com', phone: '9823101124', studentId: 'STU-1003' },
    { name: 'Sneha Kulkarni', email: 'sneha.kulkarni@example.com', phone: '9823101125', studentId: 'STU-1004' },
    { name: 'Vikram Rathore', email: 'vikram.rathore@example.com', phone: '9823101126', studentId: 'STU-1005' },
    { name: 'Divya Patel', email: 'divya.patel@example.com', phone: '9823101127', studentId: 'STU-1006' },
  ];

  for (const h of allHostels) {
    // Ensure rooms
    let rooms = await Room.find({ hostelId: h._id });
    for (const rData of sampleRooms) {
      let existing = rooms.find((r) => r.roomNumber === rData.roomNumber);
      if (!existing) {
        const newRoom = await Room.create({
          ...rData,
          hostelId: h._id,
          status: 'available',
          students: [],
          currentOccupancy: 0,
        });
        rooms.push(newRoom);
      }
    }

    // Assign existing unassigned students to this hostel
    const unassigned = await User.find({
      role: { $in: ['student'] },
      $or: [{ hostelId: { $exists: false } }, { hostelId: null }],
    }).limit(5);

    for (const student of unassigned) {
      const room = rooms.find((r) => r.currentOccupancy < r.capacity) || rooms[0];
      student.hostelId = h._id;
      student.roomId = room ? room._id : undefined;
      student.studentId = student.studentId || `STU-${Math.floor(1000 + Math.random() * 9000)}`;
      await student.save();

      if (room) {
        if (!room.students.some((id) => id.toString() === student._id.toString())) {
          room.students.push(student._id);
          room.currentOccupancy = room.students.length;
          await room.save();
        }
      }
    }

    // Ensure at least 5 students exist per hostel
    let currentStudents = await User.countDocuments({ hostelId: h._id, role: { $in: ['student'] } });
    if (currentStudents < 5) {
      const needed = 5 - currentStudents;
      for (let i = 0; i < needed; i++) {
        const profile = dummyProfiles[i % dummyProfiles.length];
        const uniqueEmail = `${profile.email.split('@')[0]}.${h._id.toString().slice(-4)}@example.com`;
        let user = await User.findOne({ email: uniqueEmail });
        if (!user) {
          const room = rooms.find((r) => r.currentOccupancy < r.capacity) || rooms[0];
          user = await User.create({
            name: profile.name,
            email: uniqueEmail,
            password: 'password123',
            role: ['student'],
            currentRole: 'student',
            phone: profile.phone,
            hostelId: h._id,
            roomId: room ? room._id : undefined,
            studentId: `${profile.studentId}-${h._id.toString().slice(-3)}`,
            status: i === 0 ? 'on-leave' : 'active',
          });
          if (room) {
            room.students.push(user._id);
            room.currentOccupancy = room.students.length;
            await room.save();
          }
        }
      }
    }

    // Update hostel counters
    const updatedRooms = await Room.find({ hostelId: h._id });
    const finalStudents = await User.countDocuments({ hostelId: h._id, role: { $in: ['student'] } });
    const totalCapacity = updatedRooms.reduce((acc, r) => acc + (r.capacity || 0), 0);
    h.totalRooms = updatedRooms.length;
    h.capacity = totalCapacity || h.capacity || 20;
    h.currentOccupancy = finalStudents;
    h.availableRooms = updatedRooms.filter((r) => r.currentOccupancy < r.capacity).length;
    await h.save();
  }

  res.status(200).json({
    success: true,
    message: 'Dummy users and rooms successfully linked and verified for all hostels in database.',
  });
});

// Create hostel owner (superadmin only)
exports.createOwner = asyncHandler(async (req, res) => {
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
});
