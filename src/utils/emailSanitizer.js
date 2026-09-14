/**
 * @file emailSanitizer.js
 * @description Security sanitization and template variable compiler for email system.
 * Prevents HTML/XSS injection, validates URLs and email addresses.
 */

'use strict';

/**
 * Escapes HTML characters in untrusted user strings to prevent HTML injection.
 * 
 * @param {*} val - Value to escape
 * @returns {string} Safe HTML string
 */
function escapeHtml(val) {
  if (val === null || val === undefined) return '';
  const str = String(val);
  const matchHtmlRegExp = /["'&<>]/;
  if (!matchHtmlRegExp.test(str)) {
    return str;
  }
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * Validates and sanitizes a URL for email hyperlinks.
 * Strictly permits only http: and https: protocols to prevent javascript: and data: attacks.
 * 
 * @param {string} url - Target URL
 * @param {string} [fallback='#'] - Fallback URL if invalid
 * @returns {string} Safe URL
 */
function sanitizeUrl(url, fallback = '#') {
  if (!url || typeof url !== 'string') return fallback;
  const trimmed = url.trim();
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return escapeHtml(trimmed);
    }
    return fallback;
  } catch (_) {
    // Relative URLs safe for domain relative routing
    if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
      return escapeHtml(trimmed);
    }
    return fallback;
  }
}

/**
 * Validates email address format using RFC 5322 regex.
 * 
 * @param {string} email - Email address to test
 * @returns {boolean} True if email is valid
 */
function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim();
  if (trimmed.length > 254) return false;
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  return emailRegex.test(trimmed);
}

/**
 * Masks an email address for safe logging without exposing full identity.
 * e.g. "student.test@example.com" -> "st***st@example.com"
 * 
 * @param {string} email
 * @returns {string} Masked email
 */
function maskEmail(email) {
  if (!email || typeof email !== 'string') return '[invalid-email]';
  const parts = email.split('@');
  if (parts.length !== 2) return '[invalid-email]';
  const name = parts[0];
  const domain = parts[1];
  if (name.length <= 2) {
    return `${name[0] || '*'}***@${domain}`;
  }
  return `${name.slice(0, 2)}***${name.slice(-1)}@${domain}`;
}

/**
 * Compiles a template string by substituting {{variable}} placeholders with sanitized values.
 * If safeUrls list is provided, matching placeholders will be sanitized as URLs rather than raw HTML.
 * 
 * @param {string} template - The template string
 * @param {Object} variables - Dictionary of variable values
 * @param {Object} [options]
 * @param {boolean} [options.isHtml=true] - Whether to HTML-escape variables
 * @param {string[]} [options.urlFields=[]] - Fields that should be sanitized as URLs
 * @returns {string} Compiled string
 */
function compileTemplate(template, variables = {}, options = {}) {
  const { isHtml = true, urlFields = ['appUrl', 'dashboardUrl', 'unsubscribeUrl', 'loginUrl'] } = options;
  if (!template || typeof template !== 'string') return '';

  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key) => {
    const rawVal = variables[key];
    if (rawVal === undefined || rawVal === null) return '';

    if (urlFields.includes(key)) {
      return sanitizeUrl(String(rawVal));
    }

    if (isHtml) {
      return escapeHtml(rawVal);
    }

    return String(rawVal);
  });
}

module.exports = {
  escapeHtml,
  sanitizeUrl,
  isValidEmail,
  maskEmail,
  compileTemplate,
};
