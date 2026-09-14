/**
 * Shared map geometry and coordinate definitions
 */

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface Bounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface GeoFenceBoundary {
  type: 'circle' | 'rectangle' | 'polygon';
  bounds: Bounds | null;
  polygon: LatLng[] | null;
  center: LatLng | null;
  radius: number | null;
}

export interface HostelMapLocation {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
}

export interface BoundaryData {
  hostel: HostelMapLocation;
  geoFence: GeoFenceBoundary | null;
}

export const METERS_PER_DEG_LAT = 111320;
export const METERS_PER_DEG_LNG = (lat: number) => 111320 * Math.cos((lat * Math.PI) / 180);

/**
 * Returns a rectangular bounding box centered at (hostelLat, hostelLng) with specified size in meters.
 */
export function getDefaultBoundsAroundHostel(
  hostelLat: number,
  hostelLng: number,
  sizeMeters = 150
): Bounds {
  const dLat = sizeMeters / METERS_PER_DEG_LAT;
  const dLng = sizeMeters / METERS_PER_DEG_LNG(hostelLat);
  return {
    north: hostelLat + dLat / 2,
    south: hostelLat - dLat / 2,
    east: hostelLng + dLng / 2,
    west: hostelLng - dLng / 2,
  };
}

/**
 * Returns 4 corners of a quadrilateral (rectangle) around the hostel.
 */
export function getDefaultPolygonAroundHostel(
  hostelLat: number,
  hostelLng: number,
  sizeMeters = 150
): LatLng[] {
  const b = getDefaultBoundsAroundHostel(hostelLat, hostelLng, sizeMeters);
  return [
    { latitude: b.north, longitude: b.west },
    { latitude: b.north, longitude: b.east },
    { latitude: b.south, longitude: b.east },
    { latitude: b.south, longitude: b.west },
  ];
}

/**
 * Great-circle distance between two geographic coordinates in meters.
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // meters
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
