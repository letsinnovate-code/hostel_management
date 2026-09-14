/**
* @file auth.test.js
* @description Baseline tests for Authentication endpoints (register, login, me).
*/

'use strict';

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { connectTestDB, clearTestDB, closeTestDB, createTestUser } = require('./setup');
const app = require('../server');

describe('Authentication API (/api/auth)', () => {
  before(async () => {
    await connectTestDB();
  });

  after(async () => {
    await closeTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
  });

  describe('POST /api/auth/register', () => {
    it('should successfully register a new student user and return a JWT token', async () => {
      const payload = {
        name: 'John Doe',
        email: 'john.doe@example.com',
        password: 'Password@123',
        phone: '9876543210',
        role: 'student',
      };

      const res = await request(app)
        .post('/api/auth/register')
        .send(payload);

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.ok(res.body.data.token);
      assert.equal(res.body.data.name, 'John Doe');
      assert.equal(res.body.data.email, 'john.doe@example.com');
      assert.equal(res.body.data.role, 'student');
      assert.equal(res.body.data.password, undefined); // Password must not be exposed
    });

    it('should reject registration if email is already registered', async () => {
      await createTestUser({ email: 'duplicate@example.com' });

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Jane Duplicate',
          email: 'duplicate@example.com',
          password: 'Password@123',
          phone: '9876543211',
          role: 'student',
        });

      assert.ok(res.status === 400 || res.status === 409);
      assert.equal(res.body.success, false);
    });

    it('should reject registration with invalid email format', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Invalid Email User',
          email: 'not-an-email',
          password: 'Password@123',
          phone: '9876543210',
        });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.equal(res.body.code, 'VALIDATION_ERROR');
    });

    it('should reject registration with password shorter than 8 characters', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Short Pass User',
          email: 'shortpass@example.com',
          password: 'short',
          phone: '9876543210',
        });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.equal(res.body.code, 'VALIDATION_ERROR');
    });
  });

  describe('POST /api/auth/login', () => {
    it('should successfully log in with valid credentials and return JWT', async () => {
      const { user, rawPassword } = await createTestUser({
        email: 'login.test@example.com',
        password: 'SecurePassword@123',
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'login.test@example.com',
          password: rawPassword,
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(res.body.data.token);
      assert.equal(res.body.data.id, user._id.toString());
      assert.equal(res.body.data.email, 'login.test@example.com');
    });

    it('should reject login with incorrect password', async () => {
      await createTestUser({
        email: 'wrongpass@example.com',
        password: 'CorrectPassword@123',
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'wrongpass@example.com',
          password: 'WrongPassword@123',
        });

      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
      assert.ok(res.body.message);
    });

    it('should reject login when required fields are missing', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'missingpass@example.com',
        });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.equal(res.body.code, 'VALIDATION_ERROR');
    });
  });

  describe('Protected Route Authentication (GET /api/auth/me)', () => {
    it('should reject access to protected route when no token is provided', async () => {
      const res = await request(app).get('/api/auth/me');

      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
    });

    it('should reject access with an invalid/malformed token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-garbage-token-string');

      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
    });

    it('should grant access to protected route with a valid token', async () => {
      const { user, token } = await createTestUser({
        name: 'Verified User',
        email: 'verified@example.com',
      });

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data._id.toString(), user._id.toString());
      assert.equal(res.body.data.name, 'Verified User');
      assert.equal(res.body.data.email, 'verified@example.com');
    });
  });
});
