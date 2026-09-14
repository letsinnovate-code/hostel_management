/**
 * @file authorization.test.js
 * @description Baseline tests for Role-Based Authorization and Multi-tenant Hostel Boundaries.
 */

'use strict';

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const mongoose = require('mongoose');
const { connectTestDB, clearTestDB, closeTestDB, createTestUser, createTestHostel } = require('./setup');
const app = require('../server');

describe('Role & Multi-tenant Authorization API', () => {
  before(async () => {
    await connectTestDB();
  });

  after(async () => {
    await closeTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
  });

  describe('Role Authorization Boundary (RBAC)', () => {
    it('should reject student accessing owner-only routes with 403 Forbidden', async () => {
      const { token } = await createTestUser({ role: 'student', currentRole: 'student' });

      const res = await request(app)
        .get('/api/owner/hostels')
        .set('Authorization', `Bearer ${token}`);

      assert.equal(res.status, 403);
      assert.equal(res.body.success, false);
      assert.match(res.body.message, /not authorized/i);
    });

    it('should reject student accessing warden-only routes with 403 Forbidden', async () => {
      const { token } = await createTestUser({ role: 'student', currentRole: 'student' });

      const res = await request(app)
        .get('/api/warden/rooms')
        .set('Authorization', `Bearer ${token}`);

      assert.equal(res.status, 403);
      assert.equal(res.body.success, false);
      assert.match(res.body.message, /not authorized/i);
    });

    it('should allow owner to access owner-only routes with 200 OK', async () => {
      const { user, token } = await createTestUser({ role: 'owner', currentRole: 'owner' });
      await createTestHostel(user._id);

      const res = await request(app)
        .get('/api/owner/hostels')
        .set('Authorization', `Bearer ${token}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(Array.isArray(res.body.data));
    });
  });

  describe('Multi-Tenant Hostel Isolation (Owner Isolation)', () => {
    it('should allow owner to access their own hostel details', async () => {
      const { user: ownerA, token: tokenA } = await createTestUser({
        role: 'owner',
        currentRole: 'owner',
        email: 'ownerA@test.com',
      });
      const hostelA = await createTestHostel(ownerA._id, { name: 'Hostel A' });

      const res = await request(app)
        .get(`/api/owner/hostels/${hostelA._id}`)
        .set('Authorization', `Bearer ${tokenA}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data._id.toString(), hostelA._id.toString());
      assert.equal(res.body.data.name, 'Hostel A');
    });

    it('should reject owner attempting to access another owner hostel with 403 Forbidden', async () => {
      const { user: ownerA } = await createTestUser({
        role: 'owner',
        currentRole: 'owner',
        email: 'ownerA2@test.com',
      });
      const hostelA = await createTestHostel(ownerA._id, { name: 'Owner A Hostel' });

      const { token: tokenB } = await createTestUser({
        role: 'owner',
        currentRole: 'owner',
        email: 'ownerB@test.com',
      });

      const res = await request(app)
        .get(`/api/owner/hostels/${hostelA._id}`)
        .set('Authorization', `Bearer ${tokenB}`);

      assert.equal(res.status, 403);
      assert.equal(res.body.success, false);
      assert.match(res.body.message, /not authorized/i);
    });
  });
});
