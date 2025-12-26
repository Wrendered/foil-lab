'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useUploadStore } from '@/stores/uploadStore';
import { formatSpeed } from '@/lib/colors';
import { ComparisonPolarPlot, ComparisonTrack, TRACK_COLORS } from '@/components/analysis/ComparisonPolarPlot';
import { cn } from '@/lib/utils';
import { Pencil, Check } from 'lucide-react';

const MAX_TRACKS = 4;

function EditableTrackName({
  fileId,
  displayName,
  fileName,
  color,
}: {
  fileId: string;
  displayName?: string;
  fileName: string;
  color: string;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(displayName || fileName.replace('.gpx', ''));
  const setDisplayName = useUploadStore((state) => state.setDisplayName);

  // Sync editValue when displayName prop changes (and not currently editing)
  useEffect(() => {
    if (!isEditing) {
      setEditValue(displayName || fileName.replace('.gpx', ''));
    }
  }, [displayName, fileName, isEditing]);

  const handleSave = () => {
    setDisplayName(fileId, editValue);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') {
      setEditValue(displayName || fileName.replace('.gpx', ''));
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-1">
        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
        <input
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          autoFocus
          className="flex-1 px-1 py-0.5 text-sm border rounded min-w-0"
        />
        <button onClick={handleSave} className="p-0.5 hover:bg-slate-200 rounded">
          <Check className="h-3 w-3 text-green-600" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 group">
      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
      <span className="font-medium">{displayName || fileName.replace('.gpx', '')}</span>
      <button
        onClick={() => setIsEditing(true)}
        className="p-0.5 opacity-0 group-hover:opacity-100 hover:bg-slate-200 rounded transition-opacity"
        title="Edit name"
      >
        <Pencil className="h-3 w-3 text-slate-400" />
      </button>
    </div>
  );
}

function EditableWindSpeed({
  fileId,
  windSpeed,
  windDirection,
}: {
  fileId: string;
  windSpeed?: number;
  windDirection?: number;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(windSpeed?.toFixed(0) || '');
  const setFileWindData = useUploadStore((state) => state.setFileWindData);

  // Sync editValue when windSpeed prop changes (and not currently editing)
  useEffect(() => {
    if (!isEditing) {
      setEditValue(windSpeed?.toFixed(0) || '');
    }
  }, [windSpeed, isEditing]);

  const handleSave = () => {
    const parsed = parseFloat(editValue);
    if (!isNaN(parsed) && parsed >= 0) {
      setFileWindData(fileId, windDirection || 0, parsed);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') {
      setEditValue(windSpeed?.toFixed(0) || '');
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <span className="inline-flex items-center gap-1">
        <span className="text-slate-400">Wind:</span>
        <input
          type="number"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          autoFocus
          className="w-12 px-1 py-0.5 text-sm border rounded"
          min="0"
          step="1"
        />
        <span className="text-slate-400">kts</span>
      </span>
    );
  }

  return (
    <span
      className="group cursor-pointer hover:bg-slate-200 rounded px-1 -mx-1"
      onClick={() => setIsEditing(true)}
      title="Click to edit wind speed"
    >
      <span className="text-slate-400">Wind:</span>{' '}
      <span className="text-slate-600">{windSpeed ? `${windSpeed.toFixed(0)} kts` : '-'}</span>
      <Pencil className="inline h-3 w-3 ml-1 text-slate-400 opacity-0 group-hover:opacity-100" />
    </span>
  );
}

export function ComparisonView() {
  const { files } = useUploadStore();
  const [selectedTrackIds, setSelectedTrackIds] = useState<Set<string>>(new Set());
  const [hoveredTrackId, setHoveredTrackId] = useState<string | null>(null);

  // Get all analyzed files
  const analyzedFiles = useMemo(() => {
    return files.filter((f) => f.status === 'completed' && f.result);
  }, [files]);

  // Auto-select first 2 tracks on mount if none selected
  const initializedRef = useRef(false);
  useEffect(() => {
    if (!initializedRef.current && analyzedFiles.length >= 2) {
      setSelectedTrackIds(new Set(analyzedFiles.slice(0, 2).map((f) => f.id)));
      initializedRef.current = true;
    }
  }, [analyzedFiles.length]);

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
        name: f.displayName || f.name,
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

    return { avgVMG, bestVMG, trackCount: comparisonTracks.length };
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
            {analyzedFiles.map((file) => {
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
                  <span className="text-sm truncate">
                    {file.displayName || file.name.replace('.gpx', '')}
                  </span>
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

          {/* Comparison Stats - Two-line rows */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Performance Comparison</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
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

                // Sort by VMG to find best and rep
                const byVMG = [...upwindSegments].sort((a, b) => b.vmg - a.vmg);

                // Best: single best segment by VMG
                const bestSeg = byVMG[0] || null;
                const bestAngle = bestSeg?.angle_to_wind ?? null;
                const bestSpeed = bestSeg?.avg_speed_knots ?? null;
                const bestVMG = bestSeg?.vmg ?? null;

                // Rep: avg of top 3 by VMG
                const top3 = byVMG.slice(0, 3);
                const repAngle = top3.length > 0
                  ? top3.reduce((sum, s) => sum + s.angle_to_wind, 0) / top3.length
                  : null;
                const repSpeed = top3.length > 0
                  ? top3.reduce((sum, s) => sum + s.avg_speed_knots, 0) / top3.length
                  : null;
                const repVMG = top3.length > 0
                  ? top3.reduce((sum, s) => sum + s.vmg, 0) / top3.length
                  : null;

                // Wind speed from historical lookup
                const windSpeed = file?.windSpeed;
                const segmentCount = result?.segments?.length ?? 0;

                return (
                  <div
                    key={track.id}
                    className={cn(
                      'p-3 rounded-lg border transition-colors',
                      isHovered ? 'bg-yellow-50 border-yellow-300' : 'bg-slate-50 border-transparent'
                    )}
                    onMouseEnter={() => setHoveredTrackId(track.id)}
                    onMouseLeave={() => setHoveredTrackId(null)}
                  >
                    {/* Line 1: Track name (editable) */}
                    <EditableTrackName
                      fileId={file?.id || ''}
                      displayName={file?.displayName}
                      fileName={file?.name || ''}
                      color={color.fill}
                    />

                    {/* Line 2: Stats */}
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                      <span title="Best segment (highest VMG): angle @ speed">
                        <span className="text-slate-400">Best:</span>{' '}
                        <span className="font-medium text-slate-800">
                          {bestAngle !== null ? `${bestAngle.toFixed(0)}°` : '-'}
                          {bestSpeed !== null ? ` @ ${formatSpeed(bestSpeed)}` : ''}
                        </span>
                      </span>
                      <span title="Representative (avg top 3 VMG): angle @ speed">
                        <span className="text-slate-400">Rep:</span>{' '}
                        <span className="font-medium text-slate-800">
                          {repAngle !== null ? `${repAngle.toFixed(0)}°` : '-'}
                          {repSpeed !== null ? ` @ ${formatSpeed(repSpeed)}` : ''}
                        </span>
                      </span>
                      <span title="Best VMG (single best segment)">
                        <span className="text-slate-400">Best VMG:</span>{' '}
                        <span className="font-medium text-green-700">{bestVMG ? formatSpeed(bestVMG) : '-'}</span>
                      </span>
                      <span title="Representative VMG (avg top 3)">
                        <span className="text-slate-400">Rep VMG:</span>{' '}
                        <span className="font-medium text-slate-800">{repVMG ? formatSpeed(repVMG) : '-'}</span>
                      </span>
                      <EditableWindSpeed
                        fileId={file?.id || ''}
                        windSpeed={windSpeed}
                        windDirection={file?.windDirection}
                      />
                      <span title="Number of upwind segments">
                        <span className="text-slate-400">Seg:</span>{' '}
                        <span className="text-slate-600">{segmentCount}</span>
                      </span>
                    </div>
                  </div>
                );
              })}

              {/* Summary */}
              {aggregateStats && (
                <div className="pt-3 border-t text-xs text-slate-500 flex justify-between">
                  <span>Avg VMG: {aggregateStats.avgVMG ? formatSpeed(aggregateStats.avgVMG) : '-'}</span>
                  <span>Best VMG: {aggregateStats.bestVMG ? formatSpeed(aggregateStats.bestVMG) : '-'}</span>
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
