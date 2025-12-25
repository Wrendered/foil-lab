'use client';

import { useMemo } from 'react';
import { TrackSegment } from '@/lib/api-client';
import { cn } from '@/lib/utils';

// Track colors - consistent palette for up to 4 tracks
const TRACK_COLORS = [
  { fill: '#3B82F6', name: 'blue' },   // Blue
  { fill: '#10B981', name: 'green' },  // Green
  { fill: '#F97316', name: 'orange' }, // Orange
  { fill: '#8B5CF6', name: 'purple' }, // Purple
];

export interface ComparisonTrack {
  id: string;
  name: string;
  segments: TrackSegment[];
  windDirection: number;
  colorIndex: number;
}

interface ComparisonPolarPlotProps {
  tracks: ComparisonTrack[];
  hoveredTrackId: string | null;
  onTrackHover: (trackId: string | null) => void;
  className?: string;
}

export function ComparisonPolarPlot({
  tracks,
  hoveredTrackId,
  onTrackHover,
  className,
}: ComparisonPolarPlotProps) {
  // Process all segments from all tracks
  const allPolarData = useMemo(() => {
    const data: Array<{
      trackId: string;
      trackName: string;
      segment: TrackSegment;
      colorIndex: number;
      angleToWind: number;
    }> = [];

    tracks.forEach((track) => {
      const upwindSegments = track.segments.filter((s) => s.direction === 'Upwind');
      upwindSegments.forEach((segment) => {
        data.push({
          trackId: track.id,
          trackName: track.name,
          segment,
          colorIndex: track.colorIndex,
          angleToWind: segment.angle_to_wind,
        });
      });
    });

    return data;
  }, [tracks]);

  // Calculate scale based on all segments
  const scaleInfo = useMemo(() => {
    if (allPolarData.length === 0) {
      return { scaleMin: 0, scaleMax: 20, scaleRange: 20 };
    }

    const speeds = allPolarData.map((d) => d.segment.avg_speed_knots);
    const maxSpeed = Math.max(...speeds);
    const minSpeed = Math.min(...speeds);
    const speedRange = maxSpeed - minSpeed;

    let scaleMin = minSpeed;
    let scaleMax = maxSpeed;

    if (speedRange < 3) {
      scaleMin = Math.max(0, minSpeed - 2);
      scaleMax = maxSpeed + 0.5;
    } else {
      scaleMin = Math.max(0, minSpeed * 0.7);
      scaleMax = maxSpeed * 1.05;
    }

    return { scaleMin, scaleMax, scaleRange: scaleMax - scaleMin || 1 };
  }, [allPolarData]);

  const centerX = 150;
  const centerY = 150;
  const maxRadius = 115;

  // Calculate position for a segment
  const getPosition = (angle: number, speed: number) => {
    const radian = (angle * Math.PI) / 180;
    const normalizedSpeed = (speed - scaleInfo.scaleMin) / scaleInfo.scaleRange;
    const radius = Math.max(0, Math.min(maxRadius, normalizedSpeed * maxRadius));
    return {
      x: centerX + Math.cos(radian - Math.PI / 2) * radius,
      y: centerY + Math.sin(radian - Math.PI / 2) * radius,
    };
  };

  // Get max distance for sizing
  const maxDistance = useMemo(() => {
    return Math.max(...allPolarData.map((d) => d.segment.distance), 1);
  }, [allPolarData]);

  if (tracks.length === 0) {
    return (
      <div className={cn('flex items-center justify-center h-64 text-slate-500', className)}>
        Select tracks to compare
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col', className)}>
      <svg viewBox="0 0 300 300" className="w-full aspect-square max-h-[320px]">
        {/* Background circles */}
        {[0.25, 0.5, 0.75, 1].map((fraction) => (
          <circle
            key={fraction}
            cx={centerX}
            cy={centerY}
            r={maxRadius * fraction}
            fill="none"
            stroke="#E5E7EB"
            strokeWidth="1"
          />
        ))}

        {/* Angle lines for both sides */}
        {[0, 30, 45, 60, 90].map((angle) => {
          const radian = (angle * Math.PI) / 180;
          const x2Right = centerX + Math.cos(radian - Math.PI / 2) * maxRadius;
          const y2Right = centerY + Math.sin(radian - Math.PI / 2) * maxRadius;
          const x2Left = centerX - Math.cos(radian - Math.PI / 2) * maxRadius;
          const y2Left = centerY + Math.sin(radian - Math.PI / 2) * maxRadius;

          return (
            <g key={angle}>
              <line x1={centerX} y1={centerY} x2={x2Right} y2={y2Right} stroke="#E5E7EB" strokeWidth="1" />
              <line x1={centerX} y1={centerY} x2={x2Left} y2={y2Left} stroke="#E5E7EB" strokeWidth="1" />
              {angle > 0 && (
                <>
                  <text
                    x={centerX + Math.cos(radian - Math.PI / 2) * (maxRadius + 12)}
                    y={centerY + Math.sin(radian - Math.PI / 2) * (maxRadius + 12)}
                    textAnchor="middle"
                    fontSize="9"
                    fill="#6B7280"
                  >
                    {angle}°
                  </text>
                  <text
                    x={centerX - Math.cos(radian - Math.PI / 2) * (maxRadius + 12)}
                    y={centerY + Math.sin(radian - Math.PI / 2) * (maxRadius + 12)}
                    textAnchor="middle"
                    fontSize="9"
                    fill="#6B7280"
                  >
                    {angle}°
                  </text>
                </>
              )}
            </g>
          );
        })}

        {/* Speed labels */}
        {[0.5, 1].map((fraction, i) => {
          const speed = scaleInfo.scaleMin + scaleInfo.scaleRange * fraction;
          return (
            <text
              key={i}
              x={centerX + 4}
              y={centerY - maxRadius * fraction + 3}
              fontSize="8"
              fill="#374151"
              fontWeight="500"
            >
              {speed.toFixed(1)}kn
            </text>
          );
        })}

        {/* Wind indicator */}
        <text x={centerX} y={centerY - maxRadius - 8} textAnchor="middle" fontSize="10" fill="#374151" fontWeight="600">
          ↑ Wind
        </text>

        {/* Segment dots - sorted so hovered track appears on top */}
        {allPolarData
          .sort((a, b) => {
            if (hoveredTrackId === a.trackId) return 1;
            if (hoveredTrackId === b.trackId) return -1;
            return 0;
          })
          .map((data, idx) => {
            const segment = data.segment;
            const displayAngle = segment.tack === 'Port' ? -data.angleToWind : data.angleToWind;
            const pos = getPosition(displayAngle, segment.avg_speed_knots);

            // Size based on distance
            const sizeScale = 3 + (segment.distance / maxDistance) * 5;

            // Get track color
            const trackColor = TRACK_COLORS[data.colorIndex % TRACK_COLORS.length];

            // Dim if another track is hovered
            const isTrackHovered = hoveredTrackId === data.trackId;
            const otherTrackHovered = hoveredTrackId !== null && !isTrackHovered;

            const opacity = otherTrackHovered ? 0.2 : 0.8;
            const strokeWidth = isTrackHovered ? 2 : 1;
            const stroke = isTrackHovered ? '#FBBF24' : 'white';

            return (
              <circle
                key={`${data.trackId}-${segment.id}-${idx}`}
                cx={pos.x}
                cy={pos.y}
                r={isTrackHovered ? sizeScale + 1 : sizeScale}
                fill={trackColor.fill}
                opacity={opacity}
                stroke={stroke}
                strokeWidth={strokeWidth}
                style={{ cursor: 'pointer', transition: 'opacity 150ms' }}
                onMouseEnter={() => onTrackHover(data.trackId)}
                onMouseLeave={() => onTrackHover(null)}
              >
                <title>
                  {data.trackName}: {segment.tack} {data.angleToWind.toFixed(0)}° - {segment.avg_speed_knots.toFixed(1)} kn
                </title>
              </circle>
            );
          })}

        {/* Center dot */}
        <circle cx={centerX} cy={centerY} r="2" fill="#6B7280" />
      </svg>

      {/* Legend - show track colors */}
      <div className="flex flex-wrap justify-center gap-3 mt-2">
        {tracks.map((track) => {
          const color = TRACK_COLORS[track.colorIndex % TRACK_COLORS.length];
          const isHovered = hoveredTrackId === track.id;
          return (
            <button
              key={track.id}
              className={cn(
                'flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors',
                isHovered ? 'bg-slate-100' : 'hover:bg-slate-50'
              )}
              onMouseEnter={() => onTrackHover(track.id)}
              onMouseLeave={() => onTrackHover(null)}
            >
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: color.fill }}
              />
              <span className="text-slate-600 truncate max-w-[100px]">
                {track.name.replace('.gpx', '')}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export { TRACK_COLORS };
