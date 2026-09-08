const Task = require('../models/Task');
const Complaint = require('../models/Complaint');
const User = require('../models/User');

// ============ TASK ASSIGNMENT ============

// Get Available Cleaning Requests (Pool)
exports.getAvailableRequests = async (req, res) => {
  try {
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
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Accept Request (Assign to Self)
exports.acceptRequest = async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id);

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

    complaint.assignedTo = req.user.id;
    complaint.status = 'in-progress'; // OR 'assigned' based on workflow, let's say 'in-progress' means accepted
    complaint.updatedAt = Date.now();

    await complaint.save();

    res.status(200).json({ success: true, data: complaint });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get Assigned Tasks
exports.getTasks = async (req, res) => {
  try {
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
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get Task by ID
exports.getTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id).populate('roomId');
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }
    if (task.assignedTo.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    res.status(200).json({ success: true, data: task });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update Task Status
exports.updateTaskStatus = async (req, res) => {
  try {
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
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Complete Task with Images
exports.completeTask = async (req, res) => {
  try {
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
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Upload Task Images
exports.uploadTaskImages = async (req, res) => {
  try {
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
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============ COMPLAINT HANDLING ============

// Get Assigned Complaints
exports.getAssignedComplaints = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = { assignedTo: req.user.id };
    if (status) filter.status = status;

    const complaints = await Complaint.find(filter)
      .populate('raisedBy', 'name roomId')
      .populate('roomId', 'roomNumber')
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: complaints });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update Complaint Status
exports.updateComplaintStatus = async (req, res) => {
  try {
    const { status, resolutionNotes } = req.body;
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found' });
    }
    if (complaint.assignedTo?.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    complaint.status = status;
    if (status === 'resolved' || status === 'closed') {
      complaint.resolvedAt = new Date();
      if (resolutionNotes) complaint.resolutionNotes = resolutionNotes;
    }
    complaint.updatedAt = Date.now();
    await complaint.save();

    res.status(200).json({ success: true, data: complaint });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============ ATTENDANCE ============

// Clock In
exports.clockIn = async (req, res) => {
  try {
    // In production, store attendance records
    // For now, just return success
    res.status(200).json({
      success: true,
      message: 'Clocked in successfully',
      data: { clockInTime: new Date() },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Clock Out
exports.clockOut = async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      message: 'Clocked out successfully',
      data: { clockOutTime: new Date() },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============ LEAVE REQUEST ============

// Create Leave Request
exports.createLeaveRequest = async (req, res) => {
  try {
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
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get Leave Requests
exports.getLeaveRequests = async (req, res) => {
  try {
    const Permission = require('../models/Permission');
    const leaveRequests = await Permission.find({
      studentId: req.user.id,
      permissionType: 'leave',
    }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: leaveRequests });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============ SHIFT SCHEDULE ============

// Get Shift Schedule
exports.getShiftSchedule = async (req, res) => {
  try {
    // In production, create a Shift model
    // For now, return mock data
    res.status(200).json({
      success: true,
      data: {
        shiftTimings: '09:00 - 17:00',
        workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

