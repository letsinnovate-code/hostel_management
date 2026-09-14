/**
 * @file roleHelper.js
 * @description Centralized role normalization and role-check utilities.
 *
 * The User model stores `role` as an array of strings, but many parts of the
 * codebase need a single primary-role string.  This module eliminates the
 * repeated `Array.isArray(role) ? role[0] : String(role)` pattern that was
 * duplicated across controllers, middleware, and services.
 */

'use strict';

/**
 * Normalize a role value (string | string[] | null | undefined) to a single
 * primary-role string.
 *
 * @param {string|string[]|null|undefined} role
 * @returns {string|null} The primary role string, or null if unresolvable.
 */
function normalizeRole(role) {
  if (role == null) return null;
  if (Array.isArray(role)) return role.length > 0 ? String(role[0]) : null;
  return String(role);
}

/**
 * Resolve the effective current role for a user document or req.user object.
 * Checks `currentRole` first, then falls back to `role`, then `roles`.
 *
 * @param {Object} user - User document or req.user
 * @returns {string|null}
 */
function resolveCurrentRole(user) {
  if (!user) return null;
  if (user.currentRole) return String(user.currentRole);
  const primary = normalizeRole(user.role);
  if (primary) return primary;
  if (Array.isArray(user.roles) && user.roles.length > 0) return String(user.roles[0]);
  return null;
}

/**
 * Get all roles for a user as a flat array of strings.
 *
 * @param {Object} user - User document or req.user
 * @returns {string[]}
 */
function getUserRoles(user) {
  if (!user) return [];
  const roleArr = Array.isArray(user.role) ? user.role.map(String) : (user.role ? [String(user.role)] : []);
  const rolesArr = Array.isArray(user.roles) ? user.roles.map(String) : [];
  const combined = new Set([...roleArr, ...rolesArr]);
  return [...combined];
}

/**
 * Check if req.user has a specific role.
 */
function hasRole(user, roleName) {
  return getUserRoles(user).includes(roleName);
}

/** Convenience: is the request user a superadmin? */
function isSuperadmin(user) { return hasRole(user, 'superadmin'); }

/** Convenience: is the request user an owner? */
function isOwner(user) { return hasRole(user, 'owner'); }

/** Convenience: is the request user a warden? */
function isWarden(user) { return hasRole(user, 'warden'); }

/**
 * Build a MongoDB query filter that matches a user by role, accounting for
 * the fact that `role` can be stored as an array or string, and `currentRole`
 * may also be set.
 *
 * Replaces the repeated pattern:
 *   { $or: [{ role: X }, { role: { $in: [X] } }, { currentRole: X }] }
 *
 * @param {string} roleName
 * @returns {Object} Mongoose query filter
 */
function buildRoleQuery(roleName) {
  return {
    $or: [
      { role: roleName },
      { role: { $in: [roleName] } },
      { currentRole: roleName },
    ],
  };
}

module.exports = {
  normalizeRole,
  resolveCurrentRole,
  getUserRoles,
  hasRole,
  isSuperadmin,
  isOwner,
  isWarden,
  buildRoleQuery,
};
