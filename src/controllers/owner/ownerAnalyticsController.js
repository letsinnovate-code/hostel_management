/**
 * @file controllers/owner/ownerAnalyticsController.js
 * @description Owner dashboard KPIs, occupancy, financial, and audit reports controller.
 */

'use strict';

const mongoose = require('mongoose');
const Hostel = require('../../models/Hostel');
const Room = require('../../models/Room');
const User = require('../../models/User');
const Payment = require('../../models/Payment');
const AuditLog = require('../../models/AuditLog');
const Complaint = require('../../models/Complaint');
const { assertOwnsHostel, getOwnerHostelIds, getScopedHostelIds } = require('./ownerHelper');

exports.getDashboardKPIs = async (req, res) => {
  try {
    const { hostelId } = req.query;
    const scopedHostelIds = await getScopedHostelIds(req, hostelId);
    if (scopedHostelIds.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          totalHostels: 0,
          totalStudents: 0,
          activeStudents: 0,
          totalRooms: 0,
          occupiedRooms: 0,
          fullyOccupiedRooms: 0,
          partiallyOccupiedRooms: 0,
          emptyRooms: 0,
          totalCapacity: 0,
          totalOccupied: 0,
          overallOccupancyRate: '0.00',
          vacancyRate: '0.00',
          totalRevenue: 0,
          pendingPayments: 0,
          totalViolations: 0,
          pendingViolations: 0,
        },
      });
    }

    const rooms = await Room.find({ hostelId: { $in: scopedHostelIds } });
    const students = await User.find({ hostelId: { $in: scopedHostelIds }, role: 'student' });
    const studentIds = students.map(s => s._id);

    let totalCapacity = 0;
    let totalOccupied = 0;
    let fullyOccupiedRooms = 0;
    let partiallyOccupiedRooms = 0;
    let emptyRooms = 0;

    rooms.forEach(room => {
      const roomStudents = students.filter(s =>
        s.roomId && s.roomId.toString() === room._id.toString()
      );
      const studentCount = roomStudents.length;
      const capacity = room.capacity || 0;

      totalCapacity += capacity;
      totalOccupied += studentCount;

      if (studentCount === 0) {
        emptyRooms++;
      } else if (studentCount >= capacity) {
        fullyOccupiedRooms++;
      } else {
        partiallyOccupiedRooms++;
      }
    });

    const overallOccupancyRate = totalCapacity > 0
      ? ((totalOccupied / totalCapacity) * 100).toFixed(2)
      : '0.00';
    const occupiedRooms = fullyOccupiedRooms + partiallyOccupiedRooms;

    const payments = await Payment.find({ hostelId: { $in: scopedHostelIds } });
    const violations = studentIds.length > 0
      ? await Violation.find({ studentId: { $in: studentIds } })
      : [];

    const kpis = {
      totalStudents: students.length,
      activeStudents: students.filter(s => s.status === 'active').length,
      totalRooms: rooms.length,
      occupiedRooms,
      fullyOccupiedRooms,
      partiallyOccupiedRooms,
      emptyRooms,
      totalCapacity,
      totalOccupied,
      overallOccupancyRate,
      vacancyRate: rooms.length > 0
        ? (((rooms.length - occupiedRooms) / rooms.length) * 100).toFixed(2)
        : '0.00',
      totalRevenue: payments.filter(p => p.status === 'paid').reduce((sum, p) => sum + (p.amount || 0), 0),
      pendingPayments: payments.filter(p => p.status === 'pending').length,
      totalViolations: violations.length,
      pendingViolations: violations.filter(v => v.status === 'pending').length,
    };

    res.status(200).json({ success: true, data: kpis });
  } catch (error) {
    console.error('Error in getDashboardKPIs:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};


exports.getOccupancyReport = async (req, res) => {
  try {
    const { hostelId } = req.query;
    const scopedHostelIds = await getScopedHostelIds(req, hostelId);
    if (scopedHostelIds.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          totalRooms: 0,
          occupiedRooms: 0,
          availableRooms: 0,
          maintenanceRooms: 0,
          occupancyRate: '0.00',
          byCategory: {},
          vacantRooms: [],
        },
      });
    }
    const filter = { hostelId: { $in: scopedHostelIds } };
    const rooms = await Room.find(filter)
      .populate('students', 'name studentId');

    const report = {
      totalRooms: rooms.length,
      occupiedRooms: rooms.filter(r => r.status === 'occupied').length,
      availableRooms: rooms.filter(r => r.status === 'available').length,
      maintenanceRooms: rooms.filter(r => r.status === 'maintenance').length,
      occupancyRate: rooms.length > 0 ? ((rooms.filter(r => r.status === 'occupied').length / rooms.length) * 100).toFixed(2) : '0.00',
      byCategory: {},
      vacantRooms: rooms.filter(r => r.status === 'available').map(r => ({
        roomId: r._id,
        roomNumber: r.roomNumber,
        category: r.category,
        availableBeds: r.capacity - r.currentOccupancy,
      })),
    };

    rooms.forEach(room => {
      if (!report.byCategory[room.category]) {
        report.byCategory[room.category] = { total: 0, occupied: 0 };
      }
      report.byCategory[room.category].total++;
      if (room.status === 'occupied') {
        report.byCategory[room.category].occupied++;
      }
    });

    res.status(200).json({ success: true, data: report });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};


exports.getFinancialReport = async (req, res) => {
  try {
    const { hostelId, startDate, endDate } = req.query;
    const scopedHostelIds = await getScopedHostelIds(req, hostelId);
    if (scopedHostelIds.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          totalRevenue: 0,
          pendingAmount: 0,
          byType: {},
          byMethod: {},
          monthlyBreakdown: {},
        },
      });
    }
    const filter = { hostelId: { $in: scopedHostelIds } };

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const payments = await Payment.find(filter);

    const report = {
      totalRevenue: payments.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0),
      pendingAmount: payments.filter(p => p.status === 'pending').reduce((sum, p) => sum + p.amount, 0),
      byType: {},
      byMethod: {},
      monthlyBreakdown: {},
    };

    payments.forEach(payment => {
      // By type
      if (!report.byType[payment.type]) {
        report.byType[payment.type] = { total: 0, paid: 0, pending: 0 };
      }
      report.byType[payment.type].total += payment.amount;
      if (payment.status === 'paid') {
        report.byType[payment.type].paid += payment.amount;
      } else {
        report.byType[payment.type].pending += payment.amount;
      }

      // By method
      if (payment.paymentMethod) {
        if (!report.byMethod[payment.paymentMethod]) {
          report.byMethod[payment.paymentMethod] = 0;
        }
        report.byMethod[payment.paymentMethod] += payment.amount;
      }

      // Monthly breakdown
      const month = new Date(payment.createdAt).toISOString().slice(0, 7);
      if (!report.monthlyBreakdown[month]) {
        report.monthlyBreakdown[month] = 0;
      }
      if (payment.status === 'paid') {
        report.monthlyBreakdown[month] += payment.amount;
      }
    });

    res.status(200).json({ success: true, data: report });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};



exports.getAuditLogs = async (req, res) => {
  try {
    const { entityType, entityId, startDate, endDate } = req.query;
    const filter = {};
    if (req.user?.role !== 'superadmin') {
      filter.performedBy = req.user.id || req.user._id;
    }
    if (entityType) filter.entityType = entityType;
    if (entityId) filter.entityId = entityId;
    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) filter.timestamp.$gte = new Date(startDate);
      if (endDate) filter.timestamp.$lte = new Date(endDate);
    }

    const logs = await AuditLog.find(filter)
      .populate('performedBy', 'name email role')
      .sort({ timestamp: -1 })
      .limit(1000);

    res.status(200).json({ success: true, data: logs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


exports.exportData = async (req, res) => {
  try {
    const { type, format, hostelId } = req.query;
    const scopedHostelIds = await getScopedHostelIds(req, hostelId);
    if (scopedHostelIds.length === 0) {
      return res.status(200).json([]);
    }
    const filter = { hostelId: { $in: scopedHostelIds } };

    let data = [];
    let filename = '';

    switch (type) {
      case 'students':
        data = await User.find({ ...filter, role: 'student' }).select('-password');
        filename = 'students';
        break;
      case 'payments':
        data = await Payment.find(filter).populate('studentId', 'name email');
        filename = 'payments';
        break;
      case 'violations':
        const students = await User.find({ ...filter, role: 'student' }).select('_id');
        data = await Violation.find({ studentId: { $in: students.map(s => s._id) } })
          .populate('studentId', 'name');
        filename = 'violations';
        break;
      default:
        return res.status(400).json({ success: false, message: 'Invalid export type' });
    }

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=${filename}.json`);
      return res.status(200).json(data);
    } else if (format === 'csv') {
      // Convert to CSV
      const csv = convertToCSV(data);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=${filename}.csv`);
      return res.status(200).send(csv);
    } else {
      return res.status(400).json({ success: false, message: 'Invalid format' });
    }
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

function convertToCSV(data) {
  if (!data || data.length === 0) return '';
  const firstItem = data[0].toObject ? data[0].toObject() : data[0];
  const headers = Object.keys(firstItem);

  const sanitizeCell = (val) => {
    if (val === null || val === undefined) return '';
    let str = typeof val === 'object' ? JSON.stringify(val) : String(val);
    // Formula injection mitigation (OWASP)
    if (/^[=+\-@\t\r]/.test(str)) {
      str = `'${str}`;
    }
    // RFC 4180 escaping: if cell contains comma, quote, or newline, escape quotes and wrap in quotes
    if (/[",\n\r]/.test(str)) {
      str = `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const headerRow = headers.map(sanitizeCell).join(',');
  const rows = data.map(item => {
    const obj = item.toObject ? item.toObject() : item;
    return headers.map(header => sanitizeCell(obj[header])).join(',');
  });

  return [headerRow, ...rows].join('\r\n');
}



exports.getSystemLogs = async (req, res) => {
  try {
    const filter = {};
    if (req.user?.role !== 'superadmin') {
      filter.performedBy = req.user.id || req.user._id;
    }
    const logs = await AuditLog.find(filter)
      .populate('performedBy', 'name email')
      .sort({ timestamp: -1 })
      .limit(100);
    res.status(200).json({ success: true, data: logs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Geocode Address