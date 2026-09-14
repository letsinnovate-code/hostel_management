/**
 * @file controllers/owner/ownerMessController.js
 * @description Owner mess schedules and meal feedback controller.
 */

'use strict';

const mongoose = require('mongoose');
const MessSchedule = require('../../models/MessSchedule');
const Hostel = require('../../models/Hostel');
const { assertOwnsHostel, getOwnerHostelIds, getScopedHostelIds } = require('./ownerHelper');

exports.getMessSchedules = async (req, res) => {
  try {
    const { hostelId } = req.params;
    await assertOwnsHostel(req, hostelId);
    const schedules = await MessSchedule.find({ hostelId }).sort({ order: 1, mealType: 1 }).lean();
    res.status(200).json({ success: true, data: schedules });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};


exports.createMessSchedule = async (req, res) => {
  try {
    const { hostelId } = req.params;
    const { mealType, title, items, startTime, endTime, dayOfWeek, active, order } = req.body;
    await assertOwnsHostel(req, hostelId);
    if (!mealType || !startTime || !endTime) {
      return res.status(400).json({ success: false, message: 'mealType, startTime and endTime are required' });
    }
    const schedule = await MessSchedule.create({
      hostelId,
      mealType: mealType.toLowerCase(),
      title: title || mealType,
      items: Array.isArray(items) ? items.filter(Boolean) : [],
      startTime: String(startTime).trim(),
      endTime: String(endTime).trim(),
      dayOfWeek: dayOfWeek != null ? parseInt(dayOfWeek, 10) : null,
      active: active !== false,
      order: order != null ? parseInt(order, 10) : 0,
    });
    res.status(201).json({ success: true, data: schedule });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};


exports.updateMessSchedule = async (req, res) => {
  try {
    const { hostelId, scheduleId } = req.params;
    await assertOwnsHostel(req, hostelId);
    const schedule = await MessSchedule.findOne({ _id: scheduleId, hostelId });
    if (!schedule) return res.status(404).json({ success: false, message: 'Mess schedule not found' });
    const { mealType, title, items, startTime, endTime, dayOfWeek, active, order } = req.body;
    if (mealType != null) schedule.mealType = mealType.toLowerCase();
    if (title != null) schedule.title = title;
    if (Array.isArray(items)) schedule.items = items.filter(Boolean);
    if (startTime != null) schedule.startTime = String(startTime).trim();
    if (endTime != null) schedule.endTime = String(endTime).trim();
    if (dayOfWeek !== undefined) schedule.dayOfWeek = dayOfWeek == null ? null : parseInt(dayOfWeek, 10);
    if (active !== undefined) schedule.active = active;
    if (order !== undefined) schedule.order = parseInt(order, 10);
    await schedule.save();
    res.status(200).json({ success: true, data: schedule });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};


exports.deleteMessSchedule = async (req, res) => {
  try {
    const { hostelId, scheduleId } = req.params;
    await assertOwnsHostel(req, hostelId);
    const deleted = await MessSchedule.findOneAndDelete({ _id: scheduleId, hostelId });
    if (!deleted) return res.status(404).json({ success: false, message: 'Mess schedule not found' });
    res.status(200).json({ success: true, message: 'Mess schedule deleted' });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// Indian vegetarian weekly mess: Sunday (0) to Saturday (6), 3 meals per day
const MESS_SEED_WEEK = [
  // Sunday
  { day: 0, breakfast: ['Poha', 'Banana', 'Tea'], lunch: ['Rice', 'Dal', 'Mix Veg', 'Curd', 'Salad'], dinner: ['Chapati', 'Chole', 'Rice', 'Raita'] },
  // Monday
  { day: 1, breakfast: ['Idli', 'Sambar', 'Coconut Chutney'], lunch: ['Rice', 'Rajma', 'Aloo Fry', 'Salad'], dinner: ['Paratha', 'Kadhi', 'Rice'] },
  // Tuesday
  { day: 2, breakfast: ['Upma', 'Chutney', 'Tea'], lunch: ['Rice', 'Dal', 'Bhindi Masala', 'Curd'], dinner: ['Chapati', 'Paneer Curry', 'Dal'] },
  // Wednesday
  { day: 3, breakfast: ['Dosa', 'Sambar', 'Chutney'], lunch: ['Rice', 'Chole', 'Cabbage Sabzi', 'Raita'], dinner: ['Paratha', 'Mix Veg', 'Rice'] },
  // Thursday
  { day: 4, breakfast: ['Poha', 'Jalebi', 'Tea'], lunch: ['Rice', 'Dal', 'Aloo Gobi', 'Curd'], dinner: ['Chapati', 'Dal', 'Rice', 'Salad'] },
  // Friday
  { day: 5, breakfast: ['Idli', 'Sambar', 'Chutney'], lunch: ['Rice', 'Rajma', 'Palak Sabzi', 'Salad'], dinner: ['Paratha', 'Paneer Butter Masala', 'Rice'] },
  // Saturday
  { day: 6, breakfast: ['Upma', 'Banana', 'Tea'], lunch: ['Rice', 'Kadhi', 'Baingan Bharta', 'Curd'], dinner: ['Chapati', 'Chole', 'Rice', 'Raita'] },
];


exports.seedMessSchedules = async (req, res) => {
  try {
    const { hostelId } = req.params;
    await assertOwnsHostel(req, hostelId);
    await MessSchedule.deleteMany({ hostelId });
    const inserts = [];
    let order = 0;
    for (const dayPlan of MESS_SEED_WEEK) {
      inserts.push({
        hostelId,
        mealType: 'breakfast',
        title: 'Breakfast',
        items: dayPlan.breakfast,
        startTime: '07:00',
        endTime: '09:00',
        dayOfWeek: dayPlan.day,
        active: true,
        order: order++,
      });
      inserts.push({
        hostelId,
        mealType: 'lunch',
        title: 'Lunch',
        items: dayPlan.lunch,
        startTime: '12:00',
        endTime: '14:00',
        dayOfWeek: dayPlan.day,
        active: true,
        order: order++,
      });
      inserts.push({
        hostelId,
        mealType: 'dinner',
        title: 'Dinner',
        items: dayPlan.dinner,
        startTime: '19:00',
        endTime: '21:00',
        dayOfWeek: dayPlan.day,
        active: true,
        order: order++,
      });
    }
    const created = await MessSchedule.insertMany(inserts);
    res.status(201).json({ success: true, data: created, message: 'Weekly mess schedule seeded (Sun–Sat, 3 meals)' });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// Get mess (food) feedback for owner's hostels – for dashboard

exports.getMessFeedback = async (req, res) => {
  try {
    const { hostelId } = req.query;
    const scopedHostelIds = await getScopedHostelIds(req, hostelId);
    if (scopedHostelIds.length === 0) {
      return res.status(200).json({ success: true, data: [] });
    }
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);

    const list = await Complaint.find({
      complaintType: 'food',
      hostelId: { $in: scopedHostelIds },
    })
      .populate('raisedBy', 'name')
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    res.status(200).json({ success: true, data: list });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// ============ LEAVE / OUTPASS (Owner) ============