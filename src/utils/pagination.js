'use strict';

/**
 * Parses and sanitizes pagination parameters from query strings.
 * Enforces defensive limits to prevent negative pages, negative limits,
 * or huge limits that could exhaust memory.
 *
 * @param {Object} query - Express req.query object
 * @param {Object} [options={}]
 * @param {number} [options.defaultLimit=50] - Default limit if none provided or invalid
 * @param {number} [options.maxLimit=100] - Hard upper ceiling for limit
 * @returns {{ page: number, limit: number, skip: number, isExplicit: boolean }}
 */
function parsePagination(query = {}, options = {}) {
  const defaultLimit = options.defaultLimit || 50;
  const maxLimit = options.maxLimit || 100;

  const rawPage = query.page;
  const rawLimit = query.limit;
  const isExplicit = rawPage !== undefined || rawLimit !== undefined;

  let page = parseInt(rawPage, 10);
  let limit = parseInt(rawLimit, 10);

  if (isNaN(page) || page < 1) {
    page = 1;
  }

  if (isNaN(limit) || limit < 1) {
    limit = defaultLimit;
  } else if (limit > maxLimit) {
    limit = maxLimit;
  }

  const skip = (page - 1) * limit;

  return {
    page,
    limit,
    skip,
    isExplicit,
  };
}

/**
 * Helper to construct standard pagination metadata.
 *
 * @param {number} total - Total count of matching documents
 * @param {number} page - Current page
 * @param {number} limit - Items per page
 * @returns {{ total: number, page: number, limit: number, pages: number }}
 */
function buildPaginationMetadata(total, page, limit) {
  const safeTotal = Math.max(0, Number(total) || 0);
  const safeLimit = Math.max(1, Number(limit) || 1);
  const safePage = Math.max(1, Number(page) || 1);
  const totalPages = Math.ceil(safeTotal / safeLimit) || 1;
  return {
    total: safeTotal,
    page: safePage,
    limit: safeLimit,
    pages: totalPages,
    totalPages,
    hasNext: safePage < totalPages,
    hasPrev: safePage > 1,
  };
}

module.exports = {
  parsePagination,
  buildPaginationMetadata,
};
