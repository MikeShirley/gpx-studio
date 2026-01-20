# GPX Editor - Algorithm Reference

This document contains TypeScript implementations of the core algorithms from RideLeader's `GPX.pas`, ready to be used in the modern web application.

## Geographic Calculations

### Haversine Distance

Calculate the great-circle distance between two points on Earth.

```typescript
// Original: TGPXwpt.WGS84Distance in GPX.pas

const EARTH_RADIUS_METERS = 6371000;

export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (deg: number) => deg * (Math.PI / 180);

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * c;
}
```

### Bounding Box Calculation

```typescript
// Original: TGPXptList.CalcBBox in GPX.pas

export interface BoundingBox {
  north: number;
  south: number;
  east: number;
  west: number;
  valid: boolean;
}

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
```

### ECEF Coordinate Conversion

```typescript
// Original: TGPXwpt.ToECEF in GPX.pas

export interface ECEFPoint {
  x: number;
  y: number;
  z: number;
}

const WGS84_A = 6378137.0; // Semi-major axis
const WGS84_F = 1 / 298.257223563; // Flattening
const WGS84_E2 = 2 * WGS84_F - WGS84_F * WGS84_F; // Eccentricity squared

export function toECEF(lat: number, lon: number, alt: number = 0): ECEFPoint {
  const latRad = lat * (Math.PI / 180);
  const lonRad = lon * (Math.PI / 180);

  const sinLat = Math.sin(latRad);
  const cosLat = Math.cos(latRad);
  const sinLon = Math.sin(lonRad);
  const cosLon = Math.cos(lonRad);

  const N = WGS84_A / Math.sqrt(1 - WGS84_E2 * sinLat * sinLat);

  return {
    x: (N + alt) * cosLat * cosLon,
    y: (N + alt) * cosLat * sinLon,
    z: (N * (1 - WGS84_E2) + alt) * sinLat,
  };
}
```

## Track Statistics

### Total Distance

```typescript
// Original: TGPXline.Length in GPX.pas

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
```

### Elevation Statistics

```typescript
// Original: FindTotalClimb, FindTotalDescent, FindMinAlt, FindMaxAlt in GPX.pas

export interface ElevationStats {
  totalClimb: number;
  totalDescent: number;
  minElevation: number;
  maxElevation: number;
  avgElevation: number;
  climbDistance: number;
  descentDistance: number;
  flatDistance: number;
  steepestClimb: number;   // percentage grade
  steepestDescent: number; // percentage grade
}

const FLAT_THRESHOLD = 1; // meters - ignore elevation changes smaller than this
const CLIMB_GRADE_THRESHOLD = 2; // percentage - grades below this are "flat"

export function calculateElevationStats(points: GPXWaypoint[]): ElevationStats {
  const pointsWithEle = points.filter((p) => p.ele !== undefined && p.ele !== null);

  if (pointsWithEle.length < 2) {
    return {
      totalClimb: 0,
      totalDescent: 0,
      minElevation: pointsWithEle[0]?.ele ?? 0,
      maxElevation: pointsWithEle[0]?.ele ?? 0,
      avgElevation: pointsWithEle[0]?.ele ?? 0,
      climbDistance: 0,
      descentDistance: 0,
      flatDistance: 0,
      steepestClimb: 0,
      steepestDescent: 0,
    };
  }

  let totalClimb = 0;
  let totalDescent = 0;
  let minElevation = pointsWithEle[0].ele!;
  let maxElevation = pointsWithEle[0].ele!;
  let elevationSum = 0;
  let climbDistance = 0;
  let descentDistance = 0;
  let flatDistance = 0;
  let steepestClimb = 0;
  let steepestDescent = 0;

  for (let i = 0; i < pointsWithEle.length; i++) {
    const ele = pointsWithEle[i].ele!;
    elevationSum += ele;

    if (ele < minElevation) minElevation = ele;
    if (ele > maxElevation) maxElevation = ele;

    if (i > 0) {
      const prevEle = pointsWithEle[i - 1].ele!;
      const eleDiff = ele - prevEle;
      const distance = haversineDistance(
        pointsWithEle[i - 1].lat,
        pointsWithEle[i - 1].lon,
        pointsWithEle[i].lat,
        pointsWithEle[i].lon
      );

      // Calculate grade percentage
      const grade = distance > 0 ? (eleDiff / distance) * 100 : 0;

      if (Math.abs(eleDiff) > FLAT_THRESHOLD) {
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
    }
  }

  return {
    totalClimb,
    totalDescent,
    minElevation,
    maxElevation,
    avgElevation: elevationSum / pointsWithEle.length,
    climbDistance,
    descentDistance,
    flatDistance,
    steepestClimb,
    steepestDescent,
  };
}
```

### Speed Statistics

```typescript
// Original: FindMovingSpeed, FindAvgSpeed, FindMaxSpeed, FindRestTime in GPX.pas

export interface SpeedStats {
  avgSpeed: number;        // m/s - total distance / total time
  movingSpeed: number;     // m/s - distance / moving time
  maxSpeed: number;        // m/s
  climbSpeed: number;      // m/s - average speed while climbing
  descentSpeed: number;    // m/s - average speed while descending
}

export interface TimeStats {
  totalTime: number;       // seconds
  movingTime: number;      // seconds
  restTime: number;        // seconds
}

const MOVING_THRESHOLD = 0.5; // m/s - speeds below this are considered "stopped"

export function calculateSpeedStats(points: GPXWaypoint[]): SpeedStats {
  const pointsWithTime = points.filter((p) => p.time);

  if (pointsWithTime.length < 2) {
    return {
      avgSpeed: 0,
      movingSpeed: 0,
      maxSpeed: 0,
      climbSpeed: 0,
      descentSpeed: 0,
    };
  }

  let totalDistance = 0;
  let movingDistance = 0;
  let movingTime = 0;
  let maxSpeed = 0;
  let climbDistance = 0;
  let climbTime = 0;
  let descentDistance = 0;
  let descentTime = 0;

  for (let i = 1; i < pointsWithTime.length; i++) {
    const prev = pointsWithTime[i - 1];
    const curr = pointsWithTime[i];

    const distance = haversineDistance(prev.lat, prev.lon, curr.lat, curr.lon);
    const timeDiff =
      (new Date(curr.time!).getTime() - new Date(prev.time!).getTime()) / 1000;

    if (timeDiff <= 0) continue;

    const speed = distance / timeDiff;
    totalDistance += distance;

    if (speed > MOVING_THRESHOLD) {
      movingDistance += distance;
      movingTime += timeDiff;

      if (speed > maxSpeed) maxSpeed = speed;

      // Track climb/descent speeds if elevation data available
      if (prev.ele !== undefined && curr.ele !== undefined) {
        const eleDiff = curr.ele - prev.ele;
        if (eleDiff > 1) {
          climbDistance += distance;
          climbTime += timeDiff;
        } else if (eleDiff < -1) {
          descentDistance += distance;
          descentTime += timeDiff;
        }
      }
    }
  }

  const firstTime = new Date(pointsWithTime[0].time!).getTime();
  const lastTime = new Date(pointsWithTime[pointsWithTime.length - 1].time!).getTime();
  const totalTime = (lastTime - firstTime) / 1000;

  return {
    avgSpeed: totalTime > 0 ? totalDistance / totalTime : 0,
    movingSpeed: movingTime > 0 ? movingDistance / movingTime : 0,
    maxSpeed,
    climbSpeed: climbTime > 0 ? climbDistance / climbTime : 0,
    descentSpeed: descentTime > 0 ? descentDistance / descentTime : 0,
  };
}

export function calculateTimeStats(points: GPXWaypoint[]): TimeStats {
  const pointsWithTime = points.filter((p) => p.time);

  if (pointsWithTime.length < 2) {
    return { totalTime: 0, movingTime: 0, restTime: 0 };
  }

  let movingTime = 0;
  let restTime = 0;

  for (let i = 1; i < pointsWithTime.length; i++) {
    const prev = pointsWithTime[i - 1];
    const curr = pointsWithTime[i];

    const distance = haversineDistance(prev.lat, prev.lon, curr.lat, curr.lon);
    const timeDiff =
      (new Date(curr.time!).getTime() - new Date(prev.time!).getTime()) / 1000;

    if (timeDiff <= 0) continue;

    const speed = distance / timeDiff;

    if (speed > MOVING_THRESHOLD) {
      movingTime += timeDiff;
    } else {
      restTime += timeDiff;
    }
  }

  const firstTime = new Date(pointsWithTime[0].time!).getTime();
  const lastTime = new Date(pointsWithTime[pointsWithTime.length - 1].time!).getTime();
  const totalTime = (lastTime - firstTime) / 1000;

  return { totalTime, movingTime, restTime };
}
```

## Track Operations

### Find Closest Point

```typescript
// Original: TGPXline.FindClosestPoint in GPX.pas

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
```

### Split Track

```typescript
// Original: TGPXptList.CutPointList in GPX.pas

export function splitAtIndex<T extends GPXWaypoint>(
  points: T[],
  splitIndex: number
): [T[], T[]] {
  if (splitIndex <= 0) {
    return [[], [...points]];
  }
  if (splitIndex >= points.length - 1) {
    return [[...points], []];
  }

  const first = points.slice(0, splitIndex + 1);
  const second = points.slice(splitIndex);

  return [first, second];
}

export function splitTrackAtPoint(
  track: GPXTrack,
  segmentId: string,
  pointIndex: number
): [GPXTrack, GPXTrack] {
  const segIndex = track.segments.findIndex((s) => s.id === segmentId);
  if (segIndex === -1) throw new Error('Segment not found');

  const segment = track.segments[segIndex];
  const [firstPoints, secondPoints] = splitAtIndex(segment.points, pointIndex);

  // First track: segments before split + first half
  const firstTrack: GPXTrack = {
    ...track,
    id: crypto.randomUUID(),
    name: track.name ? `${track.name} (1)` : 'Track (1)',
    segments: [
      ...track.segments.slice(0, segIndex),
      { ...segment, id: crypto.randomUUID(), points: firstPoints },
    ],
  };

  // Second track: second half + segments after split
  const secondTrack: GPXTrack = {
    ...track,
    id: crypto.randomUUID(),
    name: track.name ? `${track.name} (2)` : 'Track (2)',
    segments: [
      { ...segment, id: crypto.randomUUID(), points: secondPoints },
      ...track.segments.slice(segIndex + 1),
    ],
  };

  return [firstTrack, secondTrack];
}
```

### Join Tracks

```typescript
// Original: TGPXline.Join in GPX.pas

export function joinTracks(track1: GPXTrack, track2: GPXTrack): GPXTrack {
  return {
    ...track1,
    id: crypto.randomUUID(),
    name: track1.name || track2.name || 'Joined Track',
    segments: [...track1.segments, ...track2.segments],
  };
}

export function joinSegments(segment1: GPXTrackSegment, segment2: GPXTrackSegment): GPXTrackSegment {
  return {
    id: crypto.randomUUID(),
    enabled: true,
    points: [...segment1.points, ...segment2.points],
  };
}
```

### Reverse Track

```typescript
// Original: TGPXline.Reverse in GPX.pas

export function reversePoints<T extends GPXWaypoint>(points: T[]): T[] {
  return [...points].reverse();
}

export function reverseTrack(track: GPXTrack): GPXTrack {
  return {
    ...track,
    segments: track.segments
      .map((seg) => ({
        ...seg,
        points: reversePoints(seg.points),
      }))
      .reverse(),
  };
}

export function reverseRoute(route: GPXRoute): GPXRoute {
  return {
    ...route,
    points: reversePoints(route.points),
  };
}
```

## Track Simplification

### Douglas-Peucker Algorithm

```typescript
// Original: Filter.pas - track simplification

function perpendicularDistance(
  point: GPXWaypoint,
  lineStart: GPXWaypoint,
  lineEnd: GPXWaypoint
): number {
  // Convert to ECEF for accurate distance calculation
  const p = toECEF(point.lat, point.lon, point.ele || 0);
  const a = toECEF(lineStart.lat, lineStart.lon, lineStart.ele || 0);
  const b = toECEF(lineEnd.lat, lineEnd.lon, lineEnd.ele || 0);

  // Vector from a to b
  const ab = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
  // Vector from a to p
  const ap = { x: p.x - a.x, y: p.y - a.y, z: p.z - a.z };

  const abLen = Math.sqrt(ab.x ** 2 + ab.y ** 2 + ab.z ** 2);
  if (abLen === 0) {
    return Math.sqrt(ap.x ** 2 + ap.y ** 2 + ap.z ** 2);
  }

  // Cross product magnitude gives area of parallelogram
  const cross = {
    x: ap.y * ab.z - ap.z * ab.y,
    y: ap.z * ab.x - ap.x * ab.z,
    z: ap.x * ab.y - ap.y * ab.x,
  };
  const crossMag = Math.sqrt(cross.x ** 2 + cross.y ** 2 + cross.z ** 2);

  // Distance = area / base
  return crossMag / abLen;
}

export function simplifyTrack(
  points: GPXWaypoint[],
  tolerance: number
): GPXWaypoint[] {
  if (points.length <= 2) {
    return [...points];
  }

  // Find the point with the maximum distance from the line
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
    const leftPart = simplifyTrack(points.slice(0, maxIndex + 1), tolerance);
    const rightPart = simplifyTrack(points.slice(maxIndex), tolerance);

    // Remove duplicate point at the join
    return [...leftPart.slice(0, -1), ...rightPart];
  }

  // Otherwise, just keep first and last
  return [first, last];
}

export function simplifyWithPreview(
  points: GPXWaypoint[],
  tolerance: number
): { simplified: GPXWaypoint[]; reductionPercent: number } {
  const simplified = simplifyTrack(points, tolerance);
  const reductionPercent = ((points.length - simplified.length) / points.length) * 100;
  return { simplified, reductionPercent };
}
```

## Conversion Operations

### Route to Track

```typescript
export function convertRouteToTrack(route: GPXRoute): GPXTrack {
  return {
    id: crypto.randomUUID(),
    name: route.name,
    desc: route.desc,
    cmt: route.cmt,
    src: route.src,
    type: route.type,
    number: route.number,
    link: route.link,
    segments: [
      {
        id: crypto.randomUUID(),
        points: route.points.map((p) => ({ ...p, id: crypto.randomUUID() })),
        enabled: true,
      },
    ],
    extensions: route.extensions,
    color: route.color,
    enabled: route.enabled,
    expanded: true,
  };
}
```

### Track to Route

```typescript
export function convertTrackToRoute(track: GPXTrack): GPXRoute {
  // Flatten all segments into one route
  const allPoints = track.segments.flatMap((seg) =>
    seg.points.map((p) => ({ ...p, id: crypto.randomUUID() }))
  );

  return {
    id: crypto.randomUUID(),
    name: track.name,
    desc: track.desc,
    cmt: track.cmt,
    src: track.src,
    type: track.type,
    number: track.number,
    link: track.link,
    points: allPoints,
    extensions: track.extensions,
    color: track.color,
    enabled: track.enabled,
  };
}
```

## Sorting Functions

```typescript
// Original: SortTracksByDate, SortTracksByName, etc. in GPX.pas

export function sortByDate<T extends { segments?: { points: GPXWaypoint[] }[]; points?: GPXWaypoint[] }>(
  items: T[]
): T[] {
  return [...items].sort((a, b) => {
    const getFirstTime = (item: T): number => {
      const points = item.segments?.[0]?.points || item.points || [];
      const firstPoint = points.find((p) => p.time);
      return firstPoint?.time ? new Date(firstPoint.time).getTime() : 0;
    };
    return getFirstTime(a) - getFirstTime(b);
  });
}

export function sortByName<T extends { name?: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const nameA = a.name?.toLowerCase() || '';
    const nameB = b.name?.toLowerCase() || '';
    return nameA.localeCompare(nameB);
  });
}

export function sortByLength<T extends { segments?: { points: GPXWaypoint[] }[]; points?: GPXWaypoint[] }>(
  items: T[]
): T[] {
  return [...items].sort((a, b) => {
    const getLength = (item: T): number => {
      const points = item.segments
        ? item.segments.flatMap((s) => s.points)
        : item.points || [];
      return calculateTotalDistance(points);
    };
    return getLength(b) - getLength(a); // Descending
  });
}

export function sortBySize<T extends { segments?: { points: GPXWaypoint[] }[]; points?: GPXWaypoint[] }>(
  items: T[]
): T[] {
  return [...items].sort((a, b) => {
    const getSize = (item: T): number => {
      return item.segments
        ? item.segments.reduce((sum, s) => sum + s.points.length, 0)
        : item.points?.length || 0;
    };
    return getSize(b) - getSize(a); // Descending
  });
}
```

## Unit Conversions

```typescript
export const METERS_TO_FEET = 3.28084;
export const METERS_TO_MILES = 0.000621371;
export const METERS_TO_KM = 0.001;
export const MPS_TO_MPH = 2.23694;
export const MPS_TO_KMH = 3.6;

export type UnitSystem = 'metric' | 'imperial';

export function formatDistance(meters: number, units: UnitSystem): string {
  if (units === 'imperial') {
    const miles = meters * METERS_TO_MILES;
    if (miles < 0.1) {
      return `${Math.round(meters * METERS_TO_FEET)} ft`;
    }
    return `${miles.toFixed(2)} mi`;
  } else {
    const km = meters * METERS_TO_KM;
    if (km < 1) {
      return `${Math.round(meters)} m`;
    }
    return `${km.toFixed(2)} km`;
  }
}

export function formatSpeed(mps: number, units: UnitSystem): string {
  if (units === 'imperial') {
    return `${(mps * MPS_TO_MPH).toFixed(1)} mph`;
  } else {
    return `${(mps * MPS_TO_KMH).toFixed(1)} km/h`;
  }
}

export function formatElevation(meters: number, units: UnitSystem): string {
  if (units === 'imperial') {
    return `${Math.round(meters * METERS_TO_FEET)} ft`;
  } else {
    return `${Math.round(meters)} m`;
  }
}

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

export function formatGrade(percentage: number): string {
  return `${percentage.toFixed(1)}%`;
}
```

## Color Utilities

```typescript
// Original: ColorToHtml, HtmlToColor in GPX.pas

export function colorToHex(color: string): string {
  // Handle various color formats and normalize to #RRGGBB
  if (color.startsWith('#')) {
    if (color.length === 4) {
      // #RGB -> #RRGGBB
      return `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`;
    }
    return color.toUpperCase();
  }
  // Add more conversions as needed
  return color;
}

export function hexToRgba(hex: string, opacity: number = 1): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

// Generate distinct colors for tracks
export function generateTrackColor(index: number): string {
  const colors = [
    '#E53935', // Red
    '#1E88E5', // Blue
    '#43A047', // Green
    '#FB8C00', // Orange
    '#8E24AA', // Purple
    '#00ACC1', // Cyan
    '#F4511E', // Deep Orange
    '#3949AB', // Indigo
    '#7CB342', // Light Green
    '#D81B60', // Pink
  ];
  return colors[index % colors.length];
}
```
