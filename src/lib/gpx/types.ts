// Core GPX data types based on GPX 1.1 specification
// Ported from RideLeader's GPX.pas

export interface GPXLink {
  href: string;
  text?: string;
  type?: string;
}

export interface GPXWaypoint {
  id: string;
  lat: number;
  lon: number;
  ele?: number;
  time?: string;
  name?: string;
  desc?: string;
  cmt?: string;
  src?: string;
  sym?: string;
  type?: string;
  link?: GPXLink;
  sat?: number;
  hdop?: number;
  vdop?: number;
  pdop?: number;
  fix?: 'none' | '2d' | '3d' | 'dgps' | 'pps';
  magvar?: number;
  geoidheight?: number;
  ageofdgpsdata?: number;
  dgpsid?: number;
  extensions?: Record<string, unknown>;
  // UI/display state
  enabled: boolean;
  color?: string;  // Optional color for visual distinction
  sourceFile?: string;  // Track which file this item came from
}

export interface GPXTrackSegment {
  id: string;
  points: GPXWaypoint[];
  enabled: boolean;
}

export interface GPXTrack {
  id: string;
  name?: string;
  desc?: string;
  cmt?: string;
  src?: string;
  type?: string;
  number?: number;
  link?: GPXLink;
  segments: GPXTrackSegment[];
  extensions?: Record<string, unknown>;
  // Display properties
  color: string;
  enabled: boolean;
  expanded: boolean;
  sourceFile?: string;  // Track which file this item came from
}

export interface GPXRoute {
  id: string;
  name?: string;
  desc?: string;
  cmt?: string;
  src?: string;
  type?: string;
  number?: number;
  link?: GPXLink;
  points: GPXWaypoint[];
  extensions?: Record<string, unknown>;
  // Display properties
  color: string;
  enabled: boolean;
  sourceFile?: string;  // Track which file this item came from
}

export interface GPXMetadata {
  name?: string;
  desc?: string;
  author?: {
    name?: string;
    email?: { id: string; domain: string };
    link?: GPXLink;
  };
  copyright?: {
    author: string;
    year?: number;
    license?: string;
  };
  link?: GPXLink;
  time?: string;
  keywords?: string;
  bounds?: {
    minlat: number;
    minlon: number;
    maxlat: number;
    maxlon: number;
  };
}

export interface GPXDocument {
  metadata?: GPXMetadata;
  waypoints: GPXWaypoint[];
  routes: GPXRoute[];
  tracks: GPXTrack[];
  // File info
  filename?: string;
  filepath?: string;
  modified: boolean;
}

export interface BoundingBox {
  north: number;
  south: number;
  east: number;
  west: number;
  valid: boolean;
}

export interface TrackStatistics {
  distance: number;
  movingTime: number;
  totalTime: number;
  restTime: number;
  avgSpeed: number;
  movingSpeed: number;
  maxSpeed: number;
  totalClimb: number;
  totalDescent: number;
  minElevation: number;
  maxElevation: number;
  avgElevation: number;
  steepestClimb: number;
  steepestDescent: number;
  climbDistance: number;
  descentDistance: number;
  flatDistance: number;
  pointCount: number;
}

// Selection types
export type SelectableItem =
  | { type: 'waypoint'; id: string }
  | { type: 'route'; id: string }
  | { type: 'track'; id: string }
  | { type: 'segment'; trackId: string; segmentId: string };

// Utility function to create empty document
export function createEmptyDocument(): GPXDocument {
  return {
    waypoints: [],
    routes: [],
    tracks: [],
    modified: false,
  };
}

// Generate unique ID
export function generateId(): string {
  return crypto.randomUUID();
}

// Track colors for auto-assignment
const TRACK_COLORS = [
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

let colorIndex = 0;

export function getNextTrackColor(): string {
  const color = TRACK_COLORS[colorIndex % TRACK_COLORS.length];
  colorIndex++;
  return color;
}

export function resetColorIndex(): void {
  colorIndex = 0;
}
