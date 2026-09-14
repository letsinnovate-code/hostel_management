/**
 * @file tests/securityAndError.test.js
 * @description Phase 8 Test Suite: Security, JWT Invalidation, Revocation, Error Handling, and Data Integrity.
 */

'use strict';

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const { connectTestDB, clearTestDB, closeTestDB, createTestUser } = require('./setup');
const app = require('../server');
const generateToken = require('../src/utils/generateToken');
const { sendErrorResponse, AppError } = require('../src/utils/apiError');
const User = require('../src/models/User');
const { migrateParentSchema } = require('../scripts/migration/migrateParentSchema');

describe('PHASE 8 — Security, Error Handling & Data Integrity', () => {
  before(async () => {
    await connectTestDB();
  });

  after(async () => {
    await closeTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
  });

  // =========================================================================
  // TASK 1: JWT OPTIMIZATION, CLAIMS, REVOCATION & TOKEN INVALIDATION
  // =========================================================================
  describe('TASK 1 — JWT Optimization & Security Strategy', () => {
    it('generates a token with claims: id, role, hostelId, and tokenVersion without leaking sensitive data', async () => {
      const { user } = await createTestUser({
        name: 'Secure Student',
        email: 'secure@student.com',
        role: ['student'],
        status: 'active',
      });

      const token = generateToken(user);
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      assert.equal(decoded.id, String(user._id));
      assert.equal(decoded.role, 'student');
      assert.equal(decoded.tokenVersion, 0);
      assert.equal(decoded.password, undefined);
      assert.equal(decoded.resetPasswordToken, undefined);
      assert.equal(decoded.otp, undefined);
    });

    it('supports generating a token from a raw user ID for backward compatibility', async () => {
      const rawId = new mongoose.Types.ObjectId().toString();
      const token = generateToken(rawId);
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      assert.equal(decoded.id, rawId);
      assert.equal(decoded.role, 'student');
      assert.equal(decoded.tokenVersion, 0);
    });

    it('rejects access when user account is suspended with 401 and ACCOUNT_REVOKED', async () => {
      const { user } = await createTestUser({
        name: 'Suspended User',
        email: 'suspended@hostel.com',
        role: ['student'],
        status: 'suspended',
      });

      const token = generateToken(user);

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
      assert.equal(res.body.code, 'ACCOUNT_REVOKED');
      assert.match(res.body.message, /deactivated or suspended/i);
    });

    it('rejects access when user account is exited with 401 and ACCOUNT_REVOKED', async () => {
      const { user } = await createTestUser({
        name: 'Exited User',
        email: 'exited@hostel.com',
        role: ['student'],
        status: 'exited',
      });

      const token = generateToken(user);

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
      assert.equal(res.body.code, 'ACCOUNT_REVOKED');
    });

    it('invalidates active tokens when user tokenVersion is incremented (logout-all or password change)', async () => {
      const { user } = await createTestUser({
        name: 'Session User',
        email: 'session@hostel.com',
        role: ['student'],
        status: 'active',
      });

      const initialToken = generateToken(user);

      // Verify token works initially
      const res1 = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${initialToken}`);
      assert.equal(res1.status, 200);

      // Invalidate all tokens across devices
      await user.invalidateTokens();

      // Attempt to access with old token
      const res2 = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${initialToken}`);

      assert.equal(res2.status, 401);
      assert.equal(res2.body.success, false);
      assert.equal(res2.body.code, 'TOKEN_INVALIDATED');
      assert.match(res2.body.message, /invalidated/i);

      // Newly issued token succeeds
      const refreshedUser = await User.findById(user._id);
      const newToken = generateToken(refreshedUser);

      const res3 = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${newToken}`);
      assert.equal(res3.status, 200);
    });

    it('POST /api/auth/logout-all successfully invalidates all existing sessions', async () => {
      const { user } = await createTestUser({
        name: 'LogoutAll Student',
        email: 'logoutall@student.com',
        role: ['student'],
        status: 'active',
      });

      const activeToken = generateToken(user);

      const logoutRes = await request(app)
        .post('/api/auth/logout-all')
        .set('Authorization', `Bearer ${activeToken}`);

      assert.equal(logoutRes.status, 200);
      assert.equal(logoutRes.body.success, true);
      assert.match(logoutRes.body.message, /sessions have been invalidated/i);

      // Old token must now be rejected
      const meRes = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${activeToken}`);

      assert.equal(meRes.status, 401);
      assert.equal(meRes.body.code, 'TOKEN_INVALIDATED');
    });
  });

  // =========================================================================
  // TASK 2: STANDARDIZE ERROR HANDLING (NO DB INTERNALS LEAKED)
  // =========================================================================
  describe('TASK 2 — Standardized Error Handling System', () => {
    it('safely handles Mongoose CastError with 400 and INVALID_IDENTIFIER without leaking collection names', () => {
      let responseStatus = null;
      let responseBody = null;

      const mockRes = {
        status(code) {
          responseStatus = code;
          return this;
        },
        json(body) {
          responseBody = body;
          return this;
        },
      };

      const castError = new Error('Cast to ObjectId failed for value "invalid-id" (type string) at path "_id" for model "User"');
      castError.name = 'CastError';
      castError.path = 'id';
      castError.value = 'invalid-id';

      sendErrorResponse(mockRes, castError, 'Operation failed');

      assert.equal(responseStatus, 400);
      assert.equal(responseBody.success, false);
      assert.equal(responseBody.code, 'INVALID_IDENTIFIER');
      assert.equal(responseBody.message, 'Invalid format provided for id');
      assert.equal(responseBody.collection, undefined);
    });

    it('safely handles MongoDB duplicate key error (code 11000) with 409 and DUPLICATE_RESOURCE without DB internals', () => {
      let responseStatus = null;
      let responseBody = null;

      const mockRes = {
        status(code) {
          responseStatus = code;
          return this;
        },
        json(body) {
          responseBody = body;
          return this;
        },
      };

      const mongoDupError = new Error('E11000 duplicate key error collection: hostelzify.users index: email_1 dup key: { email: "taken@example.com" }');
      mongoDupError.code = 11000;
      mongoDupError.keyValue = { email: 'taken@example.com' };

      sendErrorResponse(mockRes, mongoDupError, 'Operation failed');

      assert.equal(responseStatus, 409);
      assert.equal(responseBody.success, false);
      assert.equal(responseBody.code, 'DUPLICATE_RESOURCE');
      assert.equal(responseBody.message, 'A record with this email already exists.');
      assert.equal(responseBody.index, undefined);
    });

    it('masks unexpected internal server error messages in production mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      let responseStatus = null;
      let responseBody = null;

      const mockRes = {
        status(code) {
          responseStatus = code;
          return this;
        },
        json(body) {
          responseBody = body;
          return this;
        },
      };

      try {
        const rawInternalError = new Error('FATAL: connection to database server lost at TCP socket level');
        sendErrorResponse(mockRes, rawInternalError, 'Internal server error');

        assert.equal(responseStatus, 500);
        assert.equal(responseBody.success, false);
        assert.equal(responseBody.code, 'INTERNAL_SERVER_ERROR');
        assert.equal(responseBody.message, 'Internal server error');
        assert.equal(responseBody.stack, undefined);
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });
  });

  // =========================================================================
  // TASK 4: PARENT SCHEMA SYNCHRONIZATION & MIGRATION
  // =========================================================================
  describe('TASK 4 — Parent Schema Standardization & Backward Compatibility', () => {
    it('automatically populates canonical parentContact when legacy parentInfo is provided in pre-save', async () => {
      const user = new User({
        name: 'Legacy Parent Student',
        email: 'legacy.parent@example.com',
        password: 'Password@123',
        phone: '9876543219',
        role: ['student'],
        parentInfo: {
          name: 'Robert Doe',
          phone: '9876500000',
          email: 'robert.doe@example.com',
          relationship: 'Father',
          occupation: 'Engineer',
          address: '456 Parent St',
        },
      });

      await user.save();

      const savedUser = await User.findById(user._id).lean();

      // Canonical parentContact must be populated
      assert.ok(savedUser.parentContact);
      assert.equal(savedUser.parentContact.name, 'Robert Doe');
      assert.equal(savedUser.parentContact.phone, '9876500000');
      assert.equal(savedUser.parentContact.email, 'robert.doe@example.com');
      assert.equal(savedUser.parentContact.relationship, 'Father');
      assert.equal(savedUser.parentContact.occupation, 'Engineer');

      // Legacy parentInfo must also remain intact for backward compatibility
      assert.ok(savedUser.parentInfo);
      assert.equal(savedUser.parentInfo.name, 'Robert Doe');
      assert.equal(savedUser.parentInfo.phone, '9876500000');
    });

    it('automatically synchronizes legacy parentInfo when canonical parentContact is updated in pre-save', async () => {
      const user = new User({
        name: 'Modern Parent Student',
        email: 'modern.parent@example.com',
        password: 'Password@123',
        phone: '9876543220',
        role: ['student'],
        parentContact: {
          name: 'Mary Doe',
          phone: '9876511111',
          email: 'mary.doe@example.com',
          relation: 'Mother',
          occupation: 'Doctor',
        },
      });

      await user.save();

      const savedUser = await User.findById(user._id).lean();

      // Both fields must be in sync
      assert.equal(savedUser.parentContact.name, 'Mary Doe');
      assert.equal(savedUser.parentInfo.name, 'Mary Doe');
      assert.equal(savedUser.parentInfo.phone, '9876511111');
      assert.equal(savedUser.parentInfo.relation, 'Mother');
    });

    it('idempotently migrates documents with legacy parentInfo to canonical parentContact', async () => {
      // Direct raw insert bypassing mongoose pre-save hook to simulate legacy database data
      const rawUser = {
        _id: new mongoose.Types.ObjectId(),
        name: 'Unmigrated Student',
        email: 'unmigrated@example.com',
        password: 'hashedpassword',
        phone: '9876543221',
        role: ['student'],
        parentInfo: {
          name: 'Grandparent Guardian',
          phone: '9876522222',
          email: 'guardian@example.com',
          relationship: 'Guardian',
        },
        parentContact: null,
      };

      await mongoose.connection.collection('users').insertOne(rawUser);

      // Verify unmigrated state
      const beforeDoc = await mongoose.connection.collection('users').findOne({ _id: rawUser._id });
      assert.equal(beforeDoc.parentContact, null);

      // Run idempotent migration
      await migrateParentSchema();

      // Verify migrated state
      const afterDoc = await mongoose.connection.collection('users').findOne({ _id: rawUser._id });
      assert.ok(afterDoc.parentContact);
      assert.equal(afterDoc.parentContact.name, 'Grandparent Guardian');
      assert.equal(afterDoc.parentContact.phone, '9876522222');
      assert.equal(afterDoc.parentInfo.name, 'Grandparent Guardian');

      // Running migration a second time causes 0 errors and maintains data integrity
      await migrateParentSchema();

      const secondRunDoc = await mongoose.connection.collection('users').findOne({ _id: rawUser._id });
      assert.equal(secondRunDoc.parentContact.name, 'Grandparent Guardian');
    });
  });
});
