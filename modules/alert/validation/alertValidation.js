
'use strict';

const { body, query, param, validationResult } = require('express-validator');
const mongoose = require('mongoose');

// ─────────────────────────────────────────────
// HELPER: Validate MongoDB ObjectId
// ─────────────────────────────────────────────
const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

// ─────────────────────────────────────────────
// MIDDLEWARE: Process validation results
// Returns a consistent error response if validation failed.
// ─────────────────────────────────────────────
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map((e) => ({
      field: e.path || e.param,
      message: e.msg,
    }));
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: formattedErrors,
    });
  }
  next();
};

// ─────────────────────────────────────────────
// REUSABLE: Pagination params
// ─────────────────────────────────────────────
const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('page must be a positive integer (max 1000)')
    .toInt(),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('limit must be between 1 and 100')
    .toInt(),
];

// ─────────────────────────────────────────────
// REUSABLE: hostelId query param (optional)
// ─────────────────────────────────────────────
const validateHostelIdQuery = [
  query('hostelId')
    .optional()
    .custom(isValidObjectId)
    .withMessage('hostelId must be a valid MongoDB ObjectId'),
];

// ─────────────────────────────────────────────
// REUSABLE: MongoDB ObjectId route param
// ─────────────────────────────────────────────
const validateObjectIdParam = (paramName = 'id') => [
  param(paramName)
    .custom(isValidObjectId)
    .withMessage(`${paramName} must be a valid MongoDB ObjectId`),
];

// ─────────────────────────────────────────────
// GET notifications (with filters)
// ─────────────────────────────────────────────
const validateGetNotifications = [
  ...validatePagination,
  ...validateHostelIdQuery,
  query('category')
    .optional()
    .isIn([
      'attendance', 'checkin', 'checkout', 'leave', 'curfew',
      'emergency', 'security', 'hostel_operations', 'maintenance',
      'announcement', 'discipline', 'occupancy',
    ])
    .withMessage('Invalid category value'),
  query('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'urgent', 'critical'])
    .withMessage('Invalid priority value'),
  query('status')
    .optional()
    .isIn(['unread', 'read', 'resolved', 'dismissed'])
    .withMessage('Invalid status value'),
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('startDate must be a valid ISO 8601 date')
    .toDate(),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('endDate must be a valid ISO 8601 date')
    .toDate(),
  query('search')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 200 })
    .withMessage('search query too long (max 200 chars)')
    .escape(),
  query('sortBy')
    .optional()
    .isIn(['createdAt', 'priority', 'status', 'category'])
    .withMessage('Invalid sortBy value'),
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('sortOrder must be asc or desc'),
];

// ─────────────────────────────────────────────
// GET curfew violations (with filters)
// ─────────────────────────────────────────────
const validateGetCurfewViolations = [
  ...validatePagination,
  ...validateHostelIdQuery,
  query('status')
    .optional()
    .isIn(['open', 'acknowledged', 'resolved', 'false_positive', 'pending_recheck', 'all'])
    .withMessage('Invalid curfew violation status'),
  query('date')
    .optional()
    .isISO8601()
    .withMessage('date must be a valid ISO 8601 date')
    .toDate(),
  query('studentId')
    .optional()
    .custom(isValidObjectId)
    .withMessage('studentId must be a valid MongoDB ObjectId'),
];

// ─────────────────────────────────────────────
// GET leave violations (with filters)
// ─────────────────────────────────────────────
const validateGetLeaveViolations = [
  ...validatePagination,
  ...validateHostelIdQuery,
  query('status')
    .optional()
    .isIn(['open', 'returned', 'escalated', 'resolved', 'false_positive'])
    .withMessage('Invalid leave violation status'),
];

// ─────────────────────────────────────────────
// POST resolve alert
// ─────────────────────────────────────────────
const validateResolveAlert = [
  ...validateObjectIdParam('id'),
  body('resolutionNote')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('resolutionNote must be a string (max 1000 chars)'),
];

// ─────────────────────────────────────────────
// POST emergency broadcast
// ─────────────────────────────────────────────
const validateEmergencyBroadcast = [
  body('emergencyType')
    .isIn(['fire', 'medical', 'security', 'natural_disaster', 'evacuation', 'other'])
    .withMessage('emergencyType must be one of: fire, medical, security, natural_disaster, evacuation, other'),
  body('title')
    .isString()
    .trim()
    .notEmpty()
    .isLength({ min: 3, max: 200 })
    .withMessage('title is required (3-200 chars)'),
  body('message')
    .isString()
    .trim()
    .notEmpty()
    .isLength({ min: 10, max: 2000 })
    .withMessage('message is required (10-2000 chars)'),
  body('hostelId')
    .custom(isValidObjectId)
    .withMessage('hostelId must be a valid MongoDB ObjectId'),
  body('scope')
    .optional()
    .isIn(['hostel', 'staff', 'students', 'floor'])
    .withMessage('scope must be one of: hostel, staff, students, floor'),
  body('floorNumber')
    .optional()
    .isInt({ min: 0, max: 100 })
    .withMessage('floorNumber must be an integer between 0 and 100')
    .toInt(),
];

// ─────────────────────────────────────────────
// PUT resolve curfew violation
// ─────────────────────────────────────────────
const validateResolveCurfewViolation = [
  ...validateObjectIdParam('id'),
  body('status')
    .isIn(['acknowledged', 'resolved', 'false_positive'])
    .withMessage('status must be acknowledged, resolved, or false_positive'),
  body('resolutionNote')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('resolutionNote max 1000 chars'),
];

module.exports = {
  handleValidationErrors,
  validatePagination,
  validateHostelIdQuery,
  validateObjectIdParam,
  validateGetNotifications,
  validateGetCurfewViolations,
  validateGetLeaveViolations,
  validateResolveAlert,
  validateEmergencyBroadcast,
  validateResolveCurfewViolation,
};
