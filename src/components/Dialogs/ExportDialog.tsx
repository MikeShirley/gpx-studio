import { useState, useMemo, useEffect } from 'react';
import { useUIStore } from '../../stores/uiStore';
import { useGpxStore } from '../../stores/gpxStore';
import { exportGPX } from '../../lib/gpx/exporter';
import { exportKML } from '../../lib/formats/kml';
import type { GPXDocument, GPXTrack, GPXRoute, GPXWaypoint } from '../../lib/gpx/types';
import { createEmptyDocument } from '../../lib/gpx/types';

type ExportMode = 'saveAs' | 'exportSelected' | 'splitToFiles';
type ExportFormat = 'gpx' | 'kml';

export function ExportDialog() {
  const { showExportDialog, setShowExportDialog, setStatusMessage } = useUIStore();
  const { document, selection } = useGpxStore();

  const [mode, setMode] = useState<ExportMode>('saveAs');
  const [format, setFormat] = useState<ExportFormat>('gpx');
  const [filename, setFilename] = useState('');
  const [includeWaypoints, setIncludeWaypoints] = useState(true);

  // Get current filename without extension
  const baseFilename = useMemo(() => {
    const name = document.filename || 'untitled';
    return name.replace(/\.(gpx|kml|xml)$/i, '');
  }, [document.filename]);

  // Initialize filename when dialog opens
  useEffect(() => {
    if (showExportDialog) {
      setFilename(baseFilename);
    }
  }, [showExportDialog, baseFilename]);

  // Get selected items info
  const selectedInfo = useMemo(() => {
    const tracks: GPXTrack[] = [];
    const routes: GPXRoute[] = [];
    const waypoints: GPXWaypoint[] = [];

    for (const sel of selection) {
      if (sel.type === 'track') {
        const track = document.tracks.find(t => t.id === sel.id);
        if (track) tracks.push(track);
      } else if (sel.type === 'route') {
        const route = document.routes.find(r => r.id === sel.id);
        if (route) routes.push(route);
      } else if (sel.type === 'waypoint') {
        const wp = document.waypoints.find(w => w.id === sel.id);
        if (wp) waypoints.push(wp);
      }
    }

    return { tracks, routes, waypoints };
  }, [document, selection]);

  // Get all items for split
  const allItems = useMemo(() => {
    return {
      tracks: document.tracks,
      routes: document.routes,
      waypoints: document.waypoints,
    };
  }, [document]);

  if (!showExportDialog) return null;

  const extension = format === 'gpx' ? '.gpx' : '.kml';

  const downloadFile = (content: string, name: string) => {
    const mimeType = format === 'gpx' ? 'application/gpx+xml' : 'application/vnd.google-earth.kml+xml';
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const createDocumentWithItems = (
    tracks: GPXTrack[],
    routes: GPXRoute[],
    waypoints: GPXWaypoint[]
  ): GPXDocument => {
    return {
      ...createEmptyDocument(),
      metadata: { ...document.metadata },
      tracks,
      routes,
      waypoints,
    };
  };

  const exportDocument = (doc: GPXDocument): string => {
    return format === 'gpx' ? exportGPX(doc) : exportKML(doc);
  };

  const handleSaveAs = () => {
    const name = filename.trim() || baseFilename;
    const content = exportDocument(document);
    downloadFile(content, name + extension);
    setStatusMessage(`Saved as ${name}${extension}`);
    setShowExportDialog(false);
  };

  const handleExportSelected = () => {
    if (selectedInfo.tracks.length === 0 && selectedInfo.routes.length === 0 && selectedInfo.waypoints.length === 0) {
      setStatusMessage('No items selected to export');
      return;
    }

    const name = filename.trim() || `${baseFilename}_selection`;
    const doc = createDocumentWithItems(
      selectedInfo.tracks,
      selectedInfo.routes,
      includeWaypoints ? selectedInfo.waypoints : []
    );
    const content = exportDocument(doc);
    downloadFile(content, name + extension);

    const parts: string[] = [];
    if (selectedInfo.tracks.length > 0) parts.push(`${selectedInfo.tracks.length} track(s)`);
    if (selectedInfo.routes.length > 0) parts.push(`${selectedInfo.routes.length} route(s)`);
    if (selectedInfo.waypoints.length > 0 && includeWaypoints) parts.push(`${selectedInfo.waypoints.length} waypoint(s)`);
    setStatusMessage(`Exported ${parts.join(', ')} to ${name}${extension}`);
    setShowExportDialog(false);
  };

  const handleSplitToFiles = () => {
    let fileCount = 0;

    // Export each track as a separate file
    for (const track of allItems.tracks) {
      const trackName = track.name || `Track_${fileCount + 1}`;
      const safeName = trackName.replace(/[^a-zA-Z0-9_-]/g, '_');
      const doc = createDocumentWithItems(
        [track],
        [],
        includeWaypoints ? allItems.waypoints : []
      );
      const content = exportDocument(doc);
      downloadFile(content, safeName + extension);
      fileCount++;
    }

    // Export each route as a separate file
    for (const route of allItems.routes) {
      const routeName = route.name || `Route_${fileCount + 1}`;
      const safeName = routeName.replace(/[^a-zA-Z0-9_-]/g, '_');
      const doc = createDocumentWithItems(
        [],
        [route],
        includeWaypoints ? allItems.waypoints : []
      );
      const content = exportDocument(doc);
      downloadFile(content, safeName + extension);
      fileCount++;
    }

    // If only waypoints exist, export them
    if (allItems.tracks.length === 0 && allItems.routes.length === 0 && allItems.waypoints.length > 0) {
      const doc = createDocumentWithItems([], [], allItems.waypoints);
      const content = exportDocument(doc);
      downloadFile(content, 'waypoints' + extension);
      fileCount++;
    }

    setStatusMessage(`Exported ${fileCount} file(s)`);
    setShowExportDialog(false);
  };

  const handleExport = () => {
    switch (mode) {
      case 'saveAs':
        handleSaveAs();
        break;
      case 'exportSelected':
        handleExportSelected();
        break;
      case 'splitToFiles':
        handleSplitToFiles();
        break;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleExport();
    } else if (e.key === 'Escape') {
      setShowExportDialog(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10000]">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-[450px]">
        <div className="p-6">
          <h2 className="text-lg font-semibold mb-4">Export Options</h2>

          {/* Export Mode Selection */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Export Mode</label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="mode"
                  checked={mode === 'saveAs'}
                  onChange={() => setMode('saveAs')}
                  className="text-blue-600"
                />
                <span className="text-sm">Save As (entire document with new filename)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="mode"
                  checked={mode === 'exportSelected'}
                  onChange={() => setMode('exportSelected')}
                  className="text-blue-600"
                  disabled={selection.length === 0}
                />
                <span className={`text-sm ${selection.length === 0 ? 'text-gray-400' : ''}`}>
                  Export Selected ({selection.length} item{selection.length !== 1 ? 's' : ''})
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="mode"
                  checked={mode === 'splitToFiles'}
                  onChange={() => setMode('splitToFiles')}
                  className="text-blue-600"
                />
                <span className="text-sm">
                  Split to Files ({allItems.tracks.length + allItems.routes.length} track/route files)
                </span>
              </label>
            </div>
          </div>

          {/* Format Selection */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Format</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="format"
                  checked={format === 'gpx'}
                  onChange={() => setFormat('gpx')}
                  className="text-blue-600"
                />
                <span className="text-sm">GPX</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="format"
                  checked={format === 'kml'}
                  onChange={() => setFormat('kml')}
                  className="text-blue-600"
                />
                <span className="text-sm">KML</span>
              </label>
            </div>
          </div>

          {/* Filename (for Save As and Export Selected) */}
          {mode !== 'splitToFiles' && (
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Filename</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={filename}
                  onChange={(e) => setFilename(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={baseFilename}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  autoFocus
                />
                <span className="text-sm text-gray-500">{extension}</span>
              </div>
            </div>
          )}

          {/* Include Waypoints Option (for Export Selected and Split) */}
          {(mode === 'exportSelected' || mode === 'splitToFiles') && (
            <div className="mb-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeWaypoints}
                  onChange={(e) => setIncludeWaypoints(e.target.checked)}
                  className="text-blue-600 rounded"
                />
                <span className="text-sm">Include waypoints in export</span>
              </label>
            </div>
          )}

          {/* Preview Info */}
          <div className="bg-gray-50 dark:bg-gray-900 rounded-md p-3 text-xs text-gray-600 dark:text-gray-400">
            {mode === 'saveAs' && (
              <p>Will save entire document: {document.tracks.length} tracks, {document.routes.length} routes, {document.waypoints.length} waypoints</p>
            )}
            {mode === 'exportSelected' && (
              <p>Will export: {selectedInfo.tracks.length} tracks, {selectedInfo.routes.length} routes, {includeWaypoints ? selectedInfo.waypoints.length : 0} waypoints</p>
            )}
            {mode === 'splitToFiles' && (
              <p>Will create {allItems.tracks.length + allItems.routes.length} separate files (one per track/route)</p>
            )}
          </div>
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-end gap-2">
          <button
            onClick={() => setShowExportDialog(false)}
            className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Export
          </button>
        </div>
      </div>
    </div>
  );
}
