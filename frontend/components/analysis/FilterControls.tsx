'use client';

import { useMemo, useState } from 'react';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { useViewStore, FilterBounds } from '@/stores/viewStore';
import { GPSPoint } from '@/lib/gpx-parser';
import { Clock, MapPin, RotateCcw, Filter } from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface FilterControlsProps {
  gpsData: GPSPoint[];
  onApplyFilters: () => void;
  disabled?: boolean;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function formatDuration(startMs: number, endMs: number): string {
  const durationMs = endMs - startMs;
  const minutes = Math.floor(durationMs / 60000);
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
}

export function FilterControls({ gpsData, onApplyFilters, disabled }: FilterControlsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const filterBounds = useViewStore((state) => state.filterBounds);
  const setFilterBounds = useViewStore((state) => state.setFilterBounds);
  const clearFilterBounds = useViewStore((state) => state.clearFilterBounds);

  // Calculate time bounds from GPS data
  const timeBounds = useMemo(() => {
    if (!gpsData || gpsData.length === 0) return null;

    // Time is stored as ISO string, need to parse it
    const times = gpsData
      .map((p) => p.time)
      .filter((t): t is string => t !== null && t !== undefined && t !== '')
      .map((t) => new Date(t))
      .filter((d) => !isNaN(d.getTime()));

    if (times.length < 2) return null;

    const startTime = new Date(Math.min(...times.map((t) => t.getTime())));
    const endTime = new Date(Math.max(...times.map((t) => t.getTime())));

    return { startTime, endTime };
  }, [gpsData]);

  // Current slider values (as percentage of total range)
  const sliderValues = useMemo(() => {
    if (!timeBounds) return [0, 100];

    const totalRange = timeBounds.endTime.getTime() - timeBounds.startTime.getTime();
    if (totalRange === 0) return [0, 100];

    let startPct = 0;
    let endPct = 100;

    if (filterBounds.timeStart) {
      const startDate = new Date(filterBounds.timeStart);
      startPct = ((startDate.getTime() - timeBounds.startTime.getTime()) / totalRange) * 100;
    }

    if (filterBounds.timeEnd) {
      const endDate = new Date(filterBounds.timeEnd);
      endPct = ((endDate.getTime() - timeBounds.startTime.getTime()) / totalRange) * 100;
    }

    return [Math.max(0, Math.min(100, startPct)), Math.max(0, Math.min(100, endPct))];
  }, [filterBounds.timeStart, filterBounds.timeEnd, timeBounds]);

  // Calculate display times based on slider
  const displayTimes = useMemo(() => {
    if (!timeBounds) return null;

    const totalRange = timeBounds.endTime.getTime() - timeBounds.startTime.getTime();
    const startTime = new Date(timeBounds.startTime.getTime() + (sliderValues[0] / 100) * totalRange);
    const endTime = new Date(timeBounds.startTime.getTime() + (sliderValues[1] / 100) * totalRange);

    return { startTime, endTime };
  }, [sliderValues, timeBounds]);

  const handleSliderChange = (values: number[]) => {
    if (!timeBounds) return;

    const totalRange = timeBounds.endTime.getTime() - timeBounds.startTime.getTime();
    const startTime = new Date(timeBounds.startTime.getTime() + (values[0] / 100) * totalRange);
    const endTime = new Date(timeBounds.startTime.getTime() + (values[1] / 100) * totalRange);

    setFilterBounds({
      timeStart: startTime.toISOString(),
      timeEnd: endTime.toISOString(),
    });
  };

  const handleReset = () => {
    clearFilterBounds();
  };

  const hasActiveFilters =
    filterBounds.timeStart !== null ||
    filterBounds.timeEnd !== null ||
    filterBounds.latMin !== null;

  const isTimeFiltered =
    sliderValues[0] > 0.5 || sliderValues[1] < 99.5; // Allow small tolerance

  if (!timeBounds) {
    return null; // No time data available
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={`gap-1.5 ${hasActiveFilters ? 'text-blue-600' : 'text-slate-500'}`}
        >
          <Filter className="h-4 w-4" />
          <span className="text-xs">
            {hasActiveFilters ? 'Filters active' : 'Filters'}
          </span>
        </Button>
      </CollapsibleTrigger>

      <CollapsibleContent className="mt-2">
        <div className="bg-slate-50 rounded-lg p-3 space-y-3">
          {/* Time Range Filter */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs text-slate-600">
                <Clock className="h-3.5 w-3.5" />
                <span>Time Range</span>
              </div>
              {isTimeFiltered && (
                <button
                  onClick={handleReset}
                  className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1"
                >
                  <RotateCcw className="h-3 w-3" />
                  Reset
                </button>
              )}
            </div>

            <Slider
              value={sliderValues}
              onValueChange={handleSliderChange}
              min={0}
              max={100}
              step={0.5}
              disabled={disabled}
              className="py-2"
            />

            <div className="flex justify-between text-xs text-slate-500">
              <span>{displayTimes ? formatTime(displayTimes.startTime) : '--:--'}</span>
              <span className="text-slate-400">
                {displayTimes ? formatDuration(displayTimes.startTime.getTime(), displayTimes.endTime.getTime()) : '--'}
              </span>
              <span>{displayTimes ? formatTime(displayTimes.endTime) : '--:--'}</span>
            </div>

            <div className="text-xs text-slate-400 text-center">
              Full range: {formatTime(timeBounds.startTime)} - {formatTime(timeBounds.endTime)}
            </div>
          </div>

          {/* Spatial Filter (placeholder for Phase 4 Part 2) */}
          <div className="space-y-2 opacity-50">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <MapPin className="h-3.5 w-3.5" />
              <span>Spatial Filter (coming soon)</span>
            </div>
            <p className="text-xs text-slate-400">
              Draw a rectangle on the map to filter by location
            </p>
          </div>

          {/* Apply Button */}
          {hasActiveFilters && (
            <Button
              onClick={onApplyFilters}
              disabled={disabled}
              size="sm"
              className="w-full"
            >
              Re-analyze with Filters
            </Button>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
