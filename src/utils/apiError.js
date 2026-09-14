/**
 * @file utils/apiError.js
 * @description Standardized application error class and HTTP response formatter.
 *
 * Ensures:
 * 1. Database internals (collection names, field casts, BSON query internals) are NEVER exposed.
 * 2. Safe, consistent client error responses with machine-readable codes.
 * 3. Server-side logging with timestamps, stack traces, and request context.
 * 4. Correct HTTP status codes (400, 401, 403, 404, 409, 500).
 */

'use strict';

class AppError extends Error {
  /**
   * @param {string} message - Human-readable, safe error message.
   * @param {number} [statusCode=500] - HTTP status code.
   * @param {string} [code='INTERNAL_SERVER_ERROR'] - Machine-readable error code.
   * @param {Array|Object} [details] - Optional validation or contextual details.
   */
  constructor(message, statusCode = 500, code = 'INTERNAL_SERVER_ERROR', details = undefined) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Standardized error sender for Express controllers.
 * Handles known Mongoose/MongoDB errors, operational AppErrors, and unexpected system errors.
 *
 * @param {import('express').Response} res - Express response object
 * @param {Error|AppError|any} error - Caught error
 * @param {string} [defaultMessage='An unexpected error occurred'] - Fallback safe message
 */
function sendErrorResponse(res, error, defaultMessage = 'An unexpected error occurred') {
  const timestamp = new Date().toISOString();

  // Log error on the server
  console.error(`[${timestamp}] [API Error]:`, {
    name: error?.name,
    code: error?.code,
    statusCode: error?.statusCode,
    message: error?.message,
    stack: process.env.NODE_ENV === 'production' ? undefined : error?.stack,
  });

  // 1. Operational AppError (already sanitized by application code)
  if (error instanceof AppError || (error?.isOperational && error?.statusCode)) {
    return res.status(error.statusCode).json({
      success: false,
      code: error.code || (error.statusCode === 404 ? 'RESOURCE_NOT_FOUND' : 'REQUEST_ERROR'),
      message: error.message,
      ...(error.details ? { details: error.details } : {}),
    });
  }

  // 2. Mongoose CastError (invalid ObjectId or type casting)
  if (error?.name === 'CastError') {
    return res.status(400).json({
      success: false,
      code: 'INVALID_IDENTIFIER',
      message: `Invalid format provided for ${error.path || 'identifier'}`,
    });
  }

  // 3. MongoDB Duplicate Key (11000)
  if (error?.code === 11000 || (error?.name === 'MongoServerError' && error?.code === 11000)) {
    const field = error.keyValue ? Object.keys(error.keyValue)[0] : 'resource';
    return res.status(409).json({
      success: false,
      code: 'DUPLICATE_RESOURCE',
      message: `A record with this ${field} already exists.`,
    });
  }

  // 4. Mongoose Schema Validation Error
  if (error?.name === 'ValidationError' && error?.errors) {
    const errorDetails = Object.values(error.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
    return res.status(400).json({
      success: false,
      code: 'VALIDATION_ERROR',
      message: 'Validation failed for one or more fields.',
      errors: errorDetails,
    });
  }

  // 5. Express-Validator or Client 4xx errors
  if (error?.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
    return res.status(error.statusCode).json({
      success: false,
      code: error.code || 'BAD_REQUEST',
      message: error.message || defaultMessage,
    });
  }

  // 6. Unexpected 500 or Unhandled Database Failures
  // NEVER leak database internals or unformatted driver messages in production
  const safeMessage = process.env.NODE_ENV === 'production'
    ? 'Internal server error'
    : (error?.message || defaultMessage);

  return res.status(500).json({
    success: false,
    code: 'INTERNAL_SERVER_ERROR',
    message: safeMessage,
  });
}

module.exports = {
  AppError,
  sendErrorResponse,
};
