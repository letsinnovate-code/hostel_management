/**
 * @file adapters/geoAdapter.js
 * @description Infrastructure adapter decoupling direct Google Maps API SDK usage from business logic.
 */

'use strict';

const googleMapsUtils = require('../utils/googleMaps');

class GeoAdapter {
  /**
   * Geocode an address string into latitude, longitude, and place details
   */
  static async geocodeAddress(address) {
    return await googleMapsUtils.geocodeAddress(address);
  }

  /**
   * Find nearby points of interest
   */
  static async getNearbyPlaces(latitude, longitude, types) {
    return await googleMapsUtils.getNearbyPlaces(latitude, longitude, types);
  }

  /**
   * Calculate haversine distance between two coordinates in meters
   */
  static calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth radius in meters
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }
}

module.exports = GeoAdapter;
