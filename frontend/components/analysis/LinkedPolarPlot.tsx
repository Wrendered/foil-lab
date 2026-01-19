'use client';

import { useMemo } from 'react';
import { TrackSegment } from '@/lib/api-client';
import { useViewStore } from '@/stores/viewStore';
import { cn } from '@/lib/utils';
import { Minus, Plus } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface LinkedPolarPlotProps {
  segments: TrackSegment[];
  windDirection: number;
  className?: string;
  bestAttemptsFraction?: number;
  onBestAttemptsFractionChange?: (fraction: number) => void;
}

export function LinkedPolarPlot({
  segments,
  windDirection,
  className,
  bestAttemptsFraction = 0.4,
  onBestAttemptsFractionChange,
}: LinkedPolarPlotProps) {
  const hoveredSegmentId = useViewStore((state) => state.hoveredSegmentId);
  const excludedSegmentIds = useViewStore((state) => state.excludedSegmentIds);
  const setHoveredSegment = useViewStore((state) => state.setHoveredSegment);
  const toggleSegmentExclusion = useViewStore((state) => state.toggleSegmentExclusion);

  // Calculate which segments are "best attempts" (top N% tightest per tack)
  const bestAttemptsInfo = useMemo(() => {
    const upwindSegments = segments.filter((s) => s.direction === 'Upwind');
    const activeSegments = upwindSegments.filter((s) => !excludedSegmentIds.has(s.id));

    const portSegments = activeSegments.filter((s) => s.tack === 'Port');
    const starboardSegments = activeSegments.filter((s) => s.tack === 'Starboard');

    const getBestAttemptIds = (tack: TrackSegment[]) => {
      if (tack.length === 0) return { ids: new Set<number>(), cutoffAngle: 90 };
      const minCount = 3;
      const sorted = [...tack].sort((a, b) => a.angle_to_wind - b.angle_to_wind);
      const count = Math.max(minCount, Math.floor(tack.length * bestAttemptsFraction));
      const best = sorted.slice(0, Math.min(count, tack.length));
      const cutoffAngle = best.length > 0 ? best[best.length - 1].angle_to_wind : 90;
      return {
        ids: new Set(best.map((s) => s.id)),
        cutoffAngle,
      };
    };

    const portBest = getBestAttemptIds(portSegments);
    const starboardBest = getBestAttemptIds(starboardSegments);

    return {
      bestIds: new Set([...portBest.ids, ...starboardBest.ids]),
      portCutoff: portBest.cutoffAngle,
      starboardCutoff: starboardBest.cutoffAngle,
      portCount: portBest.ids.size,
      starboardCount: starboardBest.ids.size,
      portTotal: portSegments.length,
      starboardTotal: starboardSegments.length,
    };
  }, [segments, excludedSegmentIds, bestAttemptsFraction]);

  // Process upwind segments for display
  const polarData = useMemo(() => {
    const upwindSegments = segments.filter((s) => s.direction === 'Upwind');
    return upwindSegments.map((segment) => ({
      ...segment,
      isExcluded: excludedSegmentIds.has(segment.id),
      isHovered: hoveredSegmentId === segment.id,
      isBestAttempt: bestAttemptsInfo.bestIds.has(segment.id),
    }));
  }, [segments, excludedSegmentIds, hoveredSegmentId, bestAttemptsInfo]);

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
          ↑ Wind {Math.round(windDirection)}°
        </text>

        {/* Best attempts threshold arcs - show the cutoff angle for each tack */}
        {bestAttemptsInfo.portTotal > 0 && (
          <g>
            {/* Port side arc (left side of plot) */}
            <path
              d={(() => {
                const startAngle = 0;
                const endAngle = -bestAttemptsInfo.portCutoff;
                const startRad = ((startAngle - 90) * Math.PI) / 180;
                const endRad = ((endAngle - 90) * Math.PI) / 180;
                const x1 = centerX + Math.cos(startRad) * maxRadius;
                const y1 = centerY + Math.sin(startRad) * maxRadius;
                const x2 = centerX + Math.cos(endRad) * maxRadius;
                const y2 = centerY + Math.sin(endRad) * maxRadius;
                return `M ${centerX} ${centerY} L ${x1} ${y1} A ${maxRadius} ${maxRadius} 0 0 0 ${x2} ${y2} Z`;
              })()}
              fill="#3B82F6"
              fillOpacity="0.08"
              stroke="#3B82F6"
              strokeWidth="1.5"
              strokeDasharray="4 2"
              strokeOpacity="0.5"
            >
              <title>Port tacks inside {bestAttemptsInfo.portCutoff.toFixed(0)}° used in VMG calculation</title>
            </path>
            {/* Port threshold label */}
            <text
              x={centerX - Math.cos(((bestAttemptsInfo.portCutoff - 90) * Math.PI) / 180) * (maxRadius + 24)}
              y={centerY + Math.sin(((bestAttemptsInfo.portCutoff - 90) * Math.PI) / 180) * (maxRadius + 24)}
              textAnchor="middle"
              fontSize="8"
              fill="#3B82F6"
              fontWeight="500"
            >
              {bestAttemptsInfo.portCutoff.toFixed(0)}°
            </text>
          </g>
        )}
        {bestAttemptsInfo.starboardTotal > 0 && (
          <g>
            {/* Starboard side arc (right side of plot) */}
            <path
              d={(() => {
                const startAngle = 0;
                const endAngle = bestAttemptsInfo.starboardCutoff;
                const startRad = ((startAngle - 90) * Math.PI) / 180;
                const endRad = ((endAngle - 90) * Math.PI) / 180;
                const x1 = centerX + Math.cos(startRad) * maxRadius;
                const y1 = centerY + Math.sin(startRad) * maxRadius;
                const x2 = centerX + Math.cos(endRad) * maxRadius;
                const y2 = centerY + Math.sin(endRad) * maxRadius;
                return `M ${centerX} ${centerY} L ${x1} ${y1} A ${maxRadius} ${maxRadius} 0 0 1 ${x2} ${y2} Z`;
              })()}
              fill="#10B981"
              fillOpacity="0.08"
              stroke="#10B981"
              strokeWidth="1.5"
              strokeDasharray="4 2"
              strokeOpacity="0.5"
            >
              <title>Starboard tacks inside {bestAttemptsInfo.starboardCutoff.toFixed(0)}° used in VMG calculation</title>
            </path>
            {/* Starboard threshold label */}
            <text
              x={centerX + Math.cos(((bestAttemptsInfo.starboardCutoff - 90) * Math.PI) / 180) * (maxRadius + 24)}
              y={centerY + Math.sin(((bestAttemptsInfo.starboardCutoff - 90) * Math.PI) / 180) * (maxRadius + 24)}
              textAnchor="middle"
              fontSize="8"
              fill="#10B981"
              fontWeight="500"
            >
              {bestAttemptsInfo.starboardCutoff.toFixed(0)}°
            </text>
          </g>
        )}

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

            // Colors - best attempts are bright, others are dimmed
            let fill = segment.tack === 'Port' ? '#3B82F6' : '#10B981';
            let opacity = segment.isBestAttempt ? 1 : 0.35;
            let strokeWidth = 1;
            let stroke = segment.isBestAttempt ? 'white' : 'transparent';

            if (segment.isExcluded) {
              fill = '#9CA3AF';
              opacity = 0.25;
              stroke = 'transparent';
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
              />
            );
          })}

        {/* Center dot */}
        <circle cx={centerX} cy={centerY} r="2" fill="#6B7280" />
      </svg>

      {/* Legend and Controls */}
      <TooltipProvider delayDuration={300}>
        <div className="flex flex-col gap-1 mt-1">
          {/* Tack legend */}
          <div className="flex justify-center gap-4">
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              <span className="text-xs text-slate-600">Port</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
              <span className="text-xs text-slate-600">Starboard</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-full bg-gray-400 opacity-50" />
              <span className="text-xs text-slate-600">Excluded</span>
            </div>
          </div>

          {/* Explanatory blurb */}
          <p className="text-xs text-slate-500 text-center px-2">
            Bright dots = your tightest upwind angles. Legs inside the shaded zone count toward Best VMG.
          </p>

          {/* Best attempts control */}
          {onBestAttemptsFractionChange && (
            <div className="flex items-center justify-center gap-2 pt-1 border-t border-slate-100 mt-1">
              <span className="text-xs text-slate-500">Upwind % for VMG:</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => onBestAttemptsFractionChange(Math.max(0.2, bestAttemptsFraction - 0.1))}
                    disabled={bestAttemptsFraction <= 0.2}
                    className="p-0.5 rounded hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <Minus className="h-3.5 w-3.5 text-slate-600" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>Be more selective (fewer segments)</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-xs font-medium text-slate-700 min-w-[3rem] text-center cursor-help">
                    Top {Math.round(bestAttemptsFraction * 100)}%
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[200px]">
                  <p>Only the tightest {Math.round(bestAttemptsFraction * 100)}% of upwind angles per tack are used for VMG</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => onBestAttemptsFractionChange(Math.min(1.0, bestAttemptsFraction + 0.1))}
                    disabled={bestAttemptsFraction >= 1.0}
                    className="p-0.5 rounded hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <Plus className="h-3.5 w-3.5 text-slate-600" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>Be less selective (more segments)</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-xs text-slate-400 cursor-help">
                    ({bestAttemptsInfo.portCount + bestAttemptsInfo.starboardCount} of{' '}
                    {bestAttemptsInfo.portTotal + bestAttemptsInfo.starboardTotal})
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>{bestAttemptsInfo.portCount + bestAttemptsInfo.starboardCount} segments included out of {bestAttemptsInfo.portTotal + bestAttemptsInfo.starboardTotal} total upwind legs</p>
                </TooltipContent>
              </Tooltip>
            </div>
          )}
        </div>
      </TooltipProvider>
    </div>
  );
}
