import { useState, useEffect } from 'react';
import { useUIStore } from '../../stores/uiStore';
import { useGpxStore } from '../../stores/gpxStore';

export function RenameDialog() {
  const { showRenameDialog, setShowRenameDialog, setStatusMessage } = useUIStore();
  const { document, selection, updateTrack, updateRoute, updateWaypoint } = useGpxStore();
  const [name, setName] = useState('');

  // Get the selected item's current name
  useEffect(() => {
    if (!showRenameDialog || selection.length !== 1) return;

    const sel = selection[0];
    if (sel.type === 'track') {
      const track = document.tracks.find(t => t.id === sel.id);
      setName(track?.name || '');
    } else if (sel.type === 'route') {
      const route = document.routes.find(r => r.id === sel.id);
      setName(route?.name || '');
    } else if (sel.type === 'waypoint') {
      const waypoint = document.waypoints.find(w => w.id === sel.id);
      setName(waypoint?.name || '');
    }
  }, [showRenameDialog, selection, document]);

  if (!showRenameDialog) return null;

  const selectedItem = selection[0];
  if (!selectedItem) return null;

  const itemType = selectedItem.type;
  const itemTypeLabel = itemType.charAt(0).toUpperCase() + itemType.slice(1);

  const handleSave = () => {
    if (selectedItem.type === 'track') {
      updateTrack(selectedItem.id, { name });
      setStatusMessage(`Renamed track to "${name}"`);
    } else if (selectedItem.type === 'route') {
      updateRoute(selectedItem.id, { name });
      setStatusMessage(`Renamed route to "${name}"`);
    } else if (selectedItem.type === 'waypoint') {
      updateWaypoint(selectedItem.id, { name });
      setStatusMessage(`Renamed waypoint to "${name}"`);
    }
    setShowRenameDialog(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setShowRenameDialog(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10000]">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-[350px]">
        <div className="p-6">
          <h2 className="text-lg font-semibold mb-4">Rename {itemTypeLabel}</h2>

          <div>
            <label className="block text-sm font-medium mb-2">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              autoFocus
            />
          </div>
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-end gap-2">
          <button
            onClick={() => setShowRenameDialog(false)}
            className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
