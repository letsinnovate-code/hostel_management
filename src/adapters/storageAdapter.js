/**
 * @file adapters/storageAdapter.js
 * @description Infrastructure adapter decoupling direct AWS S3 SDK usage from business logic.
 */

'use strict';

const s3Utils = require('../utils/s3Upload');

class StorageAdapter {
  /**
   * Upload single image buffer to storage
   */
  static async uploadImage(file, folder = 'hostels') {
    return await s3Utils.uploadImageToS3(file, folder);
  }

  /**
   * Upload multiple image buffers to storage
   */
  static async uploadMultipleImages(files, folder = 'hostels') {
    return await s3Utils.uploadMultipleImagesToS3(files, folder);
  }

  /**
   * Delete image from storage by URL
   */
  static async deleteImage(fileUrl) {
    return await s3Utils.deleteImageFromS3(fileUrl);
  }
}

module.exports = StorageAdapter;
