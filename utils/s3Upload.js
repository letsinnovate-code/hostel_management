const AWS = require('aws-sdk');
const multer = require('multer');
const path = require('path');

// Configure AWS S3
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'us-east-1',
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME;

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  },
});

// Upload single image to S3
const uploadImageToS3 = async (file, folder = 'hostels') => {
  try {
    if (!file) {
      throw new Error('No file provided');
    }

    const fileExtension = path.extname(file.originalname);
    const fileName = `${folder}/${Date.now()}-${Math.round(Math.random() * 1e9)}${fileExtension}`;

    const params = {
      Bucket: BUCKET_NAME,
      Key: fileName,
      Body: file.buffer,
      ContentType: file.mimetype,
      // ACL removed - bucket should have public read policy instead
    };

    const result = await s3.upload(params).promise();
    return result.Location; // Returns the public URL
  } catch (error) {
    console.error('S3 Upload Error:', error);
    throw new Error(`Failed to upload image: ${error.message}`);
  }
};

// Upload multiple images to S3
const uploadMultipleImagesToS3 = async (files, folder = 'hostels') => {
  try {
    if (!files || files.length === 0) {
      throw new Error('No files provided');
    }

    const uploadPromises = files.map((file) => uploadImageToS3(file, folder));
    const urls = await Promise.all(uploadPromises);
    return urls;
  } catch (error) {
    console.error('S3 Multiple Upload Error:', error);
    throw new Error(`Failed to upload images: ${error.message}`);
  }
};

// Delete image from S3
const deleteImageFromS3 = async (imageUrl) => {
  try {
    if (!imageUrl) return;

    // Extract key from URL
    const urlParts = imageUrl.split('/');
    const key = urlParts.slice(-2).join('/'); // Get last two parts (folder/filename)

    const params = {
      Bucket: BUCKET_NAME,
      Key: key,
    };

    await s3.deleteObject(params).promise();
    return true;
  } catch (error) {
    console.error('S3 Delete Error:', error);
    // Don't throw error, just log it
    return false;
  }
};

module.exports = {
  upload,
  uploadImageToS3,
  uploadMultipleImagesToS3,
  deleteImageFromS3,
};

