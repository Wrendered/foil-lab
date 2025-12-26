'use client';

import { useMemo } from 'react';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { useViewStore } from '@/stores/viewStore';
import { GPSPoint } from '@/lib/gpx-parser';
import { Clock, RotateCcw } from 'lucide-react';

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

export function FilterControls({ gpsData, onApplyFilters, disabled }: FilterControlsProps) {
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

  const isTimeFiltered = sliderValues[0] > 0.5 || sliderValues[1] < 99.5;

  if (!timeBounds) {
    return null;
  }

  return (
    <div className="bg-slate-50 border-t border-slate-200 px-3 py-2">
      <div className="flex items-center gap-2">
        {/* Label */}
        <div className="flex items-center gap-1 text-xs text-slate-500 flex-shrink-0">
          <Clock className="h-3.5 w-3.5" />
          <span className="font-medium">Trim:</span>
        </div>

        {/* Start time */}
        <span className="text-xs font-medium text-slate-600 flex-shrink-0">
          {displayTimes ? formatTime(displayTimes.startTime) : '--:--'}
        </span>

        {/* Slider */}
        <div className="flex-1 min-w-[60px]">
          <Slider
            value={sliderValues}
            onValueChange={handleSliderChange}
            min={0}
            max={100}
            step={0.5}
            disabled={disabled}
          />
        </div>

        {/* End time */}
        <span className="text-xs font-medium text-slate-600 flex-shrink-0">
          {displayTimes ? formatTime(displayTimes.endTime) : '--:--'}
        </span>

        {/* Reanalyze button - fixed width to prevent layout shift */}
        <Button
          onClick={onApplyFilters}
          disabled={disabled || !isTimeFiltered}
          size="sm"
          variant={isTimeFiltered ? "default" : "outline"}
          className="h-6 w-20 text-xs flex-shrink-0"
        >
          {isTimeFiltered ? 'Reanalyze' : 'Full'}
        </Button>

        {/* Reset button - always present but invisible when not filtered to prevent layout shift */}
        <button
          onClick={handleReset}
          disabled={!isTimeFiltered}
          className={`p-1 rounded transition-colors flex-shrink-0 ${
            isTimeFiltered
              ? 'text-slate-400 hover:text-slate-600'
              : 'text-transparent pointer-events-none'
          }`}
          title="Reset to full track"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
