/**
 * @file uploadValidation.js
 * @description Hardened file upload middleware factory with MIME, extension, and magic-byte binary verification.
 * Prevents Unrestricted File Upload, Denial of Service (DoS), and MIME spoofing.
 */

'use strict';

const multer = require('multer');
const path = require('path');

// Supported signatures
const MAGIC_BYTES = {
  JPEG: [0xff, 0xd8, 0xff],
  PNG: [0x89, 0x50, 0x4e, 0x47],
  PDF: [0x25, 0x50, 0x44, 0x46], // %PDF
  WEBP_RIFF: [0x52, 0x49, 0x46, 0x46], // RIFF
  WEBP_WEBP: [0x57, 0x45, 0x42, 0x50], // WEBP
  GIF: [0x47, 0x49, 0x46],
};

/**
 * Checks if buffer matches known magic bytes for claimed type
 * @param {Buffer} buffer
 * @param {string} mimetype
 * @param {string} extname
 * @returns {boolean}
 */
function verifyFileSignature(buffer, mimetype, extname) {
  if (!buffer || buffer.length < 4) return false;

  const mime = mimetype.toLowerCase();
  const ext = extname.toLowerCase();

  // JPEG
  if (mime === 'image/jpeg' || ext === '.jpg' || ext === '.jpeg') {
    return (
      buffer[0] === MAGIC_BYTES.JPEG[0] &&
      buffer[1] === MAGIC_BYTES.JPEG[1] &&
      buffer[2] === MAGIC_BYTES.JPEG[2]
    );
  }

  // PNG
  if (mime === 'image/png' || ext === '.png') {
    return (
      buffer[0] === MAGIC_BYTES.PNG[0] &&
      buffer[1] === MAGIC_BYTES.PNG[1] &&
      buffer[2] === MAGIC_BYTES.PNG[2] &&
      buffer[3] === MAGIC_BYTES.PNG[3]
    );
  }

  // PDF
  if (mime === 'application/pdf' || ext === '.pdf') {
    return (
      buffer[0] === MAGIC_BYTES.PDF[0] &&
      buffer[1] === MAGIC_BYTES.PDF[1] &&
      buffer[2] === MAGIC_BYTES.PDF[2] &&
      buffer[3] === MAGIC_BYTES.PDF[3]
    );
  }

  // WEBP
  if (mime === 'image/webp' || ext === '.webp') {
    const isRiff =
      buffer[0] === MAGIC_BYTES.WEBP_RIFF[0] &&
      buffer[1] === MAGIC_BYTES.WEBP_RIFF[1] &&
      buffer[2] === MAGIC_BYTES.WEBP_RIFF[2] &&
      buffer[3] === MAGIC_BYTES.WEBP_RIFF[3];
    if (!isRiff || buffer.length < 12) return false;
    return (
      buffer[8] === MAGIC_BYTES.WEBP_WEBP[0] &&
      buffer[9] === MAGIC_BYTES.WEBP_WEBP[1] &&
      buffer[10] === MAGIC_BYTES.WEBP_WEBP[2] &&
      buffer[11] === MAGIC_BYTES.WEBP_WEBP[3]
    );
  }

  // GIF
  if (mime === 'image/gif' || ext === '.gif') {
    return (
      buffer[0] === MAGIC_BYTES.GIF[0] &&
      buffer[1] === MAGIC_BYTES.GIF[1] &&
      buffer[2] === MAGIC_BYTES.GIF[2]
    );
  }

  // Excel (.xlsx / .xls)
  if (
    mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mime === 'application/vnd.ms-excel' ||
    ext === '.xlsx' ||
    ext === '.xls' ||
    ext === '.csv'
  ) {
    if (ext === '.csv') return true; // CSV is plain text
    // XLSX is a ZIP archive beginning with PK (0x50, 0x4B, 0x03, 0x04)
    if (ext === '.xlsx') {
      return buffer[0] === 0x50 && buffer[1] === 0x4b;
    }
    // OLE compound document (0xD0, 0xCF, 0x11, 0xE0)
    if (ext === '.xls') {
      return buffer[0] === 0xd0 && buffer[1] === 0xcf;
    }
    return true;
  }

  return false;
}

/**
 * Creates a hardened upload middleware
 * @param {Object} options
 * @param {string[]} [options.allowedTypes=['image', 'pdf']]
 * @param {number} [options.maxFileSize=5 * 1024 * 1024] - 5MB default
 * @param {number} [options.maxFiles=5]
 * @returns {Object} { uploadSingle, uploadArray, verifyMagicBytes }
 */
function createUploadMiddleware(options = {}) {
  const {
    allowedTypes = ['image', 'pdf'],
    maxFileSize = 5 * 1024 * 1024,
    maxFiles = 5,
  } = options;

  const mimeMap = {
    image: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    pdf: ['application/pdf'],
    excel: [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
    ],
  };

  const extMap = {
    image: ['.jpg', '.jpeg', '.png', '.webp', '.gif'],
    pdf: ['.pdf'],
    excel: ['.xlsx', '.xls', '.csv'],
  };

  const allowedMimes = allowedTypes.flatMap((t) => mimeMap[t] || []);
  const allowedExts = allowedTypes.flatMap((t) => extMap[t] || []);

  const storage = multer.memoryStorage();

  const multerInstance = multer({
    storage,
    limits: {
      fileSize: maxFileSize,
      files: maxFiles,
    },
    fileFilter: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const mime = (file.mimetype || '').toLowerCase();

      if (!allowedExts.includes(ext) || !allowedMimes.includes(mime)) {
        const err = new Error(`Invalid file type. Allowed extensions: ${allowedExts.join(', ')}`);
        err.code = 'INVALID_FILE_TYPE';
        return cb(err, false);
      }

      cb(null, true);
    },
  });

  // Post-upload inspection to verify magic bytes
  const verifyMagicBytesMiddleware = (req, res, next) => {
    const filesToInspect = [];
    if (req.file) filesToInspect.push(req.file);
    if (Array.isArray(req.files)) filesToInspect.push(...req.files);
    if (req.files && typeof req.files === 'object' && !Array.isArray(req.files)) {
      Object.values(req.files).forEach((arr) => {
        if (Array.isArray(arr)) filesToInspect.push(...arr);
      });
    }

    for (const file of filesToInspect) {
      if (!file.buffer) continue;
      const ext = path.extname(file.originalname).toLowerCase();
      const isValid = verifyFileSignature(file.buffer, file.mimetype, ext);

      if (!isValid) {
        return res.status(400).json({
          success: false,
          code: 'CORRUPTED_OR_SPOOFED_FILE',
          message: `File content for "${file.originalname}" does not match claimed file type (${file.mimetype}). Upload rejected.`,
        });
      }
    }

    next();
  };

  // Wrapper middleware with clean error handling
  const wrapMulter = (multerHandler) => (req, res, next) => {
    multerHandler(req, res, (err) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({
            success: false,
            code: 'FILE_TOO_LARGE',
            message: `File size exceeds the limit of ${Math.round(maxFileSize / (1024 * 1024))}MB.`,
          });
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
          return res.status(400).json({
            success: false,
            code: 'TOO_MANY_FILES',
            message: `Too many files uploaded. Maximum allowed is ${maxFiles}.`,
          });
        }
        return res.status(400).json({
          success: false,
          code: err.code || 'FILE_UPLOAD_ERROR',
          message: err.message || 'File upload failed',
        });
      }

      verifyMagicBytesMiddleware(req, res, next);
    });
  };

  return {
    single: (fieldName) => wrapMulter(multerInstance.single(fieldName)),
    array: (fieldName, count = maxFiles) => wrapMulter(multerInstance.array(fieldName, count)),
    fields: (fieldsArray) => wrapMulter(multerInstance.fields(fieldsArray)),
  };
}

module.exports = {
  createUploadMiddleware,
  verifyFileSignature,
  MAGIC_BYTES,
};
