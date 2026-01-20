import { useRef, useState } from 'react';
import { useGpxStore } from '../../stores/gpxStore';
import { useUIStore } from '../../stores/uiStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { exportGPX } from '../../lib/gpx/exporter';
import { parseKML, exportKML } from '../../lib/formats/kml';
import { getNextTrackColor } from '../../lib/gpx/types';

export function Toolbar() {
  const { document, clear, selection, deleteTrack, deleteRoute, deleteWaypoint, undo, redo, canUndo, canRedo, cutSelected, copySelected, paste, hasClipboard } = useGpxStore();
  const { editorMode, setEditorMode, setShowSettingsDialog, setShowCoordinateDialog, setShowExportDialog, setStatusMessage } = useUIStore();
  const { confirmDelete, recentFiles, addRecentFile, clearRecentFiles } = useSettingsStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showRecentFiles, setShowRecentFiles] = useState(false);

  const handleNew = () => {
    if (document.modified) {
      if (!confirm('You have unsaved changes. Create new file anyway?')) {
        return;
      }
    }
    clear();
  };

  const handleOpen = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    const currentDoc = useGpxStore.getState().document;
    const hasExistingData = currentDoc.tracks.length > 0 || currentDoc.routes.length > 0 || currentDoc.waypoints.length > 0;

    let totalTracks = 0;
    let totalRoutes = 0;
    let totalWaypoints = 0;
    let loadedFiles = 0;

    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      try {
        const text = await file.text();
        let doc;

        if (file.name.endsWith('.kml')) {
          doc = parseKML(text);
        } else {
          const { parseGPX } = await import('../../lib/gpx/parser');
          doc = parseGPX(text);
        }

        if (i === 0 && !hasExistingData) {
          // First file with no existing data - load as primary
          // Assign a consistent color to waypoints from this file
          const fileColor = doc.tracks[0]?.color || doc.routes[0]?.color || getNextTrackColor();
          const coloredWaypoints = doc.waypoints.map(wpt => ({
            ...wpt,
            color: wpt.color || fileColor,
          }));
          useGpxStore.setState({
            document: { ...doc, waypoints: coloredWaypoints, filename: file.name, modified: false },
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
        addRecentFile(file.name);
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

      const filesText = loadedFiles === 1 ? fileArray[0].name : `${loadedFiles} files`;
      setStatusMessage(`Loaded ${filesText}: ${parts.join(', ')}`);
    }

    // Reset input so same file can be selected again
    e.target.value = '';
  };

  const handleSave = () => {
    const isKml = document.filename?.endsWith('.kml');
    const content = isKml ? exportKML(document) : exportGPX(document);
    const mimeType = isKml ? 'application/vnd.google-earth.kml+xml' : 'application/gpx+xml';
    const extension = isKml ? '.kml' : '.gpx';

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement('a');
    a.href = url;

    let filename = document.filename || 'untitled.gpx';
    if (!filename.endsWith('.gpx') && !filename.endsWith('.kml')) {
      filename += extension;
    }
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    setStatusMessage(`Saved ${filename}`);
  };

  const handleDelete = () => {
    if (selection.length === 0) return;

    if (confirmDelete && !confirm(`Delete ${selection.length} selected item(s)?`)) {
      return;
    }

    for (const sel of selection) {
      if (sel.type === 'track') deleteTrack(sel.id);
      else if (sel.type === 'route') deleteRoute(sel.id);
      else if (sel.type === 'waypoint') deleteWaypoint(sel.id);
    }

    setStatusMessage(`Deleted ${selection.length} item(s)`);
  };

  const handleUndo = () => {
    if (canUndo()) {
      undo();
      setStatusMessage('Undo');
    }
  };

  const handleRedo = () => {
    if (canRedo()) {
      redo();
      setStatusMessage('Redo');
    }
  };

  return (
    <div className="h-12 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center px-2 gap-1">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".gpx,.kml,.xml"
        multiple
        onChange={handleFileSelected}
        className="hidden"
      />

      {/* Logo */}
      <div className="flex items-center gap-2 px-2 mr-4">
        <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center text-white text-xs font-bold">
          G
        </div>
        <span className="font-semibold text-sm hidden sm:inline">GPX Studio</span>
      </div>

      {/* File Operations */}
      <ToolbarGroup>
        <ToolbarButton icon="📄" title="New" onClick={handleNew} />
        <ToolbarButton icon="📂" title="Open/Merge Files" onClick={handleOpen} />
        <div className="relative">
          <ToolbarButton
            icon="🕐"
            title="Recent Files"
            onClick={() => setShowRecentFiles(!showRecentFiles)}
            disabled={recentFiles.length === 0}
          />
          {showRecentFiles && recentFiles.length > 0 && (
            <RecentFilesDropdown
              files={recentFiles}
              onSelect={(filename) => {
                setShowRecentFiles(false);
                setStatusMessage(`To reopen "${filename}", use Open and select the file`);
              }}
              onClear={() => {
                clearRecentFiles();
                setShowRecentFiles(false);
                setStatusMessage('Recent files cleared');
              }}
              onClose={() => setShowRecentFiles(false)}
            />
          )}
        </div>
        <ToolbarButton icon="💾" title="Save" onClick={handleSave} />
        <ToolbarButton icon="📤" title="Export Options (Save As, Split, Export Selected)" onClick={() => setShowExportDialog(true)} />
      </ToolbarGroup>

      <ToolbarSeparator />

      {/* Undo/Redo */}
      <ToolbarGroup>
        <ToolbarButton icon="↩️" title="Undo (Ctrl+Z)" onClick={handleUndo} disabled={!canUndo()} />
        <ToolbarButton icon="↪️" title="Redo (Ctrl+Shift+Z)" onClick={handleRedo} disabled={!canRedo()} />
      </ToolbarGroup>

      <ToolbarSeparator />

      {/* Cut/Copy/Paste */}
      <ToolbarGroup>
        <ToolbarButton
          icon="✂️"
          title="Cut (Ctrl+X)"
          onClick={() => {
            cutSelected();
            setStatusMessage(`Cut ${selection.length} item(s)`);
          }}
          disabled={selection.length === 0}
        />
        <ToolbarButton
          icon="📋"
          title="Copy (Ctrl+C)"
          onClick={() => {
            copySelected();
            setStatusMessage(`Copied ${selection.length} item(s)`);
          }}
          disabled={selection.length === 0}
        />
        <ToolbarButton
          icon="📄"
          title="Paste (Ctrl+V)"
          onClick={() => {
            paste();
            setStatusMessage('Pasted from clipboard');
          }}
          disabled={!hasClipboard()}
        />
        <ToolbarButton
          icon="🗑️"
          title="Delete (Del)"
          onClick={handleDelete}
          disabled={selection.length === 0}
        />
      </ToolbarGroup>

      <ToolbarSeparator />

      {/* Edit Mode */}
      <ToolbarGroup>
        <ToolbarButton
          icon="👆"
          title="Select"
          active={editorMode === 'select'}
          onClick={() => setEditorMode('select')}
        />
        <ToolbarButton
          icon="✋"
          title="Pan"
          active={editorMode === 'pan'}
          onClick={() => setEditorMode('pan')}
        />
        <ToolbarButton
          icon="✏️"
          title="Draw Track"
          active={editorMode === 'draw-route'}
          onClick={() => setEditorMode('draw-route')}
        />
        <ToolbarButton
          icon="📍"
          title="Add Waypoint"
          active={editorMode === 'add-waypoint'}
          onClick={() => setEditorMode('add-waypoint')}
        />
        <ToolbarButton
          icon="📏"
          title="Measure"
          active={editorMode === 'measure'}
          onClick={() => setEditorMode('measure')}
        />
        <ToolbarButton
          icon="⬚"
          title="Box Select (draw box to select items)"
          active={editorMode === 'box-select'}
          onClick={() => setEditorMode('box-select')}
        />
      </ToolbarGroup>

      <ToolbarSeparator />

      {/* Actions */}
      <ToolbarGroup>
        <ToolbarButton icon="🔤" title="Enter Coordinates" onClick={() => setShowCoordinateDialog(true)} />
      </ToolbarGroup>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Settings */}
      <ToolbarButton icon="⚙️" title="Settings" onClick={() => setShowSettingsDialog(true)} />
    </div>
  );
}

function ToolbarGroup({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-0.5">{children}</div>;
}

function ToolbarSeparator() {
  return <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-2" />;
}

interface ToolbarButtonProps {
  icon: string;
  title: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}

function ToolbarButton({ icon, title, onClick, active, disabled }: ToolbarButtonProps) {
  return (
    <button
      className={`
        w-8 h-8 flex items-center justify-center rounded text-sm
        ${active
          ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
          : 'hover:bg-gray-200 dark:hover:bg-gray-700'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      {icon}
    </button>
  );
}

interface RecentFilesDropdownProps {
  files: string[];
  onSelect: (filename: string) => void;
  onClear: () => void;
  onClose: () => void;
}

function RecentFilesDropdown({ files, onSelect, onClear, onClose }: RecentFilesDropdownProps) {
  return (
    <>
      {/* Backdrop to close dropdown when clicking outside */}
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute top-full left-0 mt-1 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg z-50">
        <div className="py-1">
          <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
            Recent Files
          </div>
          {files.map((file, index) => (
            <button
              key={index}
              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 truncate"
              onClick={() => onSelect(file)}
              title={file}
            >
              {file}
            </button>
          ))}
          <div className="border-t border-gray-200 dark:border-gray-700 mt-1 pt-1">
            <button
              className="w-full px-3 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700"
              onClick={onClear}
            >
              Clear Recent Files
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
