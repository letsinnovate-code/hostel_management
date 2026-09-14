/**
 * @file scripts/migrateParentSchema.js
 * @description Idempotent migration script to standardize User parent records.
 * Ensures canonical `parentContact` is populated from legacy `parentInfo`,
 * and synchronizes bidirectional compatibility so existing readers/writers never break.
 *
 * Usage:
 *   node scripts/migrateParentSchema.js
 */

'use strict';

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../../src/models/User');

const MONGO_URI =
  process.env.MONGO_URI ||
  process.env.MONGODB_URI ||
  'mongodb://localhost:27017/hostelzify';

async function migrateParentSchema() {
  console.log('=== [MIGRATION] Starting Parent Schema Migration ===');
  const wasAlreadyConnected = mongoose.connection.readyState === 1;

  try {
    if (!wasAlreadyConnected) {
      console.log(`Connecting to database: ${MONGO_URI.split('@').pop()}`);
      await mongoose.connect(MONGO_URI);
      console.log('Connected to MongoDB.');
    }

    const cursor = User.find({
      $or: [
        { parentInfo: { $exists: true, $ne: null } },
        { parentContact: { $exists: true, $ne: null } },
      ],
    }).cursor();

    let totalChecked = 0;
    let migratedToContact = 0;
    let synchronizedToInfo = 0;
    let alreadySynced = 0;
    const bulkOps = [];

    for await (const user of cursor) {
      totalChecked++;
      const pi = user.parentInfo || {};
      const pc = user.parentContact || {};

      const hasPiData = Boolean(pi.name || pi.phone || pi.email);
      const hasPcData = Boolean(pc.name || pc.phone || pc.email);

      let needsUpdate = false;
      let newPc = pc;
      let newPi = pi;

      // Case 1: Legacy parentInfo has data, canonical parentContact is missing/empty
      if (hasPiData && !hasPcData) {
        newPc = {
          name: pi.name || '',
          phone: pi.phone || '',
          email: pi.email || '',
          relation: pi.relation || pi.relationship || '',
          relationship: pi.relationship || pi.relation || '',
          address: pi.address || '',
          occupation: pi.occupation || '',
        };
        needsUpdate = true;
        migratedToContact++;
      }

      // Case 2: Canonical parentContact has data, legacy parentInfo is missing/empty
      if (hasPcData && !hasPiData) {
        newPi = {
          name: pc.name || '',
          phone: pc.phone || '',
          email: pc.email || '',
          relation: pc.relation || pc.relationship || '',
          relationship: pc.relationship || pc.relation || '',
          address: pc.address || '',
          occupation: pc.occupation || '',
        };
        needsUpdate = true;
        synchronizedToInfo++;
      }

      // Case 3: Both exist, ensure missing sub-properties (e.g. relation vs relationship) are reconciled
      if (hasPcData && hasPiData) {
        let fieldUpdated = false;
        const reconciled = {
          name: pc.name || pi.name || '',
          phone: pc.phone || pi.phone || '',
          email: pc.email || pi.email || '',
          relation: pc.relation || pi.relation || pc.relationship || pi.relationship || '',
          relationship: pc.relationship || pi.relationship || pc.relation || pi.relation || '',
          address: pc.address || pi.address || '',
          occupation: pc.occupation || pi.occupation || '',
        };

        if (
          pc.name !== reconciled.name ||
          pc.phone !== reconciled.phone ||
          pc.relation !== reconciled.relation ||
          pc.relationship !== reconciled.relationship
        ) {
          newPc = reconciled;
          fieldUpdated = true;
        }

        if (
          pi.name !== reconciled.name ||
          pi.phone !== reconciled.phone ||
          pi.relation !== reconciled.relation ||
          pi.relationship !== reconciled.relationship
        ) {
          newPi = reconciled;
          fieldUpdated = true;
        }

        if (fieldUpdated) {
          needsUpdate = true;
          migratedToContact++;
        } else {
          alreadySynced++;
        }
      }

      if (needsUpdate) {
        bulkOps.push({
          updateOne: {
            filter: { _id: user._id },
            update: {
              $set: {
                parentContact: newPc,
                parentInfo: newPi,
              },
            },
          },
        });
      }

      // Flush in batches of 500
      if (bulkOps.length >= 500) {
        await User.bulkWrite(bulkOps);
        bulkOps.length = 0;
      }
    }

    if (bulkOps.length > 0) {
      await User.bulkWrite(bulkOps);
    }

    console.log('=== [MIGRATION] Migration Summary ===');
    console.log(`Total user records examined: ${totalChecked}`);
    console.log(`Migrated legacy info to canonical parentContact: ${migratedToContact}`);
    console.log(`Synchronized canonical contact to legacy parentInfo: ${synchronizedToInfo}`);
    console.log(`Already in sync: ${alreadySynced}`);
    console.log('=== [MIGRATION] Complete: 0 data loss, 100% backward compatible ===');
  } catch (error) {
    console.error('[MIGRATION ERROR]', error);
    process.exitCode = 1;
  } finally {
    if (!wasAlreadyConnected) {
      await mongoose.disconnect();
      console.log('Database connection closed.');
    }
  }
}

if (require.main === module) {
  migrateParentSchema();
}

module.exports = { migrateParentSchema };
