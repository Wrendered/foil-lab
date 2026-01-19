import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { DEFAULT_PARAMETERS } from '@/lib/defaults';

/**
 * Analysis Parameters - GLOBAL settings that apply to all track analyses.
 * These control how the backend detects and filters segments.
 */
export interface AnalysisParameters {
  windDirection: number;
  angleTolerance: number;
  minSpeed: number;
  minDistance: number;
  minDuration: number;
  bestAttemptsFraction: number;  // Top N% tightest angles per tack (0.2-1.0)
}

interface AnalysisState {
  // Global detection parameters (apply to all tracks)
  parameters: AnalysisParameters;

  // UI state
  isAnalyzing: boolean;
  error: string | null;

  // Actions
  updateParameters: (params: Partial<AnalysisParameters>) => void;
  setAnalyzing: (isAnalyzing: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

/**
 * Analysis Store - manages GLOBAL state for track analysis.
 *
 * Important: Detection parameters are GLOBAL and apply to all tracks.
 * Per-track data (results, segments, wind) is stored in uploadStore.
 * Per-track view state (exclusions, wind override) is in viewStore and
 * resets when switching tracks.
 */
export const useAnalysisStore = create<AnalysisState>()(
  immer((set) => ({
    // Initial state
    parameters: { ...DEFAULT_PARAMETERS },
    isAnalyzing: false,
    error: null,

    // Actions
    updateParameters: (params) =>
      set((state) => {
        state.parameters = { ...state.parameters, ...params };
      }),

    setAnalyzing: (isAnalyzing) =>
      set((state) => {
        state.isAnalyzing = isAnalyzing;
        if (isAnalyzing) {
          state.error = null;
        }
      }),

    setError: (error) =>
      set((state) => {
        state.error = error;
        state.isAnalyzing = false;
      }),

    reset: () =>
      set((state) => {
        state.parameters = { ...DEFAULT_PARAMETERS };
        state.isAnalyzing = false;
        state.error = null;
      }),
  }))
);
