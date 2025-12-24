import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

interface ViewState {
  // Hover state - which segment is being hovered (in map, polar, or list)
  hoveredSegmentId: number | null;

  // Exclusion state - which segments are excluded from calculations
  excludedSegmentIds: Set<number>;

  // Wind adjustment - null means use the calculated wind direction
  adjustedWindDirection: number | null;

  // Actions
  setHoveredSegment: (id: number | null) => void;
  toggleSegmentExclusion: (id: number) => void;
  setExcludedSegments: (ids: Set<number>) => void;
  clearExcludedSegments: () => void;
  setWindDirection: (degrees: number | null) => void;
  reset: () => void;
}

export const useViewStore = create<ViewState>()(
  immer((set) => ({
    hoveredSegmentId: null,
    excludedSegmentIds: new Set(),
    adjustedWindDirection: null,

    setHoveredSegment: (id) =>
      set((state) => {
        state.hoveredSegmentId = id;
      }),

    toggleSegmentExclusion: (id) =>
      set((state) => {
        const newSet = new Set(state.excludedSegmentIds);
        if (newSet.has(id)) {
          newSet.delete(id);
        } else {
          newSet.add(id);
        }
        state.excludedSegmentIds = newSet;
      }),

    setExcludedSegments: (ids) =>
      set((state) => {
        state.excludedSegmentIds = ids;
      }),

    clearExcludedSegments: () =>
      set((state) => {
        state.excludedSegmentIds = new Set();
      }),

    setWindDirection: (degrees) =>
      set((state) => {
        state.adjustedWindDirection = degrees;
      }),

    reset: () =>
      set((state) => {
        state.hoveredSegmentId = null;
        state.excludedSegmentIds = new Set();
        state.adjustedWindDirection = null;
      }),
  }))
);

// Selector hooks for performance
export const useHoveredSegment = () => useViewStore((state) => state.hoveredSegmentId);
export const useExcludedSegments = () => useViewStore((state) => state.excludedSegmentIds);
export const useAdjustedWind = () => useViewStore((state) => state.adjustedWindDirection);
