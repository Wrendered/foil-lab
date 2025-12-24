'use client';

import { useMemo } from 'react';
import { TrackSegment } from '@/lib/api-client';
import { useViewStore } from '@/stores/viewStore';
import { cn } from '@/lib/utils';

interface LinkedPolarPlotProps {
  segments: TrackSegment[];
  windDirection: number;
  className?: string;
}

export function LinkedPolarPlot({ segments, windDirection, className }: LinkedPolarPlotProps) {
  const hoveredSegmentId = useViewStore((state) => state.hoveredSegmentId);
  const excludedSegmentIds = useViewStore((state) => state.excludedSegmentIds);
  const setHoveredSegment = useViewStore((state) => state.setHoveredSegment);
  const toggleSegmentExclusion = useViewStore((state) => state.toggleSegmentExclusion);

  // Process upwind segments for display
  const polarData = useMemo(() => {
    const upwindSegments = segments.filter((s) => s.direction === 'Upwind');
    return upwindSegments.map((segment) => ({
      ...segment,
      isExcluded: excludedSegmentIds.has(segment.id),
      isHovered: hoveredSegmentId === segment.id,
    }));
  }, [segments, excludedSegmentIds, hoveredSegmentId]);

  // Calculate scale based on active segments
  const scaleInfo = useMemo(() => {
    const activeSegments = polarData.filter((d) => !d.isExcluded);
    if (activeSegments.length === 0) {
      return { scaleMin: 0, scaleMax: 20, scaleRange: 20 };
    }

    const speeds = activeSegments.map((d) => d.avg_speed_knots);
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
  }, [polarData]);

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

  return (
    <div className={cn('flex flex-col', className)}>
      <svg viewBox="0 0 300 300" className="w-full aspect-square max-h-[280px]">
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

        {/* Wind direction indicator */}
        <text x={centerX} y={centerY - maxRadius - 8} textAnchor="middle" fontSize="10" fill="#374151" fontWeight="600">
          ↑ Wind {windDirection}°
        </text>

        {/* Individual segment dots - draw excluded first, then active, then hovered on top */}
        {polarData
          .sort((a, b) => {
            // Hovered on top, then active, then excluded
            if (a.isHovered) return 1;
            if (b.isHovered) return -1;
            if (a.isExcluded && !b.isExcluded) return -1;
            if (!a.isExcluded && b.isExcluded) return 1;
            return 0;
          })
          .map((segment) => {
            // Use angle_to_wind directly - port on left, starboard on right
            const displayAngle = segment.tack === 'Port' ? -segment.angle_to_wind : segment.angle_to_wind;
            const pos = getPosition(displayAngle, segment.avg_speed_knots);

            // Size based on distance
            const maxDistance = Math.max(...polarData.map((d) => d.distance)) || 1;
            const sizeScale = 3 + (segment.distance / maxDistance) * 6;

            // Colors
            let fill = segment.tack === 'Port' ? '#3B82F6' : '#10B981';
            let opacity = 0.8;
            let strokeWidth = 1;
            let stroke = 'white';

            if (segment.isExcluded) {
              fill = '#9CA3AF';
              opacity = 0.4;
            }
            if (segment.isHovered) {
              stroke = '#FBBF24';
              strokeWidth = 3;
              opacity = 1;
            }

            return (
              <circle
                key={segment.id}
                cx={pos.x}
                cy={pos.y}
                r={segment.isHovered ? sizeScale + 2 : sizeScale}
                fill={fill}
                opacity={opacity}
                stroke={stroke}
                strokeWidth={strokeWidth}
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setHoveredSegment(segment.id)}
                onMouseLeave={() => setHoveredSegment(null)}
                onClick={() => toggleSegmentExclusion(segment.id)}
              >
                <title>
                  {segment.tack}: {segment.angle_to_wind.toFixed(0)}° - {segment.avg_speed_knots.toFixed(1)} kn (
                  {segment.distance.toFixed(0)}m)
                </title>
              </circle>
            );
          })}

        {/* Center dot */}
        <circle cx={centerX} cy={centerY} r="2" fill="#6B7280" />
      </svg>

      {/* Legend */}
      <div className="flex justify-center gap-4 mt-1">
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
          <span className="text-xs text-slate-600">Port</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
          <span className="text-xs text-slate-600">Starboard</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded-full bg-gray-400" />
          <span className="text-xs text-slate-600">Excluded</span>
        </div>
      </div>
    </div>
  );
}
