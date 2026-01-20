import { useMemo } from 'react';
import { useUIStore } from '../../stores/uiStore';
import { useGpxStore } from '../../stores/gpxStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { calculateStatistics } from '../../lib/gpx/calculations';
import type { GPXWaypoint } from '../../lib/gpx/types';
import { ElevationChart } from '../Charts/ElevationChart';

export function BottomPanel() {
  const { bottomPanelHeight, bottomPanelTab, setBottomPanelTab, bottomPanelCollapsed, toggleBottomPanel } = useUIStore();

  if (bottomPanelCollapsed) {
    return (
      <div
        className="h-8 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex items-center px-4 cursor-pointer"
        onClick={toggleBottomPanel}
      >
        <span className="text-xs text-gray-500">Click to expand panel</span>
      </div>
    );
  }

  return (
    <div
      className="bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex flex-col"
      style={{ height: bottomPanelHeight }}
    >
      {/* Tab bar */}
      <div className="h-8 border-b border-gray-200 dark:border-gray-700 flex items-center px-2 gap-1">
        <TabButton
          label="Statistics"
          active={bottomPanelTab === 'statistics'}
          onClick={() => setBottomPanelTab('statistics')}
        />
        <TabButton
          label="Elevation"
          active={bottomPanelTab === 'chart'}
          onClick={() => setBottomPanelTab('chart')}
        />
        <TabButton
          label="Points"
          active={bottomPanelTab === 'points'}
          onClick={() => setBottomPanelTab('points')}
        />

        <div className="flex-1" />

        <button
          className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 px-2"
          onClick={toggleBottomPanel}
        >
          ▼ Collapse
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {bottomPanelTab === 'statistics' && <StatisticsPanel />}
        {bottomPanelTab === 'chart' && <ChartPanel />}
        {bottomPanelTab === 'points' && <PointsPanel />}
      </div>
    </div>
  );
}

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      className={`
        px-3 py-1 text-xs rounded
        ${active
          ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
          : 'hover:bg-gray-200 dark:hover:bg-gray-700'
        }
      `}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function StatisticsPanel() {
  const { document, selection } = useGpxStore();
  const { units } = useSettingsStore();

  // Get points from selection or all enabled tracks
  const points = useMemo((): GPXWaypoint[] => {
    if (selection.length === 1) {
      const sel = selection[0];
      if (sel.type === 'track') {
        const track = document.tracks.find(t => t.id === sel.id);
        if (track) {
          return track.segments.flatMap(seg => seg.points);
        }
      }
      if (sel.type === 'route') {
        const route = document.routes.find(r => r.id === sel.id);
        if (route) return route.points;
      }
      if (sel.type === 'segment') {
        const track = document.tracks.find(t => t.id === sel.trackId);
        const segment = track?.segments.find(s => s.id === sel.segmentId);
        if (segment) return segment.points;
      }
    }

    // Default: all enabled tracks
    return document.tracks
      .filter(t => t.enabled)
      .flatMap(t => t.segments.filter(s => s.enabled).flatMap(s => s.points));
  }, [document, selection]);

  const stats = useMemo(() => calculateStatistics(points), [points]);

  const formatDistance = (meters: number) => {
    if (units === 'imperial') {
      const miles = meters * 0.000621371;
      return miles < 0.1 ? `${Math.round(meters * 3.28084)} ft` : `${miles.toFixed(2)} mi`;
    }
    const km = meters / 1000;
    return km < 1 ? `${Math.round(meters)} m` : `${km.toFixed(2)} km`;
  };

  const formatSpeed = (mps: number) => {
    if (units === 'imperial') {
      return `${(mps * 2.23694).toFixed(1)} mph`;
    }
    return `${(mps * 3.6).toFixed(1)} km/h`;
  };

  const formatElevation = (meters: number) => {
    if (units === 'imperial') {
      return `${Math.round(meters * 3.28084)} ft`;
    }
    return `${Math.round(meters)} m`;
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  if (points.length === 0) {
    return <div className="text-gray-500 text-sm">No data to display</div>;
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
      {/* Distance */}
      <StatGroup title="Distance">
        <StatItem label="Total" value={formatDistance(stats.distance)} />
        <StatItem label="Climb" value={formatDistance(stats.climbDistance)} />
        <StatItem label="Descent" value={formatDistance(stats.descentDistance)} />
      </StatGroup>

      {/* Time */}
      <StatGroup title="Time">
        <StatItem label="Total" value={formatDuration(stats.totalTime)} />
        <StatItem label="Moving" value={formatDuration(stats.movingTime)} />
        <StatItem label="Rest" value={formatDuration(stats.restTime)} />
      </StatGroup>

      {/* Speed */}
      <StatGroup title="Speed">
        <StatItem label="Average" value={formatSpeed(stats.avgSpeed)} />
        <StatItem label="Moving Avg" value={formatSpeed(stats.movingSpeed)} />
        <StatItem label="Maximum" value={formatSpeed(stats.maxSpeed)} />
      </StatGroup>

      {/* Elevation */}
      <StatGroup title="Elevation">
        <StatItem label="Total Climb" value={formatElevation(stats.totalClimb)} />
        <StatItem label="Total Descent" value={formatElevation(stats.totalDescent)} />
        <StatItem label="Min" value={formatElevation(stats.minElevation)} />
        <StatItem label="Max" value={formatElevation(stats.maxElevation)} />
      </StatGroup>
    </div>
  );
}

function StatGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="font-semibold text-gray-700 dark:text-gray-300 mb-2">{title}</div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-500 dark:text-gray-400">{label}:</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function ChartPanel() {
  const { document, selection } = useGpxStore();

  // Get points from selection or first enabled track
  const points = useMemo((): GPXWaypoint[] => {
    if (selection.length === 1) {
      const sel = selection[0];
      if (sel.type === 'track') {
        const track = document.tracks.find(t => t.id === sel.id);
        if (track) {
          return track.segments.flatMap(seg => seg.points);
        }
      }
      if (sel.type === 'route') {
        const route = document.routes.find(r => r.id === sel.id);
        if (route) return route.points;
      }
    }

    // Default: first enabled track
    const firstTrack = document.tracks.find(t => t.enabled);
    if (firstTrack) {
      return firstTrack.segments.filter(s => s.enabled).flatMap(s => s.points);
    }

    return [];
  }, [document, selection]);

  if (points.length < 2) {
    return <div className="text-gray-500 text-sm">Select a track to view elevation profile</div>;
  }

  return <ElevationChart points={points} />;
}

function PointsPanel() {
  const { document, selection, deleteTrackPoint, updateRoute } = useGpxStore();
  const { setStatusMessage } = useUIStore();

  // Get points and their context from selection
  const pointsContext = useMemo(() => {
    if (selection.length === 1) {
      const sel = selection[0];
      if (sel.type === 'track') {
        const track = document.tracks.find(t => t.id === sel.id);
        if (track) {
          const points: { point: GPXWaypoint; trackId: string; segmentId: string; indexInSegment: number }[] = [];
          track.segments.forEach(seg => {
            seg.points.forEach((pt, idx) => {
              points.push({ point: pt, trackId: track.id, segmentId: seg.id, indexInSegment: idx });
            });
          });
          return { type: 'track' as const, points };
        }
      }
      if (sel.type === 'route') {
        const route = document.routes.find(r => r.id === sel.id);
        if (route) {
          return {
            type: 'route' as const,
            routeId: route.id,
            points: route.points.map((pt, idx) => ({ point: pt, index: idx })),
          };
        }
      }
      if (sel.type === 'segment') {
        const track = document.tracks.find(t => t.id === sel.trackId);
        const segment = track?.segments.find(s => s.id === sel.segmentId);
        if (segment && track) {
          return {
            type: 'segment' as const,
            trackId: track.id,
            segmentId: segment.id,
            points: segment.points.map((pt, idx) => ({ point: pt, indexInSegment: idx })),
          };
        }
      }
    }
    return null;
  }, [document, selection]);

  const handleDeletePoint = (index: number) => {
    if (!pointsContext) return;

    if (pointsContext.type === 'track') {
      const item = pointsContext.points[index];
      deleteTrackPoint(item.trackId, item.segmentId, item.indexInSegment);
      setStatusMessage('Point deleted');
    } else if (pointsContext.type === 'route') {
      const route = document.routes.find(r => r.id === pointsContext.routeId);
      if (route) {
        const newPoints = [...route.points];
        newPoints.splice(index, 1);
        updateRoute(pointsContext.routeId, { points: newPoints });
        setStatusMessage('Point deleted');
      }
    } else if (pointsContext.type === 'segment') {
      const item = pointsContext.points[index];
      deleteTrackPoint(pointsContext.trackId, pointsContext.segmentId, item.indexInSegment);
      setStatusMessage('Point deleted');
    }
  };

  if (!pointsContext || pointsContext.points.length === 0) {
    return <div className="text-gray-500 text-sm">Select a track, route, or segment to view points</div>;
  }

  return (
    <div className="overflow-auto max-h-full">
      <table className="w-full text-xs">
        <thead className="bg-gray-100 dark:bg-gray-700 sticky top-0">
          <tr>
            <th className="px-2 py-1 text-left">#</th>
            <th className="px-2 py-1 text-left">Latitude</th>
            <th className="px-2 py-1 text-left">Longitude</th>
            <th className="px-2 py-1 text-left">Elevation</th>
            <th className="px-2 py-1 text-left">Time</th>
            <th className="px-2 py-1 text-left">Name</th>
            <th className="px-2 py-1 text-center w-8"></th>
          </tr>
        </thead>
        <tbody>
          {pointsContext.points.slice(0, 100).map((item, i) => {
            const pt = 'point' in item ? item.point : (item as { point: GPXWaypoint }).point;
            return (
              <tr key={pt.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 group">
                <td className="px-2 py-1 text-gray-500">{i + 1}</td>
                <td className="px-2 py-1">{pt.lat.toFixed(6)}</td>
                <td className="px-2 py-1">{pt.lon.toFixed(6)}</td>
                <td className="px-2 py-1">{pt.ele?.toFixed(1) ?? '-'}</td>
                <td className="px-2 py-1">{pt.time ? new Date(pt.time).toLocaleTimeString() : '-'}</td>
                <td className="px-2 py-1">{pt.name || '-'}</td>
                <td className="px-2 py-1 text-center">
                  <button
                    className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 transition-opacity"
                    onClick={() => handleDeletePoint(i)}
                    title="Delete point"
                  >
                    ×
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {pointsContext.points.length > 100 && (
        <div className="text-xs text-gray-500 p-2">
          Showing first 100 of {pointsContext.points.length} points
        </div>
      )}
    </div>
  );
}
