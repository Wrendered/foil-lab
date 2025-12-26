import { create } from 'zustand';

// Time/spatial filter bounds (for re-analysis)
export interface FilterBounds {
  timeStart: string | null;  // ISO datetime string
  timeEnd: string | null;    // ISO datetime string
  latMin: number | null;
  latMax: number | null;
  lonMin: number | null;
  lonMax: number | null;
}

interface ViewState {
  // Hover state - which segment is being hovered (in map, polar, or list)
  hoveredSegmentId: number | null;

  // Exclusion state - which segments are excluded from calculations
  excludedSegmentIds: Set<number>;

  // Wind adjustment - null means use the calculated wind direction
  adjustedWindDirection: number | null;

  // Time/spatial filters - requires re-analysis when changed
  filterBounds: FilterBounds;

  // Actions
  setHoveredSegment: (id: number | null) => void;
  toggleSegmentExclusion: (id: number) => void;
  setExcludedSegments: (ids: Set<number>) => void;
  clearExcludedSegments: () => void;
  setWindDirection: (degrees: number | null) => void;
  setFilterBounds: (bounds: Partial<FilterBounds>) => void;
  clearFilterBounds: () => void;
  reset: () => void;
}

const DEFAULT_FILTER_BOUNDS: FilterBounds = {
  timeStart: null,
  timeEnd: null,
  latMin: null,
  latMax: null,
  lonMin: null,
  lonMax: null,
};

export const useViewStore = create<ViewState>()((set) => ({
  hoveredSegmentId: null,
  excludedSegmentIds: new Set(),
  adjustedWindDirection: null,
  filterBounds: { ...DEFAULT_FILTER_BOUNDS },

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

  setFilterBounds: (bounds) =>
    set((state) => ({
      filterBounds: { ...state.filterBounds, ...bounds },
    })),

  clearFilterBounds: () => set({ filterBounds: { ...DEFAULT_FILTER_BOUNDS } }),

  reset: () =>
    set({
      hoveredSegmentId: null,
      excludedSegmentIds: new Set(),
      adjustedWindDirection: null,
      filterBounds: { ...DEFAULT_FILTER_BOUNDS },
    }),
}));

// Selector hooks for performance
export const useHoveredSegment = () => useViewStore((state) => state.hoveredSegmentId);
export const useExcludedSegments = () => useViewStore((state) => state.excludedSegmentIds);
export const useAdjustedWind = () => useViewStore((state) => state.adjustedWindDirection);
export const useFilterBounds = () => useViewStore((state) => state.filterBounds);
