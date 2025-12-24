'use client';

import { useEffect, useState } from 'react';
import { FileText, Calendar, MapPin, Loader2, Check, AlertCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { WindCompass } from '@/components/WindCompass';
import { FileWithMetadata } from '@/stores/uploadStore';
import { useLookupWind } from '@/hooks/useApi';
import { cn } from '@/lib/utils';

interface TrackFileCardProps {
  file: FileWithMetadata;
  onAnalyze: (windDirection: number) => void;
  onRemove: () => void;
  isAnalyzing?: boolean;
  disabled?: boolean;
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
}: TrackFileCardProps) {
  const [windDirection, setWindDirection] = useState(90); // Default east
  const [lookupDone, setLookupDone] = useState(false);
  const [lookupInfo, setLookupInfo] = useState<{ speed: number } | null>(null);
  const windLookup = useLookupWind();

  const metadata = file.metadata;
  const gpsData = file.gpsData;

  // Extract location from first GPS point or bounds center
  const location = gpsData?.[0]
    ? { lat: gpsData[0].latitude, lon: gpsData[0].longitude }
    : metadata?.bounds
      ? {
          lat: (metadata.bounds.minLat + metadata.bounds.maxLat) / 2,
          lon: (metadata.bounds.minLon + metadata.bounds.maxLon) / 2
        }
      : null;

  // Extract and format date
  const trackTime = metadata?.time || gpsData?.[0]?.time;
  const dateInfo = trackTime ? formatDate(trackTime) : null;
  const timeStr = trackTime ? formatTime(trackTime) : null;

  // Auto-lookup wind when we have location and date
  useEffect(() => {
    if (location && dateInfo && !lookupDone && !windLookup.isPending) {
      windLookup.mutate(
        {
          latitude: location.lat,
          longitude: location.lon,
          date: dateInfo.date,
          hour: dateInfo.hour,
        },
        {
          onSuccess: (result) => {
            setWindDirection(Math.round(result.wind_direction));
            setLookupInfo({ speed: result.wind_speed_knots });
            setLookupDone(true);
          },
          onError: () => {
            setLookupDone(true); // Mark done even on error, use default
          },
        }
      );
    }
  }, [location, dateInfo, lookupDone, windLookup]);

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
            {windLookup.isPending && (
              <div className="flex items-center gap-2 text-blue-600">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span className="text-xs">Looking up wind conditions...</span>
              </div>
            )}
            {lookupInfo && (
              <p className="text-xs text-green-700">
                Historical: {windDirection}° at {lookupInfo.speed.toFixed(1)} kts
              </p>
            )}
            {lookupDone && !lookupInfo && !windLookup.isError && (
              <p className="text-xs text-slate-500">Using default wind direction</p>
            )}
          </div>

          {/* Right side - compass */}
          <div className="flex flex-col items-center">
            <p className="text-xs text-slate-500 mb-1">Wind from:</p>
            <WindCompass
              value={windDirection}
              onChange={setWindDirection}
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

      {/* Analyze button */}
      {metadata && !isCompleted && !hasError && (
        <div className="mt-4">
          <Button
            onClick={() => onAnalyze(windDirection)}
            disabled={!canAnalyze}
            className="w-full"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Analyzing...
              </>
            ) : (
              'Analyze Track'
            )}
          </Button>
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
