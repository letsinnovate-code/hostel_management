/**
 * @file validator.js
 * @description Centralized, reusable validation middleware suite using express-validator.
 * Provides standardized ObjectId, query, body, pagination, email, phone, and error handling.
 */

'use strict';

const mongoose = require('mongoose');
const { body, param, query, validationResult } = require('express-validator');

// ─────────────────────────────────────────────
// HELPER: Validate MongoDB ObjectId
// ─────────────────────────────────────────────
const isValidObjectId = (value) => {
  if (value == null) return false;
  return mongoose.Types.ObjectId.isValid(String(value)) && String(new mongoose.Types.ObjectId(String(value))) === String(value);
};

// ─────────────────────────────────────────────
// MIDDLEWARE: Process validation results
// Standardized JSON response: { success: false, code: 'VALIDATION_ERROR', message, errors }
// ─────────────────────────────────────────────
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map((e) => ({
      field: e.path || e.param,
      message: e.msg,
      value: e.value !== undefined && typeof e.value !== 'object' ? String(e.value) : undefined,
    }));

    return res.status(400).json({
      success: false,
      code: 'VALIDATION_ERROR',
      message: formattedErrors[0]?.message || 'Validation failed',
      errors: formattedErrors,
    });
  }
  next();
};

// ─────────────────────────────────────────────
// REUSABLE: Route Parameter ObjectId Validator
// ─────────────────────────────────────────────
const validateObjectId = (paramNames, location = 'param') => {
  const names = Array.isArray(paramNames) ? paramNames : [paramNames];
  const target = location === 'query' ? query : location === 'body' ? body : param;

  return [
    ...names.map((name) =>
      target(name)
        .notEmpty()
        .withMessage(`${name} is required`)
        .custom(isValidObjectId)
        .withMessage(`${name} must be a valid MongoDB ObjectId`)
    ),
    handleValidationErrors,
  ];
};

const validateOptionalObjectId = (paramNames, location = 'query') => {
  const names = Array.isArray(paramNames) ? paramNames : [paramNames];
  const target = location === 'query' ? query : location === 'body' ? body : param;

  return [
    ...names.map((name) =>
      target(name)
        .optional({ checkFalsy: true })
        .custom(isValidObjectId)
        .withMessage(`${name} must be a valid MongoDB ObjectId`)
    ),
    handleValidationErrors,
  ];
};

// ─────────────────────────────────────────────
// REUSABLE: Pagination Query Params
// ─────────────────────────────────────────────
const validatePagination = [
  query('page')
    .optional({ checkFalsy: true })
    .isInt({ min: 1, max: 10000 })
    .withMessage('page must be a positive integer (max 10000)')
    .toInt(),
  query('limit')
    .optional({ checkFalsy: true })
    .isInt({ min: 1, max: 200 })
    .withMessage('limit must be an integer between 1 and 200')
    .toInt(),
  handleValidationErrors,
];

// ─────────────────────────────────────────────
// REUSABLE: Email and Phone Validators
// ─────────────────────────────────────────────
const rfcEmailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
const phoneRegex = /^[+]?[0-9]{10,15}$/;

const validateEmail = (fieldName = 'email') =>
  body(fieldName)
    .trim()
    .notEmpty()
    .withMessage(`${fieldName} is required`)
    .matches(rfcEmailRegex)
    .withMessage(`${fieldName} must be a valid email address`)
    .normalizeEmail({ gmail_remove_dots: false });

const validatePhone = (fieldName = 'phone') =>
  body(fieldName)
    .trim()
    .notEmpty()
    .withMessage(`${fieldName} is required`)
    .custom((val) => {
      const cleaned = String(val).replace(/[\s-()]/g, '');
      return phoneRegex.test(cleaned);
    })
    .withMessage(`${fieldName} must be a valid phone number with 10 to 15 digits`);

const validatePassword = (fieldName = 'password', minLength = 8) =>
  body(fieldName)
    .isString()
    .withMessage(`${fieldName} must be a string`)
    .isLength({ min: minLength, max: 128 })
    .withMessage(`${fieldName} must be between ${minLength} and 128 characters`);

// ─────────────────────────────────────────────
// REUSABLE: Bounded String Validator
// ─────────────────────────────────────────────
const validateBoundedString = (fieldName, { min = 1, max = 2000, required = true, fieldType = 'body' } = {}) => {
  const target = fieldType === 'query' ? query : fieldType === 'param' ? param : body;
  let chain = target(fieldName).trim();

  if (required) {
    chain = chain.notEmpty().withMessage(`${fieldName} is required`);
  } else {
    chain = chain.optional({ checkFalsy: true });
  }

  return chain
    .isString()
    .withMessage(`${fieldName} must be a string`)
    .isLength({ min, max })
    .withMessage(`${fieldName} length must be between ${min} and ${max} characters`);
};

// ─────────────────────────────────────────────
// REUSABLE: Date & Temporal Validators
// ─────────────────────────────────────────────
const validateDate = (fieldName, { required = true } = {}) => {
  let chain = body(fieldName);
  if (required) {
    chain = chain.notEmpty().withMessage(`${fieldName} is required`);
  } else {
    chain = chain.optional({ checkFalsy: true });
  }
  return chain
    .isISO8601()
    .withMessage(`${fieldName} must be a valid ISO 8601 date`)
    .toDate();
};

module.exports = {
  isValidObjectId,
  handleValidationErrors,
  validateObjectId,
  validateOptionalObjectId,
  validatePagination,
  validateEmail,
  validatePhone,
  validatePassword,
  validateBoundedString,
  validateDate,
  rfcEmailRegex,
  phoneRegex,
};
