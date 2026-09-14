/**
 * @file controllers/owner/ownerAmenityController.js
 * @description Owner amenity management controller.
 */

'use strict';

const mongoose = require('mongoose');
const Amenity = require('../../models/Amenity');
const { assertOwnsHostel, getOwnerHostelIds, getScopedHostelIds } = require('./ownerHelper');
const { uploadImageToS3, uploadMultipleImagesToS3, deleteImageFromS3 } = require('../../utils/s3Upload');

exports.createAmenity = async (req, res) => {
  try {
    const { name, hostelId, category, description, isAvailable, quantity, availableQuantity, unit, cost, costType, details, images } = req.body;
    if (!hostelId || !name || !category) {
      return res.status(400).json({ success: false, message: 'Hostel ID, name, and category are required' });
    }
    await assertOwnsHostel(req, hostelId);
    const validCategories = ['wifi', 'laundry', 'mess', 'parking', 'gym', 'library', 'common-room', 'tv-room', 'study-room', 'security', 'medical', 'sports', 'other'];
    const finalCategory = validCategories.includes(category) ? category : 'other';

    const amenityData = {
      name: String(name).trim().slice(0, 100),
      hostelId,
      category: finalCategory,
      description: description ? String(description).trim().slice(0, 2000) : undefined,
      isAvailable: isAvailable !== undefined ? Boolean(isAvailable) : true,
      quantity: quantity !== undefined ? Number(quantity) : 1,
      availableQuantity: availableQuantity !== undefined ? Number(availableQuantity) : 1,
      unit: ['unit', 'piece', 'room', 'machine', 'slot', 'other'].includes(unit) ? unit : 'unit',
      cost: cost !== undefined ? Number(cost) : 0,
      costType: ['free', 'monthly', 'per-use', 'one-time'].includes(costType) ? costType : 'free',
      details: typeof details === 'object' ? details : {},
      images: Array.isArray(images) ? images.map(String).slice(0, 10) : [],
    };
    const amenity = await Amenity.create(amenityData);
    res.status(201).json({ success: true, data: amenity });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// Get Amenities

exports.getAmenities = async (req, res) => {
  try {
    const { hostelId, category, isAvailable } = req.query;
    const filter = {};

    // Security: scope amenities to owner's hostels
    const scopedHostelIds = await getScopedHostelIds(req, hostelId);
    if (scopedHostelIds.length === 0) {
      return res.status(200).json({ success: true, count: 0, data: [] });
    }
    filter.hostelId = { $in: scopedHostelIds };
    if (category) filter.category = category;
    if (isAvailable !== undefined) filter.isAvailable = isAvailable === 'true';

    const amenities = await Amenity.find(filter).populate('hostelId', 'name');
    res.status(200).json({ success: true, count: amenities.length, data: amenities });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// Get Single Amenity

exports.getAmenity = async (req, res) => {
  try {
    const amenity = await Amenity.findById(req.params.id).populate('hostelId', 'name');
    if (!amenity) {
      return res.status(404).json({ success: false, message: 'Amenity not found' });
    }
    if (amenity.hostelId) {
      await assertOwnsHostel(req, amenity.hostelId._id || amenity.hostelId);
    }
    res.status(200).json({ success: true, data: amenity });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// Update Amenity

exports.updateAmenity = async (req, res) => {
  try {
    const existing = await Amenity.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Amenity not found' });
    }
    if (existing.hostelId) {
      await assertOwnsHostel(req, existing.hostelId);
    }
    if (req.body.hostelId) {
      await assertOwnsHostel(req, req.body.hostelId);
    }
    const amenity = await Amenity.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    }).populate('hostelId', 'name');
    res.status(200).json({ success: true, data: amenity });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// Delete Amenity

exports.deleteAmenity = async (req, res) => {
  try {
    const amenity = await Amenity.findById(req.params.id);
    if (!amenity) {
      return res.status(404).json({ success: false, message: 'Amenity not found' });
    }
    if (amenity.hostelId) {
      await assertOwnsHostel(req, amenity.hostelId);
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
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
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
    if (amenity.hostelId) {
      await assertOwnsHostel(req, amenity.hostelId);
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
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
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
    if (amenity.hostelId) {
      await assertOwnsHostel(req, amenity.hostelId);
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
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// ============ RULE ENGINE ============

// Create Rule (Updates Hostel Rules)