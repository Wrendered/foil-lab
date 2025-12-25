import { create } from 'zustand';

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

export const useViewStore = create<ViewState>()((set) => ({
  hoveredSegmentId: null,
  excludedSegmentIds: new Set(),
  adjustedWindDirection: null,

  setHoveredSegment: (id) => set({ hoveredSegmentId: id }),

  toggleSegmentExclusion: (id) =>
    set((state) => {
      const newSet = new Set(state.excludedSegmentIds);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return { excludedSegmentIds: newSet };
    }),

  setExcludedSegments: (ids) => set({ excludedSegmentIds: ids }),

  clearExcludedSegments: () => set({ excludedSegmentIds: new Set() }),

  setWindDirection: (degrees) => set({ adjustedWindDirection: degrees }),

  reset: () =>
    set({
      hoveredSegmentId: null,
      excludedSegmentIds: new Set(),
      adjustedWindDirection: null,
    }),
}));

// Selector hooks for performance
export const useHoveredSegment = () => useViewStore((state) => state.hoveredSegmentId);
export const useExcludedSegments = () => useViewStore((state) => state.excludedSegmentIds);
export const useAdjustedWind = () => useViewStore((state) => state.adjustedWindDirection);
