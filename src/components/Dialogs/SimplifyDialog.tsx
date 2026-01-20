import { useState } from 'react';
import { useUIStore } from '../../stores/uiStore';
import { useGpxStore } from '../../stores/gpxStore';
import { simplifyTrack } from '../../lib/gpx/operations';
import { generateId } from '../../lib/gpx/types';

export function SimplifyDialog() {
  const { showSimplifyDialog, setShowSimplifyDialog, setStatusMessage } = useUIStore();
  const { document, selection } = useGpxStore();
  const [tolerance, setTolerance] = useState(10); // meters
  const [preview, setPreview] = useState<{ original: number; simplified: number } | null>(null);

  if (!showSimplifyDialog) return null;

  // Get selected track or route
  const selectedTrack = selection.find(s => s.type === 'track');
  const selectedRoute = selection.find(s => s.type === 'route');

  const track = selectedTrack ? document.tracks.find(t => t.id === selectedTrack.id) : null;
  const route = selectedRoute ? document.routes.find(r => r.id === selectedRoute.id) : null;

  const points = track
    ? track.segments.flatMap(s => s.points)
    : route
    ? route.points
    : [];

  const handlePreview = () => {
    if (points.length < 3) return;
    const simplified = simplifyTrack(points, tolerance);
    setPreview({ original: points.length, simplified: simplified.length });
  };

  const handleApply = () => {
    if (points.length < 3) return;

    const { updateTrack, updateRoute } = useGpxStore.getState();

    if (track) {
      const simplifiedPoints = simplifyTrack(
        track.segments.flatMap(s => s.points),
        tolerance
      ).map(p => ({ ...p, id: generateId() }));

      updateTrack(track.id, {
        segments: [{
          id: generateId(),
          points: simplifiedPoints,
          enabled: true,
        }],
      });
      setStatusMessage(`Simplified track from ${points.length} to ${simplifiedPoints.length} points`);
    } else if (route) {
      const simplifiedPoints = simplifyTrack(route.points, tolerance).map(p => ({
        ...p,
        id: generateId(),
      }));

      updateRoute(route.id, { points: simplifiedPoints });
      setStatusMessage(`Simplified route from ${points.length} to ${simplifiedPoints.length} points`);
    }

    setShowSimplifyDialog(false);
    setPreview(null);
  };

  const reductionPercent = preview
    ? Math.round(((preview.original - preview.simplified) / preview.original) * 100)
    : null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10000]">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-[400px]">
        <div className="p-6">
          <h2 className="text-lg font-semibold mb-4">Simplify Track/Route</h2>

          {!track && !route ? (
            <p className="text-sm text-gray-500">Please select a track or route to simplify.</p>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  Selected: <strong>{track?.name || route?.name || 'Unnamed'}</strong>
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Original points: <strong>{points.length}</strong>
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Tolerance (meters)
                </label>
                <input
                  type="range"
                  min="1"
                  max="100"
                  value={tolerance}
                  onChange={(e) => {
                    setTolerance(Number(e.target.value));
                    setPreview(null);
                  }}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>1m (precise)</span>
                  <span className="font-medium">{tolerance}m</span>
                  <span>100m (aggressive)</span>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Higher tolerance removes more points but may affect accuracy.
                </p>
              </div>

              {preview && (
                <div className="bg-blue-50 dark:bg-blue-900/30 rounded p-3">
                  <p className="text-sm">
                    <strong>Preview:</strong> {preview.original} → {preview.simplified} points
                    <span className="ml-2 text-green-600 dark:text-green-400">
                      ({reductionPercent}% reduction)
                    </span>
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-end gap-2">
          <button
            onClick={() => {
              setShowSimplifyDialog(false);
              setPreview(null);
            }}
            className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          {(track || route) && (
            <>
              <button
                onClick={handlePreview}
                className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Preview
              </button>
              <button
                onClick={handleApply}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Apply
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
