import { useState, useMemo } from 'react';
import { useUIStore } from '../../stores/uiStore';
import { useGpxStore } from '../../stores/gpxStore';
import { splitTrack } from '../../lib/gpx/operations';
import { haversineDistance } from '../../lib/gpx/calculations';

export function SplitTrackDialog() {
  const { showSplitTrackDialog, setShowSplitTrackDialog, setStatusMessage } = useUIStore();
  const { document, selection } = useGpxStore();
  const [selectedSegmentIndex, setSelectedSegmentIndex] = useState(0);
  const [splitPointIndex, setSplitPointIndex] = useState(1);

  if (!showSplitTrackDialog) return null;

  // Get selected track
  const selectedTrack = selection.find(s => s.type === 'track');
  const track = selectedTrack ? document.tracks.find(t => t.id === selectedTrack.id) : null;

  if (!track) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10000]">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-[400px] p-6">
          <h2 className="text-lg font-semibold mb-4">Split Track</h2>
          <p className="text-sm text-gray-500">Please select a track to split.</p>
          <div className="mt-6 flex justify-end">
            <button
              onClick={() => setShowSplitTrackDialog(false)}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  const segment = track.segments[selectedSegmentIndex];
  const points = segment?.points || [];
  const maxIndex = points.length - 2; // Can't split at first or last point

  // Calculate cumulative distance for display
  const cumulativeDistances = useMemo(() => {
    const distances: number[] = [0];
    let total = 0;
    for (let i = 1; i < points.length; i++) {
      total += haversineDistance(
        points[i - 1].lat,
        points[i - 1].lon,
        points[i].lat,
        points[i].lon
      );
      distances.push(total);
    }
    return distances;
  }, [points]);

  const totalDistance = cumulativeDistances[cumulativeDistances.length - 1] || 0;
  const splitDistance = cumulativeDistances[splitPointIndex] || 0;

  const formatDistance = (meters: number) => {
    if (meters < 1000) return `${meters.toFixed(0)}m`;
    return `${(meters / 1000).toFixed(2)}km`;
  };

  const handleSplit = () => {
    if (!track || !segment) return;

    try {
      const [firstTrack, secondTrack] = splitTrack(track, segment.id, splitPointIndex);

      // Remove original track and add the two new ones
      const { deleteTrack, addTrack } = useGpxStore.getState();
      deleteTrack(track.id);
      addTrack(firstTrack);
      addTrack(secondTrack);

      setStatusMessage(`Split "${track.name}" into two tracks at point ${splitPointIndex + 1}`);
      setShowSplitTrackDialog(false);
    } catch (error) {
      setStatusMessage(`Error splitting track: ${error}`);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10000]">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-[450px]">
        <div className="p-6">
          <h2 className="text-lg font-semibold mb-4">Split Track</h2>

          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                Track: <strong>{track.name || 'Unnamed'}</strong>
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Total points: <strong>{points.length}</strong> |
                Distance: <strong>{formatDistance(totalDistance)}</strong>
              </p>
            </div>

            {track.segments.length > 1 && (
              <div>
                <label className="block text-sm font-medium mb-2">
                  Select Segment
                </label>
                <select
                  value={selectedSegmentIndex}
                  onChange={(e) => {
                    setSelectedSegmentIndex(Number(e.target.value));
                    setSplitPointIndex(1);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"
                >
                  {track.segments.map((seg, i) => (
                    <option key={seg.id} value={i}>
                      Segment {i + 1} ({seg.points.length} points)
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-2">
                Split Point: <strong>{splitPointIndex + 1}</strong> of {points.length}
              </label>
              <input
                type="range"
                min="1"
                max={maxIndex > 0 ? maxIndex : 1}
                value={splitPointIndex}
                onChange={(e) => setSplitPointIndex(Number(e.target.value))}
                className="w-full"
                disabled={maxIndex < 1}
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>Start</span>
                <span>{formatDistance(splitDistance)} / {formatDistance(totalDistance)}</span>
                <span>End</span>
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-gray-700/50 rounded p-3 text-sm">
              <p className="font-medium mb-2">Result:</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-gray-600 dark:text-gray-400">Track 1:</p>
                  <p>{splitPointIndex + 1} points</p>
                  <p className="text-xs text-gray-500">{formatDistance(splitDistance)}</p>
                </div>
                <div>
                  <p className="text-gray-600 dark:text-gray-400">Track 2:</p>
                  <p>{points.length - splitPointIndex} points</p>
                  <p className="text-xs text-gray-500">{formatDistance(totalDistance - splitDistance)}</p>
                </div>
              </div>
            </div>

            {points.length < 3 && (
              <p className="text-amber-600 dark:text-amber-400 text-sm">
                Track must have at least 3 points to split.
              </p>
            )}
          </div>
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-end gap-2">
          <button
            onClick={() => setShowSplitTrackDialog(false)}
            className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={handleSplit}
            disabled={points.length < 3}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Split Track
          </button>
        </div>
      </div>
    </div>
  );
}
