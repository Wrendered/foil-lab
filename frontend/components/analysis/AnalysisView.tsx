'use client';

import { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { TrackMap } from './TrackMap';
import { LinkedPolarPlot } from './LinkedPolarPlot';
import { SegmentList } from './SegmentList';
import { AnalysisResult } from '@/lib/api-client';
import { GPSPoint } from '@/lib/gpx-parser';
import { useViewStore } from '@/stores/viewStore';
import { Settings } from 'lucide-react';

interface AnalysisViewProps {
  result: AnalysisResult;
  gpsData: GPSPoint[];
  filename: string;
  onOpenSettings?: () => void;
}

export function AnalysisView({ result, gpsData, filename, onOpenSettings }: AnalysisViewProps) {
  const excludedSegmentIds = useViewStore((state) => state.excludedSegmentIds);

  // Calculate stats from active segments only
  const stats = useMemo(() => {
    const upwindSegments = result.segments.filter((s) => s.direction === 'Upwind');
    const activeSegments = upwindSegments.filter((s) => !excludedSegmentIds.has(s.id));

    if (activeSegments.length === 0) {
      return {
        avgSpeed: 0,
        bestVMG: 0,
        bestVMGAngle: 0,
        activeCount: 0,
        totalCount: upwindSegments.length,
        totalDistance: 0,
      };
    }

    // Calculate VMG for each segment
    const segmentsWithVMG = activeSegments.map((s) => ({
      ...s,
      vmg: s.avg_speed_knots * Math.cos((s.angle_to_wind * Math.PI) / 180),
    }));

    const totalDistance = activeSegments.reduce((sum, s) => sum + s.distance, 0);
    const weightedSpeed = activeSegments.reduce((sum, s) => sum + s.avg_speed_knots * s.distance, 0) / totalDistance;

    const bestVMGSegment = segmentsWithVMG.reduce((best, s) => (s.vmg > best.vmg ? s : best), segmentsWithVMG[0]);

    return {
      avgSpeed: weightedSpeed,
      bestVMG: bestVMGSegment.vmg,
      bestVMGAngle: bestVMGSegment.angle_to_wind,
      activeCount: activeSegments.length,
      totalCount: upwindSegments.length,
      totalDistance,
    };
  }, [result.segments, excludedSegmentIds]);

  const windDirection = result.wind_estimate.direction;

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-slate-800 truncate">{filename}</h2>
          <span className="text-sm text-slate-500">
            Wind: {windDirection}° ({result.wind_estimate.confidence})
          </span>
        </div>
        {onOpenSettings && (
          <button
            onClick={onOpenSettings}
            className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            title="Detection settings"
          >
            <Settings className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Main content - Map and Right Panel side by side */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-3 min-h-0">
        {/* Left: Map */}
        <Card className="overflow-hidden">
          <TrackMap gpsData={gpsData} segments={result.segments} windDirection={windDirection} className="h-full" />
        </Card>

        {/* Right: Polar + Segments */}
        <div className="flex flex-col gap-3 min-h-0">
          {/* Polar Plot */}
          <Card className="p-3 flex-shrink-0">
            <LinkedPolarPlot segments={result.segments} windDirection={windDirection} />
          </Card>

          {/* Segment List */}
          <Card className="flex-1 min-h-0 overflow-hidden flex flex-col">
            <SegmentList segments={result.segments} className="h-full" />
          </Card>
        </div>
      </div>

      {/* Stats Bar */}
      <Card className="p-3 flex-shrink-0">
        <div className="flex items-center justify-around text-center">
          <div>
            <div className="text-xs text-slate-500 uppercase tracking-wide">Best VMG</div>
            <div className="text-lg font-bold text-blue-600">
              {stats.bestVMG.toFixed(1)} kn
              <span className="text-sm font-normal text-slate-500 ml-1">@ {stats.bestVMGAngle.toFixed(0)}°</span>
            </div>
          </div>
          <div className="h-8 w-px bg-slate-200" />
          <div>
            <div className="text-xs text-slate-500 uppercase tracking-wide">Avg Speed</div>
            <div className="text-lg font-bold text-green-600">{stats.avgSpeed.toFixed(1)} kn</div>
          </div>
          <div className="h-8 w-px bg-slate-200" />
          <div>
            <div className="text-xs text-slate-500 uppercase tracking-wide">Segments</div>
            <div className="text-lg font-bold text-slate-700">
              {stats.activeCount}
              <span className="text-sm font-normal text-slate-500">/{stats.totalCount}</span>
            </div>
          </div>
          <div className="h-8 w-px bg-slate-200" />
          <div>
            <div className="text-xs text-slate-500 uppercase tracking-wide">Distance</div>
            <div className="text-lg font-bold text-slate-700">{(stats.totalDistance / 1000).toFixed(2)} km</div>
          </div>
        </div>
      </Card>
    </div>
  );
}
