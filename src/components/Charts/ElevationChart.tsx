import { useMemo } from 'react';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';
import type { GPXWaypoint } from '../../lib/gpx/types';
import { haversineDistance } from '../../lib/gpx/calculations';
import { useSettingsStore } from '../../stores/settingsStore';

interface ElevationChartProps {
  points: GPXWaypoint[];
}

export function ElevationChart({ points }: ElevationChartProps) {
  const { units } = useSettingsStore();

  const data = useMemo(() => {
    if (points.length < 2) return [];

    let cumulativeDistance = 0;
    const chartData = [];

    for (let i = 0; i < points.length; i++) {
      if (i > 0) {
        cumulativeDistance += haversineDistance(
          points[i - 1].lat,
          points[i - 1].lon,
          points[i].lat,
          points[i].lon
        );
      }

      const elevation = points[i].ele;
      if (elevation !== undefined) {
        chartData.push({
          distance: units === 'imperial'
            ? cumulativeDistance * 0.000621371 // miles
            : cumulativeDistance / 1000, // km
          elevation: units === 'imperial'
            ? elevation * 3.28084 // feet
            : elevation, // meters
          rawDistance: cumulativeDistance,
          rawElevation: elevation,
        });
      }
    }

    return chartData;
  }, [points, units]);

  if (data.length < 2) {
    return <div className="text-gray-500 text-sm">No elevation data available</div>;
  }

  const distanceUnit = units === 'imperial' ? 'mi' : 'km';
  const elevationUnit = units === 'imperial' ? 'ft' : 'm';

  const minElevation = Math.min(...data.map((d) => d.elevation));
  const maxElevation = Math.max(...data.map((d) => d.elevation));
  const elevationPadding = (maxElevation - minElevation) * 0.1;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="elevationGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.4} />
            <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
        <XAxis
          dataKey="distance"
          tickFormatter={(val) => val.toFixed(1)}
          label={{
            value: `Distance (${distanceUnit})`,
            position: 'insideBottom',
            offset: -5,
            className: 'text-xs fill-gray-500',
          }}
          className="text-xs"
        />
        <YAxis
          domain={[minElevation - elevationPadding, maxElevation + elevationPadding]}
          tickFormatter={(val) => Math.round(val).toString()}
          label={{
            value: `Elevation (${elevationUnit})`,
            angle: -90,
            position: 'insideLeft',
            className: 'text-xs fill-gray-500',
          }}
          className="text-xs"
        />
        <Tooltip
          formatter={(value: number) => [`${Math.round(value)} ${elevationUnit}`, 'Elevation']}
          labelFormatter={(label: number) => `Distance: ${label.toFixed(2)} ${distanceUnit}`}
          contentStyle={{
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            border: '1px solid #e5e7eb',
            borderRadius: '4px',
            fontSize: '12px',
          }}
        />
        <Area
          type="monotone"
          dataKey="elevation"
          stroke="#3B82F6"
          strokeWidth={2}
          fill="url(#elevationGradient)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
