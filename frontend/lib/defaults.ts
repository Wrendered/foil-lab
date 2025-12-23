/**
 * Default parameter values for track analysis.
 * These are fallback values when the backend config is unavailable.
 * The backend config (fetched via /api/config) takes precedence when available.
 */
export const DEFAULT_PARAMETERS = {
  windDirection: 90,
  angleTolerance: 25,
  minSpeed: 8.0,
  minDistance: 100,
  minDuration: 10,
} as const;

/**
 * Default ranges for parameter sliders/inputs.
 * These are fallback values when the backend config is unavailable.
 */
export const DEFAULT_RANGES = {
  windDirection: { min: 0, max: 360, step: 1 },
  angleTolerance: { min: 5, max: 45, step: 1 },
  minSpeed: { min: 1, max: 20, step: 0.1 },
  minDistance: { min: 50, max: 500, step: 10 },
  minDuration: { min: 5, max: 60, step: 1 },
} as const;

export type ParameterDefaults = typeof DEFAULT_PARAMETERS;
export type ParameterRanges = typeof DEFAULT_RANGES;
