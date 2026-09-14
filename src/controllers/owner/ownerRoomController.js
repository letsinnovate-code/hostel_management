/**
 * @file controllers/owner/ownerRoomController.js
 * @description Owner room management, pricing, and auto-allocation controller.
 */

'use strict';

const mongoose = require('mongoose');
const Room = require('../../models/Room');
const Hostel = require('../../models/Hostel');
const User = require('../../models/User');
const Block = require('../../models/Block');
const { assertOwnsHostel, getOwnerHostelIds, getScopedHostelIds } = require('./ownerHelper');
const { uploadImageToS3, uploadMultipleImagesToS3, deleteImageFromS3 } = require('../../utils/s3Upload');
const RoomRepository = require('../../repositories/roomRepository');
const { sendErrorResponse } = require('../../utils/apiError');

exports.createRoom = async (req, res) => {
  try {
    const {
      roomNumber,
      hostelId,
      blockId,
      floorNumber,
      capacity,
      category,
      pricing,
      amenities,
      images,
      coverImage,
      description,
      status,
    } = req.body;

    if (!hostelId || !roomNumber) {
      return res.status(400).json({ success: false, message: 'Hostel ID and roomNumber are required' });
    }
    await assertOwnsHostel(req, hostelId);

    if (blockId) {
      const block = await Block.findById(blockId);
      if (!block || String(block.hostelId) !== String(hostelId)) {
        return res.status(400).json({ success: false, message: 'Block does not belong to the specified hostel' });
      }
    }

    const roomData = {
      roomNumber: String(roomNumber).trim().slice(0, 50),
      hostelId,
      blockId: blockId || undefined,
      floorNumber: floorNumber !== undefined ? Number(floorNumber) : 0,
      capacity: capacity !== undefined ? Math.max(1, Number(capacity)) : 2,
      currentOccupancy: 0,
      students: [],
      category: ['AC', 'Non-AC', 'Deluxe', 'Standard'].includes(category) ? category : 'Standard',
      status: ['available', 'occupied', 'maintenance', 'unavailable'].includes(status) ? status : 'available',
      pricing: pricing && typeof pricing === 'object' ? {
        monthly: Number(pricing.monthly) || 0,
        yearly: Number(pricing.yearly) || 0,
        perBed: Number(pricing.perBed) || 0,
      } : undefined,
      amenities: Array.isArray(amenities) ? amenities.map(String).slice(0, 50) : [],
      images: Array.isArray(images) ? images.map(String).slice(0, 20) : [],
      coverImage: typeof coverImage === 'string' ? coverImage : undefined,
      description: typeof description === 'string' ? description.trim().slice(0, 2000) : undefined,
    };

    const room = await Room.create(roomData);
    const populated = await Room.findById(room._id).populate('hostelId', 'name').populate('blockId', 'name');
    res.status(201).json({ success: true, data: populated || room });
  } catch (error) {
    return sendErrorResponse(res, error, 'Failed to create room');
  }
};

// Get Rooms

exports.getRooms = async (req, res) => {
  try {
    const { hostelId, blockId, status, category } = req.query;
    const filter = {};
    const scopedHostelIds = await getScopedHostelIds(req, hostelId);
    if (scopedHostelIds.length === 0) {
      return res.status(200).json({ success: true, count: 0, data: [] });
    }
    filter.hostelId = { $in: scopedHostelIds };
    if (req.params.blockId) {
      filter.blockId = req.params.blockId;
    } else if (blockId) {
      filter.blockId = blockId;
    }

    if (status) filter.status = status;
    if (category) filter.category = category;

    const roomList = await RoomRepository.findRoomsWithStudents(filter);

    res.status(200).json({
      success: true,
      count: roomList.length,
      data: roomList,
    });
  } catch (error) {
    return sendErrorResponse(res, error, 'Failed to retrieve rooms');
  }
};

exports.getRoom = async (req, res) => {
  try {
    const User = require('../../models/User');
    const room = await Room.findById(req.params.id)
      .populate('hostelId', 'name address')
      .populate('blockId', 'name')
      .populate('students', 'name email phone profileImage studentId');

    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }
    if (room.hostelId) {
      await assertOwnsHostel(req, room.hostelId._id || room.hostelId);
    }

    // If students array is empty, fetch students by roomId from User model
    if (!room.students || room.students.length === 0) {
      const students = await User.find({ roomId: req.params.id, role: 'student' })
        .select('name email phone profileImage studentId');
      room.students = students;
    }

    res.status(200).json({ success: true, data: room });
  } catch (error) {
    return sendErrorResponse(res, error, 'Failed to retrieve room');
  }
};

// Update Room

exports.updateRoom = async (req, res) => {
  try {
    const existingRoom = await Room.findById(req.params.id);
    if (!existingRoom) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }
    if (existingRoom.hostelId) {
      await assertOwnsHostel(req, existingRoom.hostelId);
    }
    const { hostelId, ...rest } = req.body;
    if (hostelId) {
      await assertOwnsHostel(req, hostelId);
    }
    const updatePayload = { ...rest };
    if (hostelId !== undefined) updatePayload.hostelId = hostelId || null;
    const room = await Room.findByIdAndUpdate(req.params.id, updatePayload, {
      new: true,
      runValidators: true,
    })
      .populate('hostelId', 'name')
      .populate('blockId', 'name')
      .populate('students');
    res.status(200).json({ success: true, data: room });
  } catch (error) {
    return sendErrorResponse(res, error, 'Failed to update room');
  }
};

// Delete Room

exports.deleteRoom = async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }
    if (room.hostelId) {
      await assertOwnsHostel(req, room.hostelId);
    }

    // Delete images from S3
    if (room.images && room.images.length > 0) {
      for (const imageUrl of room.images) {
        try {
          await deleteImageFromS3(imageUrl);
        } catch (error) {
          console.error('Error deleting room image:', error);
        }
      }
    }

    await Room.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: 'Room deleted successfully' });
  } catch (error) {
    return sendErrorResponse(res, error, 'Failed to delete room');
  }
};

// Upload Room Images

exports.uploadRoomImages = async (req, res) => {
  try {
    const { roomId } = req.params;
    const files = req.files;

    if (!files || files.length === 0) {
      return res.status(400).json({ success: false, message: 'No images provided' });
    }

    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }
    if (room.hostelId) {
      await assertOwnsHostel(req, room.hostelId);
    }

    const imageUrls = await uploadMultipleImagesToS3(files, 'rooms');
    room.images = [...(room.images || []), ...imageUrls];

    if (!room.coverImage && imageUrls.length > 0) {
      room.coverImage = imageUrls[0];
    }

    await room.save();

    res.status(200).json({
      success: true,
      data: {
        images: room.images,
        coverImage: room.coverImage,
      },
    });
  } catch (error) {
    return sendErrorResponse(res, error, 'Failed to upload room images');
  }
};

// Delete Room Image

exports.deleteRoomImage = async (req, res) => {
  try {
    const { roomId, imageUrl } = req.params;
    const decodedImageUrl = decodeURIComponent(imageUrl);

    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }
    if (room.hostelId) {
      await assertOwnsHostel(req, room.hostelId);
    }

    room.images = room.images.filter(img => img !== decodedImageUrl);
    if (room.coverImage === decodedImageUrl) {
      room.coverImage = room.images.length > 0 ? room.images[0] : null;
    }

    await deleteImageFromS3(decodedImageUrl);
    await room.save();

    res.status(200).json({
      success: true,
      message: 'Image deleted successfully',
      data: {
        images: room.images,
        coverImage: room.coverImage,
      },
    });
  } catch (error) {
    return sendErrorResponse(res, error, 'Failed to delete room image');
  }
};

// Set Room Cover Image

exports.setRoomCoverImage = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { imageUrl } = req.body;

    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }
    if (room.hostelId) {
      await assertOwnsHostel(req, room.hostelId);
    }

    if (!room.images.includes(imageUrl)) {
      return res.status(400).json({ success: false, message: 'Image not found in room images' });
    }

    room.coverImage = imageUrl;
    await room.save();

    res.status(200).json({ success: true, data: room });
  } catch (error) {
    return sendErrorResponse(res, error, 'Failed to set room cover image');
  }
};

// ============ AMENITY MANAGEMENT ============

// Create Amenity

exports.setRoomPricing = async (req, res) => {
  try {
    const { roomId, category, pricing } = req.body;
    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }
    await assertOwnsHostel(req, room.hostelId);
    room.category = category;
    room.pricing = pricing;
    await room.save();
    res.status(200).json({ success: true, data: room });
  } catch (error) {
    return sendErrorResponse(res, error, 'Failed to set room pricing');
  }
};


exports.bulkUpdateRoomPricing = async (req, res) => {
  try {
    const { roomIds, category, pricing } = req.body;
    const rooms = await Room.find({ _id: { $in: roomIds } });
    for (const r of rooms) {
      await assertOwnsHostel(req, r.hostelId);
    }
    const updateResult = await Room.updateMany(
      { _id: { $in: roomIds } },
      { category, pricing },
      { new: true }
    );
    res.status(200).json({ success: true, data: updateResult });
  } catch (error) {
    return sendErrorResponse(res, error, 'Failed to bulk update room pricing');
  }
};


exports.autoAllocateRooms = async (req, res) => {
  try {
    const { studentIds, preferences, hostelId } = req.body;
    const scopedHostelIds = await getScopedHostelIds(req, hostelId);
    if (scopedHostelIds.length === 0) {
      return res.status(400).json({ success: false, message: 'No authorized hostels found' });
    }
    const students = await User.find({ _id: { $in: studentIds }, role: 'student', hostelId: { $in: scopedHostelIds } });
    const availableRooms = await Room.find({
      hostelId: { $in: scopedHostelIds },
      status: { $ne: 'maintenance' },
      $expr: { $lt: ['$currentOccupancy', '$capacity'] },
    }).sort({ category: 1, roomNumber: 1 });

    const allocations = [];
    let roomIndex = 0;

    for (const student of students) {
      while (roomIndex < availableRooms.length) {
        const targetRoom = availableRooms[roomIndex];
        // Atomic update with capacity guard to prevent race condition overbooking
        const updatedRoom = await Room.findOneAndUpdate(
          {
            _id: targetRoom._id,
            status: { $ne: 'maintenance' },
            $expr: { $lt: ['$currentOccupancy', '$capacity'] },
          },
          {
            $push: { students: student._id },
            $inc: { currentOccupancy: 1 },
          },
          { new: true }
        );

        if (updatedRoom) {
          if (updatedRoom.currentOccupancy >= updatedRoom.capacity && updatedRoom.status !== 'occupied') {
            await Room.findByIdAndUpdate(updatedRoom._id, { $set: { status: 'occupied' } });
          }
          await User.findByIdAndUpdate(student._id, { $set: { roomId: updatedRoom._id } });
          allocations.push({ studentId: student._id, roomId: updatedRoom._id });

          // If this room has now reached capacity, advance to the next room
          if (updatedRoom.currentOccupancy >= updatedRoom.capacity) {
            roomIndex++;
          }
          break;
        } else {
          // Room was filled by another process, advance to next room
          roomIndex++;
        }
      }
      if (roomIndex >= availableRooms.length) {
        break; // No more available capacity
      }
    }

    res.status(200).json({ success: true, count: allocations.length, data: allocations });
  } catch (error) {
    return sendErrorResponse(res, error, 'Failed to auto-allocate rooms');
  }
};
