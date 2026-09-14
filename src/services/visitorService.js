/**
 * @file services/visitorService.js
 * @description Centralized visitor service managing visitor requests, approvals, checkouts, and deletions.
 */

'use strict';

const Visitor = require('../models/Visitor');
const { VISITOR_STATUS } = require('../constants');

class VisitorService {
  /**
   * Retrieve visitor by ID with optional population
   */
  static async getVisitorById(id, options = {}) {
    let query = Visitor.findById(id);
    if (options.populate) {
      if (Array.isArray(options.populate)) {
        for (const pop of options.populate) query = query.populate(pop);
      } else {
        query = query.populate(options.populate);
      }
    }
    if (options.lean) {
      query = query.lean();
    }
    return await query;
  }

  /**
   * List visitors with filtering, pagination, sorting, and population
   */
  static async listVisitors({ filter = {}, skip = 0, limit = 50, sort = { createdAt: -1 }, populate, lean = true } = {}) {
    let query = Visitor.find(filter).sort(sort).skip(skip).limit(limit);
    if (populate) {
      if (Array.isArray(populate)) {
        for (const pop of populate) query = query.populate(pop);
      } else {
        query = query.populate(populate);
      }
    }
    if (lean) {
      query = query.lean();
    }

    const [visitors, total] = await Promise.all([
      query,
      Visitor.countDocuments(filter),
    ]);

    return { visitors, total };
  }

  /**
   * Create a new visitor request
   */
  static async createVisitor(data) {
    return await Visitor.create(data);
  }

  /**
   * Approve a visitor
   */
  static async approveVisitor(id, { user, entryTime } = {}) {
    const visitor = await Visitor.findById(id);
    if (!visitor) {
      const err = new Error('Visitor not found');
      err.statusCode = 404;
      throw err;
    }

    visitor.status = VISITOR_STATUS.APPROVED;
    visitor.approvedBy = user?._id || user?.id;
    visitor.entryTime = entryTime ? new Date(entryTime) : new Date();
    await visitor.save();

    return visitor;
  }

  /**
   * Reject a visitor request
   */
  static async rejectVisitor(id, { user, rejectionReason } = {}) {
    const visitor = await Visitor.findById(id);
    if (!visitor) {
      const err = new Error('Visitor not found');
      err.statusCode = 404;
      throw err;
    }

    visitor.status = VISITOR_STATUS.REJECTED;
    visitor.approvedBy = user?._id || user?.id;
    if (rejectionReason) {
      visitor.rejectionReason = String(rejectionReason).trim();
    }
    await visitor.save();

    return visitor;
  }

  /**
   * Check out visitor and mark as completed
   */
  static async checkoutVisitor(id, { user, exitTime } = {}) {
    const visitor = await Visitor.findById(id);
    if (!visitor) {
      const err = new Error('Visitor record not found');
      err.statusCode = 404;
      throw err;
    }

    visitor.status = VISITOR_STATUS.COMPLETED;
    visitor.exitTime = exitTime ? new Date(exitTime) : new Date();
    await visitor.save();

    return visitor;
  }

  /**
   * Delete visitor record
   */
  static async deleteVisitor(id) {
    const visitor = await Visitor.findById(id);
    if (!visitor) {
      const err = new Error('Visitor record not found');
      err.statusCode = 404;
      throw err;
    }
    await Visitor.findByIdAndDelete(id);
    return { success: true, message: 'Visitor record deleted successfully' };
  }
}

module.exports = VisitorService;
