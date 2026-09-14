/**
 * @file controllers/owner/ownerHostelController.js
 * @description Owner hostel and block management controller.
 */

'use strict';

const mongoose = require('mongoose');
const Hostel = require('../../models/Hostel');
const Block = require('../../models/Block');
const User = require('../../models/User');
const {
  sanitizeHostelPayload,
  assertOwnsHostel,
  getOwnerHostelIds,
  getScopedHostelIds,
  checkSuperadmin,
  checkOwner,
} = require('./ownerHelper');
const { uploadImageToS3, uploadMultipleImagesToS3, deleteImageFromS3 } = require('../../utils/s3Upload');
const { geocodeAddress, getNearbyPlaces } = require('../../utils/googleMaps');

exports.createHostel = async (req, res) => {
  try {
    const ownerId = req.user._id || req.user.id;
    if (!ownerId) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    const hostelData = sanitizeHostelPayload(req.body);
    hostelData.ownerId = ownerId;

    // Geocode address if provided and coordinates not present
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

// Get All Hostels (Owners get only their hostels, Superadmin gets all)

exports.getHostels = async (req, res) => {
  try {
    const isSuperAdmin = req.user?.role === 'superadmin';
    const ownerId = req.user._id || req.user.id;
    if (!isSuperAdmin && !ownerId) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }
    const query = isSuperAdmin ? {} : { ownerId };
    const hostels = await Hostel.find(query).populate('ownerId', 'name email phone');
    res.status(200).json({ success: true, count: hostels.length, data: hostels });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get Single Hostel with full details

exports.getHostel = async (req, res) => {
  try {
    const isSuperAdmin = req.user?.role === 'superadmin';
    const ownerId = req.user._id || req.user.id;
    const hostel = await Hostel.findById(req.params.id)
      .populate('ownerId', 'name email phone');

    if (!hostel) {
      return res.status(404).json({ success: false, message: 'Hostel not found' });
    }

    // Security: owner can only access their own hostels (superadmin can access all)
    if (!isSuperAdmin && String(hostel.ownerId?._id || hostel.ownerId) !== String(ownerId)) {
      return res.status(403).json({ success: false, message: 'Not authorized to access this hostel' });
    }

    // Fetch blocks separately since Hostel doesn't have a blocks field
    const Block = require('../../models/Block');
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
    const ownerId = req.user._id || req.user.id;
    const hostel = await Hostel.findById(req.params.id);
    if (!hostel) {
      return res.status(404).json({ success: false, message: 'Hostel not found' });
    }
    const isSuperAdmin = req.user?.role === 'superadmin';
    // Security: owner can only modify their own hostels (superadmin can modify all)
    if (!isSuperAdmin && String(hostel.ownerId) !== String(ownerId)) {
      return res.status(403).json({ success: false, message: 'Not authorized to modify this hostel' });
    }

    const cleanData = sanitizeHostelPayload(req.body);

    // Update basic fields
    const fieldsToUpdate = ['name', 'description', 'shortDescription', 'capacity',
      'totalRooms', 'totalBlocks', 'totalFloors', 'status', 'isVerified'];

    fieldsToUpdate.forEach(field => {
      if (cleanData[field] !== undefined) hostel[field] = cleanData[field];
    });

    const validTypes = ['boys', 'girls', 'co-ed'];
    if (cleanData.type && validTypes.includes(cleanData.type)) {
      hostel.type = cleanData.type;
    }

    // Update nested objects safely by merging with plain object representation
    const nestedSections = ['contact', 'pricing', 'operatingHours', 'amenities', 'facilities', 'rules', 'businessInfo'];
    nestedSections.forEach(sec => {
      if (cleanData[sec]) {
        const current = hostel[sec]?.toObject ? hostel[sec].toObject() : (hostel[sec] || {});
        hostel.set(sec, { ...current, ...cleanData[sec] });
      }
    });

    if (cleanData.highlights !== undefined) hostel.highlights = cleanData.highlights;
    if (cleanData.tags !== undefined) hostel.tags = cleanData.tags;

    // Handle Address Update
    if (cleanData.address) {
      const incoming = { ...cleanData.address };
      const currentAddr = hostel.address?.toObject ? hostel.address.toObject() : (hostel.address || {});
      const newAddress = { ...currentAddr, ...incoming };

      // Ensure valid coordinates
      if (
        !newAddress.coordinates ||
        typeof newAddress.coordinates.latitude !== 'number' ||
        typeof newAddress.coordinates.longitude !== 'number'
      ) {
        delete newAddress.coordinates;
        if (currentAddr.coordinates?.latitude != null && currentAddr.coordinates?.longitude != null) {
          newAddress.coordinates = currentAddr.coordinates;
        } else {
          // Try geocoding if we still don't have valid coordinates
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
              if (geocodeResult) {
                newAddress.coordinates = {
                  latitude: geocodeResult.latitude,
                  longitude: geocodeResult.longitude,
                };
                newAddress.formattedAddress = geocodeResult.formattedAddress;
                newAddress.placeId = geocodeResult.placeId;
              }
            }
          } catch (error) {
            console.error('Geocoding error during update:', error);
          }
        }
      }
      hostel.set('address', newAddress);
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
    const isSuperAdmin = req.user?.role === 'superadmin';
    const ownerId = req.user?._id || req.user?.id;
    if (!isSuperAdmin && String(hostel.ownerId) !== String(ownerId)) {
      return res.status(403).json({ success: false, message: 'Not authorized to modify this hostel' });
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
    const isSuperAdmin = req.user?.role === 'superadmin';
    const ownerId = req.user?._id || req.user?.id;
    if (!isSuperAdmin && String(hostel.ownerId) !== String(ownerId)) {
      return res.status(403).json({ success: false, message: 'Not authorized to modify this hostel' });
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
    const ownerId = req.user._id || req.user.id;
    if (String(hostel.ownerId) !== String(ownerId)) {
      return res.status(403).json({ success: false, message: 'Not authorized to modify this hostel' });
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
    const ownerId = req.user._id || req.user.id;
    const hostel = await Hostel.findById(req.params.id);
    if (!hostel) {
      return res.status(404).json({ success: false, message: 'Hostel not found' });
    }
    const isSuperAdmin = req.user?.role === 'superadmin';
    if (!isSuperAdmin && String(hostel.ownerId) !== String(ownerId)) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this hostel' });
    }

    const hostelId = req.params.id;

    // Cascade delete associated records
    await Promise.all([
      Hostel.findByIdAndDelete(hostelId),
      Block.deleteMany({ hostelId }),
      Room.deleteMany({ hostelId }),
      Amenity.deleteMany({ hostelId }),
      Rule.deleteMany({ hostelId }),
      GeoFence.deleteMany({ hostelId }),
      // Unassign students from this hostel so they don't have dangling references
      User.updateMany({ hostelId }, { $unset: { hostelId: 1, roomNumber: 1, room: 1 } }),
    ]);

    res.status(200).json({ success: true, message: 'Hostel and associated records deleted successfully' });
  } catch (error) {
    console.error('Delete Hostel Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Create Block

exports.createBlock = async (req, res) => {
  try {
    const { name, hostelId, floors } = req.body;
    if (!name || !hostelId) {
      return res.status(400).json({ success: false, message: 'Block name and hostelId are required' });
    }
    await assertOwnsHostel(req, hostelId);
    const blockData = {
      name: String(name).trim().slice(0, 100),
      hostelId,
      floors: Array.isArray(floors) ? floors : [],
    };
    const block = await Block.create(blockData);
    res.status(201).json({ success: true, data: block });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// Get Blocks

exports.getBlocks = async (req, res) => {
  try {
    await assertOwnsHostel(req, req.params.hostelId);
    const blocks = await Block.find({ hostelId: req.params.hostelId })
      .populate('hostelId')
      .populate('floors.rooms');
    res.status(200).json({ success: true, data: blocks });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// Create Room

exports.updateHostelAmenities = async (req, res) => {
  try {
    await assertOwnsHostel(req, req.params.id);
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
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};


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