// Settings store using Zustand

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type UnitSystem = 'metric' | 'imperial';
export type Theme = 'light' | 'dark';

interface SettingsState {
  // Display
  units: UnitSystem;
  theme: Theme;
  defaultTileLayer: string;

  // Colors
  trackColor: string;
  routeColor: string;
  waypointColor: string;
  selectionColor: string;

  // Behavior
  autoZoomOnLoad: boolean;
  confirmDelete: boolean;

  // Recent files
  recentFiles: string[];
  maxRecentFiles: number;

  // Actions
  setUnits: (units: UnitSystem) => void;
  setTheme: (theme: Theme) => void;
  setDefaultTileLayer: (layer: string) => void;
  setTrackColor: (color: string) => void;
  setRouteColor: (color: string) => void;
  setWaypointColor: (color: string) => void;
  setSelectionColor: (color: string) => void;
  setAutoZoomOnLoad: (enabled: boolean) => void;
  setConfirmDelete: (enabled: boolean) => void;
  addRecentFile: (filepath: string) => void;
  clearRecentFiles: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      // Default values
      units: 'metric',
      theme: 'light',
      defaultTileLayer: 'osm',
      trackColor: '#E53935',
      routeColor: '#1E88E5',
      waypointColor: '#43A047',
      selectionColor: '#FB8C00',
      autoZoomOnLoad: true,
      confirmDelete: true,
      recentFiles: [],
      maxRecentFiles: 10,

      // Actions
      setUnits: (units) => set({ units }),
      setTheme: (theme) => set({ theme }),
      setDefaultTileLayer: (layer) => set({ defaultTileLayer: layer }),
      setTrackColor: (color) => set({ trackColor: color }),
      setRouteColor: (color) => set({ routeColor: color }),
      setWaypointColor: (color) => set({ waypointColor: color }),
      setSelectionColor: (color) => set({ selectionColor: color }),
      setAutoZoomOnLoad: (enabled) => set({ autoZoomOnLoad: enabled }),
      setConfirmDelete: (enabled) => set({ confirmDelete: enabled }),
      addRecentFile: (filepath) =>
        set((state) => {
          const filtered = state.recentFiles.filter((f) => f !== filepath);
          const newList = [filepath, ...filtered].slice(0, state.maxRecentFiles);
          return { recentFiles: newList };
        }),
      clearRecentFiles: () => set({ recentFiles: [] }),
    }),
    {
      name: 'gpx-studio-settings',
    }
  )
);
