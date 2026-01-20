import { useEffect, useCallback } from 'react';
import { Toolbar } from './components/Toolbar/MainToolbar';
import { Sidebar } from './components/Sidebar/Sidebar';
import { MapView } from './components/Map/MapView';
import { BottomPanel } from './components/Panels/BottomPanel';
import { CoordinateDialog } from './components/Dialogs/CoordinateDialog';
import { SettingsDialog } from './components/Dialogs/SettingsDialog';
import { SimplifyDialog } from './components/Dialogs/SimplifyDialog';
import { RenameDialog } from './components/Dialogs/RenameDialog';
import { SplitTrackDialog } from './components/Dialogs/SplitTrackDialog';
import { ExportDialog } from './components/Dialogs/ExportDialog';
import { useSettingsStore } from './stores/settingsStore';
import { useGpxStore } from './stores/gpxStore';
import { useUIStore } from './stores/uiStore';
import { parseKML } from './lib/formats/kml';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';

function App() {
  const { theme } = useSettingsStore();
  const { setStatusMessage } = useUIStore();

  // Enable keyboard shortcuts
  useKeyboardShortcuts();

  useEffect(() => {
    // Apply dark mode class to document
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Load sample GPX file on startup
  useEffect(() => {
    const loadSampleFile = async () => {
      try {
        const response = await fetch('/sample.gpx');
        if (!response.ok) return;
        const text = await response.text();
        const { parseGPX } = await import('./lib/gpx/parser');
        const doc = parseGPX(text);
        useGpxStore.setState({
          document: { ...doc, filename: '25 N Moto D5 FINAL.gpx', modified: false },
          selection: [],
        });
        setStatusMessage(`Loaded sample: ${doc.waypoints.length} waypoints, ${doc.tracks.length} tracks, ${doc.routes.length} routes`);
      } catch (error) {
        console.error('Failed to load sample file:', error);
      }
    };
    loadSampleFile();
  }, [setStatusMessage]);

  // Drag and drop file handling
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const files = Array.from(e.dataTransfer.files).filter(f =>
      f.name.endsWith('.gpx') || f.name.endsWith('.kml') || f.name.endsWith('.xml')
    );

    if (files.length === 0) return;

    const currentDoc = useGpxStore.getState().document;
    const hasExistingData = currentDoc.tracks.length > 0 || currentDoc.routes.length > 0 || currentDoc.waypoints.length > 0;

    let totalTracks = 0;
    let totalRoutes = 0;
    let totalWaypoints = 0;
    let loadedFiles = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const text = await file.text();
        let doc;

        if (file.name.endsWith('.kml')) {
          doc = parseKML(text);
        } else {
          const { parseGPX } = await import('./lib/gpx/parser');
          doc = parseGPX(text);
        }

        if (i === 0 && !hasExistingData) {
          // First file with no existing data - load as primary
          useGpxStore.setState({
            document: { ...doc, filename: file.name, modified: false },
            selection: [],
          });
          totalTracks += doc.tracks.length;
          totalRoutes += doc.routes.length;
          totalWaypoints += doc.waypoints.length;
        } else {
          // Merge subsequent files
          const result = useGpxStore.getState().mergeDocument(doc, file.name);
          totalTracks += result.tracks;
          totalRoutes += result.routes;
          totalWaypoints += result.waypoints;
        }
        loadedFiles++;
      } catch (error) {
        console.error(`Failed to load ${file.name}:`, error);
        setStatusMessage(`Failed to load ${file.name}: ${error}`);
      }
    }

    if (loadedFiles > 0) {
      const parts: string[] = [];
      if (totalTracks > 0) parts.push(`${totalTracks} track${totalTracks !== 1 ? 's' : ''}`);
      if (totalRoutes > 0) parts.push(`${totalRoutes} route${totalRoutes !== 1 ? 's' : ''}`);
      if (totalWaypoints > 0) parts.push(`${totalWaypoints} waypoint${totalWaypoints !== 1 ? 's' : ''}`);

      const filesText = loadedFiles === 1 ? files[0].name : `${loadedFiles} files`;
      setStatusMessage(`Loaded ${filesText}: ${parts.join(', ')}`);
    }
  }, [setStatusMessage]);

  const { statusMessage } = useUIStore();

  return (
    <div
      className="h-screen flex flex-col bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Top Toolbar */}
      <Toolbar />

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Tree View */}
        <Sidebar />

        {/* Splitter */}
        <div className="w-1 bg-gray-200 dark:bg-gray-700 cursor-col-resize hover:bg-blue-500" />

        {/* Right Panel - Map and Bottom Panel */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Map View */}
          <div className="flex-1 relative">
            <MapView />
          </div>

          {/* Horizontal Splitter */}
          <div className="h-1 bg-gray-200 dark:bg-gray-700 cursor-row-resize hover:bg-blue-500" />

          {/* Bottom Panel - Statistics/Chart/Points */}
          <BottomPanel />
        </div>
      </div>

      {/* Status Bar */}
      <div className="h-6 bg-gray-100 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-4 flex items-center text-xs text-gray-600 dark:text-gray-400">
        <span>{statusMessage}</span>
        <span className="ml-auto">GPX Studio v0.1.0</span>
      </div>

      {/* Dialogs */}
      <CoordinateDialog />
      <SettingsDialog />
      <SimplifyDialog />
      <RenameDialog />
      <SplitTrackDialog />
      <ExportDialog />
    </div>
  );
}

export default App;
