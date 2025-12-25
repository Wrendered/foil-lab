'use client';

import { useEffect, useMemo, useRef } from 'react';
import { FileText, Calendar, MapPin, Loader2, Check, AlertCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { WindCompass } from '@/components/WindCompass';
import { FileWithMetadata, useUploadStore } from '@/stores/uploadStore';
import { useLookupWind } from '@/hooks/useApi';
import { cn } from '@/lib/utils';

interface TrackFileCardProps {
  file: FileWithMetadata;
  onAnalyze: (windDirection: number) => void;
  onRemove: () => void;
  isAnalyzing?: boolean;
  disabled?: boolean;
  autoAnalyze?: boolean; // Auto-trigger analysis when historical wind is found
}

function formatDate(isoString: string): { date: string; hour: number; displayDate: string } {
  const d = new Date(isoString);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hour = d.getHours();

  return {
    date: `${year}-${month}-${day}`,
    hour,
    displayDate: d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }),
  };
}

function formatTime(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatLocation(lat: number, lon: number): string {
  const latDir = lat >= 0 ? 'N' : 'S';
  const lonDir = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(2)}°${latDir}, ${Math.abs(lon).toFixed(2)}°${lonDir}`;
}

export function TrackFileCard({
  file,
  onAnalyze,
  onRemove,
  isAnalyzing = false,
  disabled = false,
  autoAnalyze = true,
}: TrackFileCardProps) {
  const setFileWindData = useUploadStore((state) => state.setFileWindData);
  const windLookup = useLookupWind();

  // Refs to prevent race conditions in auto-analyze
  const autoAnalyzeTriggeredRef = useRef(false);
  const onAnalyzeRef = useRef(onAnalyze);
  onAnalyzeRef.current = onAnalyze;

  // Use store values, with fallback to 90 for wind direction
  const windDirection = file.windDirection ?? 90;
  const lookupDone = file.windLookupDone ?? false;
  const windSpeed = file.windSpeed;

  const metadata = file.metadata;
  const gpsData = file.gpsData;

  // Handler for compass changes - updates store
  const handleWindChange = (newDirection: number) => {
    setFileWindData(file.id, newDirection, windSpeed);
  };

  // Extract location from first GPS point or bounds center (memoized to prevent useEffect re-runs)
  const location = useMemo(() => {
    if (gpsData?.[0]) {
      return { lat: gpsData[0].latitude, lon: gpsData[0].longitude };
    }
    if (metadata?.bounds) {
      return {
        lat: (metadata.bounds.minLat + metadata.bounds.maxLat) / 2,
        lon: (metadata.bounds.minLon + metadata.bounds.maxLon) / 2
      };
    }
    return null;
  }, [gpsData, metadata?.bounds]);

  // Extract and format date (memoized)
  const trackTime = metadata?.time || gpsData?.[0]?.time;
  const dateInfo = useMemo(() => trackTime ? formatDate(trackTime) : null, [trackTime]);
  const timeStr = trackTime ? formatTime(trackTime) : null;

  // Auto-lookup wind when we have location and date
  const { mutate: lookupWindMutate, isPending: isLookingUpWind } = windLookup;

  useEffect(() => {
    if (location && dateInfo && !lookupDone && !isLookingUpWind) {
      lookupWindMutate(
        {
          latitude: location.lat,
          longitude: location.lon,
          date: dateInfo.date,
          hour: dateInfo.hour,
        },
        {
          onSuccess: (result) => {
            const windDir = Math.round(result.wind_direction);
            setFileWindData(file.id, windDir, result.wind_speed_knots);

            // Auto-analyze if enabled and we got valid historical wind
            // Use refs to prevent race conditions and stale closures
            if (autoAnalyze && result.wind_speed_knots && !disabled && !autoAnalyzeTriggeredRef.current) {
              autoAnalyzeTriggeredRef.current = true;
              // Small delay to ensure state is updated before triggering
              setTimeout(() => onAnalyzeRef.current(windDir), 100);
            }
          },
          onError: (error) => {
            // Log the error for debugging, then fall back to default
            console.warn('Wind lookup failed:', error);
            setFileWindData(file.id, 90, undefined);
          },
        }
      );
    }
  }, [location, dateInfo, lookupDone, isLookingUpWind, file.id, setFileWindData, lookupWindMutate, autoAnalyze, disabled]);

  const isCompleted = file.status === 'completed';
  const isUploading = file.status === 'uploading' || file.status === 'processing';
  const hasError = file.status === 'error';
  const canAnalyze = !disabled && !isAnalyzing && !isUploading && metadata;

  return (
    <Card className={cn(
      'p-4 transition-all',
      isCompleted && 'border-green-200 bg-green-50/50',
      hasError && 'border-red-200 bg-red-50/50',
    )}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {isCompleted ? (
            <Check className="h-5 w-5 text-green-600 flex-shrink-0" />
          ) : hasError ? (
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
          ) : isUploading ? (
            <Loader2 className="h-5 w-5 animate-spin text-blue-600 flex-shrink-0" />
          ) : (
            <FileText className="h-5 w-5 text-slate-500 flex-shrink-0" />
          )}
          <span className="font-medium truncate">{file.name}</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 flex-shrink-0"
          onClick={onRemove}
          disabled={isUploading || isAnalyzing}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Loading metadata state */}
      {!metadata && !hasError && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Reading track data...</span>
        </div>
      )}

      {/* Error state */}
      {hasError && (
        <p className="text-sm text-red-600">{file.error || 'Failed to process file'}</p>
      )}

      {/* Track info and wind compass */}
      {metadata && !hasError && (
        <div className="flex gap-4">
          {/* Left side - track info */}
          <div className="flex-1 space-y-2 text-sm">
            {dateInfo && (
              <div className="flex items-center gap-2 text-slate-600">
                <Calendar className="h-4 w-4 flex-shrink-0" />
                <span>{dateInfo.displayDate} {timeStr && `at ${timeStr}`}</span>
              </div>
            )}
            {location && (
              <div className="flex items-center gap-2 text-slate-600">
                <MapPin className="h-4 w-4 flex-shrink-0" />
                <span>{formatLocation(location.lat, location.lon)}</span>
              </div>
            )}
            {metadata.points && (
              <p className="text-slate-500">
                {metadata.points.toLocaleString()} GPS points
              </p>
            )}

            {/* Wind lookup status */}
            {isLookingUpWind && (
              <div className="flex items-center gap-2 text-blue-600">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span className="text-xs">Looking up wind conditions...</span>
              </div>
            )}
            {lookupDone && windSpeed && !isAnalyzing && !isCompleted && (
              <p className="text-xs text-green-700">
                Historical: {windDirection}° at {windSpeed.toFixed(1)} kts
                {autoAnalyze && <span className="text-blue-600 ml-1">• Auto-analyzing...</span>}
              </p>
            )}
            {lookupDone && windSpeed && (isAnalyzing || isCompleted) && (
              <p className="text-xs text-green-700">
                Historical: {windDirection}° at {windSpeed.toFixed(1)} kts
              </p>
            )}
            {lookupDone && !windSpeed && (
              <p className="text-xs text-slate-500">Wind lookup unavailable - set manually</p>
            )}
          </div>

          {/* Right side - compass */}
          <div className="flex flex-col items-center">
            <p className="text-xs text-slate-500 mb-1">Wind from:</p>
            <WindCompass
              value={windDirection}
              onChange={handleWindChange}
              size={100}
              disabled={isAnalyzing || isCompleted}
            />
          </div>
        </div>
      )}

      {/* Upload progress */}
      {isUploading && (
        <div className="mt-3">
          <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-all duration-300"
              style={{ width: `${file.uploadProgress}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {file.uploadProgress}% uploaded
          </p>
        </div>
      )}

      {/* Analyze button - only show if not auto-analyzing or if wind lookup failed */}
      {metadata && !isCompleted && !hasError && (
        <div className="mt-4">
          {isAnalyzing ? (
            <Button disabled className="w-full">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Analyzing...
            </Button>
          ) : (
            /* Show button if: no wind speed (lookup failed), or autoAnalyze is disabled */
            (!windSpeed || !autoAnalyze) && lookupDone && (
              <Button
                onClick={() => onAnalyze(windDirection)}
                disabled={!canAnalyze}
                className="w-full"
              >
                Analyze Track
              </Button>
            )
          )}
        </div>
      )}

      {/* Completed state */}
      {isCompleted && (
        <div className="mt-3 text-sm text-green-700 font-medium">
          Analysis complete - see results below
        </div>
      )}
    </Card>
  );
}
