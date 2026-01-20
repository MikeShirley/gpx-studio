import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useGpxStore } from '../../stores/gpxStore';
import { useUIStore } from '../../stores/uiStore';
import { TreeNode } from './TreeNode';
import { haversineDistance, calculateBoundingBox } from '../../lib/gpx/calculations';
import type { GPXTrack, GPXRoute, GPXWaypoint } from '../../lib/gpx/types';


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

// Group items by source file
interface FileGroup {
  sourceFile: string;
  tracks: GPXTrack[];
  routes: GPXRoute[];
  waypoints: GPXWaypoint[];
  color: string;
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
  } = useGpxStore();

  // Track which file groups have their waypoints expanded
  const [expandedWaypoints, setExpandedWaypoints] = useState<Set<string>>(new Set());

  // Track the anchor item for Shift+Click range selection
  const anchorRef = useRef<{ type: 'track' | 'route' | 'waypoint', id: string } | null>(null);

  // Ref for the scroll container
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Group items by source file
  const fileGroups = useMemo((): FileGroup[] => {
    const groups = new Map<string, FileGroup>();

    // Group tracks
    for (const track of document.tracks) {
      const sourceFile = track.sourceFile || 'Unsaved';
      if (!groups.has(sourceFile)) {
        groups.set(sourceFile, {
          sourceFile,
          tracks: [],
          routes: [],
          waypoints: [],
          color: track.color,
        });
      }
      groups.get(sourceFile)!.tracks.push(track);
    }

    // Group routes
    for (const route of document.routes) {
      const sourceFile = route.sourceFile || 'Unsaved';
      if (!groups.has(sourceFile)) {
        groups.set(sourceFile, {
          sourceFile,
          tracks: [],
          routes: [],
          waypoints: [],
          color: route.color,
        });
      }
      groups.get(sourceFile)!.routes.push(route);
    }

    // Group waypoints
    for (const waypoint of document.waypoints) {
      const sourceFile = waypoint.sourceFile || 'Unsaved';
      if (!groups.has(sourceFile)) {
        groups.set(sourceFile, {
          sourceFile,
          tracks: [],
          routes: [],
          waypoints: [],
          color: waypoint.color || '#3B82F6',
        });
      }
      groups.get(sourceFile)!.waypoints.push(waypoint);
    }

    return Array.from(groups.values());
  }, [document.tracks, document.routes, document.waypoints]);

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

  // Toggle waypoints expansion for a file group
  const toggleWaypointsExpanded = useCallback((sourceFile: string) => {
    setExpandedWaypoints(prev => {
      const next = new Set(prev);
      if (next.has(sourceFile)) {
        next.delete(sourceFile);
      } else {
        next.add(sourceFile);
      }
      return next;
    });
  }, []);

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

  const hasData = document.tracks.length > 0 || document.routes.length > 0 || document.waypoints.length > 0;

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
        {/* File-based hierarchy */}
        {fileGroups.map((group) => {
          const waypointsExpanded = expandedWaypoints.has(group.sourceFile);
          const hasWaypoints = group.waypoints.length > 0;

          return (
            <div key={group.sourceFile} className="mb-3">
              {/* File header */}
              <div className="flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded-t">
                <div
                  className="w-3 h-3 rounded-sm"
                  style={{ backgroundColor: group.color }}
                />
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 truncate flex-1">
                  {group.sourceFile}
                </span>
              </div>

              {/* Tracks in this file */}
              {group.tracks.map((trk) => {
                const pointCount = trk.segments.reduce((acc, seg) => acc + seg.points.length, 0);
                const distance = calculateTrackDistance(trk);
                const tooltip = `${trk.name || 'Track'}\nDistance: ${formatDistance(distance)}\nPoints: ${pointCount}\nSegments: ${trk.segments.length}`;
                // Track icon: solid colored line - use yellow when selected to match map
                const isTrackSelected = selection.some(s => s.type === 'track' && s.id === trk.id);
                const trackIconColor = isTrackSelected ? '#FFFF00' : trk.color;
                const trackIcon = (
                  <div className="w-4 h-4 flex items-center justify-center">
                    <div className="w-4 h-1 rounded" style={{ backgroundColor: trackIconColor }} />
                  </div>
                );
                return (
                  <div
                    key={trk.id}
                    data-item-id={`track-${trk.id}`}
                    onContextMenu={(e) => handleContextMenu(e, 'track', trk.id)}
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
                      subtitle={`${formatDistance(distance)}`}
                      tooltip={tooltip}
                      onMouseEnter={() => setHoveredItem({ type: 'track', id: trk.id })}
                      onMouseLeave={() => setHoveredItem(null)}
                    />
                    {trk.expanded && trk.segments.length > 1 && (
                      <div className="ml-4">
                        {trk.segments.map((seg, i) => {
                          const isSegSelected = selection.some(
                            s => s.type === 'segment' && s.trackId === trk.id && s.segmentId === seg.id
                          );
                          const segIconColor = isSegSelected ? '#FFFF00' : trk.color;
                          const segIcon = (
                            <div className="w-4 h-4 flex items-center justify-center">
                              <div className="w-3 h-0.5 rounded" style={{ backgroundColor: segIconColor }} />
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

              {/* Routes in this file */}
              {group.routes.map((rte) => {
                const distance = calculateRouteDistance(rte);
                const routeTooltip = `${rte.name || 'Route'}\nDistance: ${formatDistance(distance)}\nPoints: ${rte.points.length}`;
                // Route icon: dashed colored line - use yellow when selected to match map
                const isRouteSelected = selection.some(s => s.type === 'route' && s.id === rte.id);
                const routeIconColor = isRouteSelected ? '#FFFF00' : rte.color;
                const routeIcon = (
                  <div className="w-4 h-4 flex items-center justify-center">
                    <div
                      className="w-4 h-1 rounded"
                      style={{
                        backgroundImage: `repeating-linear-gradient(90deg, ${routeIconColor} 0px, ${routeIconColor} 3px, transparent 3px, transparent 5px)`,
                      }}
                    />
                  </div>
                );
                return (
                  <div
                    key={rte.id}
                    data-item-id={`route-${rte.id}`}
                    onContextMenu={(e) => handleContextMenu(e, 'route', rte.id)}
                  >
                    <TreeNode
                      icon={routeIcon}
                      label={rte.name || `Route`}
                      enabled={rte.enabled}
                      selected={selection.some(s => s.type === 'route' && s.id === rte.id)}
                      onSelect={(e) => handleSelect({ type: 'route', id: rte.id }, e)}
                      onToggleEnabled={() => toggleRouteEnabled(rte.id)}
                      subtitle={`${formatDistance(distance)}`}
                      tooltip={routeTooltip}
                      onMouseEnter={() => setHoveredItem({ type: 'route', id: rte.id })}
                      onMouseLeave={() => setHoveredItem(null)}
                    />
                  </div>
                );
              })}

              {/* Expandable Waypoints section for this file */}
              {hasWaypoints && (
                <div className="ml-2">
                  {/* Waypoints header - clickable to expand/collapse */}
                  {/* Use the first waypoint's color for the header icon */}
                  {(() => {
                    const headerWptColor = group.waypoints[0]?.color || '#3B82F6';
                    return (
                      <div
                        className="flex items-center gap-1 px-2 py-1 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 rounded"
                        onClick={() => toggleWaypointsExpanded(group.sourceFile)}
                      >
                        <span className="text-gray-500 text-xs">
                          {waypointsExpanded ? '▼' : '▶'}
                        </span>
                        <div className="w-4 h-4 flex items-center justify-center">
                          <div
                            className="w-2.5 h-2.5 border"
                            style={{
                              backgroundColor: headerWptColor,
                              borderColor: headerWptColor,
                              borderRadius: '50% 50% 50% 0',
                              transform: 'rotate(-45deg)',
                            }}
                          />
                        </div>
                        <span className="text-xs text-gray-600 dark:text-gray-400">
                          Waypoints ({group.waypoints.length})
                        </span>
                      </div>
                    );
                  })()}

                  {/* Individual waypoints (when expanded) */}
                  {waypointsExpanded && (
                    <div className="ml-4">
                      {group.waypoints.map((wpt) => {
                        const wptTooltip = `${wpt.name || 'Waypoint'}\nLat: ${wpt.lat.toFixed(6)}\nLon: ${wpt.lon.toFixed(6)}${wpt.ele !== undefined ? `\nElevation: ${wpt.ele.toFixed(1)} m` : ''}`;
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
                        return (
                          <div
                            key={wpt.id}
                            data-item-id={`waypoint-${wpt.id}`}
                            onContextMenu={(e) => handleContextMenu(e, 'waypoint', wpt.id)}
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
                </div>
              )}
            </div>
          );
        })}

        {/* Empty state */}
        {!hasData && (
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
        {wpt.sourceFile && <div><span className="text-gray-500">File:</span> {wpt.sourceFile}</div>}
      </div>
    );
  }

  if (selection.type === 'route') {
    const rte = document.routes.find(r => r.id === selection.id);
    if (!rte) return null;
    const distance = calculateRouteDistance(rte);
    return (
      <div className="text-xs space-y-1">
        <div><span className="text-gray-500">Name:</span> {rte.name || '(unnamed)'}</div>
        <div><span className="text-gray-500">Distance:</span> {formatDistance(distance)}</div>
        <div><span className="text-gray-500">Points:</span> {rte.points.length}</div>
        {rte.sourceFile && <div><span className="text-gray-500">File:</span> {rte.sourceFile}</div>}
      </div>
    );
  }

  if (selection.type === 'track') {
    const trk = document.tracks.find(t => t.id === selection.id);
    if (!trk) return null;
    const pointCount = trk.segments.reduce((acc, seg) => acc + seg.points.length, 0);
    const distance = calculateTrackDistance(trk);
    return (
      <div className="text-xs space-y-1">
        <div><span className="text-gray-500">Name:</span> {trk.name || '(unnamed)'}</div>
        <div><span className="text-gray-500">Distance:</span> {formatDistance(distance)}</div>
        <div><span className="text-gray-500">Segments:</span> {trk.segments.length}</div>
        <div><span className="text-gray-500">Points:</span> {pointCount}</div>
        {trk.sourceFile && <div><span className="text-gray-500">File:</span> {trk.sourceFile}</div>}
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

