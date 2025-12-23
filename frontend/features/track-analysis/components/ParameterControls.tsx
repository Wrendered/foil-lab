'use client';

import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RotateCcw, Play, Settings2 } from 'lucide-react';
import { useAnalysisStore } from '@/stores/analysisStore';
import { useConfig } from '@/hooks/useApi';
import { AnalysisParameters } from '@/stores/analysisStore';
import { ConfigResponse } from '@/lib/api-client';
import { DEFAULT_PARAMETERS, DEFAULT_RANGES } from '@/lib/defaults';

interface ParameterControlsProps {
  onParametersChange?: (params: AnalysisParameters) => void;
  onReanalyze?: () => void;
  disabled?: boolean;
  isAnalyzing?: boolean;
  className?: string;
}

export function ParameterControls({
  onParametersChange,
  onReanalyze,
  disabled = false,
  isAnalyzing = false,
  className = '',
}: ParameterControlsProps) {
  const analysisStore = useAnalysisStore();
  const { data: config } = useConfig();

  const { control, watch, reset } = useForm<AnalysisParameters>({
    defaultValues: {
      ...analysisStore.parameters,
    },
  });

  const watchedValues = watch();

  // Update form when config loads (only once)
  useEffect(() => {
    if (config) {
      reset({
        windDirection: config.defaults.wind_direction || DEFAULT_PARAMETERS.windDirection,
        angleTolerance: config.defaults.angle_tolerance || DEFAULT_PARAMETERS.angleTolerance,
        minSpeed: config.defaults.min_speed || DEFAULT_PARAMETERS.minSpeed,
        minDistance: config.defaults.min_distance || DEFAULT_PARAMETERS.minDistance,
        minDuration: config.defaults.min_duration || DEFAULT_PARAMETERS.minDuration,
      });
    }
  }, [config, reset]);

  // Real-time parameter updates (debounced) - always enabled for now
  useEffect(() => {
    const timer = setTimeout(() => {
      const newParams: AnalysisParameters = {
        windDirection: watchedValues.windDirection,
        angleTolerance: watchedValues.angleTolerance,
        minSpeed: watchedValues.minSpeed,
        minDistance: watchedValues.minDistance,
        minDuration: watchedValues.minDuration,
      };

      analysisStore.updateParameters(newParams);
      onParametersChange?.(newParams);
    }, 500); // 500ms debounce

    return () => clearTimeout(timer);
  }, [
    watchedValues.windDirection,
    watchedValues.angleTolerance,
    watchedValues.minSpeed,
    watchedValues.minDistance,
    watchedValues.minDuration,
    onParametersChange,
  ]);

  const handleResetToDefaults = () => {
    const defaultParams = {
      windDirection: config?.defaults.wind_direction || DEFAULT_PARAMETERS.windDirection,
      angleTolerance: config?.defaults.angle_tolerance || DEFAULT_PARAMETERS.angleTolerance,
      minSpeed: config?.defaults.min_speed || DEFAULT_PARAMETERS.minSpeed,
      minDistance: config?.defaults.min_distance || DEFAULT_PARAMETERS.minDistance,
      minDuration: config?.defaults.min_duration || DEFAULT_PARAMETERS.minDuration,
    };
    reset(defaultParams);
  };

  const handleManualReanalyze = () => {
    const currentParams: AnalysisParameters = {
      windDirection: watchedValues.windDirection,
      angleTolerance: watchedValues.angleTolerance,
      minSpeed: watchedValues.minSpeed,
      minDistance: watchedValues.minDistance,
      minDuration: watchedValues.minDuration,
    };
    
    analysisStore.updateParameters(currentParams);
    onReanalyze?.();
  };

  const getRanges = (config: ConfigResponse | undefined) => ({
    windDirection: config?.ranges?.wind_direction || DEFAULT_RANGES.windDirection,
    angleTolerance: config?.ranges?.angle_tolerance || DEFAULT_RANGES.angleTolerance,
    minSpeed: config?.ranges?.min_speed || DEFAULT_RANGES.minSpeed,
    minDistance: config?.ranges?.min_distance || DEFAULT_RANGES.minDistance,
    minDuration: config?.ranges?.min_duration || DEFAULT_RANGES.minDuration,
  });

  const ranges = getRanges(config);

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            <CardTitle>Analysis Parameters</CardTitle>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetToDefaults}
              disabled={disabled}
              className="text-xs w-full sm:w-auto"
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1" />
              Reset to Defaults
            </Button>
            <Button
              size="sm"
              onClick={handleManualReanalyze}
              disabled={disabled}
              className="text-xs w-full sm:w-auto"
            >
              <Play className="h-3.5 w-3.5 mr-1" />
              Re-analyze Now
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Analysis Status */}
        <div className="text-center py-2">
          {isAnalyzing ? (
            <div className="flex items-center justify-center gap-2">
              <RotateCcw className="h-3 w-3 animate-spin text-blue-600" />
              <p className="text-sm text-blue-700 font-medium">
                Analysis in progress - parameters locked
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Real-time parameter updates enabled
            </p>
          )}
        </div>


        {/* Angle Tolerance */}
        <div className="space-y-2">
          <Label htmlFor="angleTolerance">Angle Tolerance</Label>
          <div className="flex items-center gap-2">
            <Controller
              control={control}
              name="angleTolerance"
              render={({ field }) => (
                <Input
                  id="angleTolerance"
                  type="number"
                  min={ranges.angleTolerance.min}
                  max={ranges.angleTolerance.max}
                  step={ranges.angleTolerance.step}
                  value={field.value}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => field.onChange(parseFloat(e.target.value))}
                  disabled={disabled}
                  className="flex-1"
                />
              )}
            />
            <span className="text-sm text-muted-foreground">°</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Allowable deviation from true upwind/downwind
          </p>
        </div>

        {/* Min Speed */}
        <div className="space-y-2">
          <Label htmlFor="minSpeed">Minimum Speed</Label>
          <div className="flex items-center gap-2">
            <Controller
              control={control}
              name="minSpeed"
              render={({ field }) => (
                <Input
                  id="minSpeed"
                  type="number"
                  min={ranges.minSpeed.min}
                  max={ranges.minSpeed.max}
                  step={ranges.minSpeed.step}
                  value={field.value}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => field.onChange(parseFloat(e.target.value))}
                  disabled={disabled}
                  className="flex-1"
                />
              )}
            />
            <span className="text-sm text-muted-foreground">kts</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Minimum speed to consider for analysis
          </p>
        </div>

        {/* Min Distance */}
        <div className="space-y-2">
          <Label htmlFor="minDistance">Minimum Distance</Label>
          <div className="flex items-center gap-2">
            <Controller
              control={control}
              name="minDistance"
              render={({ field }) => (
                <Input
                  id="minDistance"
                  type="number"
                  min={ranges.minDistance.min}
                  max={ranges.minDistance.max}
                  step={ranges.minDistance.step}
                  value={field.value}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => field.onChange(parseFloat(e.target.value))}
                  disabled={disabled}
                  className="flex-1"
                />
              )}
            />
            <span className="text-sm text-muted-foreground">m</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Minimum segment distance to include
          </p>
        </div>

        {/* Min Duration */}
        <div className="space-y-2">
          <Label htmlFor="minDuration">Minimum Duration</Label>
          <div className="flex items-center gap-2">
            <Controller
              control={control}
              name="minDuration"
              render={({ field }) => (
                <Input
                  id="minDuration"
                  type="number"
                  min={ranges.minDuration.min}
                  max={ranges.minDuration.max}
                  step={ranges.minDuration.step}
                  value={field.value}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => field.onChange(parseFloat(e.target.value))}
                  disabled={disabled}
                  className="flex-1"
                />
              )}
            />
            <span className="text-sm text-muted-foreground">s</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Minimum segment duration to include
          </p>
        </div>
      </CardContent>
    </Card>
  );
}