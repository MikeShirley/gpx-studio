// Geographic calculations ported from RideLeader's GPX.pas
import type { GPXWaypoint, BoundingBox, TrackStatistics } from './types';

const EARTH_RADIUS_METERS = 6371000;
const MOVING_THRESHOLD_MPS = 0.5; // m/s - speeds below this are "stopped"
const FLAT_THRESHOLD_METERS = 1; // elevation changes smaller than this are "flat"

// Convert degrees to radians
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Calculate great-circle distance between two points using Haversine formula
 * Original: TGPXwpt.WGS84Distance in GPX.pas
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * c;
}

/**
 * Calculate bounding box for a set of points
 * Original: TGPXptList.CalcBBox in GPX.pas
 */
export function calculateBoundingBox(points: GPXWaypoint[]): BoundingBox {
  if (points.length === 0) {
    return { north: 0, south: 0, east: 0, west: 0, valid: false };
  }

  let north = -90;
  let south = 90;
  let east = -180;
  let west = 180;

  for (const point of points) {
    if (point.lat > north) north = point.lat;
    if (point.lat < south) south = point.lat;
    if (point.lon > east) east = point.lon;
    if (point.lon < west) west = point.lon;
  }

  return { north, south, east, west, valid: true };
}

/**
 * Merge two bounding boxes
 */
export function mergeBoundingBoxes(box1: BoundingBox, box2: BoundingBox): BoundingBox {
  if (!box1.valid) return box2;
  if (!box2.valid) return box1;

  return {
    north: Math.max(box1.north, box2.north),
    south: Math.min(box1.south, box2.south),
    east: Math.max(box1.east, box2.east),
    west: Math.min(box1.west, box2.west),
    valid: true,
  };
}

/**
 * Calculate total distance of a point sequence
 * Original: TGPXline.Length in GPX.pas
 */
export function calculateTotalDistance(points: GPXWaypoint[]): number {
  if (points.length < 2) return 0;

  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversineDistance(
      points[i - 1].lat,
      points[i - 1].lon,
      points[i].lat,
      points[i].lon
    );
  }
  return total;
}

/**
 * Calculate comprehensive track statistics
 * Original: Various Find* functions in GPX.pas
 */
export function calculateStatistics(points: GPXWaypoint[]): TrackStatistics {
  const empty: TrackStatistics = {
    distance: 0,
    movingTime: 0,
    totalTime: 0,
    restTime: 0,
    avgSpeed: 0,
    movingSpeed: 0,
    maxSpeed: 0,
    totalClimb: 0,
    totalDescent: 0,
    minElevation: 0,
    maxElevation: 0,
    avgElevation: 0,
    steepestClimb: 0,
    steepestDescent: 0,
    climbDistance: 0,
    descentDistance: 0,
    flatDistance: 0,
    pointCount: points.length,
  };

  if (points.length < 2) {
    if (points.length === 1 && points[0].ele !== undefined) {
      empty.minElevation = points[0].ele;
      empty.maxElevation = points[0].ele;
      empty.avgElevation = points[0].ele;
    }
    return empty;
  }

  let totalDistance = 0;
  let movingDistance = 0;
  let movingTime = 0;
  let restTime = 0;
  let maxSpeed = 0;
  let totalClimb = 0;
  let totalDescent = 0;
  let climbDistance = 0;
  let descentDistance = 0;
  let flatDistance = 0;
  let steepestClimb = 0;
  let steepestDescent = 0;

  // Elevation stats
  const elevations = points.filter((p) => p.ele !== undefined).map((p) => p.ele!);
  const minElevation = elevations.length > 0 ? Math.min(...elevations) : 0;
  const maxElevation = elevations.length > 0 ? Math.max(...elevations) : 0;
  const avgElevation = elevations.length > 0
    ? elevations.reduce((a, b) => a + b, 0) / elevations.length
    : 0;

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];

    const distance = haversineDistance(prev.lat, prev.lon, curr.lat, curr.lon);
    totalDistance += distance;

    // Time-based calculations
    if (prev.time && curr.time) {
      const timeDiff = (new Date(curr.time).getTime() - new Date(prev.time).getTime()) / 1000;

      if (timeDiff > 0) {
        const speed = distance / timeDiff;

        if (speed > MOVING_THRESHOLD_MPS) {
          movingDistance += distance;
          movingTime += timeDiff;
          if (speed > maxSpeed) maxSpeed = speed;
        } else {
          restTime += timeDiff;
        }
      }
    }

    // Elevation-based calculations
    if (prev.ele !== undefined && curr.ele !== undefined) {
      const eleDiff = curr.ele - prev.ele;
      const grade = distance > 0 ? (eleDiff / distance) * 100 : 0;

      if (Math.abs(eleDiff) > FLAT_THRESHOLD_METERS) {
        if (eleDiff > 0) {
          totalClimb += eleDiff;
          climbDistance += distance;
          if (grade > steepestClimb) steepestClimb = grade;
        } else {
          totalDescent += Math.abs(eleDiff);
          descentDistance += distance;
          if (Math.abs(grade) > steepestDescent) steepestDescent = Math.abs(grade);
        }
      } else {
        flatDistance += distance;
      }
    } else {
      flatDistance += distance;
    }
  }

  // Calculate total time
  let totalTime = 0;
  if (points[0].time && points[points.length - 1].time) {
    totalTime = (new Date(points[points.length - 1].time!).getTime() -
                 new Date(points[0].time!).getTime()) / 1000;
  }

  return {
    distance: totalDistance,
    movingTime,
    totalTime,
    restTime,
    avgSpeed: totalTime > 0 ? totalDistance / totalTime : 0,
    movingSpeed: movingTime > 0 ? movingDistance / movingTime : 0,
    maxSpeed,
    totalClimb,
    totalDescent,
    minElevation,
    maxElevation,
    avgElevation,
    steepestClimb,
    steepestDescent,
    climbDistance,
    descentDistance,
    flatDistance,
    pointCount: points.length,
  };
}

/**
 * Find the closest point in a list to a target location
 * Original: TGPXline.FindClosestPoint in GPX.pas
 */
export function findClosestPoint(
  points: GPXWaypoint[],
  targetLat: number,
  targetLon: number
): { point: GPXWaypoint; index: number; distance: number } | null {
  if (points.length === 0) return null;

  let closestIndex = 0;
  let closestDistance = haversineDistance(
    points[0].lat,
    points[0].lon,
    targetLat,
    targetLon
  );

  for (let i = 1; i < points.length; i++) {
    const distance = haversineDistance(
      points[i].lat,
      points[i].lon,
      targetLat,
      targetLon
    );

    if (distance < closestDistance) {
      closestDistance = distance;
      closestIndex = i;
    }
  }

  return {
    point: points[closestIndex],
    index: closestIndex,
    distance: closestDistance,
  };
}

/**
 * Calculate distance between two specific points
 */
export function distanceBetween(p1: GPXWaypoint, p2: GPXWaypoint): number {
  return haversineDistance(p1.lat, p1.lon, p2.lat, p2.lon);
}
