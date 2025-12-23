import { TrackSegment } from './api-client';

// Consistent color scheme for sailing visualizations
export const SAILING_COLORS = {
  tack: {
    port: {
      upwind: '#EF4444',    // Red
      downwind: '#F97316',  // Orange
    },
    starboard: {
      upwind: '#3B82F6',    // Blue
      downwind: '#8B5CF6',  // Purple
    },
  },
  vmg: {
    good: '#EF4444',        // Red for good VMG
    normal: '#94A3B8',      // Gray for normal
  },
  metrics: {
    speed: '#3B82F6',       // Blue
    angle: '#10B981',       // Green
    distance: '#8B5CF6',    // Purple
    time: '#F59E0B',        // Amber
  },
} as const;

// Get color for a segment based on its properties
export function getSegmentColor(
  segment: TrackSegment,
  options?: {
    vmgHighlight?: boolean;
    avgSpeed?: number;
  }
): string {
  if (options?.vmgHighlight) {
    const goodSpeed = options.avgSpeed ? segment.avg_speed_knots > options.avgSpeed : false;
    const goodAngle = segment.angle_to_wind < 50;
    return goodSpeed && goodAngle ? SAILING_COLORS.vmg.good : SAILING_COLORS.vmg.normal;
  }

  const tack = segment.tack.toLowerCase() as 'port' | 'starboard';
  const direction = segment.direction.toLowerCase() as 'upwind' | 'downwind';
  
  return SAILING_COLORS.tack[tack][direction];
}

// Format speed with consistent precision
export function formatSpeed(speed: number): string {
  return `${speed.toFixed(1)} kn`;
}

// Format angle with consistent precision
export function formatAngle(angle: number): string {
  return `${angle.toFixed(0)}°`;
}

// Format distance with appropriate units
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${meters.toFixed(0)}m`;
  }
  return `${(meters / 1000).toFixed(1)}km`;
}

// Format duration in human-readable format
export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds.toFixed(0)}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) {
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds.toFixed(0)}s` : `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}