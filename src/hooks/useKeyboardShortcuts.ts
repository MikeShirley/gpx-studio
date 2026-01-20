import { useEffect } from 'react';
import { useGpxStore } from '../stores/gpxStore';
import { useUIStore } from '../stores/uiStore';
import { useSettingsStore } from '../stores/settingsStore';
import { exportGPX } from '../lib/gpx/exporter';

export function useKeyboardShortcuts() {
  const { document, selection, deleteTrack, deleteRoute, deleteWaypoint, clearSelection, selectAll, undo, redo, canUndo, canRedo, copySelected, cutSelected, paste, hasClipboard } = useGpxStore();
  const { setShowCoordinateDialog, setShowSettingsDialog, setStatusMessage } = useUIStore();
  const { confirmDelete } = useSettingsStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const isMeta = e.metaKey || e.ctrlKey;

      // Ctrl/Cmd + O - Open
      if (isMeta && e.key === 'o') {
        e.preventDefault();
        // Trigger file input click
        const fileInput = window.document.querySelector('input[type="file"]') as HTMLInputElement;
        fileInput?.click();
      }

      // Ctrl/Cmd + S - Save
      if (isMeta && e.key === 's') {
        e.preventDefault();
        const content = exportGPX(document);
        const blob = new Blob([content], { type: 'application/gpx+xml' });
        const url = URL.createObjectURL(blob);
        const a = window.document.createElement('a');
        a.href = url;
        a.download = document.filename || 'untitled.gpx';
        a.click();
        URL.revokeObjectURL(url);
        setStatusMessage(`Saved ${document.filename || 'untitled.gpx'}`);
      }

      // Delete or Backspace - Delete selected
      if (e.key === 'Delete' || e.key === 'Backspace') {
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
      }

      // Escape - Clear selection
      if (e.key === 'Escape') {
        clearSelection();
      }

      // Ctrl/Cmd + A - Select all
      if (isMeta && e.key === 'a') {
        e.preventDefault();
        selectAll();
        const count = document.waypoints.length + document.routes.length + document.tracks.length;
        setStatusMessage(`Selected ${count} item(s)`);
      }

      // Ctrl/Cmd + , - Settings
      if (isMeta && e.key === ',') {
        e.preventDefault();
        setShowSettingsDialog(true);
      }

      // Ctrl/Cmd + Shift + L - Add waypoint by coordinates
      if (isMeta && e.shiftKey && e.key === 'L') {
        e.preventDefault();
        setShowCoordinateDialog(true);
      }

      // Ctrl/Cmd + Z - Undo
      if (isMeta && !e.shiftKey && e.key === 'z') {
        e.preventDefault();
        if (canUndo()) {
          undo();
          setStatusMessage('Undo');
        }
      }

      // Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y - Redo
      if (isMeta && ((e.shiftKey && e.key === 'z') || (e.key === 'y'))) {
        e.preventDefault();
        if (canRedo()) {
          redo();
          setStatusMessage('Redo');
        }
      }

      // Ctrl/Cmd + X - Cut
      if (isMeta && e.key === 'x') {
        if (selection.length === 0) return;
        e.preventDefault();
        const count = selection.length;
        cutSelected();
        setStatusMessage(`Cut ${count} item(s) to clipboard`);
      }

      // Ctrl/Cmd + C - Copy
      if (isMeta && e.key === 'c') {
        if (selection.length === 0) return;
        e.preventDefault();
        copySelected();
        setStatusMessage(`Copied ${selection.length} item(s) to clipboard`);
      }

      // Ctrl/Cmd + V - Paste
      if (isMeta && e.key === 'v') {
        if (!hasClipboard()) return;
        e.preventDefault();
        paste();
        setStatusMessage('Pasted from clipboard');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [document, selection, confirmDelete, deleteTrack, deleteRoute, deleteWaypoint, clearSelection, selectAll, setShowCoordinateDialog, setShowSettingsDialog, setStatusMessage, undo, redo, canUndo, canRedo, copySelected, cutSelected, paste, hasClipboard]);
}
