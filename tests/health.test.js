/**
 * @file health.test.js
 * @description Baseline tests for production health check endpoint.
 */

'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { connectTestDB, closeTestDB } = require('./setup');
const app = require('../server');

describe('Health Check API (GET /api/health)', () => {
  before(async () => {
    await connectTestDB();
  });

  after(async () => {
    await closeTestDB();
  });

  it('should return 200 with healthy database status when connected', async () => {
    const res = await request(app).get('/api/health');

    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'healthy');
    assert.equal(typeof res.body.uptime, 'number');
    assert.ok(res.body.timestamp);
    assert.equal(res.body.database.status, 'connected');
    assert.equal(res.body.database.readyState, 1);
    assert.ok(res.body.memory.rss);
    assert.ok(res.body.memory.heapUsed);
  });
});
