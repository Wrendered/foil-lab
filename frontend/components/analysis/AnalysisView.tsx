'use client';

import { useMemo, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { TrackMap } from './TrackMap';
import { LinkedPolarPlot } from './LinkedPolarPlot';
import { SegmentList } from './SegmentList';
import { FilterControls } from './FilterControls';
import { AnalysisResult, TrackSegment } from '@/lib/api-client';
import { GPSPoint } from '@/lib/gpx-parser';
import { useViewStore } from '@/stores/viewStore';
import { useUploadStore } from '@/stores/uploadStore';
import { useAnalysisStore } from '@/stores/analysisStore';
import { Settings, Minus, Plus, RotateCcw, Pencil } from 'lucide-react';

interface AnalysisViewProps {
  result: AnalysisResult;
  gpsData: GPSPoint[];
  filename: string;
  fileId: string;
  displayName?: string;
  windSpeed?: number;
  onOpenSettings?: () => void;
  onReanalyzeWithFilters?: () => void;
  isAnalyzing?: boolean;
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

export function AnalysisView({ result, gpsData, filename, fileId, displayName, windSpeed, onOpenSettings, onReanalyzeWithFilters, isAnalyzing }: AnalysisViewProps) {
  const excludedSegmentIds = useViewStore((state) => state.excludedSegmentIds);
  const adjustedWindDirection = useViewStore((state) => state.adjustedWindDirection);
  const setWindDirection = useViewStore((state) => state.setWindDirection);
  const setDisplayName = useUploadStore((state) => state.setDisplayName);
  const setFileWindData = useUploadStore((state) => state.setFileWindData);

  // Best attempts fraction from analysis store (for polar plot visualization)
  const bestAttemptsFraction = useAnalysisStore((state) => state.parameters.bestAttemptsFraction);
  const updateParameters = useAnalysisStore((state) => state.updateParameters);

  const handleBestAttemptsFractionChange = (fraction: number) => {
    updateParameters({ bestAttemptsFraction: fraction });
  };

  // Editable name state
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState(displayName || filename.replace('.gpx', ''));

  // Editable wind speed state
  const [isEditingWindSpeed, setIsEditingWindSpeed] = useState(false);
  const [editWindSpeed, setEditWindSpeed] = useState(windSpeed?.toFixed(0) || '');

  // Sync editable values when props change (and not currently editing)
  useEffect(() => {
    if (!isEditingName) {
      setEditName(displayName || filename.replace('.gpx', ''));
    }
  }, [displayName, filename, isEditingName]);

  useEffect(() => {
    if (!isEditingWindSpeed) {
      setEditWindSpeed(windSpeed?.toFixed(0) || '');
    }
  }, [windSpeed, isEditingWindSpeed]);

  const handleSaveName = () => {
    setDisplayName(fileId, editName);
    setIsEditingName(false);
  };

  const handleSaveWindSpeed = () => {
    const parsed = parseFloat(editWindSpeed);
    if (!isNaN(parsed) && parsed >= 0) {
      const currentWindDir = adjustedWindDirection ?? Math.round(result.wind_estimate.direction);
      setFileWindData(fileId, currentWindDir, parsed);
    }
    setIsEditingWindSpeed(false);
  };

  // Original calculated wind
  const calculatedWind = Math.round(result.wind_estimate.direction);

  // Effective wind direction (adjusted or calculated)
  const effectiveWind = adjustedWindDirection !== null ? adjustedWindDirection : calculatedWind;

  // Note: viewStore reset is handled by page.tsx when switching tracks or re-analyzing

  // Recalculate segments with effective wind direction
  const adjustedSegments = useMemo(() => {
    if (adjustedWindDirection === null) {
      return result.segments; // Use original segments
    }
    return recalculateSegmentAngles(result.segments, adjustedWindDirection);
  }, [result.segments, adjustedWindDirection]);

  // Best attempts fraction is now managed via the analysis store (see line ~60)
  // This allows the polar plot controls and stats bar to stay in sync

  // Calculate stats from active segments only (using adjusted segments)
  const stats = useMemo(() => {
    const upwindSegments = adjustedSegments.filter((s) => s.direction === 'Upwind');
    const activeSegments = upwindSegments.filter((s) => !excludedSegmentIds.has(s.id));

    if (activeSegments.length === 0) {
      return {
        avgSpeed: 0,
        bestVMG: 0,
        bestVMGAngle: 0,
        sessionVMG: 0,
        sessionAngle: 0,
        bestAttemptsVMG: 0,
        bestAttemptsAngle: 0,
        bestAttemptsCount: 0,
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

    // Guard against division by zero - use simple average as fallback
    const weightedSpeed = totalDistance > 0
      ? activeSegments.reduce((sum, s) => sum + s.avg_speed_knots * s.distance, 0) / totalDistance
      : activeSegments.reduce((sum, s) => sum + s.avg_speed_knots, 0) / activeSegments.length;

    const bestVMGSegment = segmentsWithVMG.reduce((best, s) => (s.vmg > best.vmg ? s : best), segmentsWithVMG[0]);

    // Session VMG: distance-weighted average of ALL active upwind segments
    const sessionVMG = totalDistance > 0
      ? segmentsWithVMG.reduce((sum, s) => sum + s.vmg * s.distance, 0) / totalDistance
      : segmentsWithVMG.reduce((sum, s) => sum + s.vmg, 0) / segmentsWithVMG.length;
    const sessionAngle = totalDistance > 0
      ? segmentsWithVMG.reduce((sum, s) => sum + s.angle_to_wind * s.distance, 0) / totalDistance
      : segmentsWithVMG.reduce((sum, s) => sum + s.angle_to_wind, 0) / segmentsWithVMG.length;

    // Best Attempts VMG: average of top N% tightest angles per tack
    // Split by tack first
    const portSegments = segmentsWithVMG.filter((s) => s.tack === 'Port');
    const starboardSegments = segmentsWithVMG.filter((s) => s.tack === 'Starboard');

    // Get best attempts from each tack (top N% tightest angles, min 3)
    const getBestAttempts = (tack: typeof portSegments) => {
      if (tack.length === 0) return [];
      const minCount = 3;
      const sortedByAngle = [...tack].sort((a, b) => a.angle_to_wind - b.angle_to_wind);
      const count = Math.max(minCount, Math.floor(tack.length * bestAttemptsFraction));
      return sortedByAngle.slice(0, Math.min(count, tack.length));
    };

    const portBest = getBestAttempts(portSegments);
    const starboardBest = getBestAttempts(starboardSegments);
    const bestAttempts = [...portBest, ...starboardBest];

    let bestAttemptsVMG = 0;
    let bestAttemptsAngle = 0;
    const bestAttemptsCount = bestAttempts.length;

    if (bestAttempts.length > 0) {
      const bestTotalDist = bestAttempts.reduce((sum, s) => sum + s.distance, 0);
      bestAttemptsVMG = bestTotalDist > 0
        ? bestAttempts.reduce((sum, s) => sum + s.vmg * s.distance, 0) / bestTotalDist
        : bestAttempts.reduce((sum, s) => sum + s.vmg, 0) / bestAttempts.length;
      bestAttemptsAngle = bestTotalDist > 0
        ? bestAttempts.reduce((sum, s) => sum + s.angle_to_wind * s.distance, 0) / bestTotalDist
        : bestAttempts.reduce((sum, s) => sum + s.angle_to_wind, 0) / bestAttempts.length;
    }

    return {
      avgSpeed: weightedSpeed,
      bestVMG: bestVMGSegment.vmg,
      bestVMGAngle: bestVMGSegment.angle_to_wind,
      sessionVMG,
      sessionAngle,
      bestAttemptsVMG,
      bestAttemptsAngle,
      bestAttemptsCount,
      activeCount: activeSegments.length,
      totalCount: upwindSegments.length,
      totalDistance,
    };
  }, [adjustedSegments, excludedSegmentIds, bestAttemptsFraction]);

  const isWindAdjusted = adjustedWindDirection !== null;

  const handleWindChange = (delta: number) => {
    const newWind = ((effectiveWind + delta) % 360 + 360) % 360;
    setWindDirection(newWind);
    // Persist to uploadStore so it survives track switching
    setFileWindData(fileId, newWind, windSpeed);
  };

  const handleResetWind = () => {
    setWindDirection(null);
  };

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-3">
          {/* Editable track name */}
          {isEditingName ? (
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={handleSaveName}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveName();
                if (e.key === 'Escape') {
                  setEditName(displayName || filename.replace('.gpx', ''));
                  setIsEditingName(false);
                }
              }}
              autoFocus
              className="text-lg font-semibold px-2 py-0.5 border rounded min-w-[200px]"
            />
          ) : (
            <div className="flex items-center gap-1 group">
              <h2 className="text-lg font-semibold text-slate-800 truncate">
                {displayName || filename.replace('.gpx', '')}
              </h2>
              <button
                onClick={() => setIsEditingName(true)}
                className="p-1 opacity-0 group-hover:opacity-100 hover:bg-slate-200 rounded transition-opacity"
                title="Edit name"
              >
                <Pencil className="h-3.5 w-3.5 text-slate-400" />
              </button>
            </div>
          )}

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

          {/* Wind speed (editable) */}
          {isEditingWindSpeed ? (
            <div className="flex items-center gap-1 text-sm">
              <input
                type="number"
                value={editWindSpeed}
                onChange={(e) => setEditWindSpeed(e.target.value)}
                onBlur={handleSaveWindSpeed}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveWindSpeed();
                  if (e.key === 'Escape') {
                    setEditWindSpeed(windSpeed?.toFixed(0) || '');
                    setIsEditingWindSpeed(false);
                  }
                }}
                autoFocus
                className="w-14 px-1 py-0.5 border rounded text-center"
                min="0"
                step="1"
              />
              <span className="text-slate-500">kts</span>
            </div>
          ) : (
            <span
              className="text-sm text-slate-500 cursor-pointer hover:bg-slate-100 rounded px-1.5 py-0.5 group"
              onClick={() => {
                setEditWindSpeed(windSpeed?.toFixed(0) || '');
                setIsEditingWindSpeed(true);
              }}
              title="Click to edit wind speed"
            >
              {windSpeed ? `${windSpeed.toFixed(0)} kts` : 'speed?'}
              <Pencil className="inline h-3 w-3 ml-1 text-slate-400 opacity-0 group-hover:opacity-100" />
            </span>
          )}

          {isWindAdjusted && (
            <span className="text-xs text-slate-400">
              (calc: {calculatedWind}°)
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
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
      </div>

      {/* Main content - Map and Right Panel side by side */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-3 min-h-0">
        {/* Left: Map with time filter */}
        <Card className="overflow-hidden flex flex-col">
          <div className="flex-1 min-h-0">
            <TrackMap gpsData={gpsData} segments={adjustedSegments} windDirection={effectiveWind} className="h-full" />
          </div>
          {onReanalyzeWithFilters && (
            <FilterControls
              gpsData={gpsData}
              onApplyFilters={onReanalyzeWithFilters}
              disabled={isAnalyzing}
            />
          )}
        </Card>

        {/* Right: Polar + Segments */}
        <div className="flex flex-col gap-3 min-h-0">
          {/* Polar Plot */}
          <Card className="p-3 flex-shrink-0">
            <LinkedPolarPlot
              segments={adjustedSegments}
              windDirection={effectiveWind}
              bestAttemptsFraction={bestAttemptsFraction}
              onBestAttemptsFractionChange={handleBestAttemptsFractionChange}
            />
          </Card>

          {/* Segment List */}
          <Card className="flex-1 min-h-0 overflow-hidden flex flex-col">
            <SegmentList segments={adjustedSegments} className="h-full" />
          </Card>
        </div>
      </div>

      {/* Stats Bar */}
      <Card className="p-3 flex-shrink-0">
        <TooltipProvider delayDuration={100}>
          <div className="flex items-center justify-around text-center">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="cursor-help">
                  <div className="text-xs text-slate-500 uppercase tracking-wide">Best Attempts VMG</div>
                  <div className="text-lg font-bold text-blue-600">
                    {stats.bestAttemptsVMG.toFixed(1)} kn
                    <span className="text-sm font-normal text-slate-500 ml-1">@ {stats.bestAttemptsAngle.toFixed(0)}°</span>
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="font-medium">Best Attempts VMG</p>
                <p className="text-xs mt-1">
                  VMG from only your best pointing segments (top {Math.round(bestAttemptsFraction * 100)}%
                  tightest angles per tack). Represents your peak upwind performance when you were
                  really trying to sail close to the wind.
                </p>
                <p className="text-xs mt-1 text-muted-foreground">
                  Using {stats.bestAttemptsCount} of {stats.activeCount} upwind segments
                </p>
              </TooltipContent>
            </Tooltip>
            <div className="h-8 w-px bg-slate-200" />
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="cursor-help">
                  <div className="text-xs text-slate-500 uppercase tracking-wide">Session VMG</div>
                  <div className="text-lg font-bold text-purple-600">
                    {stats.sessionVMG.toFixed(1)} kn
                    <span className="text-sm font-normal text-slate-500 ml-1">@ {stats.sessionAngle.toFixed(0)}°</span>
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="font-medium">Session VMG</p>
                <p className="text-xs mt-1">
                  VMG averaged across all your upwind segments. Includes cruising, transitions,
                  and suboptimal angles. Represents your overall upwind performance for the session.
                </p>
                <p className="text-xs mt-1 text-muted-foreground">
                  Averaged from {stats.activeCount} upwind segments
                </p>
              </TooltipContent>
            </Tooltip>
            <div className="h-8 w-px bg-slate-200" />
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="cursor-help">
                  <div className="text-xs text-slate-500 uppercase tracking-wide">Peak VMG</div>
                  <div className="text-lg font-bold text-green-600">
                    {stats.bestVMG.toFixed(1)} kn
                    <span className="text-sm font-normal text-slate-500 ml-1">@ {stats.bestVMGAngle.toFixed(0)}°</span>
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="font-medium">Peak VMG</p>
                <p className="text-xs mt-1">
                  Your single highest VMG from one segment. This is your absolute best
                  instantaneous upwind performance during this session.
                </p>
              </TooltipContent>
            </Tooltip>
            <div className="h-8 w-px bg-slate-200" />
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="cursor-help">
                  <div className="text-xs text-slate-500 uppercase tracking-wide">Avg Speed</div>
                  <div className="text-lg font-bold text-amber-600">{stats.avgSpeed.toFixed(1)} kn</div>
                </div>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="font-medium">Average Upwind Speed</p>
                <p className="text-xs mt-1">
                  Distance-weighted average speed across all upwind segments.
                  Longer segments contribute more to this average.
                </p>
              </TooltipContent>
            </Tooltip>
            <div className="h-8 w-px bg-slate-200" />
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="cursor-help">
                  <div className="text-xs text-slate-500 uppercase tracking-wide">Segments</div>
                  <div className="text-lg font-bold text-slate-700">
                    {stats.activeCount}
                    <span className="text-sm font-normal text-slate-500">/{stats.totalCount}</span>
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="font-medium">Upwind Segments</p>
                <p className="text-xs mt-1">
                  Number of consistent upwind stretches detected. Active segments are those
                  not manually excluded. Click segments in the list to exclude/include them.
                </p>
              </TooltipContent>
            </Tooltip>
            <div className="h-8 w-px bg-slate-200" />
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="cursor-help">
                  <div className="text-xs text-slate-500 uppercase tracking-wide">Distance</div>
                  <div className="text-lg font-bold text-slate-700">{(stats.totalDistance / 1000).toFixed(2)} km</div>
                </div>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="font-medium">Upwind Distance</p>
                <p className="text-xs mt-1">
                  Total distance covered in upwind segments. This is the actual distance
                  sailed, not straight-line distance made good.
                </p>
              </TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      </Card>
    </div>
  );
}
