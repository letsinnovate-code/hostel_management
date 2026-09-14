const User = require('../models/User');
const Attendance = require('../models/Attendance');
const Hostel = require('../models/Hostel');
const { getBusinessDayRange, getBusinessDate } = require('../services/timezoneService');
const asyncHandler = require('../utils/asyncHandler');

// Helper: Consistent timezone-aware business day query
async function getHostelBusinessDateQuery(hostelId) {
  const hostel = await Hostel.findById(hostelId).select('timezone').lean();
  const timezone = hostel?.timezone || 'Asia/Kolkata';
  const range = getBusinessDayRange(new Date(), timezone);
  const businessDate = getBusinessDate(new Date(), timezone);
  return {
    $or: [
      { date: businessDate },
      { date: { $gte: range.start, $lte: range.end } },
    ],
  };
}

// Get all checked-in students
exports.getCheckedInStudents = asyncHandler(async (req, res) => {
  const hostelId = req.user.hostelId;
  if (!hostelId) {
    return res.status(400).json({ success: false, message: 'Hostel assignment required' });
  }

  const dateQuery = await getHostelBusinessDateQuery(hostelId);

  const checkedInStudents = await Attendance.find({
    hostelId,
    status: 'inside',
    ...dateQuery,
  })
    .populate({
      path: 'studentId',
      select: 'name email phone studentId roomId blockId',
      populate: [
        { path: 'roomId', select: 'roomNumber' },
        { path: 'blockId', select: 'blockName' },
      ],
    })
    .sort({ checkInTime: -1 });

  res.status(200).json({
    success: true,
    count: checkedInStudents.length,
    data: checkedInStudents,
  });
});

// Get all checked-out students
exports.getCheckedOutStudents = asyncHandler(async (req, res) => {
  const hostelId = req.user.hostelId;
  if (!hostelId) {
    return res.status(400).json({ success: false, message: 'Hostel assignment required' });
  }

  const dateQuery = await getHostelBusinessDateQuery(hostelId);

  const checkedOutStudents = await Attendance.find({
    hostelId,
    status: 'outside',
    ...dateQuery,
  })
    .populate({
      path: 'studentId',
      select: 'name email phone studentId roomId blockId',
      populate: [
        { path: 'roomId', select: 'roomNumber' },
        { path: 'blockId', select: 'blockName' },
      ],
    })
    .sort({ checkOutTime: -1 });

  res.status(200).json({
    success: true,
    count: checkedOutStudents.length,
    data: checkedOutStudents,
  });
});

// Get all students attendance status
exports.getAllStudentsStatus = asyncHandler(async (req, res) => {
  const hostelId = req.user.hostelId;
  if (!hostelId) {
    return res.status(400).json({ success: false, message: 'Hostel assignment required' });
  }

  const dateQuery = await getHostelBusinessDateQuery(hostelId);

  // Get all students in the hostel
  const students = await User.find({
    hostelId,
    role: 'student',
    status: 'active',
  })
    .select('name email phone studentId roomId blockId')
    .populate('roomId', 'roomNumber')
    .populate('blockId', 'blockName');

  // Get today's attendance records using timezone-aware business day
  const attendanceRecords = await Attendance.find({
    hostelId,
    ...dateQuery,
  })
    .populate('studentId', 'name email phone studentId')
    .sort({ createdAt: -1 });

  // Create a map of student attendance (guarded against null/orphaned student references)
  const attendanceMap = new Map();
  attendanceRecords.forEach((record) => {
    const studentId = (record.studentId?._id || record.studentId)?.toString();
    if (!studentId) return;
    if (!attendanceMap.has(studentId) || record.createdAt > attendanceMap.get(studentId).createdAt) {
      attendanceMap.set(studentId, record);
    }
  });

  // Combine student data with attendance status
  const studentsWithStatus = students.map((student) => {
    const attendance = attendanceMap.get(student._id.toString());
    return {
      student: {
        _id: student._id,
        name: student.name,
        email: student.email,
        phone: student.phone,
        studentId: student.studentId,
        room: student.roomId?.roomNumber || 'N/A',
        block: student.blockId?.blockName || 'N/A',
      },
      status: attendance?.status || 'not_checked',
      checkInTime: attendance?.checkInTime || null,
      checkOutTime: attendance?.checkOutTime || null,
      location: attendance?.location || null,
    };
  });

  // Count statistics
  const stats = {
    total: studentsWithStatus.length,
    checkedIn: studentsWithStatus.filter((s) => s.status === 'inside').length,
    checkedOut: studentsWithStatus.filter((s) => s.status === 'outside').length,
    notChecked: studentsWithStatus.filter((s) => s.status === 'not_checked').length,
  };

  res.status(200).json({
    success: true,
    stats,
    data: studentsWithStatus,
  });
});

// Get dashboard statistics
exports.getDashboardStats = asyncHandler(async (req, res) => {
  const hostelId = req.user.hostelId;
  if (!hostelId) {
    return res.status(400).json({ success: false, message: 'Hostel assignment required' });
  }

  const dateQuery = await getHostelBusinessDateQuery(hostelId);

  const [checkedIn, checkedOut, totalStudents] = await Promise.all([
    Attendance.countDocuments({
      hostelId,
      status: 'inside',
      ...dateQuery,
    }),
    Attendance.countDocuments({
      hostelId,
      status: 'outside',
      ...dateQuery,
    }),
    User.countDocuments({
      hostelId,
      role: 'student',
      status: 'active',
    }),
  ]);

  res.status(200).json({
    success: true,
    data: {
      checkedIn,
      checkedOut,
      totalStudents,
      notChecked: totalStudents - checkedIn - checkedOut,
    },
  });
});
