// Track operations - split, join, reverse, simplify
// Ported from RideLeader's GPX.pas

import type { GPXWaypoint, GPXTrack, GPXTrackSegment, GPXRoute } from './types';
import { generateId, getNextTrackColor } from './types';
import { haversineDistance } from './calculations';

/**
 * Split a track segment at a specific point index
 * Original: TGPXptList.CutPointList in GPX.pas
 */
export function splitSegmentAtIndex(
  segment: GPXTrackSegment,
  splitIndex: number
): [GPXTrackSegment, GPXTrackSegment] {
  if (splitIndex <= 0 || splitIndex >= segment.points.length - 1) {
    throw new Error('Split index must be within the segment');
  }

  const firstPoints = segment.points.slice(0, splitIndex + 1).map(p => ({ ...p, id: generateId() }));
  const secondPoints = segment.points.slice(splitIndex).map(p => ({ ...p, id: generateId() }));

  return [
    { id: generateId(), points: firstPoints, enabled: true },
    { id: generateId(), points: secondPoints, enabled: true },
  ];
}

/**
 * Split a track at a specific segment and point
 */
export function splitTrack(
  track: GPXTrack,
  segmentId: string,
  pointIndex: number
): [GPXTrack, GPXTrack] {
  const segIndex = track.segments.findIndex(s => s.id === segmentId);
  if (segIndex === -1) throw new Error('Segment not found');

  const segment = track.segments[segIndex];
  const [firstSeg, secondSeg] = splitSegmentAtIndex(segment, pointIndex);

  const firstTrack: GPXTrack = {
    ...track,
    id: generateId(),
    name: track.name ? `${track.name} (1)` : 'Track (1)',
    segments: [
      ...track.segments.slice(0, segIndex),
      firstSeg,
    ],
    color: track.color,
    expanded: true,
  };

  const secondTrack: GPXTrack = {
    ...track,
    id: generateId(),
    name: track.name ? `${track.name} (2)` : 'Track (2)',
    segments: [
      secondSeg,
      ...track.segments.slice(segIndex + 1),
    ],
    color: getNextTrackColor(),
    expanded: true,
  };

  return [firstTrack, secondTrack];
}

/**
 * Join two track segments
 * Original: TGPXline.Join in GPX.pas
 */
export function joinSegments(
  seg1: GPXTrackSegment,
  seg2: GPXTrackSegment
): GPXTrackSegment {
  return {
    id: generateId(),
    points: [...seg1.points, ...seg2.points],
    enabled: true,
  };
}

/**
 * Join two tracks into one
 */
export function joinTracks(track1: GPXTrack, track2: GPXTrack): GPXTrack {
  return {
    ...track1,
    id: generateId(),
    name: track1.name || track2.name || 'Joined Track',
    segments: [...track1.segments, ...track2.segments],
  };
}

/**
 * Merge all segments in a track into one
 */
export function mergeTrackSegments(track: GPXTrack): GPXTrack {
  const allPoints = track.segments.flatMap(seg => seg.points);
  return {
    ...track,
    segments: [{
      id: generateId(),
      points: allPoints,
      enabled: true,
    }],
  };
}

/**
 * Reverse the point order in a segment
 * Original: TGPXline.Reverse in GPX.pas
 */
export function reverseSegment(segment: GPXTrackSegment): GPXTrackSegment {
  return {
    ...segment,
    points: [...segment.points].reverse(),
  };
}

/**
 * Reverse the point order in a track (reverses all segments and their order)
 */
export function reverseTrack(track: GPXTrack): GPXTrack {
  return {
    ...track,
    segments: track.segments
      .map(seg => reverseSegment(seg))
      .reverse(),
  };
}

/**
 * Reverse the point order in a route
 */
export function reverseRoute(route: GPXRoute): GPXRoute {
  return {
    ...route,
    points: [...route.points].reverse(),
  };
}

/**
 * Convert a route to a track
 */
export function routeToTrack(route: GPXRoute): GPXTrack {
  return {
    id: generateId(),
    name: route.name,
    desc: route.desc,
    cmt: route.cmt,
    src: route.src,
    type: route.type,
    number: route.number,
    link: route.link,
    segments: [{
      id: generateId(),
      points: route.points.map(p => ({ ...p, id: generateId() })),
      enabled: true,
    }],
    color: route.color,
    enabled: true,
    expanded: true,
  };
}

/**
 * Convert a track to a route (flattens all segments)
 */
export function trackToRoute(track: GPXTrack): GPXRoute {
  const allPoints = track.segments.flatMap(seg =>
    seg.points.map(p => ({ ...p, id: generateId() }))
  );

  return {
    id: generateId(),
    name: track.name,
    desc: track.desc,
    cmt: track.cmt,
    src: track.src,
    type: track.type,
    number: track.number,
    link: track.link,
    points: allPoints,
    color: track.color,
    enabled: true,
  };
}

/**
 * Create a route from selected waypoints
 */
export function waypointsToRoute(waypoints: GPXWaypoint[], name?: string): GPXRoute {
  return {
    id: generateId(),
    name: name || 'New Route',
    points: waypoints.map(p => ({ ...p, id: generateId() })),
    color: getNextTrackColor(),
    enabled: true,
  };
}

/**
 * Douglas-Peucker track simplification
 * Original: Filter.pas
 */
export function simplifyTrack(
  points: GPXWaypoint[],
  tolerance: number
): GPXWaypoint[] {
  if (points.length <= 2) {
    return [...points];
  }

  // Find point with maximum perpendicular distance
  let maxDistance = 0;
  let maxIndex = 0;

  const first = points[0];
  const last = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const distance = perpendicularDistance(points[i], first, last);
    if (distance > maxDistance) {
      maxDistance = distance;
      maxIndex = i;
    }
  }

  // If max distance is greater than tolerance, recursively simplify
  if (maxDistance > tolerance) {
    const left = simplifyTrack(points.slice(0, maxIndex + 1), tolerance);
    const right = simplifyTrack(points.slice(maxIndex), tolerance);
    return [...left.slice(0, -1), ...right];
  }

  // Otherwise, just keep first and last
  return [first, last];
}

/**
 * Calculate perpendicular distance from a point to a line
 */
function perpendicularDistance(
  point: GPXWaypoint,
  lineStart: GPXWaypoint,
  lineEnd: GPXWaypoint
): number {
  const dx = lineEnd.lon - lineStart.lon;
  const dy = lineEnd.lat - lineStart.lat;

  // Line length squared
  const lineLenSq = dx * dx + dy * dy;

  if (lineLenSq === 0) {
    // Line start and end are the same point
    return haversineDistance(point.lat, point.lon, lineStart.lat, lineStart.lon);
  }

  // Project point onto line
  const t = Math.max(0, Math.min(1,
    ((point.lon - lineStart.lon) * dx + (point.lat - lineStart.lat) * dy) / lineLenSq
  ));

  const projLon = lineStart.lon + t * dx;
  const projLat = lineStart.lat + t * dy;

  return haversineDistance(point.lat, point.lon, projLat, projLon);
}

/**
 * Remove empty segments from a track
 */
export function removeEmptySegments(track: GPXTrack): GPXTrack {
  return {
    ...track,
    segments: track.segments.filter(seg => seg.points.length > 0),
  };
}

/**
 * Sort points by date
 */
export function sortPointsByDate(points: GPXWaypoint[]): GPXWaypoint[] {
  return [...points].sort((a, b) => {
    if (!a.time) return 1;
    if (!b.time) return -1;
    return new Date(a.time).getTime() - new Date(b.time).getTime();
  });
}

/**
 * Sort points by name
 */
export function sortPointsByName(points: GPXWaypoint[]): GPXWaypoint[] {
  return [...points].sort((a, b) => {
    const nameA = a.name?.toLowerCase() || '';
    const nameB = b.name?.toLowerCase() || '';
    return nameA.localeCompare(nameB);
  });
}
