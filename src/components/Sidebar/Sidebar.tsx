import { useState, useCallback, useRef, useEffect } from 'react';
import { useGpxStore } from '../../stores/gpxStore';
import { useUIStore } from '../../stores/uiStore';
import { TreeNode } from './TreeNode';
import { haversineDistance, calculateBoundingBox } from '../../lib/gpx/calculations';
import type { GPXTrack, GPXRoute } from '../../lib/gpx/types';

// Drag state for reordering
interface DragState {
  type: 'track' | 'route' | 'waypoint';
  index: number;
}

// Sort options type
type TrackSortOption = 'name' | 'date' | 'length' | 'points';
type RouteSortOption = 'name' | 'length' | 'points';
type WaypointSortOption = 'name' | 'lat' | 'lon' | 'ele';

// Calculate total distance for a track
function calculateTrackDistance(track: GPXTrack): number {
  let distance = 0;
  for (const segment of track.segments) {
    for (let i = 1; i < segment.points.length; i++) {
      distance += haversineDistance(
        segment.points[i - 1].lat,
        segment.points[i - 1].lon,
        segment.points[i].lat,
        segment.points[i].lon
      );
    }
  }
  return distance;
}

// Calculate total distance for a route
function calculateRouteDistance(route: GPXRoute): number {
  let distance = 0;
  for (let i = 1; i < route.points.length; i++) {
    distance += haversineDistance(
      route.points[i - 1].lat,
      route.points[i - 1].lon,
      route.points[i].lat,
      route.points[i].lon
    );
  }
  return distance;
}

// Format distance for display
function formatDistance(meters: number): string {
  const km = meters / 1000;
  const mi = km * 0.621371;
  if (km < 1) {
    return `${Math.round(meters)} m (${Math.round(meters * 3.28084)} ft)`;
  }
  return `${km.toFixed(2)} km (${mi.toFixed(2)} mi)`;
}

interface ContextMenuState {
  x: number;
  y: number;
  type: 'track' | 'route' | 'waypoint';
  id: string;
}

export function Sidebar() {
  const { sidebarWidth, setStatusMessage, setShowSimplifyDialog, setShowRenameDialog, setShowSplitTrackDialog, setHoveredItem, setZoomTarget } = useUIStore();
  const {
    document,
    selection,
    select,
    toggleSelection,
    selectRange,
    toggleTrackEnabled,
    toggleTrackExpanded,
    toggleRouteEnabled,
    toggleWaypointEnabled,
    deleteTrack,
    deleteRoute,
    deleteWaypoint,
    reverseTrack,
    reverseRoute,
    mergeTrackSegmentsAction,
    convertRouteToTrack,
    convertTrackToRoute,
    copySelected,
    reorderTracks,
    reorderRoutes,
    reorderWaypoints,
    sortTracks,
    sortRoutes,
    sortWaypoints,
    createRouteFromWaypoints,
  } = useGpxStore();

  // Drag-and-drop state
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Sort dropdown states
  const [showTrackSort, setShowTrackSort] = useState(false);
  const [showRouteSort, setShowRouteSort] = useState(false);
  const [showWaypointSort, setShowWaypointSort] = useState(false);

  // Track the anchor item for Shift+Click range selection
  const anchorRef = useRef<{ type: 'track' | 'route' | 'waypoint', id: string } | null>(null);

  // Ref for the scroll container
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to selected item when selection changes (e.g., from map click)
  useEffect(() => {
    if (selection.length === 1 && scrollContainerRef.current) {
      const selectedItem = selection[0];
      // Handle different selection types (segment has trackId/segmentId, others have id)
      const itemId = selectedItem.type === 'segment'
        ? `segment-${selectedItem.trackId}-${selectedItem.segmentId}`
        : `${selectedItem.type}-${selectedItem.id}`;
      const element = scrollContainerRef.current.querySelector(`[data-item-id="${itemId}"]`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [selection]);

  // Handle click with multi-select support and zoom to item
  const handleSelect = useCallback((item: { type: 'track' | 'route' | 'waypoint', id: string }, event: React.MouseEvent) => {
    if (event.shiftKey && anchorRef.current) {
      // Shift+Click: select range from anchor to clicked item
      selectRange(anchorRef.current, item);
      setStatusMessage(`Selected range`);
    } else if (event.metaKey || event.ctrlKey) {
      // Ctrl/Cmd+Click: toggle individual item
      toggleSelection(item);
      // Keep the anchor for potential future range selections
    } else {
      // Regular click: single select and set anchor
      select(item);
      anchorRef.current = item;

      // Calculate bounds and zoom to item
      if (item.type === 'track') {
        const track = document.tracks.find(t => t.id === item.id);
        if (track) {
          const allPoints = track.segments.flatMap(s => s.points);
          if (allPoints.length > 0) {
            const bounds = calculateBoundingBox(allPoints);
            if (bounds.valid) {
              setZoomTarget({ north: bounds.north, south: bounds.south, east: bounds.east, west: bounds.west });
            }
          }
        }
      } else if (item.type === 'route') {
        const route = document.routes.find(r => r.id === item.id);
        if (route && route.points.length > 0) {
          const bounds = calculateBoundingBox(route.points);
          if (bounds.valid) {
            setZoomTarget({ north: bounds.north, south: bounds.south, east: bounds.east, west: bounds.west });
          }
        }
      } else if (item.type === 'waypoint') {
        const wpt = document.waypoints.find(w => w.id === item.id);
        if (wpt) {
          // For a single point, create a small bounding box around it
          const padding = 0.005; // ~500m at equator
          setZoomTarget({
            north: wpt.lat + padding,
            south: wpt.lat - padding,
            east: wpt.lon + padding,
            west: wpt.lon - padding,
          });
        }
      }
    }
  }, [select, toggleSelection, selectRange, document, setZoomTarget, setStatusMessage]);

  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  const handleContextMenu = useCallback((e: React.MouseEvent, type: 'track' | 'route' | 'waypoint', id: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, type, id });
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const hasWaypoints = document.waypoints.length > 0;
  const hasRoutes = document.routes.length > 0;
  const hasTracks = document.tracks.length > 0;

  return (
    <div
      className="bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden"
      style={{ width: sidebarWidth }}
    >
      {/* Tree View */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto custom-scrollbar p-2"
        onMouseLeave={() => setHoveredItem(null)}
      >
        {/* Tracks Section */}
        {hasTracks && (
          <div className="mb-2">
            <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1 px-2 flex items-center justify-between">
              <span>Tracks ({document.tracks.length})</span>
              <div className="relative">
                <button
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 px-1"
                  onClick={() => setShowTrackSort(!showTrackSort)}
                  title="Sort tracks"
                >
                  ⇅
                </button>
                {showTrackSort && (
                  <SortDropdown
                    options={[
                      { value: 'name', label: 'Name' },
                      { value: 'date', label: 'Date' },
                      { value: 'length', label: 'Length' },
                      { value: 'points', label: 'Points' },
                    ]}
                    onSelect={(value) => {
                      sortTracks(value as TrackSortOption);
                      setShowTrackSort(false);
                      setStatusMessage(`Sorted tracks by ${value}`);
                    }}
                    onClose={() => setShowTrackSort(false)}
                  />
                )}
              </div>
            </div>
            {document.tracks.map((trk, index) => {
              const pointCount = trk.segments.reduce((acc, seg) => acc + seg.points.length, 0);
              const distance = calculateTrackDistance(trk);
              const tooltip = `${trk.name || 'Track'}\nDistance: ${formatDistance(distance)}\nPoints: ${pointCount}\nSegments: ${trk.segments.length}`;
              // Track icon: solid colored line
              const trackIcon = (
                <div className="w-4 h-4 flex items-center justify-center">
                  <div className="w-4 h-1 rounded" style={{ backgroundColor: trk.color }} />
                </div>
              );
              const isDragging = dragState?.type === 'track' && dragState?.index === index;
              const isDragOver = dragState?.type === 'track' && dragOverIndex === index;
              return (
              <div
                key={trk.id}
                data-item-id={`track-${trk.id}`}
                draggable
                onDragStart={() => setDragState({ type: 'track', index })}
                onDragEnd={() => { setDragState(null); setDragOverIndex(null); }}
                onDragOver={(e) => { e.preventDefault(); if (dragState?.type === 'track') setDragOverIndex(index); }}
                onDrop={() => {
                  if (dragState?.type === 'track' && dragState.index !== index) {
                    reorderTracks(dragState.index, index);
                    setStatusMessage('Track reordered');
                  }
                  setDragState(null);
                  setDragOverIndex(null);
                }}
                onContextMenu={(e) => handleContextMenu(e, 'track', trk.id)}
                className={`${isDragging ? 'opacity-50' : ''} ${isDragOver ? 'border-t-2 border-blue-500' : ''}`}
              >
                <TreeNode
                  icon={trackIcon}
                  label={trk.name || `Track`}
                  enabled={trk.enabled}
                  selected={selection.some(s => s.type === 'track' && s.id === trk.id)}
                  onSelect={(e) => handleSelect({ type: 'track', id: trk.id }, e)}
                  onToggleEnabled={() => toggleTrackEnabled(trk.id)}
                  expandable={trk.segments.length > 1}
                  expanded={trk.expanded}
                  onToggleExpanded={() => toggleTrackExpanded(trk.id)}
                  subtitle={`${pointCount} points`}
                  tooltip={tooltip}
                  onMouseEnter={() => setHoveredItem({ type: 'track', id: trk.id })}
                  onMouseLeave={() => setHoveredItem(null)}
                />
                {trk.expanded && trk.segments.length > 1 && (
                  <div className="ml-4">
                    {trk.segments.map((seg, i) => {
                      const segIcon = (
                        <div className="w-4 h-4 flex items-center justify-center">
                          <div className="w-3 h-0.5 rounded" style={{ backgroundColor: trk.color }} />
                        </div>
                      );
                      return (
                        <TreeNode
                          key={seg.id}
                          icon={segIcon}
                          label={`Segment ${i + 1}`}
                          enabled={seg.enabled}
                          selected={selection.some(
                            s => s.type === 'segment' && s.trackId === trk.id && s.segmentId === seg.id
                          )}
                          onSelect={() => select({ type: 'segment', trackId: trk.id, segmentId: seg.id })}
                          onToggleEnabled={() => {}}
                          subtitle={`${seg.points.length} points`}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            );
            })}
          </div>
        )}

        {/* Routes Section */}
        {hasRoutes && (
          <div className="mb-2">
            <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1 px-2 flex items-center justify-between">
              <span>Routes ({document.routes.length})</span>
              <div className="relative">
                <button
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 px-1"
                  onClick={() => setShowRouteSort(!showRouteSort)}
                  title="Sort routes"
                >
                  ⇅
                </button>
                {showRouteSort && (
                  <SortDropdown
                    options={[
                      { value: 'name', label: 'Name' },
                      { value: 'length', label: 'Length' },
                      { value: 'points', label: 'Points' },
                    ]}
                    onSelect={(value) => {
                      sortRoutes(value as RouteSortOption);
                      setShowRouteSort(false);
                      setStatusMessage(`Sorted routes by ${value}`);
                    }}
                    onClose={() => setShowRouteSort(false)}
                  />
                )}
              </div>
            </div>
            {document.routes.map((rte, index) => {
              const distance = calculateRouteDistance(rte);
              const routeTooltip = `${rte.name || 'Route'}\nDistance: ${formatDistance(distance)}\nPoints: ${rte.points.length}`;
              // Route icon: dashed colored line
              const routeIcon = (
                <div className="w-4 h-4 flex items-center justify-center">
                  <div
                    className="w-4 h-1 rounded"
                    style={{
                      backgroundImage: `repeating-linear-gradient(90deg, ${rte.color} 0px, ${rte.color} 3px, transparent 3px, transparent 5px)`,
                    }}
                  />
                </div>
              );
              const isDragging = dragState?.type === 'route' && dragState?.index === index;
              const isDragOver = dragState?.type === 'route' && dragOverIndex === index;
              return (
              <div
                key={rte.id}
                data-item-id={`route-${rte.id}`}
                draggable
                onDragStart={() => setDragState({ type: 'route', index })}
                onDragEnd={() => { setDragState(null); setDragOverIndex(null); }}
                onDragOver={(e) => { e.preventDefault(); if (dragState?.type === 'route') setDragOverIndex(index); }}
                onDrop={() => {
                  if (dragState?.type === 'route' && dragState.index !== index) {
                    reorderRoutes(dragState.index, index);
                    setStatusMessage('Route reordered');
                  }
                  setDragState(null);
                  setDragOverIndex(null);
                }}
                onContextMenu={(e) => handleContextMenu(e, 'route', rte.id)}
                className={`${isDragging ? 'opacity-50' : ''} ${isDragOver ? 'border-t-2 border-blue-500' : ''}`}
              >
                <TreeNode
                  icon={routeIcon}
                  label={rte.name || `Route`}
                  enabled={rte.enabled}
                  selected={selection.some(s => s.type === 'route' && s.id === rte.id)}
                  onSelect={(e) => handleSelect({ type: 'route', id: rte.id }, e)}
                  onToggleEnabled={() => toggleRouteEnabled(rte.id)}
                  subtitle={`${rte.points.length} points`}
                  tooltip={routeTooltip}
                  onMouseEnter={() => setHoveredItem({ type: 'route', id: rte.id })}
                  onMouseLeave={() => setHoveredItem(null)}
                />
              </div>
            );
            })}
          </div>
        )}

        {/* Waypoints Section */}
        {hasWaypoints && (
          <div className="mb-2">
            <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1 px-2 flex items-center justify-between">
              <span>Waypoints ({document.waypoints.length})</span>
              <div className="relative flex items-center gap-1">
                {/* Create route from selected waypoints */}
                {selection.filter(s => s.type === 'waypoint').length >= 2 && (
                  <button
                    className="text-blue-500 hover:text-blue-700 dark:hover:text-blue-300 px-1 text-xs"
                    onClick={() => {
                      const waypointIds = selection
                        .filter(s => s.type === 'waypoint')
                        .map(s => s.id);
                      createRouteFromWaypoints(waypointIds);
                      setStatusMessage(`Created route from ${waypointIds.length} waypoints`);
                    }}
                    title="Create route from selected waypoints"
                  >
                    ➔
                  </button>
                )}
                <button
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 px-1"
                  onClick={() => setShowWaypointSort(!showWaypointSort)}
                  title="Sort waypoints"
                >
                  ⇅
                </button>
                {showWaypointSort && (
                  <SortDropdown
                    options={[
                      { value: 'name', label: 'Name' },
                      { value: 'lat', label: 'Latitude (N→S)' },
                      { value: 'lon', label: 'Longitude (W→E)' },
                      { value: 'ele', label: 'Elevation' },
                    ]}
                    onSelect={(value) => {
                      sortWaypoints(value as WaypointSortOption);
                      setShowWaypointSort(false);
                      setStatusMessage(`Sorted waypoints by ${value}`);
                    }}
                    onClose={() => setShowWaypointSort(false)}
                  />
                )}
              </div>
            </div>
            {document.waypoints.map((wpt, index) => {
              const wptTooltip = `${wpt.name || 'Waypoint'}\nLat: ${wpt.lat.toFixed(6)}\nLon: ${wpt.lon.toFixed(6)}${wpt.ele !== undefined ? `\nElevation: ${wpt.ele.toFixed(1)} m` : ''}`;
              // Waypoint icon: teardrop marker shape with custom color
              const wptColor = wpt.color || '#3B82F6';
              const waypointIcon = (
                <div className="w-4 h-4 flex items-center justify-center">
                  <div
                    className="w-3 h-3 border"
                    style={{
                      backgroundColor: wptColor,
                      borderColor: wptColor,
                      borderRadius: '50% 50% 50% 0',
                      transform: 'rotate(-45deg)',
                    }}
                  />
                </div>
              );
              const isDragging = dragState?.type === 'waypoint' && dragState?.index === index;
              const isDragOver = dragState?.type === 'waypoint' && dragOverIndex === index;
              return (
              <div
                key={wpt.id}
                data-item-id={`waypoint-${wpt.id}`}
                draggable
                onDragStart={() => setDragState({ type: 'waypoint', index })}
                onDragEnd={() => { setDragState(null); setDragOverIndex(null); }}
                onDragOver={(e) => { e.preventDefault(); if (dragState?.type === 'waypoint') setDragOverIndex(index); }}
                onDrop={() => {
                  if (dragState?.type === 'waypoint' && dragState.index !== index) {
                    reorderWaypoints(dragState.index, index);
                    setStatusMessage('Waypoint reordered');
                  }
                  setDragState(null);
                  setDragOverIndex(null);
                }}
                onContextMenu={(e) => handleContextMenu(e, 'waypoint', wpt.id)}
                className={`${isDragging ? 'opacity-50' : ''} ${isDragOver ? 'border-t-2 border-blue-500' : ''}`}
              >
                <TreeNode
                  icon={waypointIcon}
                  label={wpt.name || `Waypoint`}
                  enabled={wpt.enabled}
                  selected={selection.some(s => s.type === 'waypoint' && s.id === wpt.id)}
                  onSelect={(e) => handleSelect({ type: 'waypoint', id: wpt.id }, e)}
                  onToggleEnabled={() => toggleWaypointEnabled(wpt.id)}
                  tooltip={wptTooltip}
                  onMouseEnter={() => setHoveredItem({ type: 'waypoint', id: wpt.id })}
                  onMouseLeave={() => setHoveredItem(null)}
                />
              </div>
            );
            })}
          </div>
        )}

        {/* Empty state */}
        {!hasWaypoints && !hasRoutes && !hasTracks && (
          <div className="text-center text-gray-500 dark:text-gray-400 py-8">
            <p className="text-sm">No data loaded</p>
            <p className="text-xs mt-1">Open a GPX file to begin</p>
          </div>
        )}
      </div>

      {/* Properties Panel */}
      <div className="border-t border-gray-200 dark:border-gray-700 p-3">
        <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">
          Properties
        </div>
        {selection.length === 0 ? (
          <p className="text-xs text-gray-400">No selection</p>
        ) : selection.length === 1 ? (
          <PropertiesPanel selection={selection[0]} />
        ) : (
          <p className="text-xs text-gray-400">{selection.length} items selected</p>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          type={contextMenu.type}
          id={contextMenu.id}
          onClose={closeContextMenu}
          onDelete={() => {
            if (contextMenu.type === 'track') deleteTrack(contextMenu.id);
            else if (contextMenu.type === 'route') deleteRoute(contextMenu.id);
            else if (contextMenu.type === 'waypoint') deleteWaypoint(contextMenu.id);
            setStatusMessage(`Deleted ${contextMenu.type}`);
            closeContextMenu();
          }}
          onRename={() => {
            select({ type: contextMenu.type, id: contextMenu.id });
            setShowRenameDialog(true);
            closeContextMenu();
          }}
          onReverse={() => {
            if (contextMenu.type === 'track') {
              reverseTrack(contextMenu.id);
              setStatusMessage('Track reversed');
            } else if (contextMenu.type === 'route') {
              reverseRoute(contextMenu.id);
              setStatusMessage('Route reversed');
            }
            closeContextMenu();
          }}
          onMergeSegments={() => {
            if (contextMenu.type === 'track') {
              mergeTrackSegmentsAction(contextMenu.id);
              setStatusMessage('Track segments merged');
            }
            closeContextMenu();
          }}
          onConvert={() => {
            if (contextMenu.type === 'track') {
              convertTrackToRoute(contextMenu.id);
              setStatusMessage('Track converted to route');
            } else if (contextMenu.type === 'route') {
              convertRouteToTrack(contextMenu.id);
              setStatusMessage('Route converted to track');
            }
            closeContextMenu();
          }}
          onSimplify={() => {
            // Select the item first so the dialog knows what to simplify
            select({ type: contextMenu.type, id: contextMenu.id });
            setShowSimplifyDialog(true);
            closeContextMenu();
          }}
          onSplit={() => {
            select({ type: contextMenu.type, id: contextMenu.id });
            setShowSplitTrackDialog(true);
            closeContextMenu();
          }}
          onCopy={() => {
            select({ type: contextMenu.type, id: contextMenu.id });
            copySelected();
            setStatusMessage('Copied to clipboard');
            closeContextMenu();
          }}
        />
      )}
    </div>
  );
}

import type { SelectableItem } from '../../lib/gpx/types';

function PropertiesPanel({ selection }: { selection: SelectableItem }) {
  const { document } = useGpxStore();

  if (selection.type === 'waypoint') {
    const wpt = document.waypoints.find(w => w.id === selection.id);
    if (!wpt) return null;
    return (
      <div className="text-xs space-y-1">
        <div><span className="text-gray-500">Name:</span> {wpt.name || '(unnamed)'}</div>
        <div><span className="text-gray-500">Lat:</span> {wpt.lat.toFixed(6)}</div>
        <div><span className="text-gray-500">Lon:</span> {wpt.lon.toFixed(6)}</div>
        {wpt.ele !== undefined && <div><span className="text-gray-500">Ele:</span> {wpt.ele.toFixed(1)} m</div>}
      </div>
    );
  }

  if (selection.type === 'route') {
    const rte = document.routes.find(r => r.id === selection.id);
    if (!rte) return null;
    return (
      <div className="text-xs space-y-1">
        <div><span className="text-gray-500">Name:</span> {rte.name || '(unnamed)'}</div>
        <div><span className="text-gray-500">Points:</span> {rte.points.length}</div>
      </div>
    );
  }

  if (selection.type === 'track') {
    const trk = document.tracks.find(t => t.id === selection.id);
    if (!trk) return null;
    const pointCount = trk.segments.reduce((acc, seg) => acc + seg.points.length, 0);
    return (
      <div className="text-xs space-y-1">
        <div><span className="text-gray-500">Name:</span> {trk.name || '(unnamed)'}</div>
        <div><span className="text-gray-500">Segments:</span> {trk.segments.length}</div>
        <div><span className="text-gray-500">Points:</span> {pointCount}</div>
      </div>
    );
  }

  return null;
}

interface ContextMenuProps {
  x: number;
  y: number;
  type: 'track' | 'route' | 'waypoint';
  id: string;
  onClose: () => void;
  onDelete: () => void;
  onRename: () => void;
  onReverse: () => void;
  onMergeSegments: () => void;
  onConvert: () => void;
  onSimplify: () => void;
  onSplit: () => void;
  onCopy: () => void;
}

function ContextMenu({ x, y, type, onClose, onDelete, onRename, onReverse, onMergeSegments, onConvert, onSimplify, onSplit, onCopy }: ContextMenuProps) {
  // Close on click outside
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[10000]" onClick={handleBackdropClick}>
      <div
        className="absolute bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 min-w-[160px]"
        style={{ left: x, top: y }}
      >
        {/* Common options */}
        <button
          className="w-full px-3 py-1.5 text-sm text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
          onClick={onRename}
        >
          <span>✏️</span> Rename
        </button>
        <button
          className="w-full px-3 py-1.5 text-sm text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
          onClick={onCopy}
        >
          <span>📋</span> Copy
        </button>
        <button
          className="w-full px-3 py-1.5 text-sm text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
          onClick={onDelete}
        >
          <span>🗑️</span> Delete
        </button>

        {/* Track/Route specific options */}
        {(type === 'track' || type === 'route') && (
          <>
            <div className="border-t border-gray-200 dark:border-gray-600 my-1" />
            <button
              className="w-full px-3 py-1.5 text-sm text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
              onClick={onReverse}
            >
              <span>↔️</span> Reverse
            </button>
            <button
              className="w-full px-3 py-1.5 text-sm text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
              onClick={onSimplify}
            >
              <span>📐</span> Simplify...
            </button>
            <button
              className="w-full px-3 py-1.5 text-sm text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
              onClick={onConvert}
            >
              <span>🔄</span> Convert to {type === 'track' ? 'Route' : 'Track'}
            </button>
          </>
        )}

        {/* Track specific options */}
        {type === 'track' && (
          <>
            <button
              className="w-full px-3 py-1.5 text-sm text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
              onClick={onSplit}
            >
              <span>✂️</span> Split Track...
            </button>
            <button
              className="w-full px-3 py-1.5 text-sm text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
              onClick={onMergeSegments}
            >
              <span>🔗</span> Merge Segments
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// Sort dropdown component
interface SortDropdownProps {
  options: { value: string; label: string }[];
  onSelect: (value: string) => void;
  onClose: () => void;
}

function SortDropdown({ options, onSelect, onClose }: SortDropdownProps) {
  return (
    <>
      <div className="fixed inset-0 z-[9999]" onClick={onClose} />
      <div className="absolute right-0 top-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 min-w-[120px] z-[10000]">
        {options.map((opt) => (
          <button
            key={opt.value}
            className="w-full px-3 py-1.5 text-xs text-left hover:bg-gray-100 dark:hover:bg-gray-700"
            onClick={() => onSelect(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </>
  );
}
