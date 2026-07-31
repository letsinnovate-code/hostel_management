/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {Object} coord1 - {latitude, longitude}
 * @param {Object} coord2 - {latitude, longitude}
 * @returns {Number} Distance in meters
 */
function calculateDistance(coord1, coord2) {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (coord1.latitude * Math.PI) / 180;
  const φ2 = (coord2.latitude * Math.PI) / 180;
  const Δφ = ((coord2.latitude - coord1.latitude) * Math.PI) / 180;
  const Δλ = ((coord2.longitude - coord1.longitude) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

/**
 * Validate if location is within allowed radius
 * @param {Object} userLocation - {latitude, longitude}
 * @param {Object} hostelLocation - {latitude, longitude}
 * @param {Number} allowedRadius - Radius in meters (default: 100m)
 * @returns {Object} {isValid: boolean, distance: number, message: string}
 */
function validateLocation(userLocation, hostelLocation, allowedRadius = 100) {
  if (!userLocation || !userLocation.latitude || !userLocation.longitude) {
    return {
      isValid: false,
      distance: null,
      message: 'Location coordinates are required',
    };
  }

  if (!hostelLocation || !hostelLocation.latitude || !hostelLocation.longitude) {
    return {
      isValid: false,
      distance: null,
      message: 'Hostel location not configured',
    };
  }

  const distance = calculateDistance(userLocation, hostelLocation);

  if (distance > allowedRadius) {
    return {
      isValid: false,
      distance: Math.round(distance),
      message: `You are ${Math.round(distance)}m away from the hostel. Please be within ${allowedRadius}m to check in/out.`,
    };
  }

  return {
    isValid: true,
    distance: Math.round(distance),
    message: 'Location validated successfully',
  };
}

/**
 * Check if a point is inside a rectangle (bounds)
 * @param {Object} point - {latitude, longitude}
 * @param {Object} bounds - {north, south, east, west} in degrees
 * @returns {boolean}
 */
function isInsideBounds(point, bounds) {
  if (!point || point.latitude == null || point.longitude == null) return false;
  if (!bounds || bounds.north == null || bounds.south == null || bounds.east == null || bounds.west == null) return false;
  const lat = point.latitude;
  const lng = point.longitude;
  const minLat = Math.min(bounds.north, bounds.south);
  const maxLat = Math.max(bounds.north, bounds.south);
  const minLng = Math.min(bounds.east, bounds.west);
  const maxLng = Math.max(bounds.east, bounds.west);
  return lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng;
}

/**
 * Point-in-polygon (ray casting). Polygon = array of { latitude, longitude }.
 * @param {Object} point - {latitude, longitude}
 * @param {Array<{latitude: number, longitude: number}>} polygon
 * @returns {boolean}
 */
function isInsidePolygon(point, polygon) {
  if (!point || point.latitude == null || point.longitude == null) return false;
  if (!polygon || !Array.isArray(polygon) || polygon.length < 3) return false;
  const x = point.longitude;
  const y = point.latitude;
  let inside = false;
  const n = polygon.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].longitude;
    const yi = polygon[i].latitude;
    const xj = polygon[j].longitude;
    const yj = polygon[j].latitude;
    const intersect = yi > y !== yj > y && x < (xj - xi) * (y - yi) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Validate location against hostel: rectangle bounds, polygon, or circle radius
 * @param {Object} userLocation - {latitude, longitude}
 * @param {Object} hostelLocation - {latitude, longitude} (for circle)
 * @param {Object} options - { allowedRadius?, bounds?, polygon? }
 * @returns {Object} { isValid, distance?, message }
 */
function validateLocationWithGeoFence(userLocation, hostelLocation, options = {}) {
  const { allowedRadius = 500, bounds, polygon } = options;
  if (!userLocation || !userLocation.latitude || !userLocation.longitude) {
    return { isValid: false, distance: null, message: 'Location coordinates are required' };
  }
  if (polygon && polygon.length >= 3) {
    const inside = isInsidePolygon(userLocation, polygon);
    const distance = hostelLocation && hostelLocation.latitude != null
      ? calculateDistance(userLocation, hostelLocation)
      : null;
    return {
      isValid: inside,
      distance: distance != null ? Math.round(distance) : null,
      message: inside ? 'You are inside the hostel boundary.' : 'You are outside the hostel boundary.',
    };
  }
  if (bounds && [bounds.north, bounds.south, bounds.east, bounds.west].every((v) => v != null)) {
    const inside = isInsideBounds(userLocation, bounds);
    const distance = hostelLocation && hostelLocation.latitude != null
      ? calculateDistance(userLocation, hostelLocation)
      : null;
    return {
      isValid: inside,
      distance: distance != null ? Math.round(distance) : null,
      message: inside ? 'You are inside the hostel boundary.' : 'You are outside the hostel boundary.',
    };
  }
  if (!hostelLocation || hostelLocation.latitude == null || hostelLocation.longitude == null) {
    return { isValid: false, distance: null, message: 'Hostel location not configured' };
  }
  return validateLocation(userLocation, hostelLocation, allowedRadius);
}

module.exports = {
  calculateDistance,
  validateLocation,
  isInsideBounds,
  isInsidePolygon,
  validateLocationWithGeoFence,
};

