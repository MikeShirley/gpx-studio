// Main GPX data store using Zustand

import { create } from 'zustand';
import type { GPXDocument, GPXTrack, GPXRoute, GPXWaypoint, SelectableItem } from '../lib/gpx/types';
import { createEmptyDocument, generateId, getNextTrackColor } from '../lib/gpx/types';
import { parseGPX } from '../lib/gpx/parser';
import { exportGPX } from '../lib/gpx/exporter';
import { useHistoryStore } from './historyStore';
import { reverseTrack as reverseTrackOp, reverseRoute as reverseRouteOp, joinTracks as joinTracksOp, mergeTrackSegments, routeToTrack, trackToRoute } from '../lib/gpx/operations';

interface GPXState {
  document: GPXDocument;
  selection: SelectableItem[];
  clipboard: (GPXTrack | GPXRoute | GPXWaypoint)[];

  // Actions
  loadFromString: (gpxString: string, filename?: string) => void;
  mergeDocument: (doc: GPXDocument, sourceName?: string) => { tracks: number; routes: number; waypoints: number };
  loadSampleData: () => void;
  exportToString: () => string;
  clear: () => void;

  // Undo/Redo
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // Selection
  select: (item: SelectableItem) => void;
  addToSelection: (item: SelectableItem) => void;
  toggleSelection: (item: SelectableItem) => void;
  selectRange: (from: SelectableItem, to: SelectableItem) => void;
  selectAll: () => void;
  clearSelection: () => void;
  selectItemsInBounds: (bounds: { north: number; south: number; east: number; west: number }) => number;
  deletePointsInBounds: (bounds: { north: number; south: number; east: number; west: number }, options?: { waypointsOnly?: boolean; tracksOnly?: boolean }) => { deletedPoints: number; deletedWaypoints: number; newTracks: number; newRoutes: number };

  // Clipboard
  copySelected: () => void;
  cutSelected: () => void;
  paste: () => void;
  hasClipboard: () => boolean;

  // Tracks
  addTrack: (track: GPXTrack) => void;
  updateTrack: (id: string, updates: Partial<GPXTrack>) => void;
  deleteTrack: (id: string) => void;
  toggleTrackEnabled: (id: string) => void;
  toggleTrackExpanded: (id: string) => void;

  // Routes
  addRoute: (route: GPXRoute) => void;
  updateRoute: (id: string, updates: Partial<GPXRoute>) => void;
  deleteRoute: (id: string) => void;
  toggleRouteEnabled: (id: string) => void;

  // Waypoints
  addWaypoint: (waypoint: GPXWaypoint) => void;
  updateWaypoint: (id: string, updates: Partial<GPXWaypoint>) => void;
  deleteWaypoint: (id: string) => void;
  toggleWaypointEnabled: (id: string) => void;

  // Operations
  reverseTrack: (id: string) => void;
  reverseRoute: (id: string) => void;
  joinSelectedTracks: () => void;
  mergeTrackSegmentsAction: (id: string) => void;
  convertRouteToTrack: (id: string) => void;
  convertTrackToRoute: (id: string) => void;
  createRouteFromWaypoints: (waypointIds: string[]) => void;
  deleteTrackPoint: (trackId: string, segmentId: string, pointIndex: number) => void;

  // Reordering
  reorderTracks: (fromIndex: number, toIndex: number) => void;
  reorderRoutes: (fromIndex: number, toIndex: number) => void;
  reorderWaypoints: (fromIndex: number, toIndex: number) => void;

  // Sorting
  sortTracks: (by: 'name' | 'date' | 'length' | 'points') => void;
  sortRoutes: (by: 'name' | 'length' | 'points') => void;
  sortWaypoints: (by: 'name' | 'lat' | 'lon' | 'ele') => void;

  // Document
  setModified: (modified: boolean) => void;
}

// Helper to save current state to history before making changes
const pushToHistory = () => {
  const state = useGpxStore.getState();
  useHistoryStore.getState().pushState(state.document);
};

export const useGpxStore = create<GPXState>((set, get) => ({
  document: createEmptyDocument(),
  selection: [],
  clipboard: [],

  loadFromString: (gpxString: string, filename?: string) => {
    try {
      const doc = parseGPX(gpxString);
      doc.filename = filename;
      doc.modified = false;
      set({ document: doc, selection: [] });
    } catch (error) {
      console.error('Failed to parse GPX:', error);
      throw error;
    }
  },

  mergeDocument: (incomingDoc: GPXDocument, sourceName?: string) => {
    const state = get();
    pushToHistory();

    // Get a unique color for this batch of imports (all items from this file share a color)
    const batchColor = getNextTrackColor();

    // Use the source filename for grouping items from the same file
    const sourceFile = sourceName || 'Imported File';

    // Generate new IDs for all incoming items to avoid conflicts
    // Always assign the batch color so items from different files have different colors
    const newTracks: GPXTrack[] = incomingDoc.tracks.map(track => ({
      ...track,
      id: generateId(),
      name: track.name || sourceName || 'Imported Track',
      color: batchColor,
      sourceFile,
      segments: track.segments.map(seg => ({
        ...seg,
        id: generateId(),
        points: seg.points.map(pt => ({ ...pt, id: generateId() })),
      })),
    }));

    const newRoutes: GPXRoute[] = incomingDoc.routes.map(route => ({
      ...route,
      id: generateId(),
      name: route.name || sourceName || 'Imported Route',
      color: batchColor,
      sourceFile,
      points: route.points.map(pt => ({ ...pt, id: generateId() })),
    }));

    const newWaypoints: GPXWaypoint[] = incomingDoc.waypoints.map(wpt => ({
      ...wpt,
      id: generateId(),
      color: batchColor,
      sourceFile,
    }));

    set({
      document: {
        ...state.document,
        tracks: [...state.document.tracks, ...newTracks],
        routes: [...state.document.routes, ...newRoutes],
        waypoints: [...state.document.waypoints, ...newWaypoints],
        modified: true,
      },
    });

    return {
      tracks: newTracks.length,
      routes: newRoutes.length,
      waypoints: newWaypoints.length,
    };
  },

  loadSampleData: () => {
    // Sample data for development/testing
    const sampleDoc: GPXDocument = {
      metadata: {
        name: 'Sample Route',
        desc: 'A sample GPX file for testing',
        time: new Date().toISOString(),
      },
      waypoints: [
        {
          id: generateId(),
          lat: 37.7749,
          lon: -122.4194,
          name: 'San Francisco',
          desc: 'Start point',
          ele: 16,
          enabled: true,
        },
        {
          id: generateId(),
          lat: 37.8044,
          lon: -122.2712,
          name: 'Oakland',
          desc: 'Waypoint',
          ele: 13,
          enabled: true,
        },
      ],
      routes: [
        {
          id: generateId(),
          name: 'Bay Area Route',
          color: getNextTrackColor(),
          enabled: true,
          points: [
            { id: generateId(), lat: 37.7749, lon: -122.4194, ele: 16, enabled: true },
            { id: generateId(), lat: 37.7849, lon: -122.4094, ele: 50, enabled: true },
            { id: generateId(), lat: 37.7949, lon: -122.3994, ele: 75, enabled: true },
            { id: generateId(), lat: 37.8044, lon: -122.2712, ele: 13, enabled: true },
          ],
        },
      ],
      tracks: [
        {
          id: generateId(),
          name: 'Morning Ride',
          color: getNextTrackColor(),
          enabled: true,
          expanded: true,
          segments: [
            {
              id: generateId(),
              enabled: true,
              points: [
                { id: generateId(), lat: 37.7749, lon: -122.4194, ele: 16, time: '2024-01-15T08:00:00Z', enabled: true },
                { id: generateId(), lat: 37.7759, lon: -122.4184, ele: 20, time: '2024-01-15T08:01:00Z', enabled: true },
                { id: generateId(), lat: 37.7769, lon: -122.4174, ele: 25, time: '2024-01-15T08:02:00Z', enabled: true },
                { id: generateId(), lat: 37.7779, lon: -122.4164, ele: 30, time: '2024-01-15T08:03:00Z', enabled: true },
                { id: generateId(), lat: 37.7789, lon: -122.4154, ele: 35, time: '2024-01-15T08:04:00Z', enabled: true },
                { id: generateId(), lat: 37.7799, lon: -122.4144, ele: 40, time: '2024-01-15T08:05:00Z', enabled: true },
                { id: generateId(), lat: 37.7809, lon: -122.4134, ele: 45, time: '2024-01-15T08:06:00Z', enabled: true },
                { id: generateId(), lat: 37.7819, lon: -122.4124, ele: 50, time: '2024-01-15T08:07:00Z', enabled: true },
              ],
            },
          ],
        },
      ],
      modified: false,
    };

    set({ document: sampleDoc, selection: [] });
  },

  exportToString: () => {
    return exportGPX(get().document);
  },

  clear: () => {
    pushToHistory();
    useHistoryStore.getState().clear();
    set({ document: createEmptyDocument(), selection: [] });
  },

  undo: () => {
    const historyStore = useHistoryStore.getState();
    const previousDoc = historyStore.undo();
    if (previousDoc) {
      // Save current state to future before restoring
      const currentDoc = get().document;
      useHistoryStore.setState(state => ({
        future: [...state.future, JSON.parse(JSON.stringify(currentDoc))],
      }));
      set({ document: previousDoc, selection: [] });
    }
  },

  redo: () => {
    const historyStore = useHistoryStore.getState();
    const nextDoc = historyStore.redo();
    if (nextDoc) {
      set({ document: nextDoc, selection: [] });
    }
  },

  canUndo: () => useHistoryStore.getState().canUndo(),
  canRedo: () => useHistoryStore.getState().canRedo(),

  select: (item: SelectableItem) => {
    set({ selection: [item] });
  },

  addToSelection: (item: SelectableItem) => {
    set(state => ({ selection: [...state.selection, item] }));
  },

  toggleSelection: (item: SelectableItem) => {
    set(state => {
      const itemsMatch = (a: SelectableItem, b: SelectableItem): boolean => {
        if (a.type !== b.type) return false;
        if (a.type === 'segment' && b.type === 'segment') {
          return a.trackId === b.trackId && a.segmentId === b.segmentId;
        }
        if (a.type !== 'segment' && b.type !== 'segment') {
          return a.id === b.id;
        }
        return false;
      };
      const exists = state.selection.some(s => itemsMatch(s, item));
      if (exists) {
        return {
          selection: state.selection.filter(s => !itemsMatch(s, item)),
        };
      }
      return { selection: [...state.selection, item] };
    });
  },

  selectRange: (from: SelectableItem, to: SelectableItem) => {
    const state = get();
    // Build a flat list of all items in display order (tracks, routes, waypoints)
    const allItems: SelectableItem[] = [
      ...state.document.tracks.map(t => ({ type: 'track' as const, id: t.id })),
      ...state.document.routes.map(r => ({ type: 'route' as const, id: r.id })),
      ...state.document.waypoints.map(w => ({ type: 'waypoint' as const, id: w.id })),
    ];

    const itemsMatch = (a: SelectableItem, b: SelectableItem): boolean => {
      if (a.type !== b.type) return false;
      if (a.type === 'segment' && b.type === 'segment') {
        return a.trackId === b.trackId && a.segmentId === b.segmentId;
      }
      if (a.type !== 'segment' && b.type !== 'segment') {
        return a.id === b.id;
      }
      return false;
    };

    const fromIndex = allItems.findIndex(item => itemsMatch(item, from));
    const toIndex = allItems.findIndex(item => itemsMatch(item, to));

    if (fromIndex === -1 || toIndex === -1) return;

    const startIndex = Math.min(fromIndex, toIndex);
    const endIndex = Math.max(fromIndex, toIndex);

    const rangeSelection = allItems.slice(startIndex, endIndex + 1);
    set({ selection: rangeSelection });
  },

  selectAll: () => {
    const state = get();
    const allItems: SelectableItem[] = [
      ...state.document.waypoints.map(w => ({ type: 'waypoint' as const, id: w.id })),
      ...state.document.routes.map(r => ({ type: 'route' as const, id: r.id })),
      ...state.document.tracks.map(t => ({ type: 'track' as const, id: t.id })),
    ];
    set({ selection: allItems });
  },

  clearSelection: () => {
    set({ selection: [] });
  },

  selectItemsInBounds: (bounds: { north: number; south: number; east: number; west: number }) => {
    const state = get();
    const selectedItems: SelectableItem[] = [];

    // Helper to check if a point is within bounds
    const pointInBounds = (lat: number, lon: number): boolean => {
      return lat >= bounds.south && lat <= bounds.north &&
             lon >= bounds.west && lon <= bounds.east;
    };

    // Helper to check if any point of an array is in bounds
    const anyPointInBounds = (points: Array<{ lat: number; lon: number }>): boolean => {
      return points.some(p => pointInBounds(p.lat, p.lon));
    };

    // Check waypoints
    for (const wpt of state.document.waypoints) {
      if (wpt.enabled && pointInBounds(wpt.lat, wpt.lon)) {
        selectedItems.push({ type: 'waypoint', id: wpt.id });
      }
    }

    // Check routes
    for (const route of state.document.routes) {
      if (route.enabled && anyPointInBounds(route.points)) {
        selectedItems.push({ type: 'route', id: route.id });
      }
    }

    // Check tracks
    for (const track of state.document.tracks) {
      if (track.enabled) {
        const hasPointInBounds = track.segments.some(
          seg => seg.enabled && anyPointInBounds(seg.points)
        );
        if (hasPointInBounds) {
          selectedItems.push({ type: 'track', id: track.id });
        }
      }
    }

    set({ selection: selectedItems });
    return selectedItems.length;
  },

  deletePointsInBounds: (bounds: { north: number; south: number; east: number; west: number }, options?: { waypointsOnly?: boolean; tracksOnly?: boolean }) => {
    const state = get();
    let deletedPoints = 0;
    let deletedWaypoints = 0;
    let newTracks = 0;
    let newRoutes = 0;

    const deleteWaypoints = !options?.tracksOnly;
    const deleteTracks = !options?.waypointsOnly;

    // Helper to check if a point is within bounds
    const pointInBounds = (lat: number, lon: number): boolean => {
      return lat >= bounds.south && lat <= bounds.north &&
             lon >= bounds.west && lon <= bounds.east;
    };

    pushToHistory();

    // Delete waypoints within bounds (unless tracksOnly)
    const remainingWaypoints = deleteWaypoints
      ? state.document.waypoints.filter(wpt => {
          if (pointInBounds(wpt.lat, wpt.lon)) {
            deletedWaypoints++;
            return false;
          }
          return true;
        })
      : state.document.waypoints;

    // Process routes and tracks only if not waypointsOnly
    let newRoutesList: GPXRoute[] = deleteTracks ? [] : state.document.routes;
    let newTracksList: GPXTrack[] = deleteTracks ? [] : state.document.tracks;

    if (deleteTracks) {
      // Process routes - split if points are deleted from the middle
      for (const route of state.document.routes) {
        const segments: Array<typeof route.points> = [];
        let currentSegment: typeof route.points = [];

        for (const point of route.points) {
          if (pointInBounds(point.lat, point.lon)) {
            deletedPoints++;
            if (currentSegment.length > 0) {
              segments.push(currentSegment);
              currentSegment = [];
            }
          } else {
            currentSegment.push(point);
          }
        }
        if (currentSegment.length > 0) {
          segments.push(currentSegment);
        }

        if (segments.length === 0) {
          // All points deleted
        } else if (segments.length === 1 && segments[0].length === route.points.length) {
          newRoutesList.push(route);
        } else {
          segments.forEach((seg, idx) => {
            if (seg.length >= 1) {
              const newRoute: GPXRoute = {
                ...route,
                id: idx === 0 ? route.id : generateId(),
                name: segments.length > 1 ? `${route.name || 'Route'} (${idx + 1})` : route.name,
                points: seg,
              };
              newRoutesList.push(newRoute);
              if (idx > 0) newRoutes++;
            }
          });
        }
      }

      // Process tracks
      for (const track of state.document.tracks) {
        const newSegmentsList: typeof track.segments = [];
        let trackModified = false;

        for (const segment of track.segments) {
          const subSegments: Array<typeof segment.points> = [];
          let currentSubSeg: typeof segment.points = [];

          for (const point of segment.points) {
            if (pointInBounds(point.lat, point.lon)) {
              deletedPoints++;
              trackModified = true;
              if (currentSubSeg.length > 0) {
                subSegments.push(currentSubSeg);
                currentSubSeg = [];
              }
            } else {
              currentSubSeg.push(point);
            }
          }
          if (currentSubSeg.length > 0) {
            subSegments.push(currentSubSeg);
          }

          subSegments.forEach((subSeg, idx) => {
            if (subSeg.length >= 1) {
              newSegmentsList.push({
                ...segment,
                id: idx === 0 ? segment.id : generateId(),
                points: subSeg,
              });
            }
          });
        }

        if (newSegmentsList.length === 0) {
          // All points deleted
        } else if (!trackModified) {
          newTracksList.push(track);
        } else {
          const newTrack: GPXTrack = {
            ...track,
            segments: newSegmentsList,
          };
          newTracksList.push(newTrack);

          const originalSegCount = track.segments.length;
          if (newSegmentsList.length > originalSegCount) {
            newTracks += newSegmentsList.length - originalSegCount;
          }
        }
      }
    }

    set({
      document: {
        ...state.document,
        waypoints: remainingWaypoints,
        routes: newRoutesList,
        tracks: newTracksList,
        modified: true,
      },
      selection: [],
    });

    return { deletedPoints, deletedWaypoints, newTracks, newRoutes };
  },

  copySelected: () => {
    const state = get();
    const itemsToCopy: (GPXTrack | GPXRoute | GPXWaypoint)[] = [];

    for (const sel of state.selection) {
      if (sel.type === 'track') {
        const track = state.document.tracks.find(t => t.id === sel.id);
        if (track) itemsToCopy.push(JSON.parse(JSON.stringify(track)));
      } else if (sel.type === 'route') {
        const route = state.document.routes.find(r => r.id === sel.id);
        if (route) itemsToCopy.push(JSON.parse(JSON.stringify(route)));
      } else if (sel.type === 'waypoint') {
        const waypoint = state.document.waypoints.find(w => w.id === sel.id);
        if (waypoint) itemsToCopy.push(JSON.parse(JSON.stringify(waypoint)));
      }
    }

    set({ clipboard: itemsToCopy });
  },

  cutSelected: () => {
    const state = get();
    const itemsToCopy: (GPXTrack | GPXRoute | GPXWaypoint)[] = [];

    // First copy the items
    for (const sel of state.selection) {
      if (sel.type === 'track') {
        const track = state.document.tracks.find(t => t.id === sel.id);
        if (track) itemsToCopy.push(JSON.parse(JSON.stringify(track)));
      } else if (sel.type === 'route') {
        const route = state.document.routes.find(r => r.id === sel.id);
        if (route) itemsToCopy.push(JSON.parse(JSON.stringify(route)));
      } else if (sel.type === 'waypoint') {
        const waypoint = state.document.waypoints.find(w => w.id === sel.id);
        if (waypoint) itemsToCopy.push(JSON.parse(JSON.stringify(waypoint)));
      }
    }

    set({ clipboard: itemsToCopy });

    // Then delete the originals
    if (itemsToCopy.length > 0) {
      pushToHistory();
      const newTracks = state.document.tracks.filter(
        t => !state.selection.some(s => s.type === 'track' && s.id === t.id)
      );
      const newRoutes = state.document.routes.filter(
        r => !state.selection.some(s => s.type === 'route' && s.id === r.id)
      );
      const newWaypoints = state.document.waypoints.filter(
        w => !state.selection.some(s => s.type === 'waypoint' && s.id === w.id)
      );

      set({
        document: {
          ...state.document,
          tracks: newTracks,
          routes: newRoutes,
          waypoints: newWaypoints,
          modified: true,
        },
        selection: [],
      });
    }
  },

  paste: () => {
    const state = get();
    if (state.clipboard.length === 0) return;

    pushToHistory();

    for (const item of state.clipboard) {
      // Generate new IDs for pasted items
      if ('segments' in item) {
        // It's a track
        const newTrack: GPXTrack = {
          ...item,
          id: generateId(),
          name: item.name ? `${item.name} (copy)` : 'Track (copy)',
          segments: item.segments.map(seg => ({
            ...seg,
            id: generateId(),
            points: seg.points.map(p => ({ ...p, id: generateId() })),
          })),
        };
        set(s => ({
          document: {
            ...s.document,
            tracks: [...s.document.tracks, newTrack],
            modified: true,
          },
        }));
      } else if ('points' in item && Array.isArray(item.points)) {
        // It's a route
        const newRoute: GPXRoute = {
          ...item,
          id: generateId(),
          name: item.name ? `${item.name} (copy)` : 'Route (copy)',
          points: item.points.map(p => ({ ...p, id: generateId() })),
        };
        set(s => ({
          document: {
            ...s.document,
            routes: [...s.document.routes, newRoute],
            modified: true,
          },
        }));
      } else if ('lat' in item && 'lon' in item) {
        // It's a waypoint
        const wpt = item as GPXWaypoint;
        const newWaypoint: GPXWaypoint = {
          ...wpt,
          id: generateId(),
          name: wpt.name ? `${wpt.name} (copy)` : 'Waypoint (copy)',
        };
        set(s => ({
          document: {
            ...s.document,
            waypoints: [...s.document.waypoints, newWaypoint],
            modified: true,
          },
        }));
      }
    }
  },

  hasClipboard: () => get().clipboard.length > 0,

  addTrack: (track: GPXTrack) => {
    pushToHistory();
    set(state => ({
      document: {
        ...state.document,
        tracks: [...state.document.tracks, track],
        modified: true,
      },
    }));
  },

  updateTrack: (id: string, updates: Partial<GPXTrack>) => {
    pushToHistory();
    set(state => ({
      document: {
        ...state.document,
        tracks: state.document.tracks.map(t =>
          t.id === id ? { ...t, ...updates } : t
        ),
        modified: true,
      },
    }));
  },

  deleteTrack: (id: string) => {
    pushToHistory();
    set(state => ({
      document: {
        ...state.document,
        tracks: state.document.tracks.filter(t => t.id !== id),
        modified: true,
      },
      selection: state.selection.filter(s => !(s.type === 'track' && s.id === id)),
    }));
  },

  toggleTrackEnabled: (id: string) => {
    set(state => ({
      document: {
        ...state.document,
        tracks: state.document.tracks.map(t =>
          t.id === id ? { ...t, enabled: !t.enabled } : t
        ),
      },
    }));
  },

  toggleTrackExpanded: (id: string) => {
    set(state => ({
      document: {
        ...state.document,
        tracks: state.document.tracks.map(t =>
          t.id === id ? { ...t, expanded: !t.expanded } : t
        ),
      },
    }));
  },

  addRoute: (route: GPXRoute) => {
    pushToHistory();
    set(state => ({
      document: {
        ...state.document,
        routes: [...state.document.routes, route],
        modified: true,
      },
    }));
  },

  updateRoute: (id: string, updates: Partial<GPXRoute>) => {
    pushToHistory();
    set(state => ({
      document: {
        ...state.document,
        routes: state.document.routes.map(r =>
          r.id === id ? { ...r, ...updates } : r
        ),
        modified: true,
      },
    }));
  },

  deleteRoute: (id: string) => {
    pushToHistory();
    set(state => ({
      document: {
        ...state.document,
        routes: state.document.routes.filter(r => r.id !== id),
        modified: true,
      },
      selection: state.selection.filter(s => !(s.type === 'route' && s.id === id)),
    }));
  },

  toggleRouteEnabled: (id: string) => {
    set(state => ({
      document: {
        ...state.document,
        routes: state.document.routes.map(r =>
          r.id === id ? { ...r, enabled: !r.enabled } : r
        ),
      },
    }));
  },

  addWaypoint: (waypoint: GPXWaypoint) => {
    pushToHistory();
    set(state => ({
      document: {
        ...state.document,
        waypoints: [...state.document.waypoints, waypoint],
        modified: true,
      },
    }));
  },

  updateWaypoint: (id: string, updates: Partial<GPXWaypoint>) => {
    pushToHistory();
    set(state => ({
      document: {
        ...state.document,
        waypoints: state.document.waypoints.map(w =>
          w.id === id ? { ...w, ...updates } : w
        ),
        modified: true,
      },
    }));
  },

  deleteWaypoint: (id: string) => {
    pushToHistory();
    set(state => ({
      document: {
        ...state.document,
        waypoints: state.document.waypoints.filter(w => w.id !== id),
        modified: true,
      },
      selection: state.selection.filter(s => !(s.type === 'waypoint' && s.id === id)),
    }));
  },

  toggleWaypointEnabled: (id: string) => {
    set(state => ({
      document: {
        ...state.document,
        waypoints: state.document.waypoints.map(w =>
          w.id === id ? { ...w, enabled: !w.enabled } : w
        ),
      },
    }));
  },

  reverseTrack: (id: string) => {
    pushToHistory();
    set(state => ({
      document: {
        ...state.document,
        tracks: state.document.tracks.map(t =>
          t.id === id ? reverseTrackOp(t) : t
        ),
        modified: true,
      },
    }));
  },

  reverseRoute: (id: string) => {
    pushToHistory();
    set(state => ({
      document: {
        ...state.document,
        routes: state.document.routes.map(r =>
          r.id === id ? reverseRouteOp(r) : r
        ),
        modified: true,
      },
    }));
  },

  joinSelectedTracks: () => {
    const state = get();
    const selectedTracks = state.selection
      .filter(s => s.type === 'track')
      .map(s => state.document.tracks.find(t => t.id === s.id))
      .filter((t): t is GPXTrack => t !== undefined);

    if (selectedTracks.length < 2) return;

    pushToHistory();
    let joinedTrack = selectedTracks[0];
    for (let i = 1; i < selectedTracks.length; i++) {
      joinedTrack = joinTracksOp(joinedTrack, selectedTracks[i]);
    }

    const selectedIds = selectedTracks.map(t => t.id);
    set(state => ({
      document: {
        ...state.document,
        tracks: [
          ...state.document.tracks.filter(t => !selectedIds.includes(t.id)),
          joinedTrack,
        ],
        modified: true,
      },
      selection: [],
    }));
  },

  mergeTrackSegmentsAction: (id: string) => {
    pushToHistory();
    set(state => ({
      document: {
        ...state.document,
        tracks: state.document.tracks.map(t =>
          t.id === id ? mergeTrackSegments(t) : t
        ),
        modified: true,
      },
    }));
  },

  convertRouteToTrack: (id: string) => {
    const state = get();
    const route = state.document.routes.find(r => r.id === id);
    if (!route) return;

    pushToHistory();
    const newTrack = routeToTrack(route);

    set(state => ({
      document: {
        ...state.document,
        routes: state.document.routes.filter(r => r.id !== id),
        tracks: [...state.document.tracks, newTrack],
        modified: true,
      },
      selection: [],
    }));
  },

  convertTrackToRoute: (id: string) => {
    const state = get();
    const track = state.document.tracks.find(t => t.id === id);
    if (!track) return;

    pushToHistory();
    const newRoute = trackToRoute(track);

    set(state => ({
      document: {
        ...state.document,
        tracks: state.document.tracks.filter(t => t.id !== id),
        routes: [...state.document.routes, newRoute],
        modified: true,
      },
      selection: [],
    }));
  },

  createRouteFromWaypoints: (waypointIds: string[]) => {
    const state = get();
    if (waypointIds.length < 2) return;

    const waypoints = waypointIds
      .map(id => state.document.waypoints.find(w => w.id === id))
      .filter((w): w is GPXWaypoint => w !== undefined);

    if (waypoints.length < 2) return;

    pushToHistory();

    const newRoute: GPXRoute = {
      id: generateId(),
      name: `Route from ${waypoints.length} waypoints`,
      color: getNextTrackColor(),
      enabled: true,
      points: waypoints.map(w => ({
        id: generateId(),
        lat: w.lat,
        lon: w.lon,
        ele: w.ele,
        name: w.name,
        enabled: true,
      })),
    };

    set(state => ({
      document: {
        ...state.document,
        routes: [...state.document.routes, newRoute],
        modified: true,
      },
      selection: [{ type: 'route', id: newRoute.id }],
    }));
  },

  deleteTrackPoint: (trackId: string, segmentId: string, pointIndex: number) => {
    const state = get();
    const track = state.document.tracks.find(t => t.id === trackId);
    if (!track) return;

    const segment = track.segments.find(s => s.id === segmentId);
    if (!segment || pointIndex < 0 || pointIndex >= segment.points.length) return;

    pushToHistory();

    const newSegments = track.segments.map(seg => {
      if (seg.id !== segmentId) return seg;
      const newPoints = [...seg.points];
      newPoints.splice(pointIndex, 1);
      return { ...seg, points: newPoints };
    }).filter(seg => seg.points.length > 0); // Remove empty segments

    if (newSegments.length === 0) {
      // Track would be empty, delete it
      set(state => ({
        document: {
          ...state.document,
          tracks: state.document.tracks.filter(t => t.id !== trackId),
          modified: true,
        },
        selection: [],
      }));
    } else {
      set(state => ({
        document: {
          ...state.document,
          tracks: state.document.tracks.map(t =>
            t.id === trackId ? { ...t, segments: newSegments } : t
          ),
          modified: true,
        },
      }));
    }
  },

  reorderTracks: (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    pushToHistory();
    set(state => {
      const tracks = [...state.document.tracks];
      const [moved] = tracks.splice(fromIndex, 1);
      tracks.splice(toIndex, 0, moved);
      return {
        document: { ...state.document, tracks, modified: true },
      };
    });
  },

  reorderRoutes: (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    pushToHistory();
    set(state => {
      const routes = [...state.document.routes];
      const [moved] = routes.splice(fromIndex, 1);
      routes.splice(toIndex, 0, moved);
      return {
        document: { ...state.document, routes, modified: true },
      };
    });
  },

  reorderWaypoints: (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    pushToHistory();
    set(state => {
      const waypoints = [...state.document.waypoints];
      const [moved] = waypoints.splice(fromIndex, 1);
      waypoints.splice(toIndex, 0, moved);
      return {
        document: { ...state.document, waypoints, modified: true },
      };
    });
  },

  sortTracks: (by: 'name' | 'date' | 'length' | 'points') => {
    pushToHistory();
    set(state => {
      const tracks = [...state.document.tracks];
      tracks.sort((a, b) => {
        switch (by) {
          case 'name':
            return (a.name || '').localeCompare(b.name || '');
          case 'date': {
            const aTime = a.segments[0]?.points[0]?.time || '';
            const bTime = b.segments[0]?.points[0]?.time || '';
            return aTime.localeCompare(bTime);
          }
          case 'length': {
            const aLen = a.segments.reduce((acc, seg) => {
              for (let i = 1; i < seg.points.length; i++) {
                const p1 = seg.points[i - 1], p2 = seg.points[i];
                acc += Math.sqrt(Math.pow(p2.lat - p1.lat, 2) + Math.pow(p2.lon - p1.lon, 2));
              }
              return acc;
            }, 0);
            const bLen = b.segments.reduce((acc, seg) => {
              for (let i = 1; i < seg.points.length; i++) {
                const p1 = seg.points[i - 1], p2 = seg.points[i];
                acc += Math.sqrt(Math.pow(p2.lat - p1.lat, 2) + Math.pow(p2.lon - p1.lon, 2));
              }
              return acc;
            }, 0);
            return bLen - aLen; // Longest first
          }
          case 'points': {
            const aPoints = a.segments.reduce((acc, seg) => acc + seg.points.length, 0);
            const bPoints = b.segments.reduce((acc, seg) => acc + seg.points.length, 0);
            return bPoints - aPoints; // Most points first
          }
          default:
            return 0;
        }
      });
      return { document: { ...state.document, tracks, modified: true } };
    });
  },

  sortRoutes: (by: 'name' | 'length' | 'points') => {
    pushToHistory();
    set(state => {
      const routes = [...state.document.routes];
      routes.sort((a, b) => {
        switch (by) {
          case 'name':
            return (a.name || '').localeCompare(b.name || '');
          case 'length': {
            const aLen = a.points.reduce((acc, _, i) => {
              if (i === 0) return acc;
              const p1 = a.points[i - 1], p2 = a.points[i];
              return acc + Math.sqrt(Math.pow(p2.lat - p1.lat, 2) + Math.pow(p2.lon - p1.lon, 2));
            }, 0);
            const bLen = b.points.reduce((acc, _, i) => {
              if (i === 0) return acc;
              const p1 = b.points[i - 1], p2 = b.points[i];
              return acc + Math.sqrt(Math.pow(p2.lat - p1.lat, 2) + Math.pow(p2.lon - p1.lon, 2));
            }, 0);
            return bLen - aLen;
          }
          case 'points':
            return b.points.length - a.points.length;
          default:
            return 0;
        }
      });
      return { document: { ...state.document, routes, modified: true } };
    });
  },

  sortWaypoints: (by: 'name' | 'lat' | 'lon' | 'ele') => {
    pushToHistory();
    set(state => {
      const waypoints = [...state.document.waypoints];
      waypoints.sort((a, b) => {
        switch (by) {
          case 'name':
            return (a.name || '').localeCompare(b.name || '');
          case 'lat':
            return b.lat - a.lat; // North first
          case 'lon':
            return a.lon - b.lon; // West first
          case 'ele':
            return (b.ele || 0) - (a.ele || 0); // Highest first
          default:
            return 0;
        }
      });
      return { document: { ...state.document, waypoints, modified: true } };
    });
  },

  setModified: (modified: boolean) => {
    set(state => ({
      document: { ...state.document, modified },
    }));
  },
}));
