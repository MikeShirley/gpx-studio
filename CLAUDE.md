# GPX Studio - Modern GPX Editor

> An offline-first desktop application for editing GPS tracks, routes, and waypoints.
> Built with Tauri + React + TypeScript.
> Designed for rally/adventure route planning workflows.

## Confirmed Requirements

| Aspect | Decision |
|--------|----------|
| **Platforms** | Windows + macOS |
| **App Name** | GPX Studio |
| **Primary Use** | Rally/adventure route planning |
| **Map View** | Essential, but works offline with coordinate grid fallback |
| **File Formats** | GPX + KML (v1) |
| **Export Target** | Standard GPX/KML for use with Rally Navigator |
| **Workflow** | Both create new routes and edit existing files |
| **Core Features** | Full toolkit: merge/split, filter, statistics/elevation |
| **UI Layout** | RideLeader style (tree left, map right, properties bottom) |
| **Tech Stack** | Tauri 2.0 + React + TypeScript |

## Quick Start

```bash
# Create new project
npm create tauri-app@latest gpx-studio -- --template react-ts

# Navigate to project
cd gpx-studio

# Install additional dependencies
npm install zustand recharts @types/leaflet leaflet react-leaflet tailwindcss postcss autoprefixer

# Initialize Tailwind
npx tailwindcss init -p

# Start development
npm run tauri dev
```

## Project Overview

This project is a modern **offline-first desktop GPX editor** that recreates and improves upon the features of RideLeader, a Delphi desktop application from 2012. The goal is to build a cross-platform, locally-installed GPS track/route/waypoint editor with interactive map visualization, data analysis, and GPX/KML file support.

**Name:** GPX Studio

**Primary Use Case:** Rally and adventure route planning. The app is used to create, edit, merge, and clean up GPX/KML files before importing them into Rally Navigator for roadbook generation.

**Target Users:**
- Rally/adventure riders planning routes
- Route planners preparing files for navigation apps

## Design Philosophy

**Offline-First Desktop Application**

This is a local desktop application that runs entirely offline. Key principles:

1. **No internet required** - All core functionality works without network access
2. **Local file operations** - Direct read/write to filesystem, no cloud sync
3. **Optional map tiles** - Can cache map tiles for offline use, or work without maps
4. **Lightweight** - Small binary, fast startup, low memory footprint
5. **Cross-platform** - Single codebase for Windows, macOS, and Linux

## Technology Stack

```
Desktop:      Tauri 2.0 (Rust-based, lightweight alternative to Electron)
Frontend:     React 18+ with TypeScript
Build Tool:   Vite
Styling:      Tailwind CSS
Mapping:      Leaflet with React-Leaflet (optional, can work without)
Charts:       Recharts
State:        Zustand (lightweight state management)
Storage:      Native filesystem via Tauri APIs
Testing:      Vitest + React Testing Library
```

### Why Tauri over Electron?

| Aspect | Tauri | Electron |
|--------|-------|----------|
| Binary size | ~10-15 MB | ~150+ MB |
| Memory usage | Lower (native webview) | Higher (bundled Chromium) |
| Startup time | Fast | Slower |
| File access | Native Rust APIs | Node.js APIs |
| Security | Sandboxed by default | More permissive |

### Why Not Pure Web?

- File System Access API is limited (Chrome-only, no Firefox/Safari)
- Large GPX files (100k+ points) need native performance
- Offline tile caching is complex in browsers
- Desktop users expect native file dialogs and keyboard shortcuts

## Project Structure

```
gpx-studio/
├── src-tauri/                      # Rust backend (Tauri)
│   ├── src/
│   │   ├── main.rs                 # Tauri entry point
│   │   ├── commands.rs             # IPC commands exposed to frontend
│   │   ├── file_ops.rs             # File read/write operations
│   │   └── gpx_parser.rs           # Optional: Rust GPX parsing for speed
│   ├── Cargo.toml
│   ├── tauri.conf.json             # Tauri configuration
│   └── icons/                      # Application icons
├── src/                            # React frontend
│   │   ├── Map/
│   │   │   ├── MapView.tsx           # Main Leaflet map component
│   │   │   ├── TrackLayer.tsx        # Track polyline rendering
│   │   │   ├── RouteLayer.tsx        # Route polyline rendering
│   │   │   ├── WaypointLayer.tsx     # Waypoint marker rendering
│   │   │   └── DrawingTools.tsx      # Click-to-draw functionality
│   │   ├── Sidebar/
│   │   │   ├── TreeView.tsx          # Hierarchical item list
│   │   │   ├── TreeNode.tsx          # Individual tree item
│   │   │   └── ItemContextMenu.tsx   # Right-click menu
│   │   ├── Charts/
│   │   │   ├── ElevationProfile.tsx  # Altitude vs distance
│   │   │   ├── SpeedProfile.tsx      # Speed vs distance
│   │   │   └── ChartTooltip.tsx      # Interactive tooltips
│   │   ├── Panels/
│   │   │   ├── PropertiesPanel.tsx   # Item properties editor
│   │   │   ├── StatisticsPanel.tsx   # Track/route statistics
│   │   │   └── PointListPanel.tsx    # Tabular point data
│   │   ├── Dialogs/
│   │   │   ├── CoordinateInput.tsx   # Manual lat/lon entry
│   │   │   ├── FilterDialog.tsx      # Point simplification
│   │   │   ├── RenameDialog.tsx      # Item renaming
│   │   │   └── SettingsDialog.tsx    # Application settings
│   │   └── Toolbar/
│   │       ├── MainToolbar.tsx       # Top toolbar
│   │       └── ToolButton.tsx        # Individual tool buttons
│   ├── lib/
│   │   ├── gpx/
│   │   │   ├── types.ts              # GPX data type definitions
│   │   │   ├── parser.ts             # GPX file parser
│   │   │   ├── exporter.ts           # GPX file exporter
│   │   │   ├── calculations.ts       # Distance, speed, elevation math
│   │   │   └── operations.ts         # Cut, join, reverse, filter
│   │   ├── formats/
│   │   │   └── kml.ts                # KML import/export
│   │   └── utils/
│   │       ├── geo.ts                # Geographic utilities
│   │       ├── units.ts              # Unit conversions
│   │       └── colors.ts             # Color utilities
│   ├── stores/
│   │   ├── gpxStore.ts               # Main GPX data store
│   │   ├── uiStore.ts                # UI state (selection, mode)
│   │   ├── historyStore.ts           # Undo/redo history
│   │   └── settingsStore.ts          # User preferences
│   ├── hooks/
│   │   ├── useGpxFile.ts             # File loading/saving
│   │   ├── useMapInteraction.ts      # Map click handlers
│   │   ├── useKeyboardShortcuts.ts   # Hotkey handling
│   │   └── useUndoRedo.ts            # History management
│   ├── App.tsx
│   └── main.tsx
├── public/
│   └── icons/                        # Waypoint symbol icons
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
└── CLAUDE.md
```

## Core Data Types

```typescript
// src/lib/gpx/types.ts

export interface GPXLink {
  href: string;
  text?: string;
  type?: string;
}

export interface GPXWaypoint {
  id: string;                    // UUID for React keys
  lat: number;                   // WGS84 latitude
  lon: number;                   // WGS84 longitude
  ele?: number;                  // Elevation in meters
  time?: string;                 // ISO 8601 timestamp
  name?: string;
  desc?: string;
  cmt?: string;                  // Comment
  src?: string;                  // Data source
  sym?: string;                  // Symbol name
  type?: string;
  link?: GPXLink;
  sat?: number;                  // Satellite count
  hdop?: number;                 // Horizontal dilution of precision
  vdop?: number;                 // Vertical dilution of precision
  pdop?: number;                 // Position dilution of precision
  fix?: 'none' | '2d' | '3d' | 'dgps' | 'pps';
  extensions?: Record<string, unknown>;

  // UI state (not saved to GPX)
  enabled: boolean;
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
  modified: boolean;
}

export interface BoundingBox {
  north: number;
  south: number;
  east: number;
  west: number;
  valid: boolean;
}

// Statistics calculated from tracks/routes
export interface TrackStatistics {
  distance: number;           // Total distance in meters
  movingTime: number;         // Seconds spent moving
  totalTime: number;          // Total elapsed time in seconds
  restTime: number;           // Time spent stationary

  avgSpeed: number;           // m/s overall
  movingSpeed: number;        // m/s while moving
  maxSpeed: number;           // Maximum speed reached

  totalClimb: number;         // Cumulative elevation gain (meters)
  totalDescent: number;       // Cumulative elevation loss (meters)
  minElevation: number;       // Lowest point
  maxElevation: number;       // Highest point
  avgElevation: number;       // Average elevation

  steepestClimb: number;      // Max uphill grade (percentage)
  steepestDescent: number;    // Max downhill grade (percentage)

  climbDistance: number;      // Distance spent climbing
  descentDistance: number;    // Distance spent descending
  flatDistance: number;       // Distance on flat terrain

  pointCount: number;         // Number of trackpoints
}
```

## Key Algorithms to Implement

### 1. Haversine Distance (from GPX.pas)

```typescript
// src/lib/gpx/calculations.ts

const EARTH_RADIUS = 6371000; // meters

export function haversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRadians(lat1)) *
            Math.cos(toRadians(lat2)) *
            Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS * c;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}
```

### 2. Track Statistics (from GPX.pas)

```typescript
export function calculateStatistics(points: GPXWaypoint[]): TrackStatistics {
  if (points.length < 2) {
    return emptyStatistics();
  }

  let distance = 0;
  let totalClimb = 0;
  let totalDescent = 0;
  let maxSpeed = 0;
  let movingTime = 0;
  // ... implementation follows RideLeader's FindMovingSpeed, FindTotalClimb, etc.
}
```

### 3. Douglas-Peucker Simplification (from Filter.pas)

```typescript
export function simplifyTrack(
  points: GPXWaypoint[],
  tolerance: number
): GPXWaypoint[] {
  if (points.length <= 2) return points;

  // Find point with maximum distance from line between first and last
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

  // Recursively simplify
  if (maxDistance > tolerance) {
    const left = simplifyTrack(points.slice(0, maxIndex + 1), tolerance);
    const right = simplifyTrack(points.slice(maxIndex), tolerance);
    return [...left.slice(0, -1), ...right];
  }

  return [first, last];
}
```

### 4. Track Operations (from GPX.pas)

```typescript
// src/lib/gpx/operations.ts

export function splitTrack(
  track: GPXTrack,
  segmentId: string,
  pointIndex: number
): [GPXTrack, GPXTrack] {
  // Split a track at the specified point
}

export function joinTracks(track1: GPXTrack, track2: GPXTrack): GPXTrack {
  // Merge two tracks into one
}

export function reverseTrack(track: GPXTrack): GPXTrack {
  // Reverse point order in all segments
}

export function convertRouteToTrack(route: GPXRoute): GPXTrack {
  // Convert route to track
}

export function convertTrackToRoute(track: GPXTrack): GPXRoute {
  // Convert track to route (flattens segments)
}
```

## Features Checklist

All features from RideLeader, organized by implementation phase.

### Phase 1: Core Functionality
- [ ] GPX file parsing with full GPX 1.1 support
- [ ] GPX file export with metadata preservation
- [ ] Leaflet map with multiple tile layers (OSM, satellite, terrain)
- [ ] Coordinate grid fallback when offline (no map tiles)
- [ ] Display tracks, routes, and waypoints on map
- [ ] Color-coded track/route rendering
- [ ] Waypoint markers with symbols
- [ ] Zoom to fit all data
- [ ] Pan and zoom controls (mouse wheel, drag, buttons)

### Phase 2: Sidebar & Selection
- [ ] Tree view with tracks, routes, waypoints hierarchy
- [ ] Checkbox visibility toggles
- [ ] Expand/collapse track segments
- [ ] Single and multi-select
- [ ] Drag-and-drop reordering within tree
- [ ] Right-click context menu
- [ ] Sort items by date, name, size, or length

### Phase 3: Editing Tools
- [ ] Add waypoint by clicking map
- [ ] Add waypoint by entering coordinates (lat/lon input dialog)
- [ ] Draw route by clicking points on map
- [ ] Delete selected items (tracks, routes, waypoints)
- [ ] Delete individual track points
- [ ] Rename items
- [ ] Split track at point
- [ ] Join/merge tracks or routes
- [ ] Merge all tracks into one
- [ ] Reverse point order
- [ ] Convert route ↔ track
- [ ] Create route from selected waypoints
- [ ] Remove empty tracks
- [ ] Box/area selection tool for bulk delete
- [ ] Measure distance tool (point to point)

### Phase 4: Data Analysis
- [ ] Statistics panel (distance, time, speed, elevation)
- [ ] Elevation profile chart (altitude vs distance)
- [ ] Speed profile chart (speed vs distance)
- [ ] Point list table view (editable)
- [ ] Metadata editing (file name, description, author, etc.)
- [ ] Copy data to clipboard (Excel-compatible format)

### Phase 5: Advanced Features
- [ ] Undo/redo with full history
- [ ] Copy/paste tracks, routes, waypoints
- [ ] Track simplification/filtering (Douglas-Peucker)
- [ ] KML import/export
- [ ] Keyboard shortcuts
- [ ] Dark mode
- [ ] Settings persistence (colors, units, preferences)

### Phase 6: Polish
- [ ] Drag-and-drop file loading
- [ ] Open multiple files and merge
- [ ] Recent files list
- [ ] Print/screenshot export
- [ ] Offline map tile caching (MBTiles support)
- [ ] Application auto-update

## UI Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│ [Logo] GPX Editor    [New][Open][Save]  [Undo][Redo]  [Settings]    │
├──────────────┬──────────────────────────────────────────────────────┤
│              │                                                       │
│  Tree View   │                                                       │
│              │                    Map View                           │
│  □ Tracks    │                                                       │
│    □ Track 1 │                 (Leaflet Map)                         │
│      □ Seg 1 │                                                       │
│    □ Track 2 │                                                       │
│  □ Routes    │                                                       │
│    □ Route 1 │                                                       │
│  □ Waypoints │                                                       │
│    □ WP 1    │                                                       │
│    □ WP 2    ├──────────────────────────────────────────────────────┤
│              │  [Editor] [Statistics] [Chart] [Points]               │
├──────────────┤  ┌────────────────────────────────────────────────┐  │
│ Properties   │  │ Distance: 45.2 km    Total Climb: 1,234 m      │  │
│              │  │ Time: 3:45:00        Max Speed: 45.2 km/h      │  │
│ Name: [    ] │  │ Moving: 2:30:00      Avg Speed: 18.1 km/h      │  │
│ Desc: [    ] │  └────────────────────────────────────────────────┘  │
│ Color: [█]   │                                                       │
└──────────────┴──────────────────────────────────────────────────────┘
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Ctrl+O | Open file |
| Ctrl+S | Save file |
| Ctrl+Shift+S | Save as |
| Ctrl+Z | Undo |
| Ctrl+Y | Redo |
| Delete | Delete selected |
| F2 | Rename selected |
| Ctrl+A | Select all |
| Escape | Cancel current operation |
| Space | Toggle visibility of selected |
| +/- | Zoom in/out |
| F | Zoom to fit all |

## Map Tile Providers

```typescript
const tileLayers = {
  osm: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© OpenStreetMap contributors'
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '© Esri'
  },
  terrain: {
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '© OpenTopoMap'
  },
  cyclosm: {
    url: 'https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png',
    attribution: '© CyclOSM'
  }
};
```

## Offline Map Strategy

The application works in three map modes:

### 1. No Map Mode (Fully Offline)
When no internet is available and no cached tiles exist, display tracks on a simple coordinate grid:

```
┌────────────────────────────────────────┐
│  45.5°N ─────────────────────────────  │
│         │                              │
│         │    ╭──────╮                  │
│  45.0°N ─────│ Track │──────────────── │
│         │    ╰──────╯                  │
│         │                              │
│  44.5°N ─────────────────────────────  │
│        -122°W      -121°W      -120°W  │
└────────────────────────────────────────┘
```

Features in no-map mode:
- Coordinate grid with lat/lon labels
- Track/route/waypoint rendering
- All editing operations still work
- Click coordinates shown in status bar

### 2. Cached Tiles Mode
For offline use with maps, support MBTiles format:
- User can download regional tile packages
- Store as `.mbtiles` SQLite files in app data folder
- Rust backend reads tiles and serves to frontend

```rust
// src-tauri/src/tiles.rs
pub fn get_tile(mbtiles_path: &str, z: u32, x: u32, y: u32) -> Option<Vec<u8>> {
    // Read tile from MBTiles SQLite database
}
```

### 3. Online Mode
When internet is available:
- Fetch tiles on-demand from configured provider
- Optionally cache fetched tiles for later offline use
- User can "download region" for offline use

## Working Without Maps

The application is fully functional without any map display. Core features that work offline:

- **File Operations**: Open, save, merge GPX files
- **Track Editing**: Split, join, reverse, filter tracks
- **Statistics**: Distance, elevation, speed calculations
- **Charts**: Elevation and speed profiles
- **Waypoint Management**: Add, edit, delete waypoints
- **Coordinate Entry**: Manual lat/lon input
- **Point Table**: View/edit all trackpoints in table form

The map view is a convenience for visualization, not a requirement for editing.

## Settings Schema

```typescript
interface AppSettings {
  // Display
  units: 'metric' | 'imperial';
  theme: 'light' | 'dark' | 'system';
  defaultTileLayer: string;

  // Colors
  trackColor: string;
  routeColor: string;
  waypointColor: string;
  selectionColor: string;

  // Behavior
  autoZoomOnLoad: boolean;
  confirmDelete: boolean;

  // Recent files
  recentFiles: string[];
  maxRecentFiles: number;
}
```

## Development Commands

```bash
# Prerequisites
# - Node.js 18+
# - Rust toolchain (rustup)
# - Platform-specific dependencies for Tauri

# Install dependencies
npm install

# Start Tauri development (frontend + backend hot reload)
npm run tauri dev

# Build production binary
npm run tauri build

# Frontend-only development (no Tauri, for UI work)
npm run dev

# Run tests
npm run test

# Type check
npm run typecheck

# Lint
npm run lint

# Generate app icons from source image
npm run tauri icon ./app-icon.png
```

## Tauri Configuration

```json
// src-tauri/tauri.conf.json (key settings)
{
  "productName": "GPX Studio",
  "identifier": "com.gpxstudio.app",
  "build": {
    "beforeBuildCommand": "npm run build",
    "beforeDevCommand": "npm run dev",
    "devUrl": "http://localhost:5173",
    "frontendDist": "../dist"
  },
  "app": {
    "windows": [
      {
        "title": "GPX Studio",
        "width": 1200,
        "height": 800,
        "minWidth": 800,
        "minHeight": 600
      }
    ],
    "security": {
      "csp": null
    }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": ["icons/icon.ico", "icons/icon.png"]
  }
}
```

## Reference: Original RideLeader Files

Key source files from the original Delphi application for algorithm reference:

- `lib/GPX.pas` - Core data structures and calculations
- `lib/FileGPX.pas` - GPX parsing and export
- `lib/GPXDraw.pas` - Rendering logic
- `Main.pas` - UI and feature implementation
- `Filter.pas` - Track simplification

## Notes for Development

1. **Preserve extensions** - GPX files may contain custom extensions (e.g., Garmin, Trail Tech). Parse them generically and preserve on export.

2. **Handle large files** - Tracks can have 100k+ points. Use virtualization for point lists and efficient rendering.

3. **Coordinate precision** - Maintain at least 6 decimal places for lat/lon (sub-meter accuracy).

4. **Time zones** - GPX times are always UTC (Zulu time). Display in local time but store as UTC.

5. **Undo granularity** - Group related operations (e.g., delete multiple items) into single undo steps.

6. **File associations** - Consider Tauri wrapper for native .gpx file association on desktop.
