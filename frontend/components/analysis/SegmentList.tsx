'use client';

import { TrackSegment } from '@/lib/api-client';
import { useViewStore } from '@/stores/viewStore';
import { cn } from '@/lib/utils';

interface SegmentListProps {
  segments: TrackSegment[];
  className?: string;
}

export function SegmentList({ segments, className }: SegmentListProps) {
  const hoveredSegmentId = useViewStore((state) => state.hoveredSegmentId);
  const excludedSegmentIds = useViewStore((state) => state.excludedSegmentIds);
  const setHoveredSegment = useViewStore((state) => state.setHoveredSegment);
  const toggleSegmentExclusion = useViewStore((state) => state.toggleSegmentExclusion);

  // Filter to upwind segments only for now
  const upwindSegments = segments.filter((s) => s.direction === 'Upwind');
  const activeCount = upwindSegments.filter((s) => !excludedSegmentIds.has(s.id)).length;

  return (
    <div className={cn('flex flex-col', className)}>
      <div className="flex items-center justify-between px-3 py-2 border-b bg-slate-50">
        <span className="text-sm font-medium text-slate-700">
          Upwind Segments
        </span>
        <span className="text-xs text-slate-500">
          {activeCount}/{upwindSegments.length} active
        </span>
      </div>

      <div className="overflow-y-auto flex-1">
        {upwindSegments.length === 0 ? (
          <div className="p-4 text-center text-sm text-slate-500">
            No upwind segments detected
          </div>
        ) : (
          <div className="divide-y">
            {upwindSegments.map((segment) => {
              const isExcluded = excludedSegmentIds.has(segment.id);
              const isHovered = hoveredSegmentId === segment.id;

              return (
                <div
                  key={segment.id}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors',
                    isHovered && 'bg-blue-50',
                    isExcluded && 'opacity-50'
                  )}
                  onMouseEnter={() => setHoveredSegment(segment.id)}
                  onMouseLeave={() => setHoveredSegment(null)}
                  onClick={() => toggleSegmentExclusion(segment.id)}
                >
                  {/* Checkbox */}
                  <input
                    type="checkbox"
                    checked={!isExcluded}
                    onChange={() => {}} // Handled by parent onClick
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />

                  {/* Tack indicator */}
                  <div
                    className={cn(
                      'w-2 h-2 rounded-full flex-shrink-0',
                      segment.tack === 'Port' ? 'bg-blue-500' : 'bg-green-500'
                    )}
                  />

                  {/* Tack label */}
                  <span
                    className={cn(
                      'text-xs font-medium w-10',
                      segment.tack === 'Port' ? 'text-blue-700' : 'text-green-700'
                    )}
                  >
                    {segment.tack === 'Port' ? 'Port' : 'Stbd'}
                  </span>

                  {/* Angle */}
                  <span className="text-sm text-slate-700 w-10 text-right">
                    {segment.angle_to_wind.toFixed(0)}°
                  </span>

                  {/* Speed */}
                  <span className="text-sm font-medium text-slate-900 w-14 text-right">
                    {segment.avg_speed_knots.toFixed(1)}kn
                  </span>

                  {/* Distance */}
                  <span className="text-xs text-slate-500 w-12 text-right">
                    {segment.distance.toFixed(0)}m
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
