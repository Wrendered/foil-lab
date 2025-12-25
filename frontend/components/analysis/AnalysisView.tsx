'use client';

import { useMemo, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { TrackMap } from './TrackMap';
import { LinkedPolarPlot } from './LinkedPolarPlot';
import { SegmentList } from './SegmentList';
import { AnalysisResult, TrackSegment } from '@/lib/api-client';
import { GPSPoint } from '@/lib/gpx-parser';
import { useViewStore } from '@/stores/viewStore';
import { Settings, Minus, Plus, RotateCcw } from 'lucide-react';

interface AnalysisViewProps {
  result: AnalysisResult;
  gpsData: GPSPoint[];
  filename: string;
  onOpenSettings?: () => void;
}

// Recalculate angle_to_wind for segments based on new wind direction
function recalculateSegmentAngles(segments: TrackSegment[], windDirection: number): TrackSegment[] {
  return segments.map((s) => {
    // Calculate angle between bearing and wind
    let angleToWind = Math.abs(s.bearing - windDirection);
    if (angleToWind > 180) angleToWind = 360 - angleToWind;

    // Determine if upwind or downwind based on new angle
    const isUpwind = angleToWind <= 90;

    return {
      ...s,
      angle_to_wind: angleToWind,
      direction: isUpwind ? 'Upwind' : 'Downwind',
    } as TrackSegment;
  });
}

export function AnalysisView({ result, gpsData, filename, onOpenSettings }: AnalysisViewProps) {
  const excludedSegmentIds = useViewStore((state) => state.excludedSegmentIds);
  const adjustedWindDirection = useViewStore((state) => state.adjustedWindDirection);
  const setWindDirection = useViewStore((state) => state.setWindDirection);

  // Original calculated wind
  const calculatedWind = Math.round(result.wind_estimate.direction);

  // Effective wind direction (adjusted or calculated)
  const effectiveWind = adjustedWindDirection !== null ? adjustedWindDirection : calculatedWind;

  // Reset adjusted wind when result changes (new file analyzed)
  useEffect(() => {
    setWindDirection(null);
  }, [result, setWindDirection]);

  // Recalculate segments with effective wind direction
  const adjustedSegments = useMemo(() => {
    if (adjustedWindDirection === null) {
      return result.segments; // Use original segments
    }
    return recalculateSegmentAngles(result.segments, adjustedWindDirection);
  }, [result.segments, adjustedWindDirection]);

  // Calculate stats from active segments only (using adjusted segments)
  const stats = useMemo(() => {
    const upwindSegments = adjustedSegments.filter((s) => s.direction === 'Upwind');
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
  }, [adjustedSegments, excludedSegmentIds]);

  const isWindAdjusted = adjustedWindDirection !== null;

  const handleWindChange = (delta: number) => {
    const newWind = ((effectiveWind + delta) % 360 + 360) % 360;
    setWindDirection(newWind);
  };

  const handleResetWind = () => {
    setWindDirection(null);
  };

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-slate-800 truncate">{filename}</h2>

          {/* Wind direction control */}
          <div className="flex items-center gap-1.5 bg-slate-100 rounded-lg px-2 py-1">
            <span className="text-sm text-slate-600">Wind:</span>
            <button
              onClick={() => handleWindChange(-2)}
              className="p-1 hover:bg-slate-200 rounded transition-colors"
              title="Decrease 2°"
            >
              <Minus className="h-3.5 w-3.5 text-slate-600" />
            </button>
            <span className={`text-sm font-medium min-w-[3rem] text-center ${isWindAdjusted ? 'text-blue-600' : 'text-slate-700'}`}>
              {effectiveWind}°
            </span>
            <button
              onClick={() => handleWindChange(2)}
              className="p-1 hover:bg-slate-200 rounded transition-colors"
              title="Increase 2°"
            >
              <Plus className="h-3.5 w-3.5 text-slate-600" />
            </button>
            {isWindAdjusted && (
              <button
                onClick={handleResetWind}
                className="p-1 hover:bg-slate-200 rounded transition-colors ml-1"
                title={`Reset to calculated (${calculatedWind}°)`}
              >
                <RotateCcw className="h-3.5 w-3.5 text-slate-500" />
              </button>
            )}
          </div>
          {isWindAdjusted && (
            <span className="text-xs text-slate-400">
              (calc: {calculatedWind}°)
            </span>
          )}
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
          <TrackMap gpsData={gpsData} segments={adjustedSegments} windDirection={effectiveWind} className="h-full" />
        </Card>

        {/* Right: Polar + Segments */}
        <div className="flex flex-col gap-3 min-h-0">
          {/* Polar Plot */}
          <Card className="p-3 flex-shrink-0">
            <LinkedPolarPlot segments={adjustedSegments} windDirection={effectiveWind} />
          </Card>

          {/* Segment List */}
          <Card className="flex-1 min-h-0 overflow-hidden flex flex-col">
            <SegmentList segments={adjustedSegments} className="h-full" />
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
