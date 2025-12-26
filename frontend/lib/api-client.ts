import axios, { AxiosProgressEvent } from 'axios';
import { AnalysisParameters } from '@/stores/analysisStore';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Enhanced API client with interceptors
export const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 120000, // 2 minutes for large file uploads
  headers: {
    'Accept': 'application/json',
  },
});

// Request interceptor to add common headers
apiClient.interceptors.request.use(
  (config) => {
    // Add timestamp to prevent caching issues
    if (config.method === 'get') {
      config.params = {
        ...config.params,
        _t: Date.now(),
      };
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      // Server responded with error status
      const message = error.response.data?.detail || 
                     error.response.data?.message || 
                     `Server error: ${error.response.status}`;
      throw new APIError(message, error.response.status, error.response.data);
    } else if (error.request) {
      // Network error
      throw new APIError('Network error: Please check your connection and try again', 0);
    } else {
      // Other error
      throw new APIError(error.message || 'An unexpected error occurred', -1);
    }
  }
);

// Custom API Error class
export class APIError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: unknown
  ) {
    super(message);
    this.name = 'APIError';
  }
}

// Types (enhanced from existing)
export interface TrackSegment {
  id: number;
  start_idx: number;
  end_idx: number;
  distance: number;
  duration: number;
  avg_speed_knots: number;
  bearing: number;
  angle_to_wind: number;
  tack: 'Port' | 'Starboard';
  direction: 'Upwind' | 'Downwind';
  sailing_type: string;
  suspicious?: boolean;
}

export interface WindEstimate {
  direction: number;
  confidence: 'High' | 'Medium' | 'Low';
  port_average_angle: number;
  starboard_average_angle: number;
  total_segments: number;
  port_segments: number;
  starboard_segments: number;
}

export interface PerformanceMetrics {
  avg_speed: number | null;
  avg_upwind_angle: number | null;
  best_upwind_angle: number | null;
  vmg_upwind: number | null;
  vmg_downwind: number | null;
  port_tack_count: number;
  starboard_tack_count: number;
  vmg_segment_ids: number[];
}

export interface TrackSummary {
  total_distance: number;
  duration_seconds: number;
  avg_speed_knots: number;
  max_speed_knots: number;
  filename: string;
}

export interface AnalysisResult {
  segments: TrackSegment[];
  wind_estimate: WindEstimate;
  performance_metrics: PerformanceMetrics;
  track_summary: TrackSummary;
  processing_time?: number;
  cache_hit?: boolean;
}

export interface ConfigResponse {
  defaults: Record<string, number>;
  ranges: Record<string, { min: number; max: number; step: number }>;
}

// API Functions

/**
 * Get application configuration
 */
export async function getConfig(): Promise<ConfigResponse> {
  const response = await apiClient.get('/api/config');
  return response.data;
}

/**
 * Health check
 */
export async function healthCheck(): Promise<{ status: string; timestamp: string }> {
  const response = await apiClient.get('/api/health');
  return response.data;
}

// Filter parameters for time/spatial filtering (Phase 4)
export interface FilterParameters {
  timeStart?: string | null;  // ISO datetime string
  timeEnd?: string | null;    // ISO datetime string
  latMin?: number | null;
  latMax?: number | null;
  lonMin?: number | null;
  lonMax?: number | null;
}

/**
 * Upload and analyze track with progress tracking
 */
export async function analyzeTrack(
  file: File,
  params: Partial<AnalysisParameters>,
  onProgress?: (progress: number) => void,
  filters?: FilterParameters
): Promise<AnalysisResult> {
  const formData = new FormData();
  formData.append('file', file);

  // Convert parameters to API format
  const apiParams: Record<string, string | number | undefined> = {
    wind_direction: params.windDirection,
    angle_tolerance: params.angleTolerance,
    min_duration: params.minDuration,
    min_distance: params.minDistance,
    min_speed: params.minSpeed,
  };

  // Add filter parameters if provided
  if (filters) {
    if (filters.timeStart) apiParams.time_start = filters.timeStart;
    if (filters.timeEnd) apiParams.time_end = filters.timeEnd;
    if (filters.latMin !== undefined && filters.latMin !== null) apiParams.lat_min = filters.latMin;
    if (filters.latMax !== undefined && filters.latMax !== null) apiParams.lat_max = filters.latMax;
    if (filters.lonMin !== undefined && filters.lonMin !== null) apiParams.lon_min = filters.lonMin;
    if (filters.lonMax !== undefined && filters.lonMax !== null) apiParams.lon_max = filters.lonMax;
  }

  const queryParams = new URLSearchParams();
  Object.entries(apiParams).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      queryParams.append(key, value.toString());
    }
  });

  const response = await apiClient.post(
    `/api/analyze-track?${queryParams.toString()}`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent: AxiosProgressEvent) => {
        if (progressEvent.total && onProgress) {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          onProgress(percentCompleted);
        }
      },
    }
  );

  return response.data;
}

/**
 * Update analysis parameters (for future incremental updates)
 */
export async function updateAnalysisParameters(
  trackId: string,
  params: Partial<AnalysisParameters>
): Promise<AnalysisResult> {
  const response = await apiClient.patch(`/api/tracks/${trackId}/parameters`, params);
  return response.data;
}

/**
 * Get track segments (for future granular loading)
 */
export async function getTrackSegments(trackId: string): Promise<TrackSegment[]> {
  const response = await apiClient.get(`/api/tracks/${trackId}/segments`);
  return response.data;
}

/**
 * Get wind analysis (for future granular loading)
 */
export async function getWindAnalysis(trackId: string): Promise<WindEstimate> {
  const response = await apiClient.get(`/api/tracks/${trackId}/wind`);
  return response.data;
}

/**
 * Export analysis results
 */
export async function exportAnalysis(
  trackId: string,
  format: 'csv' | 'json' | 'excel' = 'csv'
): Promise<Blob> {
  const response = await apiClient.get(`/api/tracks/${trackId}/export`, {
    params: { format },
    responseType: 'blob',
  });
  return response.data;
}

// Historical wind lookup response
export interface HistoricalWindResponse {
  wind_direction: number;
  wind_speed_kmh: number;
  wind_speed_knots: number;
  source: string;
  location: string;
  timestamp: string;
}

/**
 * Look up historical wind data from Open-Meteo
 */
export async function lookupWind(
  latitude: number,
  longitude: number,
  date: string,
  hour: number = 12
): Promise<HistoricalWindResponse> {
  const response = await apiClient.get('/api/lookup-wind', {
    params: {
      latitude,
      longitude,
      date,
      hour,
    },
  });
  return response.data;
}

// React Query key factory for consistent cache keys
export const apiKeys = {
  all: ['api'] as const,
  config: () => [...apiKeys.all, 'config'] as const,
  health: () => [...apiKeys.all, 'health'] as const,
  tracks: () => [...apiKeys.all, 'tracks'] as const,
  track: (id: string) => [...apiKeys.tracks(), id] as const,
  trackSegments: (id: string) => [...apiKeys.track(id), 'segments'] as const,
  trackWind: (id: string) => [...apiKeys.track(id), 'wind'] as const,
  windLookup: (lat: number, lon: number, date: string, hour: number) =>
    [...apiKeys.all, 'wind-lookup', lat, lon, date, hour] as const,
  analysis: (file: File, params: Partial<AnalysisParameters>) => [
    ...apiKeys.all,
    'analysis',
    file.name,
    file.size,
    file.lastModified,
    params,
  ] as const,
};

// Utility functions for error handling
export function isAPIError(error: unknown): error is APIError {
  return error instanceof APIError;
}

export function getErrorMessage(error: unknown): string {
  if (isAPIError(error)) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unexpected error occurred';
}

export function isNetworkError(error: unknown): boolean {
  return isAPIError(error) && error.status === 0;
}

export function isServerError(error: unknown): boolean {
  return isAPIError(error) && error.status >= 500;
}

export function isClientError(error: unknown): boolean {
  return isAPIError(error) && error.status >= 400 && error.status < 500;
}