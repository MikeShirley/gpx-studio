import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, Rectangle, useMap, useMapEvents } from 'react-leaflet';
import type { Map as LeafletMap, LeafletMouseEvent } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useGpxStore } from '../../stores/gpxStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useUIStore } from '../../stores/uiStore';
import { calculateBoundingBox, mergeBoundingBoxes, haversineDistance } from '../../lib/gpx/calculations';
import type { BoundingBox, GPXRoute } from '../../lib/gpx/types';
import { generateId, getNextTrackColor } from '../../lib/gpx/types';

// Fix Leaflet default marker icons
import L from 'leaflet';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

// @ts-expect-error - Leaflet types don't include _getIconUrl
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl,
  iconRetinaUrl,
  shadowUrl,
});

// Helper to darken a hex color for borders
function darkenColor(hex: string, factor: number): string {
  // Remove # if present
  const color = hex.replace('#', '');
  const r = parseInt(color.substring(0, 2), 16);
  const g = parseInt(color.substring(2, 4), 16);
  const b = parseInt(color.substring(4, 6), 16);

  const darkenedR = Math.round(r * (1 - factor));
  const darkenedG = Math.round(g * (1 - factor));
  const darkenedB = Math.round(b * (1 - factor));

  return `#${darkenedR.toString(16).padStart(2, '0')}${darkenedG.toString(16).padStart(2, '0')}${darkenedB.toString(16).padStart(2, '0')}`;
}

const TILE_LAYERS = {
  osm: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri',
  },
  terrain: {
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenTopoMap',
  },
};

export function MapView() {
  const { document, addWaypoint, addTrack, selectItemsInBounds, deletePointsInBounds, selection, copySelected } = useGpxStore();
  const { defaultTileLayer, trackColor } = useSettingsStore();
  const { editorMode, setEditorMode, setStatusMessage, hoveredItem } = useUIStore();
  const mapRef = useRef<LeafletMap | null>(null);

  // Track the current route being drawn
  const [drawingRoute, setDrawingRoute] = useState<GPXRoute | null>(null);
  const [isDrawingContinuous, setIsDrawingContinuous] = useState(false);
  const lastDrawPointRef = useRef<{ lat: number; lon: number } | null>(null);
  const MIN_DRAW_DISTANCE = 5; // Minimum distance in meters between continuous draw points

  // Track measurement points
  const [measurePoints, setMeasurePoints] = useState<{ lat: number; lon: number }[]>([]);

  // Box selection state
  const [boxSelectStart, setBoxSelectStart] = useState<{ lat: number; lon: number } | null>(null);
  const [boxSelectEnd, setBoxSelectEnd] = useState<{ lat: number; lon: number } | null>(null);
  const [isBoxSelecting, setIsBoxSelecting] = useState(false);
  const [showBoxMenu, setShowBoxMenu] = useState<{ x: number; y: number } | null>(null);

  // Calculate bounds from all data
  const bounds = useMemo(() => {
    let combinedBounds: BoundingBox = { north: 0, south: 0, east: 0, west: 0, valid: false };

    // Waypoints
    if (document.waypoints.length > 0) {
      const wptBounds = calculateBoundingBox(document.waypoints);
      combinedBounds = mergeBoundingBoxes(combinedBounds, wptBounds);
    }

    // Routes
    for (const route of document.routes) {
      if (route.enabled && route.points.length > 0) {
        const rteBounds = calculateBoundingBox(route.points);
        combinedBounds = mergeBoundingBoxes(combinedBounds, rteBounds);
      }
    }

    // Tracks
    for (const track of document.tracks) {
      if (track.enabled) {
        for (const segment of track.segments) {
          if (segment.enabled && segment.points.length > 0) {
            const segBounds = calculateBoundingBox(segment.points);
            combinedBounds = mergeBoundingBoxes(combinedBounds, segBounds);
          }
        }
      }
    }

    return combinedBounds;
  }, [document]);

  const tileLayer = TILE_LAYERS[defaultTileLayer as keyof typeof TILE_LAYERS] || TILE_LAYERS.osm;

  // Default center if no data
  const defaultCenter: [number, number] = bounds.valid
    ? [(bounds.north + bounds.south) / 2, (bounds.east + bounds.west) / 2]
    : [37.7749, -122.4194]; // San Francisco

  // Handle map click based on editor mode
  const handleMapClick = useCallback((e: LeafletMouseEvent) => {
    const { lat, lng } = e.latlng;

    if (editorMode === 'add-waypoint') {
      addWaypoint({
        id: generateId(),
        lat,
        lon: lng,
        name: `Waypoint ${document.waypoints.length + 1}`,
        enabled: true,
      });
      setStatusMessage(`Added waypoint at ${lat.toFixed(6)}, ${lng.toFixed(6)}`);
    } else if (editorMode === 'draw-route') {
      // Only add point on click if we already have a route (continuous draw starts via mousedown)
      // This allows clicking to add individual points after a continuous draw
      if (drawingRoute) {
        // Check if last point is very close (to avoid duplicate from mousedown)
        const lastPoint = drawingRoute.points[drawingRoute.points.length - 1];
        const distance = haversineDistance(lastPoint.lat, lastPoint.lon, lat, lng);

        // Only add if the click is far enough from the last point (avoid duplicates)
        if (distance >= MIN_DRAW_DISTANCE) {
          const updatedRoute = {
            ...drawingRoute,
            points: [...drawingRoute.points, { id: generateId(), lat, lon: lng, enabled: true }],
          };
          setDrawingRoute(updatedRoute);
          setStatusMessage(`Route has ${updatedRoute.points.length} points`);
        }
      }
      // Note: Starting a new route is handled by handleMouseDown
    } else if (editorMode === 'measure') {
      const newPoints = [...measurePoints, { lat, lon: lng }];
      setMeasurePoints(newPoints);

      if (newPoints.length >= 2) {
        // Calculate total distance
        let totalDistance = 0;
        for (let i = 1; i < newPoints.length; i++) {
          totalDistance += haversineDistance(
            newPoints[i - 1].lat,
            newPoints[i - 1].lon,
            newPoints[i].lat,
            newPoints[i].lon
          );
        }

        const distanceKm = totalDistance / 1000;
        const distanceMi = distanceKm * 0.621371;
        setStatusMessage(`Distance: ${distanceKm.toFixed(2)} km (${distanceMi.toFixed(2)} mi)`);
      } else {
        setStatusMessage('Click another point to measure distance');
      }
    }
  }, [editorMode, document.waypoints.length, document.routes.length, addWaypoint, drawingRoute, trackColor, setStatusMessage, measurePoints]);

  // Handle double-click to finish drawing - creates a track
  const handleMapDoubleClick = useCallback(() => {
    if (editorMode === 'draw-route' && drawingRoute && drawingRoute.points.length >= 2) {
      // Convert the drawn route to a track
      const newTrack = {
        id: generateId(),
        name: `Track ${document.tracks.length + 1}`,
        color: drawingRoute.color,
        enabled: true,
        expanded: true,
        segments: [{
          id: generateId(),
          points: drawingRoute.points,
          enabled: true,
        }],
      };
      addTrack(newTrack);
      setDrawingRoute(null);
      setEditorMode('select');
      setStatusMessage(`Created track with ${drawingRoute.points.length} points`);
    }
  }, [editorMode, drawingRoute, addTrack, setEditorMode, setStatusMessage, document.tracks.length]);

  // Handle escape to cancel drawing or measuring
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (drawingRoute) {
          setDrawingRoute(null);
          setStatusMessage('Drawing cancelled');
        }
        if (measurePoints.length > 0) {
          setMeasurePoints([]);
          setStatusMessage('Measurement cleared');
        }
        if (isBoxSelecting || showBoxMenu) {
          setBoxSelectStart(null);
          setBoxSelectEnd(null);
          setIsBoxSelecting(false);
          setShowBoxMenu(null);
          setStatusMessage('Box selection cancelled');
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [drawingRoute, measurePoints, setStatusMessage, isBoxSelecting, showBoxMenu]);

  // Clear measurement when switching away from measure mode
  useEffect(() => {
    if (editorMode !== 'measure' && measurePoints.length > 0) {
      setMeasurePoints([]);
    }
  }, [editorMode]);

  // Clear box selection when switching away from box-select mode
  useEffect(() => {
    if (editorMode !== 'box-select') {
      setBoxSelectStart(null);
      setBoxSelectEnd(null);
      setIsBoxSelecting(false);
      setShowBoxMenu(null);
    }
  }, [editorMode]);

  // Handle box selection completion
  const handleBoxSelectComplete = useCallback(() => {
    if (!boxSelectStart || !boxSelectEnd) return;

    const bounds = {
      north: Math.max(boxSelectStart.lat, boxSelectEnd.lat),
      south: Math.min(boxSelectStart.lat, boxSelectEnd.lat),
      east: Math.max(boxSelectStart.lon, boxSelectEnd.lon),
      west: Math.min(boxSelectStart.lon, boxSelectEnd.lon),
    };

    const count = selectItemsInBounds(bounds);
    if (count > 0) {
      setStatusMessage(`Selected ${count} item(s) in box`);
      // Show menu at the end point of the selection
      const map = mapRef.current;
      if (map) {
        const point = map.latLngToContainerPoint([boxSelectEnd.lat, boxSelectEnd.lon]);
        setShowBoxMenu({ x: point.x, y: point.y });
      }
    } else {
      setStatusMessage('No items in selection box');
      setBoxSelectStart(null);
      setBoxSelectEnd(null);
    }
    setIsBoxSelecting(false);
  }, [boxSelectStart, boxSelectEnd, selectItemsInBounds, setStatusMessage]);

  // Handle copy selected items from box
  const handleBoxCopy = useCallback(() => {
    copySelected();
    const currentSelection = useGpxStore.getState().selection;
    setStatusMessage(`Copied ${currentSelection.length} item(s) to clipboard`);
    setShowBoxMenu(null);
    setBoxSelectStart(null);
    setBoxSelectEnd(null);
  }, [copySelected, setStatusMessage]);

  // Helper to get bounds from box selection
  const getSelectionBounds = useCallback(() => {
    if (!boxSelectStart || !boxSelectEnd) return null;
    return {
      north: Math.max(boxSelectStart.lat, boxSelectEnd.lat),
      south: Math.min(boxSelectStart.lat, boxSelectEnd.lat),
      east: Math.max(boxSelectStart.lon, boxSelectEnd.lon),
      west: Math.min(boxSelectStart.lon, boxSelectEnd.lon),
    };
  }, [boxSelectStart, boxSelectEnd]);

  // Helper to format delete result message
  const formatDeleteResult = useCallback((result: { deletedPoints: number; deletedWaypoints: number; newTracks: number; newRoutes: number }) => {
    const messages: string[] = [];
    if (result.deletedWaypoints > 0) {
      messages.push(`${result.deletedWaypoints} waypoint${result.deletedWaypoints !== 1 ? 's' : ''}`);
    }
    if (result.deletedPoints > 0) {
      messages.push(`${result.deletedPoints} point${result.deletedPoints !== 1 ? 's' : ''}`);
    }

    if (messages.length > 0) {
      let msg = `Deleted ${messages.join(' and ')}`;
      if (result.newTracks > 0 || result.newRoutes > 0) {
        const splits: string[] = [];
        if (result.newTracks > 0) splits.push(`${result.newTracks} new segment${result.newTracks !== 1 ? 's' : ''}`);
        if (result.newRoutes > 0) splits.push(`${result.newRoutes} new route${result.newRoutes !== 1 ? 's' : ''}`);
        msg += ` (created ${splits.join(' and ')})`;
      }
      return msg;
    }
    return 'No items in selection box';
  }, []);

  // Close menu and clear selection
  const closeBoxSelection = useCallback(() => {
    setShowBoxMenu(null);
    setBoxSelectStart(null);
    setBoxSelectEnd(null);
  }, []);

  // Delete waypoints only
  const handleDeleteWaypointsOnly = useCallback(() => {
    const bounds = getSelectionBounds();
    if (!bounds) return;
    const result = deletePointsInBounds(bounds, { waypointsOnly: true });
    setStatusMessage(formatDeleteResult(result));
    closeBoxSelection();
  }, [getSelectionBounds, deletePointsInBounds, setStatusMessage, formatDeleteResult, closeBoxSelection]);

  // Delete tracks/routes only
  const handleDeleteTracksOnly = useCallback(() => {
    const bounds = getSelectionBounds();
    if (!bounds) return;
    const result = deletePointsInBounds(bounds, { tracksOnly: true });
    setStatusMessage(formatDeleteResult(result));
    closeBoxSelection();
  }, [getSelectionBounds, deletePointsInBounds, setStatusMessage, formatDeleteResult, closeBoxSelection]);

  // Delete everything in bounds
  const handleDeleteAll = useCallback(() => {
    const bounds = getSelectionBounds();
    if (!bounds) return;
    const result = deletePointsInBounds(bounds);
    setStatusMessage(formatDeleteResult(result));
    closeBoxSelection();
  }, [getSelectionBounds, deletePointsInBounds, setStatusMessage, formatDeleteResult, closeBoxSelection]);

  // Zoom to selection box
  const handleZoomToSelection = useCallback(() => {
    const bounds = getSelectionBounds();
    if (!bounds || !mapRef.current) return;
    mapRef.current.fitBounds([
      [bounds.south, bounds.west],
      [bounds.north, bounds.east],
    ], { padding: [50, 50] });
    setStatusMessage('Zoomed to selection');
    closeBoxSelection();
  }, [getSelectionBounds, setStatusMessage, closeBoxSelection]);

  // Mouse handlers for box selection and continuous drawing
  const handleMouseDown = useCallback((e: LeafletMouseEvent) => {
    if (editorMode === 'box-select') {
      setBoxSelectStart({ lat: e.latlng.lat, lon: e.latlng.lng });
      setBoxSelectEnd({ lat: e.latlng.lat, lon: e.latlng.lng });
      setIsBoxSelecting(true);
      setShowBoxMenu(null);
    } else if (editorMode === 'draw-route') {
      // Start continuous drawing mode
      setIsDrawingContinuous(true);
      lastDrawPointRef.current = { lat: e.latlng.lat, lon: e.latlng.lng };

      const lat = e.latlng.lat;
      const lng = e.latlng.lng;

      if (!drawingRoute) {
        // Start a new route
        const newRoute: GPXRoute = {
          id: generateId(),
          name: `Route ${document.routes.length + 1}`,
          color: trackColor || getNextTrackColor(),
          enabled: true,
          points: [{ id: generateId(), lat, lon: lng, enabled: true }],
        };
        setDrawingRoute(newRoute);
        setStatusMessage('Drawing route... hold and drag for continuous line, double-click to finish');
      }
    }
  }, [editorMode, drawingRoute, document.routes.length, trackColor, setStatusMessage]);

  const handleMouseMove = useCallback((e: LeafletMouseEvent) => {
    if (editorMode === 'box-select' && isBoxSelecting) {
      setBoxSelectEnd({ lat: e.latlng.lat, lon: e.latlng.lng });
    } else if (editorMode === 'draw-route' && isDrawingContinuous && drawingRoute) {
      // Add points while dragging
      const lat = e.latlng.lat;
      const lng = e.latlng.lng;
      const lastPoint = lastDrawPointRef.current;

      if (lastPoint) {
        // Calculate distance from last point
        const distance = haversineDistance(lastPoint.lat, lastPoint.lon, lat, lng);

        // Only add point if it's far enough from the last one
        if (distance >= MIN_DRAW_DISTANCE) {
          const updatedRoute = {
            ...drawingRoute,
            points: [...drawingRoute.points, { id: generateId(), lat, lon: lng, enabled: true }],
          };
          setDrawingRoute(updatedRoute);
          lastDrawPointRef.current = { lat, lon: lng };
        }
      }
    }
  }, [editorMode, isBoxSelecting, isDrawingContinuous, drawingRoute, MIN_DRAW_DISTANCE]);

  const handleMouseUp = useCallback((e: LeafletMouseEvent) => {
    if (editorMode === 'box-select' && isBoxSelecting) {
      setBoxSelectEnd({ lat: e.latlng.lat, lon: e.latlng.lng });
      handleBoxSelectComplete();
    } else if (editorMode === 'draw-route' && isDrawingContinuous) {
      // End continuous drawing mode but keep route active for more points
      setIsDrawingContinuous(false);
      lastDrawPointRef.current = null;
      if (drawingRoute) {
        setStatusMessage(`Route has ${drawingRoute.points.length} points - click to add more, double-click to finish`);
      }
    }
  }, [editorMode, isBoxSelecting, handleBoxSelectComplete, isDrawingContinuous, drawingRoute, setStatusMessage]);

  return (
    <>
    <MapContainer
      center={defaultCenter}
      zoom={13}
      className="h-full w-full"
      ref={mapRef}
      zoomControl={false}
      doubleClickZoom={editorMode !== 'draw-route'}
    >
      <TileLayer url={tileLayer.url} attribution={tileLayer.attribution} />

      {/* Map event handlers */}
      <MapEventHandler
        onClick={handleMapClick}
        onDoubleClick={handleMapDoubleClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      />

      {/* Box selection handler to disable map dragging */}
      <BoxSelectMapControl isSelecting={isBoxSelecting} />

      {/* Disable map dragging during continuous drawing */}
      <DrawModeMapControl isDrawing={isDrawingContinuous} />

      {/* Zoom controls */}
      <ZoomControls bounds={bounds} />

      {/* Fit bounds on initial data load only */}
      <FitBounds bounds={bounds} shouldFit={true} />

      {/* Zoom to item selected in sidebar */}
      <ZoomToTarget />

      {/* Handle map resize when panels change */}
      <MapResizeHandler />

      {/* Render route being drawn */}
      {drawingRoute && drawingRoute.points.length > 0 && (
        <>
          <Polyline
            positions={drawingRoute.points.map((p) => [p.lat, p.lon])}
            color={drawingRoute.color}
            weight={3}
            opacity={0.8}
            dashArray="5, 5"
          />
          {/* Show markers for points being drawn */}
          {drawingRoute.points.map((pt) => (
            <Marker
              key={pt.id}
              position={[pt.lat, pt.lon]}
              icon={L.divIcon({
                className: 'drawing-point-marker',
                html: `<div style="width: 12px; height: 12px; background: ${drawingRoute.color}; border: 2px solid white; border-radius: 50%; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
                iconSize: [12, 12],
                iconAnchor: [6, 6],
              })}
            />
          ))}
        </>
      )}

      {/* Render measurement */}
      {measurePoints.length > 0 && (
        <>
          {measurePoints.length >= 2 && (
            <Polyline
              positions={measurePoints.map((p) => [p.lat, p.lon])}
              color="#FF5722"
              weight={3}
              opacity={0.8}
              dashArray="10, 5"
            />
          )}
          {/* Show markers for measurement points */}
          {measurePoints.map((pt, idx) => (
            <Marker
              key={idx}
              position={[pt.lat, pt.lon]}
              icon={L.divIcon({
                className: 'measure-point-marker',
                html: `<div style="width: 16px; height: 16px; background: #FF5722; border: 2px solid white; border-radius: 50%; box-shadow: 0 2px 4px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; color: white; font-size: 10px; font-weight: bold;">${idx + 1}</div>`,
                iconSize: [16, 16],
                iconAnchor: [8, 8],
              })}
            />
          ))}
        </>
      )}

      {/* Render tracks */}
      {document.tracks.map((track) => {
        const isHovered = hoveredItem?.type === 'track' && hoveredItem?.id === track.id;
        const isSelected = selection.some(s => s.type === 'track' && s.id === track.id);
        const isHighlighted = isSelected || isHovered;
        return track.enabled &&
        track.segments.map((segment) =>
          segment.enabled && segment.points.length > 1 ? (
            <Polyline
              key={segment.id}
              positions={segment.points.map((p) => [p.lat, p.lon])}
              color={isHighlighted ? '#FFFF00' : track.color}
              weight={isHighlighted ? 6 : 3}
              opacity={isHighlighted ? 1 : 0.8}
              eventHandlers={{
                click: (e) => {
                  L.DomEvent.stopPropagation(e);
                  useGpxStore.getState().select({ type: 'track', id: track.id });
                },
              }}
            />
          ) : null
        );
      })}

      {/* Render routes */}
      {document.routes.map((route) => {
        const isHovered = hoveredItem?.type === 'route' && hoveredItem?.id === route.id;
        const isSelected = selection.some(s => s.type === 'route' && s.id === route.id);
        const isHighlighted = isSelected || isHovered;
        return route.enabled && route.points.length > 1 ? (
          <Polyline
            key={route.id}
            positions={route.points.map((p) => [p.lat, p.lon])}
            color={isHighlighted ? '#FFFF00' : route.color}
            weight={isHighlighted ? 6 : 3}
            opacity={isHighlighted ? 1 : 0.8}
            dashArray={isHighlighted ? undefined : "10, 10"}
            eventHandlers={{
              click: (e) => {
                L.DomEvent.stopPropagation(e);
                useGpxStore.getState().select({ type: 'route', id: route.id });
              },
            }}
          />
        ) : null;
      })}

      {/* Render waypoints */}
      {document.waypoints.map((wpt) => {
        const isHovered = hoveredItem?.type === 'waypoint' && hoveredItem?.id === wpt.id;
        const isSelected = selection.some(s => s.type === 'waypoint' && s.id === wpt.id);

        // Always use a custom icon - either highlighted (selected/hovered) or normal
        // Selected and hovered both use yellow for consistency with sidebar
        const isHighlighted = isSelected || isHovered;
        // Use waypoint's custom color if available, otherwise default blue
        const waypointColor = wpt.color || '#3B82F6';
        const waypointBorderColor = wpt.color ? darkenColor(wpt.color, 0.3) : '#1D4ED8';
        const waypointIcon = L.divIcon({
          className: isSelected ? 'waypoint-selected' : isHovered ? 'waypoint-hovered' : 'waypoint-normal',
          html: `<div style="
            width: ${isHighlighted ? '28px' : '24px'};
            height: ${isHighlighted ? '28px' : '24px'};
            background: ${isHighlighted ? '#FFFF00' : waypointColor};
            border: ${isHighlighted ? '3px' : '2px'} solid ${isHighlighted ? '#F59E0B' : waypointBorderColor};
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            ${isHighlighted ? 'box-shadow: 0 0 12px 4px rgba(255, 255, 0, 0.6);' : ''}
          "></div>`,
          iconSize: [isHighlighted ? 28 : 24, isHighlighted ? 28 : 24],
          iconAnchor: [isHighlighted ? 14 : 12, isHighlighted ? 28 : 24],
        });

        return wpt.enabled ? (
          <Marker
            key={wpt.id}
            position={[wpt.lat, wpt.lon]}
            icon={waypointIcon}
            eventHandlers={{
              click: (e) => {
                L.DomEvent.stopPropagation(e);
                useGpxStore.getState().select({ type: 'waypoint', id: wpt.id });
              },
            }}
          >
            <Popup>
              <div>
                <strong>{wpt.name || 'Waypoint'}</strong>
                {wpt.desc && <p className="text-sm">{wpt.desc}</p>}
                <p className="text-xs text-gray-500">
                  {wpt.lat.toFixed(6)}, {wpt.lon.toFixed(6)}
                  {wpt.ele !== undefined && ` (${wpt.ele.toFixed(1)}m)`}
                </p>
              </div>
            </Popup>
          </Marker>
        ) : null;
      })}

      {/* Render box selection rectangle */}
      {boxSelectStart && boxSelectEnd && (
        <Rectangle
          bounds={[
            [Math.min(boxSelectStart.lat, boxSelectEnd.lat), Math.min(boxSelectStart.lon, boxSelectEnd.lon)],
            [Math.max(boxSelectStart.lat, boxSelectEnd.lat), Math.max(boxSelectStart.lon, boxSelectEnd.lon)],
          ]}
          pathOptions={{
            color: '#3B82F6',
            weight: 2,
            fillColor: '#3B82F6',
            fillOpacity: 0.2,
            dashArray: '5, 5',
          }}
        />
      )}

    </MapContainer>

    {/* Box selection menu - rendered outside MapContainer for proper event handling */}
    {showBoxMenu && (
      <BoxSelectionMenu
        x={showBoxMenu.x}
        y={showBoxMenu.y}
        count={selection.length}
        onCopy={handleBoxCopy}
        onDeleteWaypointsOnly={handleDeleteWaypointsOnly}
        onDeleteTracksOnly={handleDeleteTracksOnly}
        onDeleteAll={handleDeleteAll}
        onZoomTo={handleZoomToSelection}
        onClose={closeBoxSelection}
      />
    )}
  </>
  );
}

// Component to fit map to bounds - only on initial load or explicit trigger
function FitBounds({ bounds, shouldFit }: { bounds: BoundingBox; shouldFit: boolean }) {
  const map = useMap();
  const hasFittedRef = useRef(false);

  useEffect(() => {
    // Only fit bounds once on initial data load, or when explicitly requested
    if (bounds.valid && shouldFit && !hasFittedRef.current) {
      map.fitBounds([
        [bounds.south, bounds.west],
        [bounds.north, bounds.east],
      ], { padding: [50, 50] });
      hasFittedRef.current = true;
    }
  }, [map, bounds, shouldFit]);

  // Reset when all data is cleared
  useEffect(() => {
    if (!bounds.valid) {
      hasFittedRef.current = false;
    }
  }, [bounds.valid]);

  return null;
}

// Zoom to a specific target when triggered from sidebar
function ZoomToTarget() {
  const map = useMap();
  const zoomTarget = useUIStore((state) => state.zoomTarget);
  const setZoomTarget = useUIStore((state) => state.setZoomTarget);

  useEffect(() => {
    if (zoomTarget && map) {
      // Calculate if this is a single point (small bounds)
      const latDiff = Math.abs(zoomTarget.north - zoomTarget.south);
      const lonDiff = Math.abs(zoomTarget.east - zoomTarget.west);
      const isSinglePoint = latDiff < 0.02 && lonDiff < 0.02;

      // Use setTimeout to ensure map is ready
      setTimeout(() => {
        if (isSinglePoint) {
          // For single points (waypoints), center and zoom to a fixed level
          const centerLat = (zoomTarget.north + zoomTarget.south) / 2;
          const centerLon = (zoomTarget.east + zoomTarget.west) / 2;
          map.setView([centerLat, centerLon], 16, { animate: true });
        } else {
          // For larger areas (tracks/routes), fit bounds with padding
          map.fitBounds([
            [zoomTarget.south, zoomTarget.west],
            [zoomTarget.north, zoomTarget.east],
          ], { padding: [50, 50], maxZoom: 16, animate: true });
        }
        // Clear the target after zooming
        setZoomTarget(null);
      }, 50);
    }
  }, [map, zoomTarget, setZoomTarget]);

  return null;
}

// Handle map resize when panels collapse/expand
function MapResizeHandler() {
  const map = useMap();
  const bottomPanelCollapsed = useUIStore((state) => state.bottomPanelCollapsed);
  const bottomPanelHeight = useUIStore((state) => state.bottomPanelHeight);

  useEffect(() => {
    // Invalidate map size after a short delay to allow DOM to update
    const timer = setTimeout(() => {
      map.invalidateSize({ animate: true });
    }, 100);
    return () => clearTimeout(timer);
  }, [map, bottomPanelCollapsed, bottomPanelHeight]);

  return null;
}

// Zoom controls component
function ZoomControls({ bounds }: { bounds: BoundingBox }) {
  const map = useMap();

  const handleZoomIn = () => {
    map.zoomIn();
  };

  const handleZoomOut = () => {
    map.zoomOut();
  };

  const handleZoomToFit = () => {
    if (bounds.valid) {
      map.fitBounds([
        [bounds.south, bounds.west],
        [bounds.north, bounds.east],
      ], { padding: [50, 50] });
    }
  };

  return (
    <div className="absolute top-2 right-2 z-[1000] flex flex-col gap-1">
      <button
        onClick={handleZoomIn}
        className="w-8 h-8 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded shadow flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700"
        title="Zoom In"
      >
        +
      </button>
      <button
        onClick={handleZoomOut}
        className="w-8 h-8 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded shadow flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700"
        title="Zoom Out"
      >
        −
      </button>
      <button
        onClick={handleZoomToFit}
        className="w-8 h-8 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded shadow flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 text-xs"
        title="Zoom to Fit"
      >
        ⊡
      </button>
    </div>
  );
}

// Component to handle map events
function MapEventHandler({
  onClick,
  onDoubleClick,
  onMouseDown,
  onMouseMove,
  onMouseUp,
}: {
  onClick: (e: LeafletMouseEvent) => void;
  onDoubleClick: () => void;
  onMouseDown?: (e: LeafletMouseEvent) => void;
  onMouseMove?: (e: LeafletMouseEvent) => void;
  onMouseUp?: (e: LeafletMouseEvent) => void;
}) {
  useMapEvents({
    click: onClick,
    dblclick: onDoubleClick,
    mousedown: onMouseDown,
    mousemove: onMouseMove,
    mouseup: onMouseUp,
  });
  return null;
}

// Component to control map dragging during box selection
function BoxSelectMapControl({ isSelecting }: { isSelecting: boolean }) {
  const map = useMap();

  useEffect(() => {
    if (isSelecting) {
      map.dragging.disable();
    } else {
      map.dragging.enable();
    }
  }, [map, isSelecting]);

  return null;
}

// Disable map dragging during continuous drawing
function DrawModeMapControl({ isDrawing }: { isDrawing: boolean }) {
  const map = useMap();

  useEffect(() => {
    if (isDrawing) {
      map.dragging.disable();
    } else {
      map.dragging.enable();
    }
  }, [map, isDrawing]);

  return null;
}

// Menu component for box selection actions
function BoxSelectionMenu({
  x,
  y,
  count,
  onCopy,
  onDeleteWaypointsOnly,
  onDeleteTracksOnly,
  onDeleteAll,
  onZoomTo,
}: {
  x: number;
  y: number;
  count: number;
  onCopy: () => void;
  onDeleteWaypointsOnly: () => void;
  onDeleteTracksOnly: () => void;
  onDeleteAll: () => void;
  onZoomTo: () => void;
  onClose?: () => void;
}) {
  const handleClick = (e: React.MouseEvent, action: () => void) => {
    e.preventDefault();
    e.stopPropagation();
    action();
  };

  return (
    <div
      className="box-selection-menu fixed bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 min-w-[180px] z-[10000]"
      style={{ left: x + 10, top: y + 10 }}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="px-3 py-1.5 text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-600">
        {count} item{count !== 1 ? 's' : ''} in selection
      </div>
      <button
        className="w-full px-3 py-1.5 text-sm text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
        onClick={(e) => handleClick(e, onCopy)}
      >
        <span>📋</span> Copy
      </button>
      <button
        className="w-full px-3 py-1.5 text-sm text-left hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center gap-2"
        onClick={(e) => handleClick(e, onZoomTo)}
      >
        <span>🔍</span> Zoom to Selection
      </button>
      <div className="border-t border-gray-200 dark:border-gray-600 my-1" />
      <div className="px-3 py-1 text-xs text-gray-400 dark:text-gray-500">Delete...</div>
      <button
        className="w-full px-3 py-1.5 text-sm text-left hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 flex items-center gap-2"
        onClick={(e) => handleClick(e, onDeleteWaypointsOnly)}
      >
        <span>📍</span> Waypoints Only
      </button>
      <button
        className="w-full px-3 py-1.5 text-sm text-left hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 flex items-center gap-2"
        onClick={(e) => handleClick(e, onDeleteTracksOnly)}
      >
        <span>〰️</span> Tracks/Routes Only
      </button>
      <button
        className="w-full px-3 py-1.5 text-sm text-left hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 flex items-center gap-2"
        onClick={(e) => handleClick(e, onDeleteAll)}
      >
        <span>🗑️</span> Everything
      </button>
    </div>
  );
}
