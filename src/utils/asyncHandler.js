/**
 * @file asyncHandler.js
 * @description Express async handler wrapper.
 *
 * Wraps async route handlers so that rejected promises are automatically
 * forwarded to Express's global error handler (next(err)).
 *
 * This eliminates the need for repetitive try/catch blocks in every
 * controller function, and ensures all errors flow through the centralized
 * error middleware in server.js.
 *
 * Usage:
 *   const asyncHandler = require('../utils/asyncHandler');
 *   exports.getUsers = asyncHandler(async (req, res) => { ... });
 */

'use strict';

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

module.exports = asyncHandler;
