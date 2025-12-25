'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useUploadStore } from '@/stores/uploadStore';
import { formatSpeed } from '@/lib/colors';
import { ComparisonPolarPlot, ComparisonTrack, TRACK_COLORS } from '@/components/analysis/ComparisonPolarPlot';
import { cn } from '@/lib/utils';

const MAX_TRACKS = 4;

export function ComparisonView() {
  const { files } = useUploadStore();
  const [selectedTrackIds, setSelectedTrackIds] = useState<Set<string>>(new Set());
  const [hoveredTrackId, setHoveredTrackId] = useState<string | null>(null);

  // Get all analyzed files
  const analyzedFiles = useMemo(() => {
    return files.filter((f) => f.status === 'completed' && f.result);
  }, [files]);

  // Auto-select first 2 tracks on mount if none selected
  useMemo(() => {
    if (selectedTrackIds.size === 0 && analyzedFiles.length >= 2) {
      setSelectedTrackIds(new Set(analyzedFiles.slice(0, 2).map((f) => f.id)));
    }
  }, [analyzedFiles.length]); // Only run when file count changes

  // Toggle track selection
  const toggleTrack = (trackId: string) => {
    setSelectedTrackIds((prev) => {
      const next = new Set(prev);
      if (next.has(trackId)) {
        next.delete(trackId);
      } else if (next.size < MAX_TRACKS) {
        next.add(trackId);
      }
      return next;
    });
  };

  // Build comparison tracks for polar plot
  const comparisonTracks: ComparisonTrack[] = useMemo(() => {
    let colorIndex = 0;
    return analyzedFiles
      .filter((f) => selectedTrackIds.has(f.id))
      .map((f) => ({
        id: f.id,
        name: f.name,
        segments: f.result?.segments || [],
        windDirection: f.result?.wind_estimate?.direction || 0,
        colorIndex: colorIndex++,
      }));
  }, [analyzedFiles, selectedTrackIds]);

  // Calculate aggregate stats for selected tracks
  const aggregateStats = useMemo(() => {
    if (comparisonTracks.length === 0) return null;

    const selectedFiles = analyzedFiles.filter((f) => selectedTrackIds.has(f.id));
    const allResults = selectedFiles.map((f) => f.result).filter((r) => r !== undefined);

    const vmgValues = allResults
      .map((r) => r.performance_metrics?.vmg_upwind)
      .filter((v): v is number => v !== null && v !== undefined);

    const avgVMG = vmgValues.length > 0 ? vmgValues.reduce((a, b) => a + b, 0) / vmgValues.length : null;
    const bestVMG = vmgValues.length > 0 ? Math.max(...vmgValues) : null;

    const speedValues = allResults
      .map((r) => r.performance_metrics?.avg_speed)
      .filter((v): v is number => v !== null && v !== undefined);

    const avgSpeed = speedValues.length > 0 ? speedValues.reduce((a, b) => a + b, 0) / speedValues.length : null;

    return { avgVMG, bestVMG, avgSpeed, trackCount: comparisonTracks.length };
  }, [analyzedFiles, selectedTrackIds, comparisonTracks.length]);

  if (analyzedFiles.length < 2) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-gray-500">Upload and analyze at least 2 tracks to compare</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Track Selection */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">
            Select Tracks to Compare ({selectedTrackIds.size}/{MAX_TRACKS})
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 gap-2">
            {analyzedFiles.map((file, idx) => {
              const isSelected = selectedTrackIds.has(file.id);
              const isDisabled = !isSelected && selectedTrackIds.size >= MAX_TRACKS;
              const colorIndex = comparisonTracks.findIndex((t) => t.id === file.id);
              const color = colorIndex >= 0 ? TRACK_COLORS[colorIndex] : null;

              return (
                <label
                  key={file.id}
                  className={cn(
                    'flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors',
                    isSelected ? 'bg-slate-100' : 'hover:bg-slate-50',
                    isDisabled && 'opacity-50 cursor-not-allowed',
                    hoveredTrackId === file.id && 'ring-2 ring-yellow-400'
                  )}
                  onMouseEnter={() => isSelected && setHoveredTrackId(file.id)}
                  onMouseLeave={() => setHoveredTrackId(null)}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => !isDisabled && toggleTrack(file.id)}
                    disabled={isDisabled}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  {color && (
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: color.fill }}
                    />
                  )}
                  <span className="text-sm truncate">{file.name.replace('.gpx', '')}</span>
                </label>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Polar Plot + Stats side by side on larger screens */}
      {comparisonTracks.length >= 2 && (
        <div className="grid lg:grid-cols-2 gap-4">
          {/* Overlay Polar Plot */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Polar Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <ComparisonPolarPlot
                tracks={comparisonTracks}
                hoveredTrackId={hoveredTrackId}
                onTrackHover={setHoveredTrackId}
              />
            </CardContent>
          </Card>

          {/* Comparison Stats Table */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Performance Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="p-2 font-medium">Track</th>
                      <th className="p-2 font-medium text-right" title="Average of top 3 VMG segments">Rep VMG</th>
                      <th className="p-2 font-medium text-right" title="Average of top 3 tightest angles">Rep Angle</th>
                      <th className="p-2 font-medium text-right" title="Average of top 3 fastest segments">Rep Speed</th>
                      <th className="p-2 font-medium text-right" title="Historical wind speed">Wind</th>
                      <th className="p-2 font-medium text-right">Segments</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparisonTracks.map((track) => {
                      const file = analyzedFiles.find((f) => f.id === track.id);
                      const result = file?.result;
                      const color = TRACK_COLORS[track.colorIndex];
                      const isHovered = hoveredTrackId === track.id;

                      // Get upwind segments with calculated VMG
                      const calcVMG = (s: { avg_speed_knots: number; angle_to_wind: number }) =>
                        s.avg_speed_knots * Math.cos((s.angle_to_wind * Math.PI) / 180);

                      const upwindSegments = (result?.segments || [])
                        .filter((s) => s.direction === 'Upwind')
                        .map((s) => ({ ...s, vmg: calcVMG(s) }));

                      // Rep VMG: avg of top 3 by VMG
                      const byVMG = [...upwindSegments].sort((a, b) => b.vmg - a.vmg);
                      const top3VMG = byVMG.slice(0, 3);
                      const repVMG = top3VMG.length > 0
                        ? top3VMG.reduce((sum, s) => sum + s.vmg, 0) / top3VMG.length
                        : null;

                      // Rep Angle: avg of top 3 tightest angles (lowest angle_to_wind)
                      const byAngle = [...upwindSegments].sort((a, b) => a.angle_to_wind - b.angle_to_wind);
                      const top3Angle = byAngle.slice(0, 3);
                      const repAngle = top3Angle.length > 0
                        ? top3Angle.reduce((sum, s) => sum + s.angle_to_wind, 0) / top3Angle.length
                        : null;

                      // Rep Speed: avg of top 3 fastest segments
                      const bySpeed = [...upwindSegments].sort((a, b) => b.avg_speed_knots - a.avg_speed_knots);
                      const top3Speed = bySpeed.slice(0, 3);
                      const repSpeed = top3Speed.length > 0
                        ? top3Speed.reduce((sum, s) => sum + s.avg_speed_knots, 0) / top3Speed.length
                        : null;

                      // Wind speed from historical lookup
                      const windSpeed = file?.windSpeed;

                      return (
                        <tr
                          key={track.id}
                          className={cn(
                            'border-b transition-colors',
                            isHovered ? 'bg-yellow-50' : 'hover:bg-slate-50'
                          )}
                          onMouseEnter={() => setHoveredTrackId(track.id)}
                          onMouseLeave={() => setHoveredTrackId(null)}
                        >
                          <td className="p-2">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                style={{ backgroundColor: color.fill }}
                              />
                              <span className="truncate max-w-[120px]">
                                {track.name.replace('.gpx', '')}
                              </span>
                            </div>
                          </td>
                          <td className="p-2 text-right font-medium">
                            {repVMG ? formatSpeed(repVMG) : '-'}
                          </td>
                          <td className="p-2 text-right">
                            {repAngle ? `${repAngle.toFixed(0)}°` : '-'}
                          </td>
                          <td className="p-2 text-right">
                            {repSpeed ? formatSpeed(repSpeed) : '-'}
                          </td>
                          <td className="p-2 text-right text-slate-500">
                            {windSpeed ? `${windSpeed.toFixed(0)} kts` : '-'}
                          </td>
                          <td className="p-2 text-right">{result?.segments?.length ?? 0}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Summary row */}
              {aggregateStats && (
                <div className="mt-4 pt-3 border-t text-xs text-slate-600">
                  <div className="flex justify-between">
                    <span>Average VMG across tracks:</span>
                    <span className="font-medium">
                      {aggregateStats.avgVMG ? formatSpeed(aggregateStats.avgVMG) : '-'}
                    </span>
                  </div>
                  <div className="flex justify-between mt-1">
                    <span>Best VMG (any track):</span>
                    <span className="font-medium">
                      {aggregateStats.bestVMG ? formatSpeed(aggregateStats.bestVMG) : '-'}
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Message when less than 2 selected */}
      {comparisonTracks.length < 2 && (
        <Card>
          <CardContent className="p-8 text-center text-slate-500">
            Select at least 2 tracks above to see comparison
          </CardContent>
        </Card>
      )}
    </div>
  );
}
