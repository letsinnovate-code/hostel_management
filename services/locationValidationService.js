// services/locationValidationService.js
/**
 * Authoritative Server-Side Location Validation Pipeline
 * 
 * Centralized location security and sensor validation:
 * 1. Strict coordinate bounds & data type sanitation
 * 2. GPS accuracy threshold validation
 * 3. GPS capture freshness and replay protection
 * 4. Authoritative server-side geofence calculation with checkout boundary buffer
 */

'use strict';

const { validateLocationWithGeoFence, validateLocation } = require('../utils/locationValidation');

const LOCATION_MAX_ACCURACY_METERS = Number(process.env.LOCATION_MAX_ACCURACY_METERS) || 100;
const LOCATION_MAX_AGE_SECONDS = Number(process.env.LOCATION_MAX_AGE_SECONDS) || 120;
const LOCATION_FUTURE_SKEW_TOLERANCE_SECONDS = 15;
const CHECKOUT_EXTERNAL_BUFFER_METERS = Number(process.env.CHECKOUT_EXTERNAL_BUFFER_METERS) || 300;

/**
 * Validates coordinate numbers and range.
 * @param {any} lat
 * @param {any} lng
 * @returns {{ valid: boolean, error?: string, code?: string }}
 */
function validateCoordinates(lat, lng) {
  if (lat == null || lng == null) {
    return {
      valid: false,
      code: 'LOCATION_REQUIRED',
      error: 'Location coordinates (latitude, longitude) are required',
    };
  }

  // Reject strings, objects, arrays, NaN, Infinity
  if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng) || !isFinite(lat) || !isFinite(lng)) {
    return {
      valid: false,
      code: 'INVALID_COORDINATES',
      error: 'Coordinates must be valid finite numbers',
    };
  }

  if (lat < -90 || lat > 90) {
    return {
      valid: false,
      code: 'INVALID_COORDINATES',
      error: `Latitude out of range [-90, 90]: received ${lat}`,
    };
  }

  if (lng < -180 || lng > 180) {
    return {
      valid: false,
      code: 'INVALID_COORDINATES',
      error: `Longitude out of range [-180, 180]: received ${lng}`,
    };
  }

  return { valid: true };
}

/**
 * Validates GPS accuracy measurement.
 * @param {any} accuracy
 * @param {number} [maxAllowedMeters=LOCATION_MAX_ACCURACY_METERS]
 * @returns {{ valid: boolean, accuracy?: number, error?: string, code?: string }}
 */
function validateAccuracy(accuracy, maxAllowedMeters = LOCATION_MAX_ACCURACY_METERS) {
  if (accuracy == null) {
    return {
      valid: false,
      code: 'LOCATION_ACCURACY_REQUIRED',
      error: 'GPS accuracy measurement is required for attendance verification',
    };
  }

  if (typeof accuracy !== 'number' || isNaN(accuracy) || !isFinite(accuracy) || accuracy <= 0) {
    return {
      valid: false,
      code: 'INVALID_ACCURACY',
      error: 'GPS accuracy must be a positive finite number',
    };
  }

  if (accuracy > maxAllowedMeters) {
    return {
      valid: false,
      code: 'LOCATION_ACCURACY_TOO_LOW',
      error: `GPS accuracy too low (${Math.round(accuracy)}m). Maximum allowed uncertainty is ${maxAllowedMeters}m. Please move to an open area with clear sky view.`,
    };
  }

  return { valid: true, accuracy: Math.round(accuracy * 10) / 10 };
}

/**
 * Validates GPS timestamp freshness against server arrival time.
 * @param {any} timestamp
 * @param {Date} [serverReceivedAt=new Date()]
 * @param {number} [maxAgeSeconds=LOCATION_MAX_AGE_SECONDS]
 * @returns {{ valid: boolean, capturedAt?: Date, ageSeconds?: number, error?: string, code?: string }}
 */
function validateFreshness(timestamp, serverReceivedAt = new Date(), maxAgeSeconds = LOCATION_MAX_AGE_SECONDS) {
  if (!timestamp) {
    return {
      valid: false,
      code: 'LOCATION_TIMESTAMP_REQUIRED',
      error: 'Location capture timestamp is required',
    };
  }

  const capturedAt = new Date(timestamp);
  if (isNaN(capturedAt.getTime())) {
    return {
      valid: false,
      code: 'LOCATION_TIMESTAMP_INVALID',
      error: 'Invalid location timestamp format',
    };
  }

  const ageSeconds = (serverReceivedAt.getTime() - capturedAt.getTime()) / 1000;

  // Future timestamp tolerance check (prevent clock spoofing beyond small clock skew)
  if (ageSeconds < -LOCATION_FUTURE_SKEW_TOLERANCE_SECONDS) {
    return {
      valid: false,
      code: 'LOCATION_TIMESTAMP_INVALID',
      error: `Device timestamp is in the future by ${Math.round(-ageSeconds)} seconds. Please synchronize your device clock.`,
    };
  }

  // Stale location check
  if (ageSeconds > maxAgeSeconds) {
    return {
      valid: false,
      code: 'LOCATION_TOO_OLD',
      error: `Location reading is stale (${Math.round(ageSeconds)}s old). Maximum allowed age is ${maxAgeSeconds}s. Please capture a fresh location.`,
    };
  }

  return { valid: true, capturedAt, ageSeconds: Math.round(ageSeconds) };
}

/**
 * Full parsing and validation of an incoming attendance location request body.
 * Supports both nested `{ location: { latitude, longitude, accuracy, timestamp } }`
 * and flat `{ location, accuracy, timestamp }`.
 * 
 * @param {Object} body - Request body
 * @param {Object} [options={}]
 * @returns {{ success: boolean, canonicalLocation?: Object, error?: string, code?: string, statusCode?: number }}
 */
function validateLocationRequest(body, options = {}) {
  const serverReceivedAt = new Date();
  const rawLoc = body?.location || {};
  
  const lat = rawLoc.latitude != null ? rawLoc.latitude : body?.latitude;
  const lng = rawLoc.longitude != null ? rawLoc.longitude : body?.longitude;
  const rawAcc = rawLoc.accuracy != null ? rawLoc.accuracy : body?.accuracy;
  const rawTs = rawLoc.timestamp != null ? rawLoc.timestamp : body?.timestamp;

  // 1. Validate coordinates
  const coordCheck = validateCoordinates(lat, lng);
  if (!coordCheck.valid) {
    return { success: false, code: coordCheck.code, error: coordCheck.error, statusCode: 400 };
  }

  // 2. Validate accuracy
  const accCheck = validateAccuracy(rawAcc, options.maxAccuracyMeters || LOCATION_MAX_ACCURACY_METERS);
  if (!accCheck.valid) {
    return { success: false, code: accCheck.code, error: accCheck.error, statusCode: 400 };
  }

  // 3. Validate freshness
  const freshCheck = validateFreshness(rawTs, serverReceivedAt, options.maxAgeSeconds || LOCATION_MAX_AGE_SECONDS);
  if (!freshCheck.valid) {
    return { success: false, code: freshCheck.code, error: freshCheck.error, statusCode: 400 };
  }

  return {
    success: true,
    canonicalLocation: {
      latitude: lat,
      longitude: lng,
      accuracyMeters: accCheck.accuracy,
      capturedAt: freshCheck.capturedAt,
      serverReceivedAt,
      ageSeconds: freshCheck.ageSeconds,
      source: body.source || 'web',
    },
  };
}

/**
 * Server-side authoritative evaluation of presence within hostel geofence.
 * Handles circular, polygonal, and rectangular geofences, with optional checkout buffer.
 * 
 * @param {Object} params
 * @param {Object} params.location - { latitude, longitude }
 * @param {Object} params.hostel - Hostel document
 * @param {Object} [params.geoFence] - Active GeoFence document
 * @param {boolean} [params.isCheckOut=false] - Whether evaluating a check-out request (applies buffer)
 * @returns {{ isValid: boolean, isInside: boolean, distance: number|null, message: string, code?: string }}
 */
function evaluateGeofence({ location, hostel, geoFence, isCheckOut = false }) {
  if (!hostel) {
    return { isValid: false, isInside: false, distance: null, code: 'HOSTEL_NOT_FOUND', message: 'Hostel not found' };
  }

  const hostelCoordinates = hostel.address?.coordinates?.latitude != null && hostel.address?.coordinates?.longitude != null
    ? { latitude: hostel.address.coordinates.latitude, longitude: hostel.address.coordinates.longitude }
    : null;

  const allowedBufferMeters = isCheckOut ? CHECKOUT_EXTERNAL_BUFFER_METERS : 0;

  if (geoFence && geoFence.type === 'polygon' && geoFence.polygon?.length >= 3) {
    const res = validateLocationWithGeoFence(location, hostelCoordinates, {
      polygon: geoFence.polygon,
      allowedBufferMeters,
    });
    return {
      isValid: res.isValid,
      isInside: res.isValid,
      isExactInside: res.isExactInside,
      distance: res.distance,
      message: res.message,
      code: res.isValid ? 'INSIDE_GEOFENCE' : 'OUTSIDE_GEOFENCE',
    };
  }

  if (geoFence && geoFence.type === 'rectangle' && geoFence.bounds) {
    const res = validateLocationWithGeoFence(location, hostelCoordinates, {
      bounds: geoFence.bounds,
      allowedBufferMeters,
    });
    return {
      isValid: res.isValid,
      isInside: res.isValid,
      isExactInside: res.isExactInside,
      distance: res.distance,
      message: res.message,
      code: res.isValid ? 'INSIDE_GEOFENCE' : 'OUTSIDE_GEOFENCE',
    };
  }

  if (hostelCoordinates || geoFence?.center) {
    const center = geoFence?.center?.latitude != null
      ? { latitude: geoFence.center.latitude, longitude: geoFence.center.longitude }
      : hostelCoordinates;
    const radius = geoFence?.type === 'circle' && geoFence?.radius != null ? geoFence.radius : 500;

    const res = validateLocationWithGeoFence(location, center, {
      allowedRadius: radius,
      allowedBufferMeters,
    });

    return {
      isValid: res.isValid,
      isInside: res.isValid,
      isExactInside: res.isExactInside,
      distance: res.distance,
      message: res.message,
      code: res.isValid ? 'INSIDE_GEOFENCE' : 'OUTSIDE_GEOFENCE',
    };
  }

  return {
    isValid: false,
    isInside: false,
    distance: null,
    code: 'GEOFENCE_NOT_CONFIGURED',
    message: 'Hostel location boundary is not configured by management.',
  };
}

const GEOFENCE_MAX_CIRCLE_RADIUS_METERS = 10000;

/**
 * Validates geofence configuration parameters (Issue 24).
 * @param {string} type - 'circle', 'polygon', or 'rectangle'
 * @param {Object} data - Configuration geometry
 * @returns {{ valid: boolean, normalized?: Object, error?: string }}
 */
function validateGeoFenceConfig(type, { center, radius, polygon, bounds } = {}) {
  if (!['circle', 'polygon', 'rectangle'].includes(type)) {
    return { valid: false, error: 'Invalid geofence type. Must be circle, polygon, or rectangle.' };
  }

  if (type === 'circle') {
    if (!center || typeof center.latitude !== 'number' || typeof center.longitude !== 'number' ||
        isNaN(center.latitude) || isNaN(center.longitude) || !isFinite(center.latitude) || !isFinite(center.longitude)) {
      return { valid: false, error: 'Circle geofence requires valid numeric center latitude and longitude.' };
    }
    if (center.latitude < -90 || center.latitude > 90 || center.longitude < -180 || center.longitude > 180) {
      return { valid: false, error: 'Center coordinates out of valid range [-90..90, -180..180].' };
    }
    if (typeof radius !== 'number' || isNaN(radius) || !isFinite(radius) || radius <= 0) {
      return { valid: false, error: 'Circle radius must be a positive number in meters.' };
    }
    if (radius > GEOFENCE_MAX_CIRCLE_RADIUS_METERS) {
      return { valid: false, error: `Circle radius exceeds maximum allowed (${GEOFENCE_MAX_CIRCLE_RADIUS_METERS}m).` };
    }
    return {
      valid: true,
      normalized: {
        center: { latitude: center.latitude, longitude: center.longitude },
        radius,
      },
    };
  }

  if (type === 'polygon') {
    if (!Array.isArray(polygon) || polygon.length < 3) {
      return { valid: false, error: 'Polygon geofence requires an array of at least 3 vertices.' };
    }
    const normalized = [];
    for (let i = 0; i < polygon.length; i++) {
      const p = polygon[i];
      const lat = Number(p?.latitude);
      const lng = Number(p?.longitude);
      if (isNaN(lat) || isNaN(lng) || !isFinite(lat) || !isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return { valid: false, error: `Polygon vertex at index ${i} has invalid coordinates.` };
      }
      normalized.push({ latitude: lat, longitude: lng });
    }
    // Check non-degenerate geometry: at least 3 distinct points
    const uniquePoints = new Set(normalized.map((p) => `${p.latitude.toFixed(6)},${p.longitude.toFixed(6)}`));
    if (uniquePoints.size < 3) {
      return { valid: false, error: 'Polygon geofence vertices must include at least 3 distinct non-identical points.' };
    }
    return {
      valid: true,
      normalized: { polygon: normalized },
    };
  }

  if (type === 'rectangle') {
    if (!bounds || typeof bounds.north !== 'number' || typeof bounds.south !== 'number' ||
        typeof bounds.east !== 'number' || typeof bounds.west !== 'number' ||
        isNaN(bounds.north) || isNaN(bounds.south) || isNaN(bounds.east) || isNaN(bounds.west) ||
        !isFinite(bounds.north) || !isFinite(bounds.south) || !isFinite(bounds.east) || !isFinite(bounds.west)) {
      return { valid: false, error: 'Rectangle geofence requires valid numeric north, south, east, and west bounds.' };
    }
    if (bounds.north < -90 || bounds.north > 90 || bounds.south < -90 || bounds.south > 90 ||
        bounds.east < -180 || bounds.east > 180 || bounds.west < -180 || bounds.west > 180) {
      return { valid: false, error: 'Rectangle bounds coordinates out of valid range [-90..90, -180..180].' };
    }
    if (bounds.north <= bounds.south) {
      return { valid: false, error: 'Rectangle north boundary must be strictly greater than south boundary.' };
    }
    if (bounds.east === bounds.west) {
      return { valid: false, error: 'Rectangle east and west boundaries cannot be identical.' };
    }
    return {
      valid: true,
      normalized: {
        bounds: {
          north: bounds.north,
          south: bounds.south,
          east: bounds.east,
          west: bounds.west,
        },
      },
    };
  }

  return { valid: false, error: 'Unsupported geofence type.' };
}

module.exports = {
  LOCATION_MAX_ACCURACY_METERS,
  LOCATION_MAX_AGE_SECONDS,
  LOCATION_FUTURE_SKEW_TOLERANCE_SECONDS,
  CHECKOUT_EXTERNAL_BUFFER_METERS,
  GEOFENCE_MAX_CIRCLE_RADIUS_METERS,
  validateCoordinates,
  validateAccuracy,
  validateFreshness,
  validateLocationRequest,
  evaluateGeofence,
  validateGeoFenceConfig,
};

