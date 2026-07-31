const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Hostel = require('../models/Hostel');
const Block = require('../models/Block');
const Room = require('../models/Room');
const Amenity = require('../models/Amenity');
const Rule = require('../models/Rule');
const Attendance = require('../models/Attendance');
const GateEvent = require('../models/GateEvent');
const Violation = require('../models/Violation');
const Complaint = require('../models/Complaint');
const Notification = require('../models/Notification');
const GeoFence = require('../models/GeoFence');
const FeeStructure = require('../models/FeeStructure');
const Payment = require('../models/Payment');
const Plan = require('../models/Plan');
const { setPeriodFromPlan } = require('../utils/paymentPeriod');
const Template = require('../models/Template');
const AuditLog = require('../models/AuditLog');
const SupportTicket = require('../models/SupportTicket');
const Permission = require('../models/Permission');
const StudentLocation = require('../models/StudentLocation');
const Visitor = require('../models/Visitor');
const { sendPushNotifications, sendExpoPushNotifications, isExpoPushToken, sendLeaveRequestUpdateToStudent } = require('../utils/notificationService');
const { validateLocation } = require('../utils/locationValidation');
const { uploadImageToS3, uploadMultipleImagesToS3, deleteImageFromS3 } = require('../utils/s3Upload');
const { geocodeAddress, getNearbyPlaces } = require('../utils/googleMaps');
const { sendWelcomeEmail, sendStaffWelcomeEmail, sendApprovalEmail, sendNoticeEmail, sendBulkNoticeEmails } = require('../utils/emailService');

// Note: XLSX is optional - install with: npm install xlsx
let XLSX;
try {
  XLSX = require('xlsx');
} catch (e) {
  console.warn('xlsx package not installed. Bulk upload will not work.');
}

// ============ HOSTEL CONFIGURATION ============

// Create Hostel
exports.createHostel = async (req, res) => {
  try {
    const hostelData = { ...req.body };
    const ownerId = req.user._id || req.user.id;
    if (!ownerId) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }
    hostelData.ownerId = ownerId;

    // Normalize nearbyPlaces: must be array of { name, distance?, type? } (handled again before create)

    // Ensure images is an array of strings
    if (hostelData.images != null) {
      const raw = hostelData.images;
      hostelData.images = Array.isArray(raw) ? raw.map((u) => (typeof u === 'string' ? u : String(u))) : typeof raw === 'string' ? [raw] : [];
    }

    // Never pass undefined/invalid address.coordinates - Mongoose cast fails
    if (hostelData.address) {
      const coords = hostelData.address.coordinates;
      if (coords == null || typeof coords.latitude !== 'number' || typeof coords.longitude !== 'number') {
        delete hostelData.address.coordinates;
      }
    }

    // Geocode address if provided
    if (hostelData.address && !hostelData.address.coordinates) {
      try {
        const addressString = [
          hostelData.address.street,
          hostelData.address.city,
          hostelData.address.state,
          hostelData.address.pincode,
          hostelData.address.country || 'India',
        ]
          .filter(Boolean)
          .join(', ');

        if (addressString) {
          const geocodeResult = await geocodeAddress(addressString);
          if (geocodeResult) {
            hostelData.address = {
              ...hostelData.address,
              coordinates: {
                latitude: geocodeResult.latitude,
                longitude: geocodeResult.longitude,
              },
              formattedAddress: geocodeResult.formattedAddress,
              placeId: geocodeResult.placeId,
            };
          }
        }
      } catch (error) {
        console.error('Geocoding error:', error);
        // Continue without geocoding if it fails
      }
    }

    // Do not save nearby places on create – only address, coordinates, name, etc.
    delete hostelData.nearbyPlaces;

    const hostel = await Hostel.create(hostelData);
    res.status(201).json({ success: true, data: hostel });
  } catch (error) {
    console.error('Error in createHostel:', {
      error: error.message,
      stack: error.stack,
    });
    res.status(500).json({ success: false, message: error.message || 'Failed to create hostel' });
  }
};

// Get All Hostels
exports.getHostels = async (req, res) => {
  try {
    const ownerId = req.user._id || req.user.id;
    if (!ownerId) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }
    const hostels = await Hostel.find({ ownerId }).populate('ownerId');
    res.status(200).json({ success: true, count: hostels.length, data: hostels });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get Single Hostel with full details
exports.getHostel = async (req, res) => {
  try {
    const hostel = await Hostel.findById(req.params.id)
      .populate('ownerId', 'name email phone');

    if (!hostel) {
      return res.status(404).json({ success: false, message: 'Hostel not found' });
    }

    // Fetch blocks separately since Hostel doesn't have a blocks field
    const Block = require('../models/Block');
    const blocks = await Block.find({ hostelId: req.params.id })
      .populate({
        path: 'floors.rooms',
        model: 'Room',
      });

    // Get nearby places if coordinates exist
    let nearbyPlaces = [];
    if (hostel.address?.coordinates?.latitude && hostel.address?.coordinates?.longitude) {
      try {
        nearbyPlaces = await getNearbyPlaces(
          hostel.address.coordinates.latitude,
          hostel.address.coordinates.longitude
        );
      } catch (error) {
        console.error('Error fetching nearby places:', error);
      }
    }

    // Combine with existing nearby places
    const allNearbyPlaces = [...(hostel.nearbyPlaces || []), ...nearbyPlaces];

    res.status(200).json({
      success: true,
      data: {
        ...hostel.toObject(),
        blocks: blocks,
        nearbyPlaces: allNearbyPlaces,
      },
    });
  } catch (error) {
    console.error('Error in getHostel:', {
      error: error.message,
      stack: error.stack,
      hostelId: req.params.id,
    });
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch hostel details' });
  }
};

// Update Hostel
exports.updateHostel = async (req, res) => {
  try {
    const hostel = await Hostel.findById(req.params.id);
    if (!hostel) {
      return res.status(404).json({ success: false, message: 'Hostel not found' });
    }

    // Update basic fields
    const fieldsToUpdate = ['name', 'type', 'description', 'shortDescription', 'capacity',
      'totalRooms', 'totalBlocks', 'totalFloors', 'status', 'isVerified'];

    fieldsToUpdate.forEach(field => {
      if (req.body[field] !== undefined) hostel[field] = req.body[field];
    });

    // Update nested objects if provided
    if (req.body.contact) {
      hostel.contact = { ...hostel.contact, ...req.body.contact };
    }
    if (req.body.pricing) {
      hostel.pricing = { ...hostel.pricing, ...req.body.pricing };
    }
    if (req.body.operatingHours) {
      hostel.operatingHours = { ...hostel.operatingHours, ...req.body.operatingHours };
    }
    if (req.body.amenities) {
      hostel.amenities = { ...hostel.amenities, ...req.body.amenities };
    }
    if (req.body.facilities) {
      hostel.facilities = { ...hostel.facilities, ...req.body.facilities };
    }
    if (req.body.rules) {
      hostel.rules = { ...hostel.rules, ...req.body.rules };
    }
    if (req.body.businessInfo) {
      hostel.businessInfo = { ...hostel.businessInfo, ...req.body.businessInfo };
    }
    if (req.body.highlights) hostel.highlights = req.body.highlights;
    if (req.body.tags) hostel.tags = req.body.tags;

    // Handle Address Update
    if (req.body.address) {
      const incoming = { ...req.body.address };
      // Never pass undefined coordinates to Mongoose - it fails cast. Omit or use existing.
      const hasValidCoords = incoming.coordinates != null &&
        typeof incoming.coordinates.latitude === 'number' &&
        typeof incoming.coordinates.longitude === 'number';
      if (!hasValidCoords) {
        delete incoming.coordinates;
      }
      const newAddress = { ...hostel.address, ...incoming };

      // If we have valid coordinates from incoming, they're already in newAddress
      if (newAddress.coordinates === undefined || newAddress.coordinates === null ||
        typeof newAddress.coordinates?.latitude !== 'number' || typeof newAddress.coordinates?.longitude !== 'number') {
        delete newAddress.coordinates;
        if (hostel.address?.coordinates?.latitude != null && hostel.address?.coordinates?.longitude != null) {
          newAddress.coordinates = hostel.address.coordinates;
        }
        // Try geocoding if we still don't have valid coordinates
        if (!newAddress.coordinates) {
          try {
            const addressString = [
              newAddress.street,
              newAddress.city,
              newAddress.state,
              newAddress.pincode,
              newAddress.country || 'India',
            ].filter(Boolean).join(', ');

            if (addressString) {
              const geocodeResult = await geocodeAddress(addressString);
              newAddress.coordinates = {
                latitude: geocodeResult.latitude,
                longitude: geocodeResult.longitude,
              };
              newAddress.formattedAddress = geocodeResult.formattedAddress;
              newAddress.placeId = geocodeResult.placeId;
            }
          } catch (error) {
            console.error('Geocoding error during update:', error);
          }
        }
      }
      hostel.address = newAddress;
    }

    await hostel.save();
    res.status(200).json({ success: true, data: hostel });
  } catch (error) {
    console.error('Update Hostel Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Upload Hostel Images
exports.uploadHostelImages = async (req, res) => {
  try {
    const { hostelId } = req.params;
    const files = req.files;

    if (!files || files.length === 0) {
      return res.status(400).json({ success: false, message: 'No images provided' });
    }

    const hostel = await Hostel.findById(hostelId);
    if (!hostel) {
      return res.status(404).json({ success: false, message: 'Hostel not found' });
    }

    // Upload images to S3
    const imageUrls = await uploadMultipleImagesToS3(files, 'hostels');

    // Add to hostel images array
    hostel.images = [...(hostel.images || []), ...imageUrls];

    // Set first image as cover if no cover image exists
    if (!hostel.coverImage && imageUrls.length > 0) {
      hostel.coverImage = imageUrls[0];
    }

    await hostel.save();

    res.status(200).json({
      success: true,
      data: {
        images: hostel.images,
        coverImage: hostel.coverImage,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete Hostel Image
exports.deleteHostelImage = async (req, res) => {
  try {
    const { hostelId, imageUrl } = req.params;
    const decodedImageUrl = decodeURIComponent(imageUrl);

    const hostel = await Hostel.findById(hostelId);
    if (!hostel) {
      return res.status(404).json({ success: false, message: 'Hostel not found' });
    }

    // Remove from array
    hostel.images = hostel.images.filter((img) => img !== decodedImageUrl);

    // If deleted image was cover, set new cover
    if (hostel.coverImage === decodedImageUrl) {
      hostel.coverImage = hostel.images.length > 0 ? hostel.images[0] : null;
    }

    // Delete from S3
    await deleteImageFromS3(decodedImageUrl);

    await hostel.save();

    res.status(200).json({
      success: true,
      message: 'Image deleted successfully',
      data: {
        images: hostel.images,
        coverImage: hostel.coverImage,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Set Cover Image
exports.setCoverImage = async (req, res) => {
  try {
    const { hostelId } = req.params;
    const { imageUrl } = req.body;

    const hostel = await Hostel.findById(hostelId);
    if (!hostel) {
      return res.status(404).json({ success: false, message: 'Hostel not found' });
    }

    if (!hostel.images.includes(imageUrl)) {
      return res.status(400).json({ success: false, message: 'Image not found in hostel images' });
    }

    hostel.coverImage = imageUrl;
    await hostel.save();

    res.status(200).json({ success: true, data: hostel });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete Hostel
exports.deleteHostel = async (req, res) => {
  try {
    const hostel = await Hostel.findByIdAndDelete(req.params.id);
    if (!hostel) {
      return res.status(404).json({ success: false, message: 'Hostel not found' });
    }
    res.status(200).json({ success: true, message: 'Hostel deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Create Block
exports.createBlock = async (req, res) => {
  try {
    const block = await Block.create(req.body);
    res.status(201).json({ success: true, data: block });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get Blocks
exports.getBlocks = async (req, res) => {
  try {
    const blocks = await Block.find({ hostelId: req.params.hostelId })
      .populate('hostelId')
      .populate('floors.rooms');
    res.status(200).json({ success: true, data: blocks });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Create Room
exports.createRoom = async (req, res) => {
  try {
    const Hostel = require('../models/Hostel');
    const { hostelId, ...rest } = req.body;
    // Validate hostel belongs to owner when hostelId is provided
    if (hostelId) {
      const hostel = await Hostel.findById(hostelId);
      if (!hostel) {
        return res.status(400).json({ success: false, message: 'Hostel not found' });
      }
      const ownerId = req.user._id || req.user.id;
      if (!ownerId || String(hostel.ownerId) !== String(ownerId)) {
        return res.status(403).json({ success: false, message: 'Not authorized to add rooms to this hostel' });
      }
    }
    const room = await Room.create({ ...rest, hostelId: hostelId || undefined });
    const populated = await Room.findById(room._id).populate('hostelId', 'name').populate('blockId', 'name');
    res.status(201).json({ success: true, data: populated || room });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get Rooms
exports.getRooms = async (req, res) => {
  try {
    const User = require('../models/User');
    const { hostelId, blockId, status, category } = req.query;
    const filter = {};
    if (hostelId) filter.hostelId = hostelId;
    if (req.params.blockId) {
      filter.blockId = req.params.blockId;
    } else if (blockId) {
      filter.blockId = blockId;
    }

    if (status) filter.status = status;
    if (category) filter.category = category;

    const rooms = await Room.find(filter)
      .populate('hostelId', 'name')
      .populate('blockId', 'name')
      .populate('students', 'name email phone profileImage studentId');

    // For rooms with empty students array, fetch students by roomId from User model
    for (let room of rooms) {
      if (!room.students || room.students.length === 0) {
        const students = await User.find({ roomId: room._id, role: 'student' })
          .select('name email phone profileImage studentId');
        room.students = students;
      }
    }

    res.status(200).json({ success: true, count: rooms.length, data: rooms });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get Single Room
exports.getRoom = async (req, res) => {
  try {
    const User = require('../models/User');
    const room = await Room.findById(req.params.id)
      .populate('hostelId', 'name address')
      .populate('blockId', 'name')
      .populate('students', 'name email phone profileImage studentId');

    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }

    // If students array is empty, fetch students by roomId from User model
    if (!room.students || room.students.length === 0) {
      const students = await User.find({ roomId: req.params.id, role: 'student' })
        .select('name email phone profileImage studentId');
      room.students = students;
    }

    res.status(200).json({ success: true, data: room });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update Room
exports.updateRoom = async (req, res) => {
  try {
    const Hostel = require('../models/Hostel');
    const { hostelId, ...rest } = req.body;
    if (hostelId != null) {
      const hostel = await Hostel.findById(hostelId);
      if (!hostel) {
        return res.status(400).json({ success: false, message: 'Hostel not found' });
      }
      const ownerId = req.user._id || req.user.id;
      if (!ownerId || String(hostel.ownerId) !== String(ownerId)) {
        return res.status(403).json({ success: false, message: 'Not authorized to assign room to this hostel' });
      }
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
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }
    res.status(200).json({ success: true, data: room });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete Room
exports.deleteRoom = async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found' });
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
    res.status(500).json({ success: false, message: error.message });
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
    res.status(500).json({ success: false, message: error.message });
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
    res.status(500).json({ success: false, message: error.message });
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

    if (!room.images.includes(imageUrl)) {
      return res.status(400).json({ success: false, message: 'Image not found in room images' });
    }

    room.coverImage = imageUrl;
    await room.save();

    res.status(200).json({ success: true, data: room });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============ AMENITY MANAGEMENT ============

// Create Amenity
exports.createAmenity = async (req, res) => {
  try {
    const amenity = await Amenity.create(req.body);
    res.status(201).json({ success: true, data: amenity });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get Amenities
exports.getAmenities = async (req, res) => {
  try {
    const { hostelId, category, isAvailable } = req.query;
    const filter = {};

    if (hostelId) filter.hostelId = hostelId;
    if (category) filter.category = category;
    if (isAvailable !== undefined) filter.isAvailable = isAvailable === 'true';

    const amenities = await Amenity.find(filter).populate('hostelId', 'name');
    res.status(200).json({ success: true, count: amenities.length, data: amenities });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get Single Amenity
exports.getAmenity = async (req, res) => {
  try {
    const amenity = await Amenity.findById(req.params.id).populate('hostelId', 'name');
    if (!amenity) {
      return res.status(404).json({ success: false, message: 'Amenity not found' });
    }
    res.status(200).json({ success: true, data: amenity });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update Amenity
exports.updateAmenity = async (req, res) => {
  try {
    const amenity = await Amenity.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    }).populate('hostelId', 'name');
    if (!amenity) {
      return res.status(404).json({ success: false, message: 'Amenity not found' });
    }
    res.status(200).json({ success: true, data: amenity });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete Amenity
exports.deleteAmenity = async (req, res) => {
  try {
    const amenity = await Amenity.findById(req.params.id);
    if (!amenity) {
      return res.status(404).json({ success: false, message: 'Amenity not found' });
    }

    // Delete images from S3
    if (amenity.images && amenity.images.length > 0) {
      for (const imageUrl of amenity.images) {
        try {
          await deleteImageFromS3(imageUrl);
        } catch (error) {
          console.error('Error deleting amenity image:', error);
        }
      }
    }

    await Amenity.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: 'Amenity deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Upload Amenity Images
exports.uploadAmenityImages = async (req, res) => {
  try {
    const { amenityId } = req.params;
    const files = req.files;

    if (!files || files.length === 0) {
      return res.status(400).json({ success: false, message: 'No images provided' });
    }

    const amenity = await Amenity.findById(amenityId);
    if (!amenity) {
      return res.status(404).json({ success: false, message: 'Amenity not found' });
    }

    const imageUrls = await uploadMultipleImagesToS3(files, 'amenities');
    amenity.images = [...(amenity.images || []), ...imageUrls];
    await amenity.save();

    res.status(200).json({
      success: true,
      data: {
        images: amenity.images,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete Amenity Image
exports.deleteAmenityImage = async (req, res) => {
  try {
    const { amenityId, imageUrl } = req.params;
    const decodedImageUrl = decodeURIComponent(imageUrl);

    const amenity = await Amenity.findById(amenityId);
    if (!amenity) {
      return res.status(404).json({ success: false, message: 'Amenity not found' });
    }

    amenity.images = amenity.images.filter(img => img !== decodedImageUrl);
    await deleteImageFromS3(decodedImageUrl);
    await amenity.save();

    res.status(200).json({
      success: true,
      message: 'Image deleted successfully',
      data: {
        images: amenity.images,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============ RULE ENGINE ============

// Create Rule (Updates Hostel Rules)
exports.createRule = async (req, res) => {
  try {
    const { hostelId, ...ruleData } = req.body;

    if (!hostelId) {
      return res.status(400).json({ success: false, message: 'Hostel ID is required' });
    }

    const hostel = await Hostel.findById(hostelId);
    if (!hostel) {
      return res.status(404).json({ success: false, message: 'Hostel not found' });
    }

    // Update hostel rules
    hostel.rules = { ...hostel.rules, ...ruleData };
    await hostel.save();

    // Return with structure expected by frontend
    const ruleResponse = {
      _id: hostel._id, // Use hostel ID as rule ID for mapping
      hostelId: hostel,
      ...hostel.rules.toObject(),
      status: 'active' // Dummy status since embedded doesn't have it
    };

    res.status(201).json({ success: true, data: ruleResponse });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get Rules (Fetches from Hostels)
exports.getRules = async (req, res) => {
  try {
    const filter = {};
    const hostelId = req.params.hostelId || req.query.hostelId;
    if (hostelId) {
      filter._id = hostelId;
    }

    const hostels = await Hostel.find(filter).select('name type address rules');

    // Map hostels to rule objects
    const rules = hostels
      .filter(h => h.rules && Object.keys(h.rules.toObject()).length > 0) // Only return if rules exist
      .map(h => ({
        _id: h._id,
        hostelId: h, // Populate hostel details
        ...h.rules.toObject(),
        status: 'active'
      }));

    res.status(200).json({ success: true, count: rules.length, data: rules });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update Rule (Updates Hostel Rules)
exports.updateRule = async (req, res) => {
  try {
    // req.params.id is treated as hostelId here since we map 1:1
    const hostelId = req.params.id;
    const ruleData = req.body;

    const hostel = await Hostel.findById(hostelId);
    if (!hostel) {
      return res.status(404).json({ success: false, message: 'Hostel not found' });
    }

    // Update fields
    if (ruleData.hostelId) delete ruleData.hostelId; // Don't update reference

    hostel.rules = { ...hostel.rules.toObject(), ...ruleData };
    await hostel.save();

    const ruleResponse = {
      _id: hostel._id,
      hostelId: hostel,
      ...hostel.rules.toObject(),
      status: 'active'
    };

    res.status(200).json({ success: true, data: ruleResponse });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete Rule (Resets Hostel Rules)
exports.deleteRule = async (req, res) => {
  try {
    const hostelId = req.params.id;
    const hostel = await Hostel.findById(hostelId);

    if (!hostel) {
      return res.status(404).json({ success: false, message: 'Hostel/Rules not found' });
    }

    // Reset rules to defaults/empty
    hostel.rules = {
      lateEntryAllowed: false,
      lateEntryFine: 0,
      visitorAllowed: true,
      smokingAllowed: false,
      alcoholAllowed: false,
      petsAllowed: false,
      oppositeGenderAllowed: false,
      customRules: []
    };

    await hostel.save();

    res.status(200).json({ success: true, message: 'Rules reset successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============ USER MANAGEMENT ============

// Create User (Warden, Cleaner, Supervisor)
exports.createUser = async (req, res) => {
  try {
    const userData = { ...req.body };

    // Normalize role: support multiple roles for staff
    if (Array.isArray(userData.roles) && userData.roles.length > 0) {
      const staffRoles = userData.roles.filter((r) => ['warden', 'cleaner', 'supervisor', 'security'].includes(r));
      if (staffRoles.length > 0) {
        userData.role = staffRoles;
        userData.currentRole = userData.currentRole || staffRoles[0];
      }
    }
    if (Array.isArray(userData.role) && userData.role.length > 0 && !userData.currentRole) {
      userData.currentRole = userData.role[0];
    }

    // Convert empty strings to undefined for optional ObjectId fields
    if (userData.blockId === '' || userData.blockId === null) {
      userData.blockId = undefined;
    }
    if (userData.roomId === '' || userData.roomId === null) {
      userData.roomId = undefined;
    }
    if (userData.hostelId === '' || userData.hostelId === null) {
      userData.hostelId = undefined;
    }
    if (userData.planId === '' || userData.planId === null) {
      userData.planId = undefined;
    }

    // Convert empty strings to undefined for nested objects
    if (userData.address && Object.values(userData.address).every(v => v === '' || v === null || v === undefined)) {
      userData.address = undefined;
    }
    if (userData.parentContact && Object.values(userData.parentContact).every(v => v === '' || v === null || v === undefined)) {
      userData.parentContact = undefined;
    }
    if (userData.emergencyContact && Object.values(userData.emergencyContact).every(v => v === '' || v === null || v === undefined)) {
      userData.emergencyContact = undefined;
    }
    if (userData.dateOfBirth === '' || userData.dateOfBirth === null) {
      userData.dateOfBirth = undefined;
    }

    // Handle role - convert to array if single role provided
    if (userData.role && !Array.isArray(userData.role)) {
      userData.role = [userData.role];
    }

    // Set currentRole to first role if multiple roles
    if (userData.role && userData.role.length > 0) {
      userData.currentRole = userData.role[0];
    }

    // Save original password before it gets hashed (for email)
    const originalPassword = userData.password;

    // Generate temporary password if not provided
    let tempPassword = null;
    if (!userData.password) {
      tempPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8).toUpperCase() + '123';
      userData.password = tempPassword;
    }

    const user = await User.create(userData);

    // Send welcome email
    if (user.email) {
      const hostel = await Hostel.findById(user.hostelId);
      const hostelName = hostel?.name || 'Hostel';

      // Use the original password (before hashing) or tempPassword for email
      const passwordForEmail = tempPassword || originalPassword || 'Please contact admin for password';

      // Check if user is a student
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
        );
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
        );
      }
    }

    // Don't send password in response
    const userResponse = user.toObject();
    delete userResponse.password;

    res.status(201).json({ success: true, data: userResponse });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get All Users
exports.getUsers = async (req, res) => {
  try {
    const { role, hostelId, status } = req.query;
    const filter = {};
    if (role) {
      const rolesArray = Array.isArray(role) ? role : [role];
      filter.$or = [{ role: { $in: rolesArray } }, { role: rolesArray[0] }, { roles: { $in: rolesArray } }];
    }
    if (hostelId) filter.hostelId = hostelId;
    if (status) filter.status = status;

    const users = await User.find(filter)
      .populate('hostelId')
      .populate('blockId')
      .populate('roomId')
      .populate('planId')
      .select('-password');
    res.status(200).json({ success: true, count: users.length, data: users });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
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
    res.status(200).json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update User
exports.updateUser = async (req, res) => {
  try {
    const updateData = { ...req.body };
    const userId = req.params.id;

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

    const allowedFields = ['name', 'email', 'phone', 'role', 'roles', 'currentRole', 'hostelId', 'blockId', 'roomId', 'planId', 'status', 'parentContact', 'emergencyContact', 'address', 'dateOfBirth'];
    const set = {};

    allowedFields.forEach((field) => {
      if (updateData[field] !== undefined) {
        set[field] = updateData[field];
      }
    });

    if (updateData.role !== undefined) {
      const rolesArray = Array.isArray(updateData.role) ? updateData.role : [updateData.role];
      set.role = rolesArray;
      if (!set.currentRole || !rolesArray.includes(set.currentRole)) {
        set.currentRole = rolesArray[0];
      }
    }

    if (updateData.password && typeof updateData.password === 'string' && updateData.password.length > 0) {
      const salt = await bcrypt.genSalt(10);
      set.password = await bcrypt.hash(updateData.password, salt);
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: set },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const userObj = user.toObject ? user.toObject() : user;
    res.status(200).json({ success: true, data: userObj });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete User
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.status(200).json({ success: true, message: 'User deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============ STUDENT LIFECYCLE ============

// Get Students by Status
exports.getStudentsByStatus = async (req, res) => {
  try {
    const { status } = req.params;
    const students = await User.find({
      role: { $in: ['student'] }, // Support both array and single role
      status
    })
      .populate('hostelId')
      .populate('blockId')
      .populate('roomId')
      .populate('planId')
      .select('-password');
    res.status(200).json({ success: true, count: students.length, data: students });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============ ANALYTICS & REPORTS ============

// Attendance Trends
exports.getAttendanceTrends = async (req, res) => {
  try {
    const { hostelId, startDate, endDate } = req.query;
    const filter = {};
    if (hostelId) filter.hostelId = hostelId;
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }

    const attendance = await Attendance.find(filter).populate('studentId');
    const trends = {
      total: attendance.length,
      inside: attendance.filter(a => a.status === 'inside').length,
      outside: attendance.filter(a => a.status === 'outside').length,
      pending: attendance.filter(a => a.status === 'pending').length,
    };
    res.status(200).json({ success: true, data: trends });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Recent violations for owner dashboard (with date/time, description, student name). Supports from/to date range.
exports.getRecentViolations = async (req, res) => {
  try {
    const { hostelId, from, to } = req.query;
    const targetHostelId = hostelId || req.user?.hostelId;
    let studentIds = [];
    if (targetHostelId) {
      const students = await User.find({ hostelId: targetHostelId, role: 'student' }).select('_id');
      studentIds = students.map((s) => s._id);
    } else if (req.user?.id) {
      const hostels = await Hostel.find({ ownerId: req.user.id }).select('_id');
      const hostelIds = hostels.map((h) => h._id);
      const students = await User.find({ hostelId: { $in: hostelIds }, role: 'student' }).select('_id');
      studentIds = students.map((s) => s._id);
    }
    const filter = studentIds.length ? { studentId: { $in: studentIds } } : {};
    if (from || to) {
      filter.createdAt = {};
      if (from) {
        const fromDate = new Date(from);
        fromDate.setHours(0, 0, 0, 0);
        filter.createdAt.$gte = fromDate;
      }
      if (to) {
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = toDate;
      }
    }
    const limit = Math.min(parseInt(req.query.limit, 10) || 200, 500);
    const violations = await Violation.find(filter)
      .populate('studentId', 'name email studentId')
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    res.status(200).json({ success: true, data: violations });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Violation Heatmap
exports.getViolationHeatmap = async (req, res) => {
  try {
    const { hostelId, startDate, endDate } = req.query;
    const filter = {};
    if (hostelId) {
      const students = await User.find({ hostelId, role: 'student' }).select('_id');
      filter.studentId = { $in: students.map(s => s._id) };
    }
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const violations = await Violation.find(filter)
      .populate('studentId', 'name roomId')
      .populate('ruleId');

    const heatmap = violations.reduce((acc, v) => {
      const key = v.violationType;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    res.status(200).json({ success: true, data: heatmap });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Monthly Discipline Report
exports.getMonthlyDisciplineReport = async (req, res) => {
  try {
    const { hostelId, month, year } = req.query;
    const startDate = new Date(year || new Date().getFullYear(), (month || new Date().getMonth()) - 1, 1);
    const endDate = new Date(year || new Date().getFullYear(), month || new Date().getMonth(), 0);

    const filter = { createdAt: { $gte: startDate, $lte: endDate } };
    if (hostelId) {
      const students = await User.find({ hostelId, role: 'student' }).select('_id');
      filter.studentId = { $in: students.map(s => s._id) };
    }

    const violations = await Violation.find(filter).populate('studentId', 'name');
    const complaints = await Complaint.find(filter).populate('raisedBy', 'name');

    res.status(200).json({
      success: true,
      data: {
        violations: violations.length,
        complaints: complaints.length,
        violationsList: violations,
        complaintsList: complaints,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============ NOTIFICATION BROADCAST ============

// Send Notification
// Send Notification/Notice with Email
exports.sendNotification = async (req, res) => {
  try {
    const { title, message, type, targetAudience, recipients, priority, expiresAt, sendEmail } = req.body;
    const hostelId = req.body.hostelId;

    // Get hostel info
    const hostel = await Hostel.findById(hostelId);
    if (!hostel) {
      return res.status(404).json({ success: false, message: 'Hostel not found' });
    }

    // Map UI targetAudience to DB role (e.g. "students" -> "student")
    const audienceToRole = {
      students: 'student',
      student: 'student',
      wardens: 'warden',
      warden: 'warden',
      staff: { $in: ['cleaner', 'supervisor', 'security'] },
      cleaners: 'cleaner',
    };
    const roleFilter = targetAudience ? (audienceToRole[targetAudience] || targetAudience) : null;

    // Get recipients
    let notificationRecipients = [];
    let emailRecipients = [];

    if (targetAudience === 'all') {
      const users = await User.find({ hostelId }).select('_id name email');
      notificationRecipients = users.map(u => u._id);
      emailRecipients = users.filter(u => u.email).map(u => ({ email: u.email, name: u.name }));
    } else if (roleFilter) {
      const roleQuery = typeof roleFilter === 'object' ? { role: roleFilter } : { role: roleFilter };
      const users = await User.find({ hostelId, ...roleQuery }).select('_id name email');
      notificationRecipients = users.map(u => u._id);
      emailRecipients = users.filter(u => u.email).map(u => ({ email: u.email, name: u.name }));
    } else if (recipients && recipients.length > 0) {
      notificationRecipients = recipients;
      const users = await User.find({ _id: { $in: recipients } }).select('_id name email');
      emailRecipients = users.filter(u => u.email).map(u => ({ email: u.email, name: u.name }));
    }

    // Create notification
    const notification = await Notification.create({
      title,
      message,
      type: type || 'announcement',
      targetAudience: targetAudience || 'all',
      recipients: notificationRecipients,
      createdBy: req.user.id,
      priority: priority || 'medium',
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      hostelId,
    });

    // Send emails if requested
    let emailResults = [];
    if (sendEmail && emailRecipients.length > 0) {
      try {
        emailResults = await sendBulkNoticeEmails(
          emailRecipients,
          title,
          message,
          type || 'announcement',
          hostel.name,
          priority || 'medium'
        );
      } catch (emailError) {
        console.error('Error sending notice emails:', emailError);
        // Don't fail the request if email fails
      }
    }

    // Send mobile push notifications to target audience (recipients with push tokens)
    let pushSent = 0;
    console.log('[Notice] Created notification', notification._id, 'targetAudience:', targetAudience, 'recipientCount:', notificationRecipients.length);
    if (notificationRecipients.length > 0) {
      try {
        const usersWithTokens = await User.find({
          _id: { $in: notificationRecipients },
          $or: [
            { pushToken: { $exists: true, $ne: null, $ne: '' } },
            { expoPushToken: { $exists: true, $ne: null, $ne: '' } },
          ],
        }).select('_id pushToken expoPushToken').lean();

        console.log('[Notice] Push: recipients with tokens:', usersWithTokens.length, 'of', notificationRecipients.length);

        const expoNotifications = [];
        const fcmNotifications = [];
        const body = (message || '').length > 120 ? (message || '').slice(0, 117) + '...' : (message || '');
        const payload = {
          title: title || 'Notice',
          body,
          data: { type: 'announcement', notificationId: notification._id.toString(), screen: 'notifications' },
        };

        usersWithTokens.forEach((u) => {
          const hasFcm = u.pushToken && !isExpoPushToken(u.pushToken);
          const hasExpo = u.expoPushToken && isExpoPushToken(u.expoPushToken);
          if (hasFcm) {
            fcmNotifications.push({ ...payload, to: u.pushToken });
          } else if (hasExpo) {
            expoNotifications.push({ ...payload, to: u.expoPushToken });
          }
        });

        if (expoNotifications.length > 0) {
          console.log('[Notice] Sending Expo push to', expoNotifications.length, 'device(s)');
          await sendExpoPushNotifications(expoNotifications);
          pushSent += expoNotifications.length;
          console.log('[Notice] Expo push sent:', expoNotifications.length);
        }
        if (fcmNotifications.length > 0) {
          console.log('[Notice] Sending FCM push to', fcmNotifications.length, 'device(s)');
          const fcmResults = await sendPushNotifications(fcmNotifications);
          pushSent += fcmNotifications.length;
          console.log('[Notice] FCM push sent:', fcmNotifications.length, 'results:', fcmResults?.length);
          const invalidTokens = Array.isArray(fcmResults) && fcmResults.invalidTokens?.length ? fcmResults.invalidTokens : [];
          if (invalidTokens.length > 0) {
            await User.updateMany(
              { pushToken: { $in: invalidTokens } },
              { $unset: { pushToken: 1 } }
            );
            console.log('[Notice] Removed', invalidTokens.length, 'invalid FCM token(s) from User records');
          }
        }
        if (pushSent === 0 && usersWithTokens.length > 0) {
          console.warn('[Notice] No push sent: tokens may be invalid (Expo/FCM format check failed for', usersWithTokens.length, 'users)');
        }
      } catch (pushError) {
        console.error('[Notice] Error sending push notifications:', pushError.message || pushError);
        // Don't fail the request if push fails
      }
    } else {
      console.log('[Notice] No recipients for targetAudience:', targetAudience, '(check audienceToRole mapping or hostel has no users for this role)');
    }

    res.status(201).json({
      success: true,
      data: notification,
      emailSent: sendEmail,
      emailsSent: emailResults.filter(r => r.success).length,
      emailsFailed: emailResults.filter(r => !r.success).length,
      pushSent,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get Notifications
exports.getNotifications = async (req, res) => {
  try {
    const { hostelId } = req.params;
    const { type, priority, targetAudience, page = 1, limit = 50 } = req.query;

    const query = { hostelId };
    if (type) query.type = type;
    if (priority) query.priority = priority;
    if (targetAudience) query.targetAudience = targetAudience;

    // Check for expired notices
    query.$or = [
      { expiresAt: { $exists: false } },
      { expiresAt: null },
      { expiresAt: { $gt: new Date() } },
    ];

    const notifications = await Notification.find(query)
      .populate('createdBy', 'name email')
      .populate('recipients', 'name email')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Notification.countDocuments(query);

    res.status(200).json({
      success: true,
      data: notifications,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get Single Notification
exports.getNotification = async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate('recipients', 'name email')
      .populate('hostelId', 'name');

    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    res.status(200).json({ success: true, data: notification });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Resend push notification (reminder) for an existing notice — same audience and payload as create
exports.sendNotificationReminder = async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id).lean();
    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }
    if (notification.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to send reminder for this notification' });
    }

    const hostelId = notification.hostelId?.toString ? notification.hostelId.toString() : notification.hostelId;
    const targetAudience = notification.targetAudience || 'all';
    const title = notification.title || 'Notice';
    const message = notification.message || '';

    const audienceToRole = {
      students: 'student',
      student: 'student',
      wardens: 'warden',
      warden: 'warden',
      staff: { $in: ['cleaner', 'supervisor', 'security'] },
      cleaners: 'cleaner',
    };
    const roleFilter = targetAudience ? (audienceToRole[targetAudience] || targetAudience) : null;

    let notificationRecipients = [];
    if (targetAudience === 'all') {
      const users = await User.find({ hostelId }).select('_id').lean();
      notificationRecipients = users.map(u => u._id);
    } else if (roleFilter) {
      const roleQuery = typeof roleFilter === 'object' ? { role: roleFilter } : { role: roleFilter };
      const users = await User.find({ hostelId, ...roleQuery }).select('_id').lean();
      notificationRecipients = users.map(u => u._id);
    } else if (notification.recipients && notification.recipients.length > 0) {
      notificationRecipients = notification.recipients.map(r => (r && r._id ? r._id : r));
    }

    let pushSent = 0;
    if (notificationRecipients.length === 0) {
      return res.status(200).json({ success: true, pushSent: 0, message: 'No recipients for this notice' });
    }

    const {
      sendPushNotifications,
      sendExpoPushNotifications,
      isExpoPushToken,
    } = require('../utils/notificationService');

    const usersWithTokens = await User.find({
      _id: { $in: notificationRecipients },
      $or: [
        { pushToken: { $exists: true, $ne: null, $ne: '' } },
        { expoPushToken: { $exists: true, $ne: null, $ne: '' } },
      ],
    }).select('pushToken expoPushToken').lean();

    const body = (message || '').length > 120 ? (message || '').slice(0, 117) + '...' : (message || '');
    const payload = {
      title,
      body,
      data: { type: 'announcement', notificationId: notification._id.toString(), screen: 'notifications' },
    };

    const expoNotifications = [];
    const fcmNotifications = [];
    usersWithTokens.forEach((u) => {
      const hasFcm = u.pushToken && !isExpoPushToken(u.pushToken);
      const hasExpo = u.expoPushToken && isExpoPushToken(u.expoPushToken);
      if (hasFcm) fcmNotifications.push({ ...payload, to: u.pushToken });
      else if (hasExpo) expoNotifications.push({ ...payload, to: u.expoPushToken });
    });

    if (expoNotifications.length > 0) {
      await sendExpoPushNotifications(expoNotifications);
      pushSent += expoNotifications.length;
    }
    if (fcmNotifications.length > 0) {
      const fcmResults = await sendPushNotifications(fcmNotifications);
      pushSent += fcmNotifications.length;
      const invalidTokens = Array.isArray(fcmResults) && fcmResults.invalidTokens?.length ? fcmResults.invalidTokens : [];
      if (invalidTokens.length > 0) {
        await User.updateMany(
          { pushToken: { $in: invalidTokens } },
          { $unset: { pushToken: 1 } }
        );
        console.log('[Notice Reminder] Removed', invalidTokens.length, 'invalid FCM token(s)');
      }
    }

    console.log('[Notice Reminder] Sent to', pushSent, 'device(s) for notification', req.params.id);
    res.status(200).json({ success: true, pushSent });
  } catch (error) {
    console.error('[Notice Reminder] Error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update Notification
exports.updateNotification = async (req, res) => {
  try {
    const { title, message, type, priority, expiresAt } = req.body;

    const notification = await Notification.findById(req.params.id);
    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    // Check if user created this notification
    if (notification.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to update this notification' });
    }

    if (title) notification.title = title;
    if (message) notification.message = message;
    if (type) notification.type = type;
    if (priority) notification.priority = priority;
    if (expiresAt !== undefined) notification.expiresAt = expiresAt ? new Date(expiresAt) : null;

    await notification.save();

    res.status(200).json({ success: true, data: notification });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete Notification
exports.deleteNotification = async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    // Check if user created this notification
    if (notification.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this notification' });
    }

    await notification.deleteOne();

    res.status(200).json({ success: true, message: 'Notification deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


exports.updateHostelAmenities = async (req, res) => {
  try {
    const hostel = await Hostel.findByIdAndUpdate(
      req.params.id,
      { amenities: req.body.amenities },
      { new: true, runValidators: true }
    );
    if (!hostel) {
      return res.status(404).json({ success: false, message: 'Hostel not found' });
    }
    res.status(200).json({ success: true, data: hostel });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


exports.setRoomPricing = async (req, res) => {
  try {
    const { roomId, category, pricing } = req.body;
    const room = await Room.findByIdAndUpdate(
      roomId,
      { category, pricing },
      { new: true, runValidators: true }
    );
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }
    res.status(200).json({ success: true, data: room });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.bulkUpdateRoomPricing = async (req, res) => {
  try {
    const { roomIds, category, pricing } = req.body;
    const rooms = await Room.updateMany(
      { _id: { $in: roomIds } },
      { category, pricing },
      { new: true }
    );
    res.status(200).json({ success: true, data: rooms });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.autoAllocateRooms = async (req, res) => {
  try {
    const { studentIds, preferences } = req.body;
    const students = await User.find({ _id: { $in: studentIds }, role: 'student' });
    const availableRooms = await Room.find({
      status: 'available',
      currentOccupancy: { $lt: { $expr: '$capacity' } },
    }).sort({ category: 1, roomNumber: 1 });

    const allocations = [];
    let roomIndex = 0;

    for (const student of students) {
      if (roomIndex >= availableRooms.length) break;

      const room = availableRooms[roomIndex];
      if (room.currentOccupancy < room.capacity) {
        room.students.push(student._id);
        room.currentOccupancy += 1;
        if (room.currentOccupancy >= room.capacity) {
          room.status = 'occupied';
        }
        await room.save();

        student.roomId = room._id;
        await student.save();

        allocations.push({ studentId: student._id, roomId: room._id });
      }
      roomIndex++;
    }

    res.status(200).json({ success: true, data: allocations });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


exports.createCurfewRule = async (req, res) => {
  try {
    const { hostelId, weekday, weekend, specialDays } = req.body;
    const rule = await Rule.create({
      hostelId,
      ruleType: 'curfew',
      title: 'Curfew Policy',
      curfewConfig: { weekday, weekend, specialDays: specialDays || [] },
    });
    res.status(201).json({ success: true, data: rule });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createLateEntryRule = async (req, res) => {
  try {
    const { hostelId, allowedTimes, fineAmount, maxViolations, escalationAfter } = req.body;
    const rule = await Rule.create({
      hostelId,
      ruleType: 'late-entry',
      title: 'Late Entry Policy',
      lateEntryConfig: { allowedTimes, fineAmount, maxViolations, escalationAfter },
    });
    res.status(201).json({ success: true, data: rule });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createLeavePolicy = async (req, res) => {
  try {
    const { hostelId, maxLeaveDays, maxConsecutiveDays, requireParentApproval, autoExpiry, expiryDays } = req.body;
    const rule = await Rule.create({
      hostelId,
      ruleType: 'leave',
      title: 'Leave Policy',
      leaveConfig: { maxLeaveDays, maxConsecutiveDays, requireParentApproval, autoExpiry, expiryDays },
    });
    res.status(201).json({ success: true, data: rule });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createDisciplineMatrix = async (req, res) => {
  try {
    const { hostelId, violationType, actions } = req.body;
    const rule = await Rule.create({
      hostelId,
      ruleType: 'discipline',
      title: `Discipline Matrix - ${violationType}`,
      disciplineMatrix: { violationType, actions },
    });
    res.status(201).json({ success: true, data: rule });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


exports.createGeoFence = async (req, res) => {
  try {
    const { hostelId, name, type, polygon, bounds, center, radius, isActive } = req.body;
    if (!hostelId || !name || !type) {
      return res.status(400).json({ success: false, message: 'hostelId, name and type are required' });
    }

    // Build payload for the single active boundary; clear other-type fields so only one shape is stored
    const setPayload = {
      hostelId,
      name,
      type,
      isActive: isActive !== false,
    };
    const unsetPayload = {};
    if (type === 'polygon' && Array.isArray(polygon) && polygon.length >= 3) {
      const normalized = polygon.map((p) => ({
        latitude: Number(p.latitude),
        longitude: Number(p.longitude),
      }));
      setPayload.polygon = normalized;
      unsetPayload.bounds = '';
      unsetPayload.center = '';
      unsetPayload.radius = '';

      // Sync hostel location to center of boundary (centroid of polygon)
      const sumLat = normalized.reduce((s, p) => s + p.latitude, 0);
      const sumLng = normalized.reduce((s, p) => s + p.longitude, 0);
      const centroidLat = sumLat / normalized.length;
      const centroidLng = sumLng / normalized.length;
      await Hostel.findByIdAndUpdate(hostelId, {
        $set: {
          'address.coordinates': {
            latitude: centroidLat,
            longitude: centroidLng,
          },
        },
      });
    } else if (type === 'rectangle' && bounds && typeof bounds.north === 'number' && typeof bounds.south === 'number' && typeof bounds.east === 'number' && typeof bounds.west === 'number') {
      setPayload.bounds = {
        north: bounds.north,
        south: bounds.south,
        east: bounds.east,
        west: bounds.west,
      };
      unsetPayload.polygon = '';
      unsetPayload.center = '';
      unsetPayload.radius = '';
    } else if (type === 'circle' && center && typeof center.latitude === 'number' && typeof center.longitude === 'number' && typeof radius === 'number') {
      setPayload.center = { latitude: center.latitude, longitude: center.longitude };
      setPayload.radius = radius;
      unsetPayload.polygon = '';
      unsetPayload.bounds = '';
    } else {
      return res.status(400).json({ success: false, message: 'Invalid boundary data for type: ' + type });
    }

    // Ensure only one active geo-fence per hostel: deactivate all others
    await GeoFence.updateMany({ hostelId }, { $set: { isActive: false } });

    const existing = await GeoFence.findOne({ hostelId });
    let geoFence;
    if (existing) {
      const updateOp = { $set: setPayload };
      if (Object.keys(unsetPayload).length) updateOp.$unset = unsetPayload;
      geoFence = await GeoFence.findByIdAndUpdate(
        existing._id,
        updateOp,
        { new: true, runValidators: true }
      );
      return res.status(200).json({ success: true, data: geoFence });
    }
    geoFence = await GeoFence.create(setPayload);
    res.status(201).json({ success: true, data: geoFence });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getGeoFences = async (req, res) => {
  try {
    const hostelId = req.params.hostelId;
    // Return only the current active boundary (one per hostel)
    const current = await GeoFence.findOne({ hostelId, isActive: true });
    const data = current ? [current] : [];
    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateGeoFence = async (req, res) => {
  try {
    const geoFence = await GeoFence.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!geoFence) {
      return res.status(404).json({ success: false, message: 'Geo-fence not found' });
    }
    res.status(200).json({ success: true, data: geoFence });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


exports.createFeeStructure = async (req, res) => {
  try {
    const feeStructure = await FeeStructure.create(req.body);
    res.status(201).json({ success: true, data: feeStructure });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getFeeStructures = async (req, res) => {
  try {
    const feeStructures = await FeeStructure.find({ hostelId: req.params.hostelId })
      .populate('roomIds', 'roomNumber category');
    res.status(200).json({ success: true, data: feeStructures });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Plans (1 / 3 / 6 / 12 month rent plans)
exports.getPlans = async (req, res) => {
  try {
    const plans = await Plan.find({ hostelId: req.params.hostelId }).sort({ durationMonths: 1 });
    res.status(200).json({ success: true, data: plans });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.seedPlans = async (req, res) => {
  try {
    const hostelId = req.params.hostelId;
    const existing = await Plan.countDocuments({ hostelId });
    if (existing > 0) {
      return res.status(400).json({ success: false, message: 'Plans already exist for this hostel. Delete or edit them instead.' });
    }
    const defaults = [
      { name: '1 Month', durationMonths: 1, amount: 0 },
      { name: '3 Months', durationMonths: 3, amount: 0 },
      { name: '6 Months', durationMonths: 6, amount: 0 },
      { name: '12 Months', durationMonths: 12, amount: 0 },
    ];
    const plans = await Plan.insertMany(defaults.map((p) => ({ ...p, hostelId })));
    res.status(201).json({ success: true, data: plans, message: 'Plans seeded (1, 3, 6, 12 month). Update amounts in the table.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updatePlan = async (req, res) => {
  try {
    const plan = await Plan.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!plan) return res.status(404).json({ success: false, message: 'Plan not found' });
    res.status(200).json({ success: true, data: plan });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get applicable fee amount for a student by fee type (based on room/category)
exports.getApplicableFeeForStudent = async (req, res) => {
  try {
    const { hostelId, studentId } = req.params;
    const { type } = req.query;
    const student = await User.findById(studentId).populate('roomId', 'category _id');
    if (!student || !student.hostelId || student.hostelId.toString() !== hostelId) {
      return res.status(404).json({ success: false, message: 'Student not found in this hostel' });
    }
    const feeStructures = await FeeStructure.find({
      hostelId,
      type: type || { $exists: true },
      isActive: true,
    });
    const roomCategory = student.roomId?.category;
    const roomIdStr = student.roomId?._id?.toString();
    const pick = (list) => {
      for (const f of list) {
        if (f.applicableTo === 'specific_rooms' && f.roomIds?.length) {
          const ids = (f.roomIds || []).map((r) => (r._id || r).toString());
          if (roomIdStr && ids.includes(roomIdStr)) return f;
        }
        if (f.applicableTo === 'room_category' && f.roomCategories?.length && roomCategory) {
          if (f.roomCategories.includes(roomCategory)) return f;
        }
        if (f.applicableTo === 'all') return f;
      }
      return null;
    };
    const byType = {};
    for (const f of feeStructures) {
      if (!byType[f.type]) byType[f.type] = [];
      byType[f.type].push(f);
    }
    const result = {};
    for (const t of Object.keys(byType)) {
      const ordered = [...(byType[t].filter((f) => f.applicableTo === 'specific_rooms')), ...(byType[t].filter((f) => f.applicableTo === 'room_category')), ...(byType[t].filter((f) => f.applicableTo === 'all'))];
      const applicable = pick(ordered);
      if (applicable) result[t] = { amount: applicable.amount, name: applicable.name, frequency: applicable.frequency };
    }
    if (type) {
      return res.status(200).json({ success: true, data: result[type] || null });
    }
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


exports.createPayment = async (req, res) => {
  try {
    const body = { ...req.body };
    if (body.planId) {
      const plan = await Plan.findById(body.planId).select('durationMonths').lean();
      if (plan && plan.durationMonths) {
        const startDate = body.dueDate ? new Date(body.dueDate) : new Date();
        setPeriodFromPlan(body, startDate, plan.durationMonths);
      }
    }
    const payment = await Payment.create(body);
    res.status(201).json({ success: true, data: payment });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getPayments = async (req, res) => {
  try {
    const { hostelId, studentId, status, type } = req.query;
    const filter = {};
    if (hostelId) filter.hostelId = hostelId;
    if (studentId) filter.studentId = studentId;
    if (status) filter.status = status;
    if (type) filter.type = type;

    let payments = await Payment.find(filter)
      .populate({ path: 'studentId', select: 'name email roomId planId', populate: [{ path: 'roomId', select: 'roomNumber category' }, { path: 'planId', select: 'name durationMonths amount' }] })
      .populate('hostelId', 'name')
      .populate('planId', 'name durationMonths amount')
      .sort({ createdAt: -1 })
      .lean();
    // Backfill period for paid payments that have plan but no period
    for (const p of payments) {
      if (p.status === 'paid' && p.planId && (!p.periodStart || !p.periodEnd) && p.planId.durationMonths) {
        const start = p.paidDate ? new Date(p.paidDate) : new Date(p.updatedAt || p.createdAt);
        setPeriodFromPlan(p, start, p.planId.durationMonths);
        await Payment.updateOne({ _id: p._id }, { $set: { periodStart: p.periodStart, periodEnd: p.periodEnd } });
      }
    }
    res.status(200).json({ success: true, data: payments });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updatePaymentStatus = async (req, res) => {
  try {
    const { status, transactionId, paymentMethod } = req.body;
    const payment = await Payment.findById(req.params.id);
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }
    payment.status = status;
    if (transactionId != null) payment.transactionId = transactionId;
    if (paymentMethod != null) payment.paymentMethod = paymentMethod;
    if (status === 'paid') {
      payment.paidDate = new Date();
      if (payment.planId) {
        const plan = await Plan.findById(payment.planId).select('durationMonths').lean();
        if (plan && plan.durationMonths) setPeriodFromPlan(payment, payment.paidDate, plan.durationMonths);
      }
    } else {
      payment.paidDate = null;
    }
    await payment.save();
    const updated = await Payment.findById(payment._id)
      .populate('studentId', 'name roomId')
      .populate('planId', 'name durationMonths amount')
      .lean();
    res.status(200).json({ success: true, data: updated || payment });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deletePayment = async (req, res) => {
  try {
    const payment = await Payment.findByIdAndDelete(req.params.id);
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }
    res.status(200).json({ success: true, data: { _id: payment._id } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.generateInvoice = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id).populate('studentId').populate('hostelId');
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }

    const invoiceId = `INV-${Date.now()}-${payment._id.toString().slice(-6)}`;
    payment.invoiceId = invoiceId;
    await payment.save();

    res.status(200).json({
      success: true,
      data: {
        invoiceId,
        payment,
        generatedAt: new Date(),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


exports.bulkUploadStudents = async (req, res) => {
  try {
    if (!XLSX) {
      return res.status(500).json({ success: false, message: 'xlsx package not installed. Run: npm install xlsx' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    const students = [];
    const errors = [];

    const hostel = await Hostel.findById(req.body.hostelId);
    const hostelName = hostel?.name || 'Hostel';

    for (const row of data) {
      try {
        const tempPassword = row.password || Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8).toUpperCase() + '123';

        const student = await User.create({
          name: row.name,
          email: row.email,
          password: tempPassword,
          role: 'student',
          phone: row.phone,
          studentId: row.studentId,
          hostelId: req.body.hostelId,
          status: 'active',
        });

        // Send welcome email
        if (student.email) {
          await sendWelcomeEmail(
            student.email,
            student.name,
            hostelName,
            {
              email: student.email,
              password: tempPassword,
            }
          );
        }

        students.push(student);
      } catch (error) {
        errors.push({ row, error: error.message });
      }
    }

    res.status(201).json({
      success: true,
      data: { created: students.length, students, errors },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.approveStudentOnboarding = async (req, res) => {
  try {
    const student = await User.findByIdAndUpdate(
      req.params.id,
      { status: 'active' },
      { new: true }
    ).populate('hostelId');

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    // Send approval email
    if (student.email) {
      const hostelName = student.hostelId?.name || 'Hostel';
      await sendApprovalEmail(student.email, student.name, hostelName);
    }

    res.status(200).json({ success: true, data: student });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Resend Welcome Email
exports.resendWelcomeEmail = async (req, res) => {
  try {
    const { id } = req.params;
    const student = await User.findById(id).select('+password');

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    if (student.role !== 'student') {
      return res.status(400).json({ success: false, message: 'User is not a student' });
    }

    // Generate new password
    const crypto = require('crypto');
    const tempPassword = crypto.randomBytes(8).toString('hex');

    // Update student password
    student.password = tempPassword;
    await student.save();

    // Get hostel name
    const hostel = await Hostel.findById(student.hostelId);
    const hostelName = hostel ? hostel.name : 'Hostel';

    // Send welcome email with new password
    await sendWelcomeEmail(
      student.email,
      student.name,
      hostelName,
      {
        email: student.email,
        password: tempPassword,
      }
    );

    res.status(200).json({
      success: true,
      message: 'Welcome email sent successfully with new password',
    });
  } catch (error) {
    console.error('Error in resendWelcomeEmail:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to resend welcome email' });
  }
};

// Upload Student Profile Image
exports.uploadStudentProfileImage = async (req, res) => {
  try {
    const { studentId } = req.params;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ success: false, message: 'No image provided' });
    }

    const student = await User.findById(studentId);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const imageUrl = await uploadImageToS3(file, 'students/profile');
    student.profileImage = imageUrl;
    await student.save();

    res.status(200).json({
      success: true,
      data: {
        profileImage: student.profileImage,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Upload Student Documents
exports.uploadStudentDocuments = async (req, res) => {
  try {
    const { studentId } = req.params;
    const files = req.files;

    if (!files || files.length === 0) {
      return res.status(400).json({ success: false, message: 'No documents provided' });
    }

    const student = await User.findById(studentId);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const documentData = req.body.documents || []; // Array of {type, name} objects
    const uploadedDocuments = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const docInfo = documentData[i] || {};

      const imageUrl = await uploadImageToS3(file, 'students/documents');
      uploadedDocuments.push({
        type: docInfo.type || 'other',
        name: docInfo.name || file.originalname,
        url: imageUrl,
        uploadedAt: new Date(),
      });
    }

    student.documents = [...(student.documents || []), ...uploadedDocuments];
    await student.save();

    res.status(200).json({
      success: true,
      data: {
        documents: student.documents,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete Student Document
exports.deleteStudentDocument = async (req, res) => {
  try {
    const { studentId, documentId } = req.params;

    const student = await User.findById(studentId);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const document = student.documents?.id(documentId);
    if (!document) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    // Delete from S3
    if (document.url) {
      await deleteImageFromS3(document.url);
    }

    student.documents.pull(documentId);
    await student.save();

    res.status(200).json({
      success: true,
      message: 'Document deleted successfully',
      data: {
        documents: student.documents,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateStudentStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const student = await User.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }
    res.status(200).json({ success: true, data: student });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


exports.createTemplate = async (req, res) => {
  try {
    const template = await Template.create(req.body);
    res.status(201).json({ success: true, data: template });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getTemplates = async (req, res) => {
  try {
    const templates = await Template.find({ hostelId: req.params.hostelId });
    res.status(200).json({ success: true, data: templates });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


exports.sendBroadcast = async (req, res) => {
  try {
    const { title, message, type, targetAudience, templateId, recipients } = req.body;

    // If template is used, fetch and replace variables
    let finalMessage = message;
    if (templateId) {
      const template = await Template.findById(templateId);
      if (template) {
        finalMessage = template.content;
        // Replace variables if needed
        if (req.body.variables) {
          Object.keys(req.body.variables).forEach(key => {
            finalMessage = finalMessage.replace(`{${key}}`, req.body.variables[key]);
          });
        }
      }
    }

    const Notification = require('../models/Notification');
    let notificationRecipients = [];

    if (targetAudience === 'all') {
      const users = await User.find({ hostelId: req.body.hostelId });
      notificationRecipients = users.map(u => u._id);
    } else if (targetAudience) {
      const users = await User.find({ hostelId: req.body.hostelId, role: targetAudience });
      notificationRecipients = users.map(u => u._id);
    } else if (recipients) {
      notificationRecipients = recipients;
    }

    const notification = await Notification.create({
      title,
      message: finalMessage,
      type,
      targetAudience,
      recipients: notificationRecipients,
      createdBy: req.user.id,
      hostelId: req.body.hostelId,
    });

    res.status(201).json({ success: true, data: notification });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============ GUEST VISIT (VISITOR) REQUESTS ============

// Get visitor requests for owner's hostels (students in owner's hostels)
exports.getVisitorRequests = async (req, res) => {
  try {
    const hostels = await Hostel.find({ ownerId: req.user.id }).select('_id');
    const hostelIds = hostels.map(h => h._id);
    const students = await User.find({ hostelId: { $in: hostelIds }, role: 'student' }).select('_id');
    const studentIds = students.map(s => s._id);

    const visitors = await Visitor.find({ visitingStudentId: { $in: studentIds } })
      .populate('visitingStudentId', 'name roomId hostelId')
      .populate('approvedBy', 'name')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, data: visitors });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Approve visitor request and notify student
exports.approveVisitorRequest = async (req, res) => {
  try {
    const { visitorId } = req.params;
    const visitor = await Visitor.findById(visitorId).populate('visitingStudentId', 'name hostelId pushToken');
    if (!visitor) {
      return res.status(404).json({ success: false, message: 'Visitor request not found' });
    }
    if (visitor.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Request already processed' });
    }

    const student = visitor.visitingStudentId;
    const hostel = await Hostel.findById(student?.hostelId);
    if (!hostel || hostel.ownerId.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized for this hostel' });
    }

    visitor.status = 'approved';
    visitor.approvedBy = req.user.id;
    visitor.entryTime = new Date();
    await visitor.save();

    const title = 'Guest visit approved';
    const message = `Your visitor request for ${visitor.visitorName} has been approved by the hostel.`;
    await Notification.create({
      title,
      message,
      type: 'alert',
      recipients: [visitor.visitingStudentId._id],
      createdBy: req.user.id,
      hostelId: student.hostelId,
    });

    if (student.pushToken) {
      try {
        await sendPushNotifications([{ to: student.pushToken, title, body: message, data: { type: 'visitor_approved', visitorId: visitor._id.toString() } }]);
      } catch (e) {
        console.warn('Push notification failed:', e.message);
      }
    }

    res.status(200).json({ success: true, data: visitor });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Reject visitor request and notify student
exports.rejectVisitorRequest = async (req, res) => {
  try {
    const { visitorId } = req.params;
    const { rejectionReason } = req.body;
    const visitor = await Visitor.findById(visitorId).populate('visitingStudentId', 'name hostelId pushToken');
    if (!visitor) {
      return res.status(404).json({ success: false, message: 'Visitor request not found' });
    }
    if (visitor.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Request already processed' });
    }

    const student = visitor.visitingStudentId;
    const hostel = await Hostel.findById(student?.hostelId);
    if (!hostel || hostel.ownerId.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized for this hostel' });
    }

    visitor.status = 'rejected';
    visitor.approvedBy = req.user.id;
    visitor.rejectionReason = rejectionReason || 'Not specified';
    await visitor.save();

    const title = 'Guest visit not approved';
    const message = `Your visitor request for ${visitor.visitorName} was not approved.${rejectionReason ? ` Reason: ${rejectionReason}` : ''}`;
    await Notification.create({
      title,
      message,
      type: 'alert',
      recipients: [visitor.visitingStudentId._id],
      createdBy: req.user.id,
      hostelId: student.hostelId,
    });

    if (student.pushToken) {
      try {
        await sendPushNotifications([{ to: student.pushToken, title, body: message, data: { type: 'visitor_rejected', visitorId: visitor._id.toString() } }]);
      } catch (e) {
        console.warn('Push notification failed:', e.message);
      }
    }

    res.status(200).json({ success: true, data: visitor });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getDashboardKPIs = async (req, res) => {
  try {
    const { hostelId } = req.query;
    const targetHostelId = hostelId || req.user?.hostelId;
    const mongoose = require('mongoose');

    const roomFilter = targetHostelId ? { hostelId: targetHostelId } : {};
    const rooms = await Room.find(roomFilter);
    const roomIds = rooms.map(r => r._id);
    const hostelRoomIds = roomIds.map(id => id.toString());

    // Find students by hostelId directly
    const studentsByHostel = targetHostelId
      ? await User.find({ hostelId: targetHostelId, role: 'student' })
      : [];

    // Find ALL students with roomId set (regardless of hostel)
    // This ensures we catch students even if they're not linked through blocks
    const allStudentsWithRooms = await User.find({
      roomId: { $exists: true, $ne: null },
      role: 'student'
    });

    // Filter students by rooms in this hostel (if hostelId provided)
    const studentsByRoom = hostelRoomIds.length > 0
      ? allStudentsWithRooms.filter(s =>
        s.roomId && hostelRoomIds.includes(s.roomId.toString())
      )
      : allStudentsWithRooms.filter(s =>
        s.roomId && roomIds.some(rid => rid.toString() === s.roomId.toString())
      );

    // Combine and deduplicate students
    const studentIdSet = new Set();
    studentsByHostel.forEach(s => studentIdSet.add(s._id.toString()));
    studentsByRoom.forEach(s => studentIdSet.add(s._id.toString()));

    // If no students found and we have rooms, get all students assigned to those rooms
    if (studentIdSet.size === 0 && roomIds.length > 0) {
      const fallbackStudents = await User.find({
        roomId: { $in: roomIds },
        role: 'student'
      });
      fallbackStudents.forEach(s => studentIdSet.add(s._id.toString()));
    }

    // If still no students, get all students with any roomId (for debugging)
    if (studentIdSet.size === 0) {
      const allStudentsWithAnyRoom = await User.find({
        roomId: { $exists: true, $ne: null },
        role: 'student'
      });
      allStudentsWithAnyRoom.forEach(s => studentIdSet.add(s._id.toString()));
    }

    const allStudentIds = Array.from(studentIdSet).map(id => new mongoose.Types.ObjectId(id));
    const students = allStudentIds.length > 0
      ? await User.find({ _id: { $in: allStudentIds }, role: 'student' })
      : [];

    // Calculate occupancy with partial occupancy support
    let totalCapacity = 0;
    let totalOccupied = 0;
    let fullyOccupiedRooms = 0;
    let partiallyOccupiedRooms = 0;
    let emptyRooms = 0;

    rooms.forEach(room => {
      const roomStudents = students.filter(s =>
        s.roomId && s.roomId.toString() === room._id.toString()
      );
      const studentCount = roomStudents.length;
      const capacity = room.capacity || 0;
      const occupancy = capacity > 0 ? (studentCount / capacity) * 100 : 0;

      totalCapacity += capacity;
      totalOccupied += studentCount;

      if (studentCount === 0) {
        emptyRooms++;
      } else if (studentCount >= capacity) {
        fullyOccupiedRooms++;
      } else {
        partiallyOccupiedRooms++;
      }
    });

    const overallOccupancyRate = totalCapacity > 0
      ? ((totalOccupied / totalCapacity) * 100).toFixed(2)
      : '0.00';

    // Calculate occupied rooms (rooms with at least 1 student)
    const occupiedRooms = fullyOccupiedRooms + partiallyOccupiedRooms;

    const filter = targetHostelId ? { hostelId: targetHostelId } : {};
    const payments = await Payment.find(filter);
    const violations = await Violation.find({ studentId: { $in: students.map(s => s._id) } });

    const kpis = {
      totalStudents: students.length,
      activeStudents: students.filter(s => s.status === 'active').length,
      totalRooms: rooms.length,
      occupiedRooms: occupiedRooms,
      fullyOccupiedRooms: fullyOccupiedRooms,
      partiallyOccupiedRooms: partiallyOccupiedRooms,
      emptyRooms: emptyRooms,
      totalCapacity: totalCapacity,
      totalOccupied: totalOccupied,
      overallOccupancyRate: overallOccupancyRate,
      vacancyRate: rooms.length > 0
        ? (((rooms.length - occupiedRooms) / rooms.length) * 100).toFixed(2)
        : '0.00',
      totalRevenue: payments.filter(p => p.status === 'paid').reduce((sum, p) => sum + (p.amount || 0), 0),
      pendingPayments: payments.filter(p => p.status === 'pending').length,
      totalViolations: violations.length,
      pendingViolations: violations.filter(v => v.status === 'pending').length,
    };

    res.status(200).json({ success: true, data: kpis });
  } catch (error) {
    console.error('Error in getDashboardKPIs:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getStaffPerformance = async (req, res) => {
  try {
    const { hostelId, startDate, endDate } = req.query;
    const filter = { hostelId: hostelId || req.user.hostelId };

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
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getOccupancyReport = async (req, res) => {
  try {
    const { hostelId } = req.query;
    const filter = {};
    if (hostelId) filter.hostelId = hostelId;
    const rooms = await Room.find(filter)
      .populate('students', 'name studentId');

    const report = {
      totalRooms: rooms.length,
      occupiedRooms: rooms.filter(r => r.status === 'occupied').length,
      availableRooms: rooms.filter(r => r.status === 'available').length,
      maintenanceRooms: rooms.filter(r => r.status === 'maintenance').length,
      occupancyRate: ((rooms.filter(r => r.status === 'occupied').length / rooms.length) * 100).toFixed(2),
      byCategory: {},
      vacantRooms: rooms.filter(r => r.status === 'available').map(r => ({
        roomId: r._id,
        roomNumber: r.roomNumber,
        category: r.category,
        availableBeds: r.capacity - r.currentOccupancy,
      })),
    };

    rooms.forEach(room => {
      if (!report.byCategory[room.category]) {
        report.byCategory[room.category] = { total: 0, occupied: 0 };
      }
      report.byCategory[room.category].total++;
      if (room.status === 'occupied') {
        report.byCategory[room.category].occupied++;
      }
    });

    res.status(200).json({ success: true, data: report });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getFinancialReport = async (req, res) => {
  try {
    const { hostelId, startDate, endDate } = req.query;
    const filter = { hostelId: hostelId || req.user.hostelId };

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const payments = await Payment.find(filter);

    const report = {
      totalRevenue: payments.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0),
      pendingAmount: payments.filter(p => p.status === 'pending').reduce((sum, p) => sum + p.amount, 0),
      byType: {},
      byMethod: {},
      monthlyBreakdown: {},
    };

    payments.forEach(payment => {
      // By type
      if (!report.byType[payment.type]) {
        report.byType[payment.type] = { total: 0, paid: 0, pending: 0 };
      }
      report.byType[payment.type].total += payment.amount;
      if (payment.status === 'paid') {
        report.byType[payment.type].paid += payment.amount;
      } else {
        report.byType[payment.type].pending += payment.amount;
      }

      // By method
      if (payment.paymentMethod) {
        if (!report.byMethod[payment.paymentMethod]) {
          report.byMethod[payment.paymentMethod] = 0;
        }
        report.byMethod[payment.paymentMethod] += payment.amount;
      }

      // Monthly breakdown
      const month = new Date(payment.createdAt).toISOString().slice(0, 7);
      if (!report.monthlyBreakdown[month]) {
        report.monthlyBreakdown[month] = 0;
      }
      if (payment.status === 'paid') {
        report.monthlyBreakdown[month] += payment.amount;
      }
    });

    res.status(200).json({ success: true, data: report });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


exports.getAuditLogs = async (req, res) => {
  try {
    const { entityType, entityId, startDate, endDate } = req.query;
    const filter = {};
    if (entityType) filter.entityType = entityType;
    if (entityId) filter.entityId = entityId;
    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) filter.timestamp.$gte = new Date(startDate);
      if (endDate) filter.timestamp.$lte = new Date(endDate);
    }

    const logs = await AuditLog.find(filter)
      .populate('performedBy', 'name email role')
      .sort({ timestamp: -1 })
      .limit(1000);

    res.status(200).json({ success: true, data: logs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.exportData = async (req, res) => {
  try {
    const { type, format, hostelId } = req.query;
    const filter = { hostelId: hostelId || req.user.hostelId };

    let data = [];
    let filename = '';

    switch (type) {
      case 'students':
        data = await User.find({ ...filter, role: 'student' }).select('-password');
        filename = 'students';
        break;
      case 'payments':
        data = await Payment.find(filter).populate('studentId', 'name email');
        filename = 'payments';
        break;
      case 'violations':
        const students = await User.find({ ...filter, role: 'student' }).select('_id');
        data = await Violation.find({ studentId: { $in: students.map(s => s._id) } })
          .populate('studentId', 'name');
        filename = 'violations';
        break;
      default:
        return res.status(400).json({ success: false, message: 'Invalid export type' });
    }

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=${filename}.json`);
      return res.status(200).json(data);
    } else if (format === 'csv') {
      // Convert to CSV
      const csv = convertToCSV(data);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=${filename}.csv`);
      return res.status(200).send(csv);
    } else {
      return res.status(400).json({ success: false, message: 'Invalid format' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

function convertToCSV(data) {
  if (!data || data.length === 0) return '';
  const headers = Object.keys(data[0].toObject ? data[0].toObject() : data[0]);
  const rows = data.map(item => {
    const obj = item.toObject ? item.toObject() : item;
    return headers.map(header => {
      const value = obj[header];
      return typeof value === 'object' ? JSON.stringify(value) : value;
    });
  });
  return [headers, ...rows].map(row => row.join(',')).join('\n');
}


exports.createSupportTicket = async (req, res) => {
  try {
    const ticketNumber = `TKT-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    const ticket = await SupportTicket.create({
      ...req.body,
      ticketNumber,
      raisedBy: req.user.id,
    });
    res.status(201).json({ success: true, data: ticket });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getSupportTickets = async (req, res) => {
  try {
    const tickets = await SupportTicket.find({ raisedBy: req.user.id })
      .populate('assignedTo', 'name email')
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: tickets });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


exports.getSystemLogs = async (req, res) => {
  try {
    // This would typically come from a logging service
    // For now, return audit logs
    const logs = await AuditLog.find()
      .populate('performedBy', 'name email')
      .sort({ timestamp: -1 })
      .limit(100);
    res.status(200).json({ success: true, data: logs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Geocode Address
exports.geocodeAddressEndpoint = async (req, res) => {
  try {
    const { address } = req.body;

    if (!address) {
      return res.status(400).json({
        success: false,
        message: 'Address is required'
      });
    }

    const addressString = typeof address === 'string'
      ? address
      : [
        address.street,
        address.city,
        address.state,
        address.pincode,
        address.country || 'India',
      ]
        .filter(Boolean)
        .join(', ');

    if (!addressString) {
      return res.status(400).json({
        success: false,
        message: 'Address string is required'
      });
    }

    const geocodeResult = await geocodeAddress(addressString);

    res.status(200).json({
      success: true,
      data: {
        coordinates: {
          latitude: geocodeResult.latitude,
          longitude: geocodeResult.longitude,
        },
        formattedAddress: geocodeResult.formattedAddress,
        placeId: geocodeResult.placeId,
      },
    });
  } catch (error) {
    console.error('Geocoding error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to geocode address',
    });
  }
};

// Get enquiries for owner's hostels
exports.getEnquiries = async (req, res) => {
  try {
    const Enquiry = require('../models/Enquiry');
    const hostels = await Hostel.find({ ownerId: req.user.id }).select('_id');
    const hostelIds = hostels.map(h => h._id);

    const enquiries = await Enquiry.find({ hostelId: { $in: hostelIds } })
      .populate('hostelId', 'name')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: enquiries.length, data: enquiries });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update enquiry status
exports.updateEnquiryStatus = async (req, res) => {
  try {
    const Enquiry = require('../models/Enquiry');
    const { status, notes } = req.body;

    const enquiry = await Enquiry.findById(req.params.id);
    if (!enquiry) {
      return res.status(404).json({ success: false, message: 'Enquiry not found' });
    }

    // Verify owner owns the hostel
    const hostel = await Hostel.findById(enquiry.hostelId);
    if (!hostel || hostel.ownerId.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    enquiry.status = status || enquiry.status;
    if (notes) enquiry.notes = notes;
    if (status === 'contacted' || status === 'resolved') {
      enquiry.respondedAt = new Date();
    }

    await enquiry.save();
    res.status(200).json({ success: true, data: enquiry });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get callback requests for owner's hostels
exports.getCallbackRequests = async (req, res) => {
  try {
    const CallbackRequest = require('../models/CallbackRequest');
    const hostels = await Hostel.find({ ownerId: req.user.id }).select('_id');
    const hostelIds = hostels.map(h => h._id);

    const callbacks = await CallbackRequest.find({ hostelId: { $in: hostelIds } })
      .populate('hostelId', 'name')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: callbacks.length, data: callbacks });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update callback request status
exports.updateCallbackStatus = async (req, res) => {
  try {
    const CallbackRequest = require('../models/CallbackRequest');
    const { status, notes } = req.body;

    const callback = await CallbackRequest.findById(req.params.id);
    if (!callback) {
      return res.status(404).json({ success: false, message: 'Callback request not found' });
    }

    // Verify owner owns the hostel
    const hostel = await Hostel.findById(callback.hostelId);
    if (!hostel || hostel.ownerId.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    callback.status = status || callback.status;
    if (notes) callback.notes = notes;
    if (status === 'called') {
      callback.calledAt = new Date();
    }

    await callback.save();
    res.status(200).json({ success: true, data: callback });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Trigger Attendance Check - Fetches latest location for all students and determines presence
exports.triggerAttendanceCheck = async (req, res) => {
  try {
    const { hostelId } = req.body;

    // Get hostel details
    const hostel = await Hostel.findById(hostelId);
    if (!hostel) {
      return res.status(404).json({ success: false, message: 'Hostel not found' });
    }

    // Verify owner owns this hostel
    if (hostel.ownerId.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    // Get all students in this hostel
    const students = await User.find({
      hostelId: hostelId,
      role: 'student',
      status: 'active',
    }).select('name email studentId locationPermissionStatus currentLocation lastLocationUpdate pushToken');

    const notifications = [];

    // Get latest location for each student
    const studentStatuses = await Promise.all(
      students.map(async (student) => {
        // Get most recent location record
        const latestLocation = await StudentLocation.findOne({
          studentId: student._id,
        }).sort({ timestamp: -1 });

        let presenceStatus = 'unknown';
        let distanceFromHostel = null;
        let lastUpdate = student.lastLocationUpdate || latestLocation?.timestamp;

        // Check if student has location permission
        if (student.locationPermissionStatus === 'denied') {
          presenceStatus = 'permission_denied';
        } else if (student.locationPermissionStatus === 'not_requested') {
          presenceStatus = 'permission_not_requested';
        } else if (!latestLocation && !student.currentLocation) {
          presenceStatus = 'no_data';
        } else {
          // Use current location from user or latest location record
          const location = student.currentLocation || latestLocation?.location;

          if (location && hostel.address?.coordinates?.latitude && hostel.address?.coordinates?.longitude) {
            const hostelLocation = {
              latitude: hostel.address.coordinates.latitude,
              longitude: hostel.address.coordinates.longitude,
            };

            const validation = validateLocation(location, hostelLocation, 500);
            distanceFromHostel = validation.distance;
            presenceStatus = validation.isValid ? 'inside' : 'outside';
          }
        }

        // Prepare push notification for student
        if (student.pushToken) {
          let body = '';
          if (presenceStatus === 'inside') body = 'Attendance verified: You are currently inside the hostel.';
          else if (presenceStatus === 'outside') body = 'Attendance alert: You are currently outside the hostel.';
          else if (presenceStatus === 'permission_denied') {
            body = 'Attendance alert: Please enable location access to verify your presence.';
          } else {
            body = 'Owner triggered an attendance check.';
          }

          notifications.push({
            to: student.pushToken,
            title: 'Attendance Check Triggered',
            body: body,
            data: { type: 'attendance_check', status: presenceStatus }
          });
        }

        return {
          studentId: student._id,
          name: student.name,
          email: student.email,
          studentNumber: student.studentId,
          presenceStatus,
          distanceFromHostel,
          lastUpdate,
          locationPermissionStatus: student.locationPermissionStatus,
          accuracy: latestLocation?.accuracy || student.currentLocation?.accuracy,
        };
      })
    );

    // Send push notifications in background
    if (notifications.length > 0) {
      sendPushNotifications(notifications).catch(err => console.error('Error sending background notifications:', err));
    }

    // Calculate summary statistics
    const summary = {
      total: studentStatuses.length,
      inside: studentStatuses.filter(s => s.presenceStatus === 'inside').length,
      outside: studentStatuses.filter(s => s.presenceStatus === 'outside').length,
      permissionDenied: studentStatuses.filter(s => s.presenceStatus === 'permission_denied').length,
      permissionNotRequested: studentStatuses.filter(s => s.presenceStatus === 'permission_not_requested').length,
      noData: studentStatuses.filter(s => s.presenceStatus === 'no_data').length,
    };

    res.status(200).json({
      success: true,
      data: {
        hostel: {
          id: hostel._id,
          name: hostel.name,
          coordinates: hostel.address?.coordinates,
        },
        summary,
        students: studentStatuses,
        timestamp: new Date(),
      },
    });
  } catch (error) {
    console.error('Error in triggerAttendanceCheck:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get real-time location status of all students
exports.getStudentLocations = async (req, res) => {
  try {
    const { hostelId, status } = req.query;
    const query = { role: 'student' };
    if (hostelId) query.hostelId = hostelId;
    if (status) query.status = status;

    const students = await User.find(query).select('name email studentId currentLocation lastLocationUpdate locationPermissionStatus');
    res.status(200).json({ success: true, data: students });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// List students with their current check-in/check-out status (from latest Attendance)
exports.getStudentsWithAttendance = async (req, res) => {
  try {
    const { hostelId } = req.query;
    const hostels = await Hostel.find({ ownerId: req.user.id }).select('_id');
    const hostelIds = hostels.map(h => h._id);
    const query = { role: 'student' };
    if (hostelId) query.hostelId = hostelId;
    else if (hostelIds.length) query.hostelId = { $in: hostelIds };

    const students = await User.find(query)
      .populate('hostelId', 'name')
      .populate('roomId', 'roomNumber')
      .populate('planId', 'name amount durationMonths')
      .select('name email phone studentId status hostelId roomId pushToken planId')
      .lean();

    const studentIds = students.map(s => s._id);
    const latestAttendance = await Attendance.aggregate([
      { $match: { studentId: { $in: studentIds } } },
      { $sort: { date: -1, createdAt: -1 } },
      { $group: { _id: '$studentId', doc: { $first: '$$ROOT' } } },
      { $replaceRoot: { newRoot: '$doc' } },
    ]);

    const attendanceByStudent = {};
    latestAttendance.forEach(a => {
      attendanceByStudent[a.studentId.toString()] = a;
    });

    const list = students.map(s => {
      const { pushToken, ...rest } = s;
      const att = attendanceByStudent[s._id.toString()];
      const presenceStatus = !att ? 'unknown' : (att.status === 'inside' ? 'inside' : att.status === 'outside' ? 'outside' : 'unknown');
      return {
        ...rest,
        presenceStatus,
        lastCheckIn: att?.checkInTime || null,
        lastCheckOut: att?.checkOutTime || null,
        hasPushToken: !!(pushToken && String(pushToken).trim()),
      };
    });

    res.status(200).json({ success: true, data: list });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Day-wise attendance: all students of hostel with total time inside per day (0 if no record)
exports.getDailyAttendance = async (req, res) => {
  try {
    const { hostelId, from, to } = req.query;
    const hostels = await Hostel.find({ ownerId: req.user.id }).select('_id');
    const hostelIds = hostels.map(h => h._id);
    if (hostelIds.length === 0) {
      return res.status(200).json({ success: true, data: [] });
    }
    const effectiveHostelId = hostelId || (hostelIds.length === 1 ? hostelIds[0] : null);
    if (!effectiveHostelId) {
      return res.status(200).json({ success: true, data: [] });
    }

    const fromDate = from ? new Date(from) : new Date();
    fromDate.setHours(0, 0, 0, 0);
    const toDate = to ? new Date(to) : new Date(fromDate);
    if (to) toDate.setHours(23, 59, 59, 999);
    else toDate.setHours(23, 59, 59, 999);

    const students = await User.find({ hostelId: effectiveHostelId, role: 'student' })
      .select('name email studentId')
      .sort({ name: 1 })
      .lean();

    const records = await Attendance.find({
      hostelId: effectiveHostelId,
      date: { $gte: fromDate, $lte: toDate },
    })
      .populate('studentId', 'name email studentId')
      .lean();

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const now = new Date();

    const byDay = {};
    const dayKeys = new Set();
    for (let d = new Date(fromDate); d <= toDate; d.setDate(d.getDate() + 1)) {
      const dayKey = d.toISOString().slice(0, 10);
      dayKeys.add(dayKey);
      byDay[dayKey] = students.map((s) => ({
        studentId: s._id,
        name: s.name ?? '—',
        email: s.email ?? '',
        studentNumber: s.studentId ?? '',
        totalMinutesInside: 0,
        totalTimeFormatted: '0m',
      }));
    }

    // Group by (dayKey, studentId): use MAX(totalMinutesInside) + current session if inside (same as mobile getStatus)
    const dayStudentMinutes = {};
    const dayStudentCurrentSession = {};
    for (const r of records) {
      const d = new Date(r.date);
      d.setHours(0, 0, 0, 0);
      const dayKey = d.toISOString().slice(0, 10);
      const sid = (r.studentId && (r.studentId._id || r.studentId)).toString();
      const key = `${dayKey}:${sid}`;
      const base = Number(r.totalMinutesInside) || 0;
      if (base > (dayStudentMinutes[key] || 0)) dayStudentMinutes[key] = base;
      if (d.getTime() === todayStart.getTime() && r.status === 'inside' && r.checkInTime) {
        const currentSession = (now.getTime() - new Date(r.checkInTime).getTime()) / 60000;
        dayStudentCurrentSession[key] = Math.max(0, dayStudentCurrentSession[key] || 0, currentSession);
      }
    }
    for (const dayKey of dayKeys) {
      const rows = byDay[dayKey];
      if (!rows) continue;
      for (const row of rows) {
        const sid = (row.studentId && (row.studentId._id || row.studentId)).toString();
        const key = `${dayKey}:${sid}`;
        let minutes = dayStudentMinutes[key] || 0;
        minutes += dayStudentCurrentSession[key] || 0;
        row.totalMinutesInside = Math.round(minutes * 10) / 10;
        row.totalTimeFormatted = formatMinutesToTime(minutes);
      }
    }

    const sortedDays = Array.from(dayKeys).sort();
    const data = sortedDays.map((date) => ({
      date,
      students: byDay[date],
    }));

    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

function formatMinutesToTime(minutes) {
  const m = Math.round(Number(minutes) || 0);
  if (m <= 0) return '0m';
  const h = Math.floor(m / 60);
  const min = m % 60;
  if (h > 0 && min > 0) return `${h}h ${min}m`;
  if (h > 0) return `${h}h`;
  return `${min}m`;
}

// Gate logs: time-sorted check-in/check-out events from GateEvent (one document per in/out)
exports.getGateLogs = async (req, res) => {
  try {
    const { hostelId, from, to, studentId: studentIdParam } = req.query;
    const hostels = await Hostel.find({ ownerId: req.user.id }).select('_id').lean();
    const hostelIds = hostels.map((h) => h._id);
    if (hostelIds.length === 0) {
      return res.status(200).json({ success: true, data: { events: [] } });
    }
    const effectiveHostelId = hostelId || (hostelIds.length === 1 ? hostelIds[0] : null);
    if (!effectiveHostelId) {
      return res.status(200).json({ success: true, data: { events: [] } });
    }

    const fromDate = from ? new Date(from) : new Date();
    fromDate.setHours(0, 0, 0, 0);
    const toDate = to ? new Date(to) : new Date(fromDate);
    toDate.setHours(23, 59, 59, 999);
    if (!to) toDate.setHours(23, 59, 59, 999);

    const query = { hostelId: effectiveHostelId, time: { $gte: fromDate, $lte: toDate } };
    if (studentIdParam) query.studentId = studentIdParam;

    const records = await GateEvent.find(query)
      .populate('studentId', 'name email studentId')
      .sort({ time: 1 })
      .lean();

    const rawEvents = records.map((r) => ({
      time: r.time,
      type: r.type,
      studentId: r.studentId?._id || r.studentId,
      studentName: r.studentId?.name ?? '—',
      studentEmail: r.studentId?.email ?? '',
      studentNumber: r.studentId?.studentId ?? '',
    }));

    // Dedupe: same student + same type within 60s → keep only the first (removes duplicate IN/IN or OUT/OUT)
    const DEDUPE_MS = 60 * 1000;
    const events = [];
    for (const ev of rawEvents) {
      const sid = String(ev.studentId);
      const t = new Date(ev.time).getTime();
      const isDup = events.some(
        (e) => String(e.studentId) === sid && e.type === ev.type && Math.abs(new Date(e.time).getTime() - t) <= DEDUPE_MS
      );
      if (!isDup) events.push(ev);
    }

    res.status(200).json({ success: true, data: { events } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// List students by location permission status
exports.getLocationPermissionStatus = async (req, res) => {
  try {
    const { hostelId } = req.query;
    const query = { role: 'student' };
    if (hostelId) query.hostelId = hostelId;

    const students = await User.find(query).select('name studentId locationPermissionStatus');

    // Group by status
    const grouped = {
      granted: students.filter(s => s.locationPermissionStatus === 'granted'),
      denied: students.filter(s => s.locationPermissionStatus === 'denied'),
      not_requested: students.filter(s => s.locationPermissionStatus === 'not_requested'),
    };

    res.status(200).json({ success: true, data: grouped });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Send Notification to All Students (Expo when available for receipts, else FCM)
exports.sendNotificationToAll = async (req, res) => {
  try {
    const { title, body, data } = req.body;
    const User = require('../models/User');
    const {
      sendPushNotifications,
      sendExpoPushNotifications,
      isExpoPushToken,
    } = require('../utils/notificationService');

    const students = await User.find({
      role: 'student',
      $or: [
        { pushToken: { $exists: true, $ne: null, $ne: '' } },
        { expoPushToken: { $exists: true, $ne: null, $ne: '' } },
      ],
    }).select('pushToken expoPushToken');

    if (students.length === 0) {
      return res.status(404).json({ success: false, message: 'No students with push tokens found' });
    }

    const expoNotifications = [];
    const fcmNotifications = [];

    // Prefer FCM when we have a native FCM token (avoids Expo needing FCM credentials for Android)
    students.forEach((s) => {
      const payload = { title, body, data: data || {} };
      const hasFcm = s.pushToken && !isExpoPushToken(s.pushToken);
      const hasExpo = s.expoPushToken && isExpoPushToken(s.expoPushToken);
      if (hasFcm) {
        fcmNotifications.push({ ...payload, to: s.pushToken });
      } else if (hasExpo) {
        expoNotifications.push({ ...payload, to: s.expoPushToken });
      }
    });

    let receiptIds = [];
    let expoResults = [];
    if (expoNotifications.length > 0) {
      const expoOut = await sendExpoPushNotifications(expoNotifications);
      receiptIds = expoOut.receiptIds || [];
      expoResults = expoOut.responses || [];
    }

    let fcmResults = [];
    if (fcmNotifications.length > 0) {
      fcmResults = await sendPushNotifications(fcmNotifications);
      const invalidTokens = Array.isArray(fcmResults) && fcmResults.invalidTokens?.length ? fcmResults.invalidTokens : [];
      if (invalidTokens.length > 0) {
        await User.updateMany(
          { pushToken: { $in: invalidTokens } },
          { $unset: { pushToken: 1 } }
        );
        console.log('[Broadcast] Removed', invalidTokens.length, 'invalid FCM token(s) from User records');
      }
    }

    res.status(200).json({
      success: true,
      message: `Notification sent to ${expoNotifications.length + fcmNotifications.length} students`,
      receiptIds,
      expoCount: expoNotifications.length,
      fcmCount: fcmNotifications.length,
      results: { expo: expoResults, fcm: fcmResults },
    });
  } catch (error) {
    console.error('Broadcast notification error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get status of Expo push notification receipts (ok | error | DeviceNotRegistered | MessageTooBig)
exports.getNotificationReceipts = async (req, res) => {
  try {
    const ids = req.body?.ids || (typeof req.query.ids === 'string' ? req.query.ids.split(',') : []);
    if (!ids.length) {
      return res.status(400).json({ success: false, message: 'Receipt ids required (body.ids or query ids=id1,id2)' });
    }
    const { getExpoReceipts } = require('../utils/notificationService');
    const receipts = await getExpoReceipts(ids);
    res.status(200).json({ success: true, data: receipts });
  } catch (error) {
    console.error('Get receipts error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============ MESS SCHEDULE (Owner) ============
const MessSchedule = require('../models/MessSchedule');

exports.getMessSchedules = async (req, res) => {
  try {
    const { hostelId } = req.params;
    const hostel = await Hostel.findById(hostelId);
    if (!hostel) return res.status(404).json({ success: false, message: 'Hostel not found' });
    const ownerIdStr = String(hostel.ownerId);
    const userIdStr = String(req.user.id || req.user._id);
    if (ownerIdStr !== userIdStr) {
      return res.status(403).json({ success: false, message: 'Not authorized for this hostel' });
    }
    const schedules = await MessSchedule.find({ hostelId }).sort({ order: 1, mealType: 1 }).lean();
    res.status(200).json({ success: true, data: schedules });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createMessSchedule = async (req, res) => {
  try {
    const { hostelId } = req.params;
    const { mealType, title, items, startTime, endTime, dayOfWeek, active, order } = req.body;
    const hostel = await Hostel.findById(hostelId);
    if (!hostel) return res.status(404).json({ success: false, message: 'Hostel not found' });
    const ownerIdStr = String(hostel.ownerId);
    const userIdStr = String(req.user.id || req.user._id);
    if (ownerIdStr !== userIdStr) {
      return res.status(403).json({ success: false, message: 'Not authorized for this hostel' });
    }
    if (!mealType || !startTime || !endTime) {
      return res.status(400).json({ success: false, message: 'mealType, startTime and endTime are required' });
    }
    const schedule = await MessSchedule.create({
      hostelId,
      mealType: mealType.toLowerCase(),
      title: title || mealType,
      items: Array.isArray(items) ? items.filter(Boolean) : [],
      startTime: String(startTime).trim(),
      endTime: String(endTime).trim(),
      dayOfWeek: dayOfWeek != null ? parseInt(dayOfWeek, 10) : null,
      active: active !== false,
      order: order != null ? parseInt(order, 10) : 0,
    });
    res.status(201).json({ success: true, data: schedule });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateMessSchedule = async (req, res) => {
  try {
    const { hostelId, scheduleId } = req.params;
    const hostel = await Hostel.findById(hostelId);
    if (!hostel) return res.status(404).json({ success: false, message: 'Hostel not found' });
    const ownerIdStr = String(hostel.ownerId);
    const userIdStr = String(req.user.id || req.user._id);
    if (ownerIdStr !== userIdStr) {
      return res.status(403).json({ success: false, message: 'Not authorized for this hostel' });
    }
    const schedule = await MessSchedule.findOne({ _id: scheduleId, hostelId });
    if (!schedule) return res.status(404).json({ success: false, message: 'Mess schedule not found' });
    const { mealType, title, items, startTime, endTime, dayOfWeek, active, order } = req.body;
    if (mealType != null) schedule.mealType = mealType.toLowerCase();
    if (title != null) schedule.title = title;
    if (Array.isArray(items)) schedule.items = items.filter(Boolean);
    if (startTime != null) schedule.startTime = String(startTime).trim();
    if (endTime != null) schedule.endTime = String(endTime).trim();
    if (dayOfWeek !== undefined) schedule.dayOfWeek = dayOfWeek == null ? null : parseInt(dayOfWeek, 10);
    if (active !== undefined) schedule.active = active;
    if (order !== undefined) schedule.order = parseInt(order, 10);
    await schedule.save();
    res.status(200).json({ success: true, data: schedule });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteMessSchedule = async (req, res) => {
  try {
    const { hostelId, scheduleId } = req.params;
    const hostel = await Hostel.findById(hostelId);
    if (!hostel) return res.status(404).json({ success: false, message: 'Hostel not found' });
    const ownerIdStr = String(hostel.ownerId);
    const userIdStr = String(req.user.id || req.user._id);
    if (ownerIdStr !== userIdStr) {
      return res.status(403).json({ success: false, message: 'Not authorized for this hostel' });
    }
    const deleted = await MessSchedule.findOneAndDelete({ _id: scheduleId, hostelId });
    if (!deleted) return res.status(404).json({ success: false, message: 'Mess schedule not found' });
    res.status(200).json({ success: true, message: 'Mess schedule deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Indian vegetarian weekly mess: Sunday (0) to Saturday (6), 3 meals per day
const MESS_SEED_WEEK = [
  // Sunday
  { day: 0, breakfast: ['Poha', 'Banana', 'Tea'], lunch: ['Rice', 'Dal', 'Mix Veg', 'Curd', 'Salad'], dinner: ['Chapati', 'Chole', 'Rice', 'Raita'] },
  // Monday
  { day: 1, breakfast: ['Idli', 'Sambar', 'Coconut Chutney'], lunch: ['Rice', 'Rajma', 'Aloo Fry', 'Salad'], dinner: ['Paratha', 'Kadhi', 'Rice'] },
  // Tuesday
  { day: 2, breakfast: ['Upma', 'Chutney', 'Tea'], lunch: ['Rice', 'Dal', 'Bhindi Masala', 'Curd'], dinner: ['Chapati', 'Paneer Curry', 'Dal'] },
  // Wednesday
  { day: 3, breakfast: ['Dosa', 'Sambar', 'Chutney'], lunch: ['Rice', 'Chole', 'Cabbage Sabzi', 'Raita'], dinner: ['Paratha', 'Mix Veg', 'Rice'] },
  // Thursday
  { day: 4, breakfast: ['Poha', 'Jalebi', 'Tea'], lunch: ['Rice', 'Dal', 'Aloo Gobi', 'Curd'], dinner: ['Chapati', 'Dal', 'Rice', 'Salad'] },
  // Friday
  { day: 5, breakfast: ['Idli', 'Sambar', 'Chutney'], lunch: ['Rice', 'Rajma', 'Palak Sabzi', 'Salad'], dinner: ['Paratha', 'Paneer Butter Masala', 'Rice'] },
  // Saturday
  { day: 6, breakfast: ['Upma', 'Banana', 'Tea'], lunch: ['Rice', 'Kadhi', 'Baingan Bharta', 'Curd'], dinner: ['Chapati', 'Chole', 'Rice', 'Raita'] },
];

exports.seedMessSchedules = async (req, res) => {
  try {
    const { hostelId } = req.params;
    const hostel = await Hostel.findById(hostelId);
    if (!hostel) return res.status(404).json({ success: false, message: 'Hostel not found' });
    const ownerIdStr = String(hostel.ownerId);
    const userIdStr = String(req.user.id || req.user._id);
    if (ownerIdStr !== userIdStr) {
      return res.status(403).json({ success: false, message: 'Not authorized for this hostel' });
    }
    await MessSchedule.deleteMany({ hostelId });
    const inserts = [];
    let order = 0;
    for (const dayPlan of MESS_SEED_WEEK) {
      inserts.push({
        hostelId,
        mealType: 'breakfast',
        title: 'Breakfast',
        items: dayPlan.breakfast,
        startTime: '07:00',
        endTime: '09:00',
        dayOfWeek: dayPlan.day,
        active: true,
        order: order++,
      });
      inserts.push({
        hostelId,
        mealType: 'lunch',
        title: 'Lunch',
        items: dayPlan.lunch,
        startTime: '12:00',
        endTime: '14:00',
        dayOfWeek: dayPlan.day,
        active: true,
        order: order++,
      });
      inserts.push({
        hostelId,
        mealType: 'dinner',
        title: 'Dinner',
        items: dayPlan.dinner,
        startTime: '19:00',
        endTime: '21:00',
        dayOfWeek: dayPlan.day,
        active: true,
        order: order++,
      });
    }
    const created = await MessSchedule.insertMany(inserts);
    res.status(201).json({ success: true, data: created, message: 'Weekly mess schedule seeded (Sun–Sat, 3 meals)' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get mess (food) feedback for owner's hostels – for dashboard
exports.getMessFeedback = async (req, res) => {
  try {
    const ownerId = req.user.id || req.user._id;
    const hostels = await Hostel.find({ ownerId }).select('_id').lean();
    const hostelIds = hostels.map((h) => h._id);
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const hostelIdQuery = req.query.hostelId
      ? { hostelId: req.query.hostelId }
      : { hostelId: { $in: hostelIds } };

    const list = await Complaint.find({
      complaintType: 'food',
      ...hostelIdQuery,
    })
      .populate('raisedBy', 'name')
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    res.status(200).json({ success: true, data: list });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============ LEAVE / OUTPASS (Owner) ============
exports.getLeaveRequests = async (req, res) => {
  try {
    const ownerId = req.user.id || req.user._id;
    const hostels = await Hostel.find({ ownerId }).select('_id').lean();
    const hostelIds = hostels.map((h) => h._id);
    const students = await User.find({ hostelId: { $in: hostelIds }, role: 'student' }).select('_id').lean();
    const studentIds = students.map((s) => s._id);
    const { hostelId, status } = req.query;
    const filter = { studentId: { $in: studentIds } };
    if (status) filter.status = status;
    let list = await Permission.find(filter)
      .populate('studentId', 'name email phone')
      .populate('approvedBy', 'name')
      .sort({ createdAt: -1 })
      .lean();
    if (hostelId) {
      const inHostel = await User.find({ hostelId, role: 'student' }).select('_id').lean();
      const ids = new Set(inHostel.map((u) => u._id.toString()));
      list = list.filter((p) => ids.has((p.studentId && p.studentId._id || p.studentId).toString()));
    }
    res.status(200).json({ success: true, data: list });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.approveLeaveRequest = async (req, res) => {
  try {
    const { permissionId } = req.params;
    const permission = await Permission.findById(permissionId).populate('studentId', 'hostelId pushToken expoPushToken');
    if (!permission) return res.status(404).json({ success: false, message: 'Leave request not found' });
    const ownerId = req.user.id || req.user._id;
    const hostel = await Hostel.findOne({ _id: permission.studentId.hostelId, ownerId });
    if (!hostel) return res.status(403).json({ success: false, message: 'Not authorized for this hostel' });
    permission.status = 'approved';
    permission.approvedBy = req.user.id;
    permission.approvedAt = new Date();
    await permission.save();

    const studentId = permission.studentId._id || permission.studentId;
    const title = 'Leave request approved';
    const message = `Your ${(permission.permissionType || 'leave').replace(/-/g, ' ')} request has been approved.`;
    await Notification.create({
      title,
      message,
      type: 'alert',
      targetAudience: 'staff', // so only recipients see it (not "all" students); recipient is the applicant only
      recipients: [studentId],
      createdBy: req.user.id,
      hostelId: permission.studentId.hostelId,
    });

    setImmediate(() => {
      const student = permission.studentId;
      sendLeaveRequestUpdateToStudent({
        pushToken: student.pushToken,
        expoPushToken: student.expoPushToken,
        approved: true,
        permissionType: permission.permissionType,
        requestedDate: permission.requestedDate ? new Date(permission.requestedDate).toISOString().slice(0, 10) : undefined,
        permissionId: permission._id.toString(),
      }).catch((e) => console.warn('Leave approved push failed:', e.message));
    });

    res.status(200).json({ success: true, data: permission });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.rejectLeaveRequest = async (req, res) => {
  try {
    const { permissionId } = req.params;
    const { rejectionReason } = req.body;
    const permission = await Permission.findById(permissionId).populate('studentId', 'hostelId pushToken expoPushToken');
    if (!permission) return res.status(404).json({ success: false, message: 'Leave request not found' });
    const ownerId = req.user.id || req.user._id;
    const hostel = await Hostel.findOne({ _id: permission.studentId.hostelId, ownerId });
    if (!hostel) return res.status(403).json({ success: false, message: 'Not authorized for this hostel' });
    permission.status = 'rejected';
    permission.approvedBy = req.user.id;
    permission.approvedAt = new Date();
    permission.rejectionReason = rejectionReason || '';
    await permission.save();

    const studentId = permission.studentId._id || permission.studentId;
    const reason = rejectionReason || '';
    const title = 'Leave request not approved';
    const message = `Your ${(permission.permissionType || 'leave').replace(/-/g, ' ')} request was not approved.${reason ? ` Reason: ${reason}` : ''}`;
    await Notification.create({
      title,
      message,
      type: 'alert',
      targetAudience: 'staff', // so only recipients see it (not "all" students); recipient is the applicant only
      recipients: [studentId],
      createdBy: req.user.id,
      hostelId: permission.studentId.hostelId,
    });

    setImmediate(() => {
      const student = permission.studentId;
      sendLeaveRequestUpdateToStudent({
        pushToken: student.pushToken,
        expoPushToken: student.expoPushToken,
        approved: false,
        permissionType: permission.permissionType,
        requestedDate: permission.requestedDate ? new Date(permission.requestedDate).toISOString().slice(0, 10) : undefined,
        rejectionReason: reason,
        permissionId: permission._id.toString(),
      }).catch((e) => console.warn('Leave rejected push failed:', e.message));
    });

    res.status(200).json({ success: true, data: permission });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============ MAINTENANCE / ROOM REQUESTS (Owner) ============
exports.getMaintenanceComplaints = async (req, res) => {
  try {
    const ownerId = req.user.id || req.user._id;
    const hostels = await Hostel.find({ ownerId }).select('_id').lean();
    const hostelIds = hostels.map((h) => h._id);
    const { hostelId, status } = req.query;
    const filter = { complaintType: 'maintenance', hostelId: hostelId ? hostelId : { $in: hostelIds } };
    if (status) filter.status = status;
    const list = await Complaint.find(filter)
      .populate('raisedBy', 'name phone')
      .populate('roomId', 'roomNumber')
      .sort({ createdAt: -1 })
      .lean();
    res.status(200).json({ success: true, data: list });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateComplaintStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, resolutionNotes } = req.body;
    const complaint = await Complaint.findById(id);
    if (!complaint) return res.status(404).json({ success: false, message: 'Complaint not found' });
    const hostel = await Hostel.findOne({ _id: complaint.hostelId, ownerId: req.user.id || req.user._id });
    if (!hostel) return res.status(403).json({ success: false, message: 'Not authorized' });
    complaint.status = status || complaint.status;
    if (resolutionNotes != null) complaint.resolutionNotes = resolutionNotes;
    if (status === 'resolved' || status === 'closed') complaint.resolvedAt = new Date();
    complaint.updatedAt = new Date();
    await complaint.save();
    res.status(200).json({ success: true, data: complaint });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============ QR CODE GENERATION ============

let QRCode;
try {
  QRCode = require('qrcode');
} catch (e) {
  console.warn('qrcode package not installed. QR features will not work.');
}
const jwt = require('jsonwebtoken');

/**
 * Generate a Registration Invite QR Code
 * Owner calls this to get a QR that encodes a signed invite URL.
 * Student scans → opens /register?invite=<token> → form pre-filled with hostelId + role locked to "student"
 * GET /api/owner/students/registration-invite-qr?hostelId=<id>
 */
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

    // Verify owner actually owns this hostel
    const hostel = await Hostel.findOne({ _id: hostelId, ownerId }).lean();
    if (!hostel) {
      return res.status(404).json({ success: false, message: 'Hostel not found or not owned by you' });
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
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get Student Identity QR Code
 * Returns a QR code encoding the student's identity for gate check-in scanning.
 * GET /api/owner/students/:id/qr
 */
exports.getStudentQR = async (req, res) => {
  try {
    if (!QRCode) {
      return res.status(503).json({ success: false, message: 'QR library not installed on server. Run: npm install qrcode' });
    }

    const ownerId = req.user._id || req.user.id;
    const student = await User.findById(req.params.id).select('name email phone studentId hostelId role status').lean();

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    // Verify this student belongs to a hostel owned by the requesting owner
    if (student.hostelId) {
      const hostel = await Hostel.findOne({ _id: student.hostelId, ownerId }).lean();
      if (!hostel) {
        return res.status(403).json({ success: false, message: 'Not authorized to access this student' });
      }
    }

    // QR payload — encode student identity data
    const qrPayload = JSON.stringify({
      userId: String(student._id),
      studentId: student.studentId || null,
      name: student.name,
      hostelId: student.hostelId ? String(student.hostelId) : null,
    });

    const qrDataUrl = await QRCode.toDataURL(qrPayload, {
      width: 300,
      margin: 2,
      color: { dark: '#1e3a5f', light: '#ffffff' },
    });

    res.status(200).json({
      success: true,
      data: {
        qrDataUrl,
        student: {
          id: String(student._id),
          name: student.name,
          email: student.email,
          studentId: student.studentId,
          status: student.status,
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};



