const Task = require('../models/Task');
const User = require('../models/User');
const Hostel = require('../models/Hostel');
const asyncHandler = require('../utils/asyncHandler');

// @desc    Get Supervisor Dashboard Stats
// @route   GET /api/supervisor/dashboard
// @access  Private (Supervisor)
exports.getDashboardStats = asyncHandler(async (req, res) => {
  const supervisor = await User.findById(req.user.id);
  const hostelId = supervisor.hostelId;

  if (!hostelId) {
    return res.status(400).json({ success: false, message: 'Supervisor not assigned to any hostel.' });
  }

  const staffCount = await User.countDocuments({ hostelId, role: { $in: ['cleaner', 'security'] } });
  
  const pendingTasks = await Task.countDocuments({ status: 'pending' }); // Needs filtering by hostel if Task had hostelId
  const inProgressTasks = await Task.countDocuments({ status: 'in-progress' });
  const completedTasks = await Task.countDocuments({ status: 'completed' });

  res.status(200).json({
    success: true,
    data: {
      staffCount,
      tasks: {
        pending: pendingTasks,
        inProgress: inProgressTasks,
        completed: completedTasks
      }
    }
  });
});

// @desc    Get all staff assigned to supervisor's hostel
// @route   GET /api/supervisor/staff
// @access  Private (Supervisor)
exports.getStaff = asyncHandler(async (req, res) => {
  const supervisor = await User.findById(req.user.id);
  const staff = await User.find({ hostelId: supervisor.hostelId, role: { $in: ['cleaner', 'security'] } })
    .select('-password');

  res.status(200).json({ success: true, count: staff.length, data: staff });
});

// @desc    Assign a new task to a cleaner or maintenance staff
// @route   POST /api/supervisor/tasks
// @access  Private (Supervisor)
exports.createTask = asyncHandler(async (req, res) => {
  const { title, description, assignedTo, roomId, taskType, scheduledDate } = req.body;

  const staff = await User.findById(assignedTo);
  if (!staff || staff.role !== 'cleaner') {
    return res.status(400).json({ success: false, message: 'Task can only be assigned to valid cleaners' });
  }

  const task = await Task.create({
    title,
    description,
    assignedTo,
    roomId,
    taskType: taskType || 'cleaning',
    scheduledDate: scheduledDate || Date.now(),
    status: 'pending'
  });

  res.status(201).json({ success: true, data: task });
});

// @desc    Get all tasks
// @route   GET /api/supervisor/tasks
// @access  Private (Supervisor)
exports.getTasks = asyncHandler(async (req, res) => {
  const tasks = await Task.find()
    .populate('assignedTo', 'name email role')
    .populate('roomId', 'roomNumber blockId')
    .sort({ createdAt: -1 });

  res.status(200).json({ success: true, count: tasks.length, data: tasks });
});

// @desc    Update task (approve completion, cancel, etc)
// @route   PUT /api/supervisor/tasks/:id
// @access  Private (Supervisor)
exports.updateTask = asyncHandler(async (req, res) => {
  let task = await Task.findById(req.params.id);

  if (!task) {
    return res.status(404).json({ success: false, message: 'Task not found' });
  }

  task = await Task.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });

  res.status(200).json({ success: true, data: task });
});
