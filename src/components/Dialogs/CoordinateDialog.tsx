import { useState } from 'react';
import { useUIStore } from '../../stores/uiStore';
import { useGpxStore } from '../../stores/gpxStore';
import { generateId } from '../../lib/gpx/types';

export function CoordinateDialog() {
  const { showCoordinateDialog, setShowCoordinateDialog } = useUIStore();
  const { addWaypoint } = useGpxStore();

  const [lat, setLat] = useState('');
  const [lon, setLon] = useState('');
  const [ele, setEle] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  if (!showCoordinateDialog) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lon);
    const elevation = ele ? parseFloat(ele) : undefined;

    if (isNaN(latitude) || latitude < -90 || latitude > 90) {
      setError('Latitude must be between -90 and 90');
      return;
    }

    if (isNaN(longitude) || longitude < -180 || longitude > 180) {
      setError('Longitude must be between -180 and 180');
      return;
    }

    if (ele && isNaN(elevation!)) {
      setError('Elevation must be a number');
      return;
    }

    addWaypoint({
      id: generateId(),
      lat: latitude,
      lon: longitude,
      ele: elevation,
      name: name || `Waypoint`,
      enabled: true,
    });

    // Reset and close
    setLat('');
    setLon('');
    setEle('');
    setName('');
    setShowCoordinateDialog(false);
  };

  const handleClose = () => {
    setLat('');
    setLon('');
    setEle('');
    setName('');
    setError('');
    setShowCoordinateDialog(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10000]">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-96 p-6">
        <h2 className="text-lg font-semibold mb-4">Add Waypoint</h2>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Waypoint name (optional)"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Latitude *</label>
                <input
                  type="text"
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                  placeholder="e.g. 37.7749"
                  required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Longitude *</label>
                <input
                  type="text"
                  value={lon}
                  onChange={(e) => setLon(e.target.value)}
                  placeholder="e.g. -122.4194"
                  required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Elevation (m)</label>
              <input
                type="text"
                value={ele}
                onChange={(e) => setEle(e.target.value)}
                placeholder="e.g. 100 (optional)"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"
              />
            </div>

            {error && (
              <div className="text-red-500 text-sm">{error}</div>
            )}
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Add Waypoint
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
