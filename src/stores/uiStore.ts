// UI state store using Zustand

import { create } from 'zustand';

export type EditorMode =
  | 'select'
  | 'pan'
  | 'draw-route'
  | 'add-waypoint'
  | 'measure'
  | 'box-select';

export type BottomPanelTab = 'statistics' | 'chart' | 'points';

interface UIState {
  // Editor mode
  editorMode: EditorMode;

  // Sidebar
  sidebarWidth: number;

  // Bottom panel
  bottomPanelHeight: number;
  bottomPanelTab: BottomPanelTab;
  bottomPanelCollapsed: boolean;

  // Dialogs
  showSettingsDialog: boolean;
  showCoordinateDialog: boolean;
  showRenameDialog: boolean;
  showFilterDialog: boolean;
  showAboutDialog: boolean;
  showSimplifyDialog: boolean;
  showSplitTrackDialog: boolean;
  showSaveAsDialog: boolean;
  showExportDialog: boolean;

  // Hover state for sidebar highlighting
  hoveredItem: { type: 'track' | 'route' | 'waypoint'; id: string } | null;

  // Zoom target for map (when clicking sidebar items)
  zoomTarget: { north: number; south: number; east: number; west: number } | null;

  // Status
  statusMessage: string;
  isLoading: boolean;

  // Actions
  setEditorMode: (mode: EditorMode) => void;
  setSidebarWidth: (width: number) => void;
  setBottomPanelHeight: (height: number) => void;
  setBottomPanelTab: (tab: BottomPanelTab) => void;
  toggleBottomPanel: () => void;
  setShowSettingsDialog: (show: boolean) => void;
  setShowCoordinateDialog: (show: boolean) => void;
  setShowRenameDialog: (show: boolean) => void;
  setShowFilterDialog: (show: boolean) => void;
  setShowAboutDialog: (show: boolean) => void;
  setShowSimplifyDialog: (show: boolean) => void;
  setShowSplitTrackDialog: (show: boolean) => void;
  setShowSaveAsDialog: (show: boolean) => void;
  setShowExportDialog: (show: boolean) => void;
  setHoveredItem: (item: { type: 'track' | 'route' | 'waypoint'; id: string } | null) => void;
  setZoomTarget: (target: { north: number; south: number; east: number; west: number } | null) => void;
  setStatusMessage: (message: string) => void;
  setIsLoading: (loading: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  // Default values
  editorMode: 'select',
  sidebarWidth: 280,
  bottomPanelHeight: 200,
  bottomPanelTab: 'statistics',
  bottomPanelCollapsed: false,
  showSettingsDialog: false,
  showCoordinateDialog: false,
  showRenameDialog: false,
  showFilterDialog: false,
  showAboutDialog: false,
  showSimplifyDialog: false,
  showSplitTrackDialog: false,
  showSaveAsDialog: false,
  showExportDialog: false,
  hoveredItem: null,
  zoomTarget: null,
  statusMessage: 'Ready',
  isLoading: false,

  // Actions
  setEditorMode: (mode) => set({ editorMode: mode }),
  setSidebarWidth: (width) => set({ sidebarWidth: width }),
  setBottomPanelHeight: (height) => set({ bottomPanelHeight: height }),
  setBottomPanelTab: (tab) => set({ bottomPanelTab: tab }),
  toggleBottomPanel: () => set((state) => ({ bottomPanelCollapsed: !state.bottomPanelCollapsed })),
  setShowSettingsDialog: (show) => set({ showSettingsDialog: show }),
  setShowCoordinateDialog: (show) => set({ showCoordinateDialog: show }),
  setShowRenameDialog: (show) => set({ showRenameDialog: show }),
  setShowFilterDialog: (show) => set({ showFilterDialog: show }),
  setShowAboutDialog: (show) => set({ showAboutDialog: show }),
  setShowSimplifyDialog: (show) => set({ showSimplifyDialog: show }),
  setShowSplitTrackDialog: (show) => set({ showSplitTrackDialog: show }),
  setShowSaveAsDialog: (show) => set({ showSaveAsDialog: show }),
  setShowExportDialog: (show) => set({ showExportDialog: show }),
  setHoveredItem: (item) => set({ hoveredItem: item }),
  setZoomTarget: (target) => set({ zoomTarget: target }),
  setStatusMessage: (message) => set({ statusMessage: message }),
  setIsLoading: (loading) => set({ isLoading: loading }),
}));
