const Task = require('../models/Task');
const Complaint = require('../models/Complaint');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const ComplaintService = require('../services/complaintService');
const { COMPLAINT_STATUS } = require('../constants');

// ============ TASK ASSIGNMENT ============

// Get Available Cleaning Requests (Pool)
exports.getAvailableRequests = asyncHandler(async (req, res) => {
  const cleaner = await User.findById(req.user.id);

  // Find open cleaning complaints in the same hostel and block
  const requests = await Complaint.find({
    complaintType: 'cleaning',
    status: 'open',
    hostelId: cleaner.hostelId,
    blockId: cleaner.blockId
  })
    .populate('roomId', 'roomNumber')
    .sort({ createdAt: 1 }); // Oldest first

  res.status(200).json({ success: true, count: requests.length, data: requests });
});

// Accept Request (Assign to Self)
exports.acceptRequest = asyncHandler(async (req, res) => {
  const complaint = await ComplaintService.getComplaintById(req.params.id);

  if (!complaint) {
    return res.status(404).json({ success: false, message: 'Request not found' });
  }

  if (complaint.status !== 'open') {
    return res.status(400).json({ success: false, message: 'Request is already assigned or closed' });
  }

  const cleaner = await User.findById(req.user.id).select('hostelId blockId').lean();
  if (complaint.hostelId && cleaner?.hostelId && String(complaint.hostelId) !== String(cleaner.hostelId)) {
    return res.status(403).json({ success: false, message: 'Not authorized to accept requests from another hostel' });
  }

  const updated = await ComplaintService.updateStatus(req.params.id, {
    status: 'in-progress',
    assignedTo: req.user.id,
    user: req.user,
    remarks: 'Accepted cleaning request',
  });

  res.status(200).json({ success: true, data: updated });
});

// Get Assigned Tasks
exports.getTasks = asyncHandler(async (req, res) => {
  const { status, date } = req.query;
  const filter = { assignedTo: req.user.id };
  if (status) filter.status = status;
  if (date) {
    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);
    filter.scheduledDate = { $gte: startDate, $lte: endDate };
  }

  const tasks = await Task.find(filter)
    .populate('roomId', 'roomNumber')
    .sort({ scheduledDate: 1 });
  res.status(200).json({ success: true, data: tasks });
});

// Get Task by ID
exports.getTask = asyncHandler(async (req, res) => {
  const task = await Task.findById(req.params.id).populate('roomId');
  if (!task) {
    return res.status(404).json({ success: false, message: 'Task not found' });
  }
  if (task.assignedTo.toString() !== req.user.id) {
    return res.status(403).json({ success: false, message: 'Not authorized' });
  }
  res.status(200).json({ success: true, data: task });
});

// Update Task Status
exports.updateTaskStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const task = await Task.findById(req.params.id);
  if (!task) {
    return res.status(404).json({ success: false, message: 'Task not found' });
  }
  if (task.assignedTo.toString() !== req.user.id) {
    return res.status(403).json({ success: false, message: 'Not authorized' });
  }

  task.status = status;
  if (status === 'completed') {
    task.completedAt = new Date();
  }
  await task.save();

  res.status(200).json({ success: true, data: task });
});

// Complete Task with Images
exports.completeTask = asyncHandler(async (req, res) => {
  const { notes, afterImages } = req.body;
  const task = await Task.findById(req.params.id);
  if (!task) {
    return res.status(404).json({ success: false, message: 'Task not found' });
  }
  if (task.assignedTo.toString() !== req.user.id) {
    return res.status(403).json({ success: false, message: 'Not authorized' });
  }

  task.status = 'completed';
  task.completedAt = new Date();
  if (notes) task.notes = notes;
  if (afterImages) task.afterImages = afterImages;

  await task.save();

  res.status(200).json({ success: true, data: task });
});

// Upload Task Images
exports.uploadTaskImages = asyncHandler(async (req, res) => {
  const { taskId, imageType, imageUrl } = req.body; // imageType: 'before' or 'after'
  if (!imageUrl || typeof imageUrl !== 'string') {
    return res.status(400).json({ success: false, message: 'Valid imageUrl string is required' });
  }

  const task = await Task.findById(taskId);
  if (!task) {
    return res.status(404).json({ success: false, message: 'Task not found' });
  }
  if (task.assignedTo.toString() !== req.user.id) {
    return res.status(403).json({ success: false, message: 'Not authorized' });
  }

  if (imageType === 'before') {
    task.beforeImages = task.beforeImages || [];
    task.beforeImages.push(imageUrl);
  } else {
    task.afterImages = task.afterImages || [];
    task.afterImages.push(imageUrl);
  }
  await task.save();

  res.status(200).json({ success: true, data: task });
});

// ============ COMPLAINT HANDLING ============

// Get Assigned Complaints
exports.getAssignedComplaints = asyncHandler(async (req, res) => {
  const { status } = req.query;
  const filter = { assignedTo: req.user.id };
  if (status) filter.status = status;

  const { complaints } = await ComplaintService.listComplaints({
    filter,
    sort: { createdAt: -1 },
    populate: [
      { path: 'raisedBy', select: 'name roomId' },
      { path: 'roomId', select: 'roomNumber' },
    ],
    lean: false,
    limit: 1000,
  });
  res.status(200).json({ success: true, data: complaints });
});

// Update Complaint Status
exports.updateComplaintStatus = asyncHandler(async (req, res) => {
  const { status, resolutionNotes } = req.body;
  const complaint = await ComplaintService.getComplaintById(req.params.id);
  if (!complaint) {
    return res.status(404).json({ success: false, message: 'Complaint not found' });
  }
  const assignedId = complaint.assignedTo ? complaint.assignedTo.toString() : null;
  const currentUserId = (req.user?.id || req.user?._id)?.toString();
  if (assignedId !== currentUserId) {
    return res.status(403).json({ success: false, message: 'Not authorized' });
  }

  const updated = await ComplaintService.updateStatus(req.params.id, {
    status,
    resolutionNotes,
    user: req.user,
    ip: req.ip,
    userAgent: req.headers?.['user-agent'],
  });

  res.status(200).json({ success: true, data: updated });
});

// ============ ATTENDANCE ============

// Clock In
exports.clockIn = asyncHandler(async (req, res) => {
  // In production, store attendance records
  // For now, just return success
  res.status(200).json({
    success: true,
    message: 'Clocked in successfully',
    data: { clockInTime: new Date() },
  });
});

// Clock Out
exports.clockOut = asyncHandler(async (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Clocked out successfully',
    data: { clockOutTime: new Date() },
  });
});

// ============ LEAVE REQUEST ============

// Create Leave Request
exports.createLeaveRequest = asyncHandler(async (req, res) => {
  // Using Permission model for leave requests
  const Permission = require('../models/Permission');
  const leaveRequest = await Permission.create({
    studentId: req.user.id, // Using cleaner as studentId for consistency
    permissionType: 'leave',
    reason: req.body.reason,
    requestedDate: req.body.requestedDate,
    returnDate: req.body.returnDate,
  });

  res.status(201).json({ success: true, data: leaveRequest });
});

// Get Leave Requests
exports.getLeaveRequests = asyncHandler(async (req, res) => {
  const Permission = require('../models/Permission');
  const leaveRequests = await Permission.find({
    studentId: req.user.id,
    permissionType: 'leave',
  }).sort({ createdAt: -1 });
  res.status(200).json({ success: true, data: leaveRequests });
});

// ============ SHIFT SCHEDULE ============

// Get Shift Schedule
exports.getShiftSchedule = asyncHandler(async (req, res) => {
  // In production, create a Shift model
  // For now, return mock data
  res.status(200).json({
    success: true,
    data: {
      shiftTimings: '09:00 - 17:00',
      workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    },
  });
});
