import { useUIStore } from '../../stores/uiStore';
import { useSettingsStore } from '../../stores/settingsStore';

export function SettingsDialog() {
  const { showSettingsDialog, setShowSettingsDialog } = useUIStore();
  const {
    units,
    setUnits,
    theme,
    setTheme,
    defaultTileLayer,
    setDefaultTileLayer,
    trackColor,
    setTrackColor,
    routeColor,
    setRouteColor,
    waypointColor,
    setWaypointColor,
    autoZoomOnLoad,
    setAutoZoomOnLoad,
    confirmDelete,
    setConfirmDelete,
  } = useSettingsStore();

  if (!showSettingsDialog) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10000]">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-[500px] max-h-[90vh] flex flex-col">
        <div className="p-6 overflow-y-auto flex-1">
          <h2 className="text-lg font-semibold mb-6">Settings</h2>

          {/* Display Section */}
          <section className="mb-6">
            <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">Display</h3>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-sm">Units</label>
                <select
                  value={units}
                  onChange={(e) => setUnits(e.target.value as 'metric' | 'imperial')}
                  className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-sm"
                >
                  <option value="metric">Metric (km, m)</option>
                  <option value="imperial">Imperial (mi, ft)</option>
                </select>
              </div>

              <div className="flex items-center justify-between">
                <label className="text-sm">Theme</label>
                <select
                  value={theme}
                  onChange={(e) => setTheme(e.target.value as 'light' | 'dark')}
                  className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-sm"
                >
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </div>

              <div className="flex items-center justify-between">
                <label className="text-sm">Default Map Layer</label>
                <select
                  value={defaultTileLayer}
                  onChange={(e) => setDefaultTileLayer(e.target.value)}
                  className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-sm"
                >
                  <option value="osm">OpenStreetMap</option>
                  <option value="satellite">Satellite</option>
                  <option value="terrain">Terrain</option>
                </select>
              </div>
            </div>
          </section>

          {/* Colors Section */}
          <section className="mb-6">
            <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">Default Colors</h3>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-sm">Tracks</label>
                <input
                  type="color"
                  value={trackColor}
                  onChange={(e) => setTrackColor(e.target.value)}
                  className="w-10 h-8 rounded border border-gray-300 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between">
                <label className="text-sm">Routes</label>
                <input
                  type="color"
                  value={routeColor}
                  onChange={(e) => setRouteColor(e.target.value)}
                  className="w-10 h-8 rounded border border-gray-300 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between">
                <label className="text-sm">Waypoints</label>
                <input
                  type="color"
                  value={waypointColor}
                  onChange={(e) => setWaypointColor(e.target.value)}
                  className="w-10 h-8 rounded border border-gray-300 cursor-pointer"
                />
              </div>
            </div>
          </section>

          {/* Behavior Section */}
          <section className="mb-6">
            <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">Behavior</h3>

            <div className="space-y-4">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={autoZoomOnLoad}
                  onChange={(e) => setAutoZoomOnLoad(e.target.checked)}
                  className="w-4 h-4 rounded"
                />
                <span className="text-sm">Auto-zoom to fit data on load</span>
              </label>

              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={confirmDelete}
                  onChange={(e) => setConfirmDelete(e.target.checked)}
                  className="w-4 h-4 rounded"
                />
                <span className="text-sm">Confirm before deleting</span>
              </label>
            </div>
          </section>
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-end">
          <button
            onClick={() => setShowSettingsDialog(false)}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
