/**
 * @file controllers/warden/wardenRoomController.js
 * @description Warden room allocation, bed assignment, and vacancy controller.
 */

'use strict';

const mongoose = require('mongoose');
const Room = require('../../models/Room');
const User = require('../../models/User');
const RoomAllocationHistory = require('../../models/RoomAllocationHistory');
const RoomService = require('../../services/roomService');
const RoomRepository = require('../../repositories/roomRepository');
const StudentRepository = require('../../repositories/studentRepository');
const { resolveWardenHostelId } = require('./wardenHelper');

exports.getWardenRooms = async (req, res) => {
  try {
    const targetHostelId = await resolveWardenHostelId(req);
    if (!targetHostelId) {
      return res.status(200).json({
        success: true,
        data: {
          rooms: [],
          floors: [],
          blocks: [],
          metrics: {
            totalRooms: 0,
            totalBeds: 0,
            occupiedBeds: 0,
            vacantBeds: 0,
            occupancyRate: 0,
            maintenanceRooms: 0,
          },
        },
      });
    }

    const { floor, block, status, category, search } = req.query;

    const filter = { hostelId: targetHostelId };

    if (floor && floor !== 'all') {
      filter.floorNumber = Number(floor);
    }
    if (block && block !== 'all') {
      filter.blockId = block;
    }
    if (status && status !== 'all') {
      filter.status = status;
    }
    if (category && category !== 'all') {
      filter.category = category;
    }

    if (search && search.trim()) {
      const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.roomNumber = { $regex: escaped, $options: 'i' };
    }

    let rooms = await Room.find(filter)
      .populate('blockId', 'name')
      .populate('hostelId', 'name')
      .populate({
        path: 'students',
        select: 'name studentId phone email gender course year status profileImage',
      })
      .sort({ floorNumber: 1, roomNumber: 1 })
      .lean();

    // Fallback sync: If room.students is empty but Users have this roomId, batch synchronize (N+1 resolution)
    const emptyRoomIds = [];
    for (const r of rooms) {
      if (!r.students || r.students.length === 0) {
        emptyRoomIds.push(r._id);
      }
    }

    if (emptyRoomIds.length > 0) {
      const activeResidents = await User.find({
        roomId: { $in: emptyRoomIds },
        role: 'student',
        status: { $in: ['active', 'on-leave'] },
      })
        .select('name studentId phone email gender course year status profileImage roomId')
        .lean();

      const residentsByRoom = new Map();
      for (const s of activeResidents) {
        const rId = String(s.roomId);
        if (!residentsByRoom.has(rId)) residentsByRoom.set(rId, []);
        residentsByRoom.get(rId).push(s);
      }

      const bulkOps = [];
      for (const r of rooms) {
        if (!r.students || r.students.length === 0) {
          const roomResidents = residentsByRoom.get(String(r._id)) || [];
          if (roomResidents.length > 0) {
            r.students = roomResidents;
            bulkOps.push({
              updateOne: {
                filter: { _id: r._id },
                update: {
                  students: roomResidents.map((s) => s._id),
                  currentOccupancy: roomResidents.length,
                  status:
                    roomResidents.length >= r.capacity
                      ? 'occupied'
                      : r.status === 'maintenance' || r.status === 'unavailable'
                      ? r.status
                      : 'available',
                },
              },
            });
          }
        }
      }

      if (bulkOps.length > 0) {
        Room.bulkWrite(bulkOps).catch((bulkErr) => {
          console.error('[wardenRoomController] Background room reconciliation bulkWrite failed:', bulkErr.message);
        });
      }
    }

    // Calculate available beds safely
    for (const r of rooms) {
      const occupied = r.students ? r.students.length : (r.currentOccupancy || 0);
      r.currentOccupancy = occupied;
      r.availableBeds = Math.max(0, (r.capacity || 0) - occupied);
    }

    // Compute hostel-wide metrics
    const allHostelRooms = await Room.find({ hostelId: targetHostelId })
      .populate('students', '_id')
      .lean();

    let totalBeds = 0;
    let occupiedBeds = 0;
    let maintenanceRooms = 0;
    const floorSet = new Set();
    const blockMap = new Map();

    allHostelRooms.forEach((r) => {
      if (r.floorNumber != null) floorSet.add(r.floorNumber);
      if (r.blockId) {
        const bId = String(r.blockId._id || r.blockId);
        blockMap.set(bId, r.blockId.name || 'Block');
      }
      const cap = r.capacity || 0;
      const occ = r.students ? r.students.length : (r.currentOccupancy || 0);
      totalBeds += cap;
      occupiedBeds += occ;
      if (r.status === 'maintenance' || r.status === 'unavailable') {
        maintenanceRooms += 1;
      }
    });

    const vacantBeds = Math.max(0, totalBeds - occupiedBeds);
    const occupancyRate = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

    res.status(200).json({
      success: true,
      data: {
        rooms,
        floors: Array.from(floorSet).sort((a, b) => a - b),
        blocks: Array.from(blockMap.entries()).map(([id, name]) => ({ _id: id, name })),
        metrics: {
          totalRooms: allHostelRooms.length,
          totalBeds,
          occupiedBeds,
          vacantBeds,
          occupancyRate,
          maintenanceRooms,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching warden rooms:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get Unassigned Students in this hostel
exports.getUnassignedStudents = async (req, res) => {
  try {
    const targetHostelId = await resolveWardenHostelId(req);
    if (!targetHostelId) {
      return res.status(200).json({ success: true, data: [] });
    }

    const students = await User.find({
      hostelId: targetHostelId,
      role: 'student',
      status: { $in: ['active', 'on-leave'] },
      $or: [{ roomId: null }, { roomId: { $exists: false } }],
    })
      .select('name studentId phone email gender course year status profileImage')
      .sort({ name: 1 })
      .lean();

    res.status(200).json({ success: true, count: students.length, data: students });
  } catch (error) {
    console.error('Error fetching unassigned students:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Assign Student to Available Bed
exports.assignBed = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { studentId, reason = '' } = req.body;

    if (!studentId || !mongoose.isValidObjectId(studentId)) {
      return res.status(400).json({ success: false, message: 'Valid student ID is required' });
    }
    if (!roomId || !mongoose.isValidObjectId(roomId)) {
      return res.status(400).json({ success: false, message: 'Valid room ID is required' });
    }

    const targetHostelId = await resolveWardenHostelId(req);
    if (!targetHostelId) {
      return res.status(403).json({ success: false, message: 'No hostel assigned' });
    }

    // 1. Fetch Room & verify ownership
    const room = await Room.findOne({ _id: roomId, hostelId: targetHostelId });
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found in your assigned hostel' });
    }

    // Safeguard: Room status must not be maintenance or unavailable
    if (room.status === 'maintenance' || room.status === 'unavailable') {
      return res.status(400).json({
        success: false,
        message: `Cannot assign student: Room ${room.roomNumber} is currently marked as ${room.status}.`,
      });
    }

    // Safeguard: Capacity check
    const currentOccupancy = room.students ? room.students.length : 0;
    if (currentOccupancy >= room.capacity) {
      return res.status(400).json({
        success: false,
        message: `Cannot assign student: Room ${room.roomNumber} is already at full capacity (${room.capacity}/${room.capacity} beds occupied).`,
      });
    }

    // 2. Fetch Student & verify hostel membership
    const student = await User.findOne({ _id: studentId, role: 'student', hostelId: targetHostelId });
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found in your assigned hostel' });
    }

    // Safeguard: Prevent duplicate active allocations
    if (student.roomId) {
      const existingRoom = await Room.findById(student.roomId).select('roomNumber');
      return res.status(400).json({
        success: false,
        message: `Student is already allocated to Room ${existingRoom?.roomNumber || student.roomId}. Use the Transfer action instead of Assign.`,
      });
    }

    // Safeguard: Double check student is not in room's array
    if (room.students.some(s => String(s) === String(studentId))) {
      return res.status(400).json({
        success: false,
        message: `Student is already recorded in Room ${room.roomNumber}.`,
      });
    }

    // 3. Update Room
    room.students.push(studentId);
    room.currentOccupancy = room.students.length;
    if (room.currentOccupancy >= room.capacity) {
      room.status = 'occupied';
    } else {
      room.status = 'available';
    }
    await room.save();

    // 4. Update Student
    student.roomId = room._id;
    if (room.blockId) student.blockId = room.blockId;
    await student.save();

    // 5. Create Room Allocation History
    const historyEntry = await RoomAllocationHistory.create({
      hostelId: targetHostelId,
      studentId: student._id,
      toRoomId: room._id,
      action: 'assign',
      reason: reason.trim() || 'Assigned bed by Warden',
      performedBy: req.user._id || req.user.id,
      details: {
        roomNumber: room.roomNumber,
        occupancyAfter: room.currentOccupancy,
        capacity: room.capacity,
      },
    });

    const populatedRoom = await Room.findById(room._id)
      .populate('students', 'name studentId phone email gender course year status profileImage')
      .populate('blockId', 'name')
      .lean();

    res.status(200).json({
      success: true,
      message: `Student ${student.name} successfully assigned to Room ${room.roomNumber}`,
      data: {
        room: populatedRoom,
        history: historyEntry,
      },
    });
  } catch (error) {
    console.error('Error assigning bed:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Transfer Student to another Room
exports.transferBed = async (req, res) => {
  try {
    const { studentId, fromRoomId, toRoomId, reason = '' } = req.body;

    if (!studentId || !mongoose.isValidObjectId(studentId)) {
      return res.status(400).json({ success: false, message: 'Valid student ID is required' });
    }
    if (!fromRoomId || !mongoose.isValidObjectId(fromRoomId)) {
      return res.status(400).json({ success: false, message: 'Valid source room ID is required' });
    }
    if (!toRoomId || !mongoose.isValidObjectId(toRoomId)) {
      return res.status(400).json({ success: false, message: 'Valid target room ID is required' });
    }

    if (String(fromRoomId) === String(toRoomId)) {
      return res.status(400).json({ success: false, message: 'Source and target room cannot be the same' });
    }

    const targetHostelId = await resolveWardenHostelId(req);
    if (!targetHostelId) {
      return res.status(403).json({ success: false, message: 'No hostel assigned' });
    }

    // 1. Fetch source room & target room
    const [sourceRoom, targetRoom, student] = await Promise.all([
      Room.findOne({ _id: fromRoomId, hostelId: targetHostelId }),
      Room.findOne({ _id: toRoomId, hostelId: targetHostelId }),
      User.findOne({ _id: studentId, role: 'student', hostelId: targetHostelId }),
    ]);

    if (!sourceRoom) {
      return res.status(404).json({ success: false, message: 'Source room not found in your assigned hostel' });
    }
    if (!targetRoom) {
      return res.status(404).json({ success: false, message: 'Target room not found in your assigned hostel' });
    }
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found in your assigned hostel' });
    }

    // Safeguard: Verify student is currently in source room
    if (String(student.roomId) !== String(fromRoomId) && !sourceRoom.students.some(s => String(s) === String(studentId))) {
      return res.status(400).json({
        success: false,
        message: `Student is not currently allocated to source Room ${sourceRoom.roomNumber}.`,
      });
    }

    // Safeguard: Target room status must not be maintenance/unavailable
    if (targetRoom.status === 'maintenance' || targetRoom.status === 'unavailable') {
      return res.status(400).json({
        success: false,
        message: `Cannot transfer student: Target Room ${targetRoom.roomNumber} is currently under ${targetRoom.status}.`,
      });
    }

    // Safeguard: Target room must have available beds
    const targetOccupancy = targetRoom.students ? targetRoom.students.length : 0;
    if (targetOccupancy >= targetRoom.capacity) {
      return res.status(400).json({
        success: false,
        message: `Cannot transfer student: Target Room ${targetRoom.roomNumber} is at full capacity (${targetRoom.capacity}/${targetRoom.capacity} beds occupied).`,
      });
    }

    // 2. Remove from Source Room
    sourceRoom.students = sourceRoom.students.filter(s => String(s) !== String(studentId));
    sourceRoom.currentOccupancy = sourceRoom.students.length;
    if (sourceRoom.status === 'occupied' && sourceRoom.currentOccupancy < sourceRoom.capacity) {
      sourceRoom.status = 'available';
    }
    await sourceRoom.save();

    // 3. Add to Target Room
    targetRoom.students.push(studentId);
    targetRoom.currentOccupancy = targetRoom.students.length;
    if (targetRoom.currentOccupancy >= targetRoom.capacity) {
      targetRoom.status = 'occupied';
    } else {
      targetRoom.status = 'available';
    }
    await targetRoom.save();

    // 4. Update Student
    student.roomId = targetRoom._id;
    if (targetRoom.blockId) student.blockId = targetRoom.blockId;
    await student.save();

    // 5. Create History
    const historyEntry = await RoomAllocationHistory.create({
      hostelId: targetHostelId,
      studentId: student._id,
      fromRoomId: sourceRoom._id,
      toRoomId: targetRoom._id,
      action: 'transfer',
      reason: reason.trim() || 'Room transfer by Warden',
      performedBy: req.user._id || req.user.id,
      details: {
        fromRoomNumber: sourceRoom.roomNumber,
        toRoomNumber: targetRoom.roomNumber,
      },
    });

    res.status(200).json({
      success: true,
      message: `Student ${student.name} successfully transferred from Room ${sourceRoom.roomNumber} to Room ${targetRoom.roomNumber}`,
      data: {
        fromRoom: sourceRoom,
        toRoom: targetRoom,
        history: historyEntry,
      },
    });
  } catch (error) {
    console.error('Error transferring bed:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Vacate Bed (Remove student from room)
exports.vacateBed = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { studentId, reason = '' } = req.body;

    if (!studentId || !mongoose.isValidObjectId(studentId)) {
      return res.status(400).json({ success: false, message: 'Valid student ID is required' });
    }
    if (!roomId || !mongoose.isValidObjectId(roomId)) {
      return res.status(400).json({ success: false, message: 'Valid room ID is required' });
    }

    const targetHostelId = await resolveWardenHostelId(req);
    if (!targetHostelId) {
      return res.status(403).json({ success: false, message: 'No hostel assigned' });
    }

    const [room, student] = await Promise.all([
      Room.findOne({ _id: roomId, hostelId: targetHostelId }),
      User.findOne({ _id: studentId, role: 'student', hostelId: targetHostelId }),
    ]);

    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found in your assigned hostel' });
    }
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found in your assigned hostel' });
    }

    // Remove from room students
    room.students = (room.students || []).filter(s => String(s) !== String(studentId));
    room.currentOccupancy = room.students.length;
    if (room.status === 'occupied' && room.currentOccupancy < room.capacity) {
      room.status = 'available';
    }
    await room.save();

    // Clear student's room
    student.roomId = undefined;
    await student.save();

    // Create history
    const historyEntry = await RoomAllocationHistory.create({
      hostelId: targetHostelId,
      studentId: student._id,
      fromRoomId: room._id,
      action: 'vacate',
      reason: reason.trim() || 'Bed vacated by Warden',
      performedBy: req.user._id || req.user.id,
      details: {
        roomNumber: room.roomNumber,
        occupancyAfter: room.currentOccupancy,
      },
    });

    res.status(200).json({
      success: true,
      message: `Student ${student.name} vacated from Room ${room.roomNumber}`,
      data: {
        room,
        history: historyEntry,
      },
    });
  } catch (error) {
    console.error('Error vacating bed:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update Room Status (Available, Maintenance, Unavailable)
exports.updateRoomStatus = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { status, reason = '' } = req.body;

    const allowed = ['available', 'maintenance', 'unavailable'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, message: `Status must be one of: ${allowed.join(', ')}` });
    }

    const targetHostelId = await resolveWardenHostelId(req);
    if (!targetHostelId) {
      return res.status(403).json({ success: false, message: 'No hostel assigned' });
    }

    const room = await Room.findOne({ _id: roomId, hostelId: targetHostelId });
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found in your assigned hostel' });
    }

    const previousStatus = room.status;

    if (status === 'available') {
      const occ = room.students ? room.students.length : (room.currentOccupancy || 0);
      room.status = occ >= room.capacity ? 'occupied' : 'available';
    } else {
      room.status = status;
    }

    await room.save();

    const historyEntry = await RoomAllocationHistory.create({
      hostelId: targetHostelId,
      toRoomId: room._id,
      action: status === 'maintenance' ? 'maintenance' : 'status_change',
      reason: reason.trim() || `Status changed from ${previousStatus} to ${room.status}`,
      performedBy: req.user._id || req.user.id,
      details: {
        roomNumber: room.roomNumber,
        previousStatus,
        newStatus: room.status,
      },
    });

    res.status(200).json({
      success: true,
      message: `Room ${room.roomNumber} status updated to ${room.status}`,
      data: {
        room,
        history: historyEntry,
      },
    });
  } catch (error) {
    console.error('Error updating room status:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Report Room Problem (Maintenance Complaint)
exports.reportRoomProblem = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { title, description, priority = 'medium', complaintType = 'maintenance' } = req.body;

    if (!title || !description) {
      return res.status(400).json({ success: false, message: 'Title and description are required' });
    }

    const targetHostelId = await resolveWardenHostelId(req);
    if (!targetHostelId) {
      return res.status(403).json({ success: false, message: 'No hostel assigned' });
    }

    const room = await Room.findOne({ _id: roomId, hostelId: targetHostelId });
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found in your assigned hostel' });
    }

    const complaint = await Complaint.create({
      raisedBy: req.user._id || req.user.id,
      hostelId: targetHostelId,
      blockId: room.blockId,
      roomId: room._id,
      title: `[Room ${room.roomNumber}] ${title.trim()}`,
      description: description.trim(),
      complaintType,
      priority,
      status: 'open',
    });

    res.status(201).json({
      success: true,
      message: `Room problem reported successfully for Room ${room.roomNumber}`,
      data: complaint,
    });
  } catch (error) {
    console.error('Error reporting room problem:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get Room Allocation History
exports.getRoomAllocationHistory = async (req, res) => {
  try {
    const targetHostelId = await resolveWardenHostelId(req);
    if (!targetHostelId) {
      return res.status(200).json({ success: true, data: [], pagination: { total: 0, page: 1, limit: 20 } });
    }

    const { roomId, studentId, page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

    const filter = { hostelId: targetHostelId };
    if (roomId && mongoose.isValidObjectId(roomId)) {
      filter.$or = [{ toRoomId: roomId }, { fromRoomId: roomId }];
    }
    if (studentId && mongoose.isValidObjectId(studentId)) {
      filter.studentId = studentId;
    }

    const [total, history] = await Promise.all([
      RoomAllocationHistory.countDocuments(filter),
      RoomAllocationHistory.find(filter)
        .populate('studentId', 'name studentId phone email profileImage')
        .populate('fromRoomId', 'roomNumber floorNumber')
        .populate('toRoomId', 'roomNumber floorNumber')
        .populate('performedBy', 'name role')
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(),
    ]);

    res.status(200).json({
      success: true,
      data: history,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum) || 1,
      },
    });
  } catch (error) {
    console.error('Error fetching room allocation history:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============ ATTENDANCE MANAGEMENT MODULE ============

/**
 * Helper: Log an attendance audit entry
 */
async function logAttendanceAudit({ action, entityId, performedBy, before, after, req }) {
  try {
    await AuditLog.create({
      action,
      entityType: 'attendance',
      entityId: entityId || (after?._id) || new mongoose.Types.ObjectId(),
      performedBy,
      changes: {
        before: before ? (before.toObject ? before.toObject() : before) : null,
        after: after ? (after.toObject ? after.toObject() : after) : null,
      },
      ipAddress: req?.ip || req?.headers?.['x-forwarded-for'] || '',
      userAgent: req?.headers?.['user-agent'] || '',
      timestamp: new Date(),
    });
  } catch (err) {
    console.warn('Failed to write attendance audit log:', err.message);
  }
}

/**
 * Get daily attendance sheet for roll call
 * Supports filtering by date, room, floor, course, status, search query
 */
