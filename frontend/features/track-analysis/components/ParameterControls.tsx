'use client';

import { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { RotateCcw, Play, Settings2, ChevronDown, HelpCircle } from 'lucide-react';
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

// Better descriptions with practical examples
const PARAMETER_INFO = {
  angleTolerance: {
    label: 'Angle Tolerance',
    unit: '°',
    description: 'Max heading change before starting a new segment',
    example: 'At 25°, if your heading drifts >25° from the start of a tack, a new segment begins. Lower = stricter',
  },
  minSpeed: {
    label: 'Minimum Speed',
    unit: 'kts',
    description: 'Ignore GPS points below this speed',
    example: 'Filters out sinking, water starts, and breaks. Set higher to focus only on fast runs',
  },
  minDistance: {
    label: 'Minimum Distance',
    unit: 'm',
    description: 'Only count segments longer than this',
    example: 'Filters out brief gusts and condition shifts. Focus on sustained tacks, not lucky spurts',
  },
  minDuration: {
    label: 'Minimum Duration',
    unit: 's',
    description: 'Only count segments lasting longer than this',
    example: 'Ensures you held that angle consistently. Short bursts from gusts get filtered out',
  },
};

export function ParameterControls({
  onParametersChange,
  onReanalyze,
  disabled = false,
  isAnalyzing = false,
  className = '',
}: ParameterControlsProps) {
  const [isOpen, setIsOpen] = useState(false);
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

  // Real-time parameter updates (debounced)
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
    }, 500);

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

  // Check if any parameter differs from defaults
  const defaultAngle = config?.defaults.angle_tolerance || DEFAULT_PARAMETERS.angleTolerance;
  const defaultSpeed = config?.defaults.min_speed || DEFAULT_PARAMETERS.minSpeed;
  const defaultDistance = config?.defaults.min_distance || DEFAULT_PARAMETERS.minDistance;
  const defaultDuration = config?.defaults.min_duration || DEFAULT_PARAMETERS.minDuration;

  const hasCustomSettings =
    watchedValues.angleTolerance !== defaultAngle ||
    watchedValues.minSpeed !== defaultSpeed ||
    watchedValues.minDistance !== defaultDistance ||
    watchedValues.minDuration !== defaultDuration;

  // Summary text for collapsed state
  const summaryText = hasCustomSettings
    ? `Custom: ${watchedValues.angleTolerance}° / ${watchedValues.minSpeed}kn / ${watchedValues.minDistance}m`
    : 'Using defaults';

  return (
    <Card className={className}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <button className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors rounded-t-lg">
            <div className="flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-slate-600" />
              <div className="text-left">
                <div className="font-semibold text-sm">Detection Settings</div>
                <div className="text-xs text-slate-500">{summaryText}</div>
              </div>
            </div>
            <ChevronDown
              className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
            />
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0 pb-4 space-y-5 border-t">
            {/* Action buttons */}
            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetToDefaults}
                disabled={disabled || !hasCustomSettings}
                className="text-xs flex-1"
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1" />
                Reset
              </Button>
              <Button
                size="sm"
                onClick={handleManualReanalyze}
                disabled={disabled}
                className="text-xs flex-1"
              >
                <Play className="h-3.5 w-3.5 mr-1" />
                Re-analyze
              </Button>
            </div>

            {/* Help text */}
            <p className="text-xs text-slate-500 text-center">
              These settings control how track segments are detected.
              {isAnalyzing && (
                <span className="text-blue-600 block mt-1">Analysis in progress...</span>
              )}
            </p>

            <TooltipProvider delayDuration={200}>
              {/* Angle Tolerance */}
              <ParameterField
                control={control}
                name="angleTolerance"
                info={PARAMETER_INFO.angleTolerance}
                range={ranges.angleTolerance}
                disabled={disabled}
              />

              {/* Min Speed */}
              <ParameterField
                control={control}
                name="minSpeed"
                info={PARAMETER_INFO.minSpeed}
                range={ranges.minSpeed}
                disabled={disabled}
              />

              {/* Min Distance */}
              <ParameterField
                control={control}
                name="minDistance"
                info={PARAMETER_INFO.minDistance}
                range={ranges.minDistance}
                disabled={disabled}
              />

              {/* Min Duration */}
              <ParameterField
                control={control}
                name="minDuration"
                info={PARAMETER_INFO.minDuration}
                range={ranges.minDuration}
                disabled={disabled}
              />
            </TooltipProvider>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

// Reusable parameter field component
function ParameterField({
  control,
  name,
  info,
  range,
  disabled,
}: {
  control: any;
  name: keyof Omit<AnalysisParameters, 'windDirection'>;
  info: { label: string; unit: string; description: string; example: string };
  range: { min: number; max: number; step: number };
  disabled: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Label htmlFor={name} className="text-sm">{info.label}</Label>
        <Tooltip>
          <TooltipTrigger asChild>
            <button type="button" className="text-slate-400 hover:text-slate-600">
              <HelpCircle className="h-3.5 w-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="max-w-[250px]">
            <p className="font-medium mb-1">{info.description}</p>
            <p className="text-slate-300 text-xs">{info.example}</p>
          </TooltipContent>
        </Tooltip>
      </div>
      <div className="flex items-center gap-2">
        <Controller
          control={control}
          name={name}
          render={({ field }) => (
            <Input
              id={name}
              type="number"
              min={range.min}
              max={range.max}
              step={range.step}
              value={field.value}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => field.onChange(parseFloat(e.target.value))}
              disabled={disabled}
              className="flex-1 h-9"
            />
          )}
        />
        <span className="text-sm text-slate-500 w-8">{info.unit}</span>
      </div>
    </div>
  );
}
