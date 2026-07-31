#!/usr/bin/env node
/**
 * One-time backfill: create GateEvent documents from existing Attendance records
 * so gate logs show history before the GateEvent architecture was added.
 * Run from project root: node scripts/backfill-gate-events.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Attendance = require('../models/Attendance');
const GateEvent = require('../models/GateEvent');

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/hostelzack';

async function backfill() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');

  const records = await Attendance.find({
    $or: [
      { checkInTime: { $exists: true, $ne: null } },
      { checkOutTime: { $exists: true, $ne: null } },
    ],
  })
    .populate('studentId', '_id')
    .lean();

  let inserted = 0;
  let skipped = 0;
  for (const r of records) {
    const studentId = r.studentId?._id || r.studentId;
    const hostelId = r.hostelId;
    if (!studentId || !hostelId) continue;

    if (r.checkInTime) {
      const existing = await GateEvent.findOne({
        studentId,
        hostelId,
        type: 'in',
        time: r.checkInTime,
      }).lean();
      if (existing) {
        skipped += 1;
      } else {
        await GateEvent.create({
          studentId,
          hostelId,
          type: 'in',
          time: r.checkInTime,
          location: r.location,
          verificationMethod: r.verificationMethod || 'auto',
          attendanceId: r._id,
          source: 'auto',
        });
        inserted += 1;
      }
    }
    if (r.checkOutTime) {
      const existing = await GateEvent.findOne({
        studentId,
        hostelId,
        type: 'out',
        time: r.checkOutTime,
      }).lean();
      if (existing) {
        skipped += 1;
      } else {
        await GateEvent.create({
          studentId,
          hostelId,
          type: 'out',
          time: r.checkOutTime,
          location: r.location,
          verificationMethod: r.verificationMethod || 'auto',
          attendanceId: r._id,
          source: 'auto',
        });
        inserted += 1;
      }
    }
  }

  console.log(`Backfill done. Inserted: ${inserted}, Skipped (already present): ${skipped}`);
  await mongoose.disconnect();
  process.exit(0);
}

backfill().catch((err) => {
  console.error(err);
  process.exit(1);
});
