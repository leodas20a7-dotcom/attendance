/**
 * Geolocation & Geofencing Utilities for Convenio Marts
 * Uses high-precision Haversine formula to measure distance between
 * staff coordinates and shop branch coordinates in meters.
 */

const EARTH_RADIUS_METERS = 6371000;
export const DEFAULT_GEOFENCE_RADIUS_METERS = 50;

/**
 * Calculates distance between two GPS coordinates using the Haversine formula.
 * @param {number} lat1 Latitude of point 1
 * @param {number} lon1 Longitude of point 1
 * @param {number} lat2 Latitude of point 2
 * @param {number} lon2 Longitude of point 2
 * @returns {number} Distance in meters rounded to nearest whole meter
 */
export function getDistanceInMeters(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) {
    return Infinity;
  }

  const toRad = (value) => (Number(value) * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(EARTH_RADIUS_METERS * c);
}

/**
 * Evaluates user's location against all active branches.
 * @param {number} userLat
 * @param {number} userLng
 * @param {Array} branches
 * @returns {{
 *   nearestBranch: Object|null,
 *   distanceMeters: number,
 *   isWithinGeofence: boolean,
 *   allBranchesWithDistance: Array
 * }}
 */
export function findNearestBranch(userLat, userLng, branches = []) {
  if (!branches || branches.length === 0 || userLat == null || userLng == null) {
    return {
      nearestBranch: null,
      distanceMeters: Infinity,
      isWithinGeofence: false,
      allBranchesWithDistance: []
    };
  }

  const evaluated = branches
    .filter((b) => b.lat != null && b.lng != null)
    .map((branch) => {
      const distance = getDistanceInMeters(userLat, userLng, branch.lat, branch.lng);
      const radius = branch.geofenceRadiusMeters || DEFAULT_GEOFENCE_RADIUS_METERS;
      return {
        ...branch,
        distanceMeters: distance,
        isWithinRadius: distance <= radius
      };
    })
    .sort((a, b) => a.distanceMeters - b.distanceMeters);

  if (evaluated.length === 0) {
    return {
      nearestBranch: null,
      distanceMeters: Infinity,
      isWithinGeofence: false,
      allBranchesWithDistance: []
    };
  }

  const nearest = evaluated[0];
  const radius = nearest.geofenceRadiusMeters || DEFAULT_GEOFENCE_RADIUS_METERS;

  return {
    nearestBranch: nearest,
    distanceMeters: nearest.distanceMeters,
    isWithinGeofence: nearest.distanceMeters <= radius,
    allBranchesWithDistance: evaluated
  };
}

/**
 * Asynchronously acquires the current device GPS position via browser Geolocation API.
 * Uses high accuracy for precise geofencing.
 * @param {Object} options
 * @returns {Promise<{lat: number, lng: number, accuracy: number}>}
 */
export function getCurrentDeviceLocation(options = {}) {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      return reject({
        code: 'NOT_SUPPORTED',
        message: 'Location services are not supported by your browser.'
      });
    }

    const defaultOptions = {
      enableHighAccuracy: true,
      timeout: 12000,
      maximumAge: 0,
      ...options
    };

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: Math.round(position.coords.accuracy || 0)
        });
      },
      (error) => {
        let code = 'UNKNOWN_ERROR';
        let message = 'Unable to determine your current location.';

        if (error.code === error.PERMISSION_DENIED) {
          code = 'PERMISSION_DENIED';
          message = 'Location access was denied. Please allow location access in your browser settings to verify store attendance.';
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          code = 'POSITION_UNAVAILABLE';
          message = 'GPS signal is currently unavailable. Please ensure your device location is turned on and try again.';
        } else if (error.code === error.TIMEOUT) {
          code = 'TIMEOUT';
          message = 'Location request timed out. Please try refreshing.';
        }

        reject({ code, message, originalError: error });
      },
      defaultOptions
    );
  });
}

/**
 * Formats distance in meters into human readable strings (e.g. "32m", "1.4 km").
 * @param {number} meters
 * @returns {string}
 */
export function formatDistance(meters) {
  if (meters == null || !Number.isFinite(meters)) return 'Unknown distance';
  if (meters < 1000) return `${meters}m`;
  return `${(meters / 1000).toFixed(1)} km`;
}
