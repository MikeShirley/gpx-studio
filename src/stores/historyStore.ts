// Undo/Redo history store
import { create } from 'zustand';
import type { GPXDocument } from '../lib/gpx/types';

interface HistoryState {
  past: GPXDocument[];
  future: GPXDocument[];
  maxHistory: number;

  // Actions
  pushState: (doc: GPXDocument) => void;
  undo: () => GPXDocument | null;
  redo: () => GPXDocument | null;
  canUndo: () => boolean;
  canRedo: () => boolean;
  clear: () => void;
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  past: [],
  future: [],
  maxHistory: 50,

  pushState: (doc: GPXDocument) => {
    set((state) => {
      // Deep clone the document
      const cloned = JSON.parse(JSON.stringify(doc));
      const newPast = [...state.past, cloned].slice(-state.maxHistory);
      return {
        past: newPast,
        future: [], // Clear redo stack on new action
      };
    });
  },

  undo: () => {
    const state = get();
    if (state.past.length === 0) return null;

    const newPast = [...state.past];
    const previousState = newPast.pop();

    set({ past: newPast });
    return previousState || null;
  },

  redo: () => {
    const state = get();
    if (state.future.length === 0) return null;

    const newFuture = [...state.future];
    const nextState = newFuture.pop();

    if (nextState) {
      set((state) => ({
        past: [...state.past, nextState],
        future: newFuture,
      }));
    }

    return nextState || null;
  },

  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,

  clear: () => set({ past: [], future: [] }),
}));
