'use client';

import { useEffect, useState } from 'react';
import { ParameterControls } from '@/features/track-analysis/components/ParameterControls';
import { AnalysisView } from '@/components/analysis';
import { TrackUploader } from '@/components/TrackUploader';
import { TrackNavigator } from '@/components/TrackNavigator';
import { ComparisonView } from '@/components/ComparisonView';
import { useUploadStore } from '@/stores/uploadStore';
import { useAnalysisStore } from '@/stores/analysisStore';
import { useViewStore } from '@/stores/viewStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ClientOnly } from '@/components/ClientOnly';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useConfig, useTrackAnalysis, useConnectionStatus } from '@/hooks/useApi';
import { useToast } from '@/components/ui/toast';
import { Loader2, WifiOff, AlertCircle, ChevronDown } from 'lucide-react';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { isNetworkError, isServerError, isAPIError, FilterParameters } from '@/lib/api-client';
import { DEFAULT_PARAMETERS } from '@/lib/defaults';

export default function AnalyzePage() {
  const uploadStore = useUploadStore();
  const analysisStore = useAnalysisStore();
  const viewStore = useViewStore();
  const { addToast } = useToast();
  const [isCompareMode, setIsCompareMode] = useState(false);

  // API hooks
  const { data: config, error: configError, isLoading: configLoading } = useConfig();
  const connectionStatus = useConnectionStatus();
  const trackAnalysis = useTrackAnalysis();
  
  // Get the current file's result
  const currentFile = uploadStore.currentFileId 
    ? uploadStore.files.find(f => f.id === uploadStore.currentFileId)
    : uploadStore.files.find(f => f.status === 'completed' && f.result);
    
  const currentResult = currentFile?.result;

  // Set defaults when config loads (only once)
  useEffect(() => {
    if (config) {
      analysisStore.updateParameters({
        windDirection: config.defaults.wind_direction || DEFAULT_PARAMETERS.windDirection,
        angleTolerance: config.defaults.angle_tolerance || DEFAULT_PARAMETERS.angleTolerance,
        minSpeed: config.defaults.min_speed || DEFAULT_PARAMETERS.minSpeed,
        minDistance: config.defaults.min_distance || DEFAULT_PARAMETERS.minDistance,
        minDuration: config.defaults.min_duration || DEFAULT_PARAMETERS.minDuration,
      });
    }
  }, [config]); // Remove analysisStore from dependencies

  // Show toast notifications for API status
  useEffect(() => {
    if (configError) {
      addToast({
        title: 'Configuration Error',
        description: 'Failed to load app configuration. Using defaults.',
        variant: 'warning',
      });
    }
  }, [configError, addToast]);

  useEffect(() => {
    if (connectionStatus.status === 'disconnected') {
      addToast({
        title: 'Connection Lost',
        description: 'Unable to connect to the analysis server.',
        variant: 'error',
        duration: 0, // Persistent until connection restored
      });
    }
  }, [connectionStatus.status, addToast]);

  const handleAnalyzeTrack = (file: File, windDirection: number, filters?: FilterParameters) => {
    const fileWithMeta = uploadStore.files.find((f) => f.file === file);
    if (!fileWithMeta) {
      addToast({
        title: 'Re-analyze Failed',
        description: 'File reference lost. Please re-upload the file.',
        variant: 'error',
      });
      return;
    }

    const params = {
      ...analysisStore.parameters,
      windDirection,
    };

    analysisStore.setAnalyzing(true);

    trackAnalysis.mutate(
      {
        file,
        params,
        fileId: fileWithMeta.id,
        filters,
      },
      {
        onSuccess: (result) => {
          analysisStore.setAnalyzing(false);
          // Don't reset viewStore if using filters - preserve filter state
          if (!filters) {
            viewStore.reset();
          } else {
            // Only reset hover and exclusions, keep filter bounds
            viewStore.setHoveredSegment(null);
            viewStore.clearExcludedSegments();
          }

          if (!uploadStore.currentFileId) {
            uploadStore.setCurrentFileId(fileWithMeta.id);
          }

          addToast({
            title: 'Analysis Complete',
            description: `Found ${result.segments?.length || 0} segments`,
            variant: 'success',
          });
        },
        onError: (error) => {
          const { title, description } = getErrorMessage(error);
          analysisStore.setError(description);
          analysisStore.setAnalyzing(false);

          addToast({
            title,
            description,
            variant: 'error',
            duration: 8000,
          });
        },
      }
    );
  };

  // Handler for re-analyzing with current filter bounds
  const handleReanalyzeWithFilters = () => {
    if (!currentFile) return;

    const windDir = currentFile.windDirection
      ?? currentFile.result?.wind_estimate?.direction
      ?? analysisStore.parameters.windDirection;

    // Get current filter bounds from viewStore
    const { timeStart, timeEnd, latMin, latMax, lonMin, lonMax } = viewStore.filterBounds;

    const filters: FilterParameters = {
      timeStart,
      timeEnd,
      latMin,
      latMax,
      lonMin,
      lonMax,
    };

    handleAnalyzeTrack(currentFile.file, windDir, filters);
  };

  // Utility function to get user-friendly error messages
  const getErrorMessage = (error: unknown): { title: string; description: string } => {
    if (isNetworkError(error)) {
      return {
        title: 'Connection Error',
        description: 'Unable to connect to the analysis server. Please check your internet connection and try again.'
      };
    }
    
    if (isServerError(error)) {
      return {
        title: 'Server Error',
        description: 'The analysis server is experiencing issues. Please try again in a few moments.'
      };
    }
    
    if (isAPIError(error)) {
      // Handle specific API error cases
      if (error.status === 413) {
        return {
          title: 'File Too Large',
          description: 'Your GPX file is too large. Please try with a smaller file (max 50MB).'
        };
      }
      
      if (error.status === 400 && error.message.includes('GPX')) {
        return {
          title: 'Invalid File Format',
          description: 'Please upload a valid GPX file. Other file formats are not supported.'
        };
      }
      
      if (error.status === 400 && error.message.includes('empty')) {
        return {
          title: 'Empty File',
          description: 'The file appears to be empty or corrupted. Please try with a different file.'
        };
      }
      
      if (error.status === 400) {
        return {
          title: 'File Processing Error',
          description: error.message || 'Unable to process this GPX file. Please check the file format and try again.'
        };
      }
    }
    
    // Fallback for unknown errors
    return {
      title: 'Analysis Failed',
      description: 'Something went wrong during analysis. Please try again or contact support if the problem persists.'
    };
  };

  // Handle track selection - reset view state when switching tracks
  const handleTrackSelect = (fileId: string) => {
    // Reset per-track view state (wind override, segment exclusions, hover)
    viewStore.reset();
    uploadStore.setCurrentFileId(fileId);
    setIsCompareMode(false);
  };
  
  const handleCompareMode = () => {
    setIsCompareMode(true);
    uploadStore.setCurrentFileId(null);
  };

  return (
    <ErrorBoundary>
      <div className="container mx-auto max-w-6xl px-4 py-8">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <p className="text-gray-600 text-sm">
              Compare upwind performance across sessions and gear. Drop a GPX to get started.
            </p>
            <Collapsible>
              <CollapsibleTrigger className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-0.5">
                What can I do?
                <ChevronDown className="h-3 w-3" />
              </CollapsibleTrigger>
              <CollapsibleContent className="absolute z-50 mt-2 bg-white border rounded-lg shadow-lg p-4 max-w-sm">
                <ul className="text-xs text-gray-600 space-y-1.5">
                  <li><span className="font-medium text-gray-800">Auto-detects wind</span> from historical data based on your GPX time and location, then refines it from your tacking patterns</li>
                  <li><span className="font-medium text-gray-800">Adjust wind manually</span> if the estimate looks off</li>
                  <li><span className="font-medium text-gray-800">Upload multiple tracks</span> to compare sessions or gear side-by-side</li>
                  <li><span className="font-medium text-gray-800">Trim by time</span> to focus on specific parts of your session</li>
                  <li><span className="font-medium text-gray-800">Toggle segments</span> on/off to refine your stats</li>
                </ul>
              </CollapsibleContent>
            </Collapsible>
          </div>

          {/* Status indicators - only show when there's an issue */}
          {(!connectionStatus.isConnected || configLoading) && (
            <div className="flex items-center gap-3">
              {!connectionStatus.isConnected && (
                <div className="flex items-center gap-2 text-sm text-red-600">
                  <WifiOff className="h-4 w-4" />
                  <span>{connectionStatus.isChecking ? 'Connecting...' : 'Server unavailable'}</span>
                </div>
              )}
              {configLoading && (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Loading...</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Column - File Upload and Parameters */}
          <div className="lg:col-span-1 space-y-6">
            {/* Track Upload Section with integrated wind compass */}
            <ErrorBoundary fallback={FileUploadErrorFallback}>
              <TrackUploader
                onAnalyze={handleAnalyzeTrack}
                isAnalyzing={analysisStore.isAnalyzing}
                disabled={!connectionStatus.isConnected}
              />
            </ErrorBoundary>

            {/* Parameter Controls */}
            <ParameterControls
              onReanalyze={() => {
                // Re-analyze with file's wind direction (not global default)
                if (currentFile) {
                  const windDir = currentFile.windDirection
                    ?? currentFile.result?.wind_estimate?.direction
                    ?? analysisStore.parameters.windDirection;
                  handleAnalyzeTrack(currentFile.file, windDir);
                }
              }}
              disabled={analysisStore.isAnalyzing || !connectionStatus.isConnected || !currentFile}
              isAnalyzing={analysisStore.isAnalyzing}
            />
          </div>

          {/* Right Column - Results */}
          <div className="lg:col-span-2">
            <ClientOnly>
              {/* Analysis State */}
              {analysisStore.isAnalyzing && (
                <Card className="mb-8">
                  <CardContent className="p-8 text-center">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
                    <p className="text-lg font-medium">Analyzing your track...</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      This may take a few moments for large files
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Error State */}
              {analysisStore.error && (
                <Card className="mb-8 border-red-200">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-red-600 mt-0.5" />
                      <div>
                        <p className="text-red-800 font-medium">Analysis Error</p>
                        <p className="text-red-600 text-sm mt-1">{analysisStore.error}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Track Navigator */}
              {uploadStore.files.some(f => f.status === 'completed' && f.result) && (
                <TrackNavigator
                  onTrackSelect={handleTrackSelect}
                  onCompareMode={handleCompareMode}
                  currentFileId={uploadStore.currentFileId}
                  isCompareMode={isCompareMode}
                />
              )}
              
              {/* Results */}
              {!analysisStore.isAnalyzing && (
                <>
                  {/* Comparison Mode */}
                  {isCompareMode ? (
                    <ComparisonView />
                  ) : (
                    /* Individual Track Results - New Interactive View */
                    currentResult && currentFile?.gpsData && (
                      <div className="h-[calc(100vh-280px)] min-h-[600px]">
                        <AnalysisView
                          result={currentResult}
                          gpsData={currentFile.gpsData}
                          filename={currentFile.name}
                          fileId={currentFile.id}
                          displayName={currentFile.displayName}
                          windSpeed={currentFile.windSpeed}
                          onReanalyzeWithFilters={handleReanalyzeWithFilters}
                          isAnalyzing={analysisStore.isAnalyzing}
                        />
                      </div>
                    )
                  )}
                </>
              )}
              
            </ClientOnly>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 pt-6 border-t">
          <div className="max-w-2xl mx-auto text-center">
            <p className="text-gray-600 text-sm leading-relaxed">
              I built this because I wanted data instead of subjectivity when comparing gear and technique.
              It tracks downwind too, though I haven't tested that as much.
              It's a side project, expect rough edges, but sharing in case it's useful to others who obsess over this stuff.
            </p>
            <p className="mt-3 text-sm">
              <span className="text-gray-500">Questions, bugs, or ideas?</span>{' '}
              <a
                href="https://www.instagram.com/heart_wrench/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                @heart_wrench
              </a>
            </p>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}

// Error fallback for file upload component
function FileUploadErrorFallback({
  error,
  resetError,
}: {
  error: Error;
  resetError: () => void;
}) {
  return (
    <div className="border border-red-200 rounded-lg p-4 bg-red-50">
      <div className="flex items-center gap-2 mb-2">
        <AlertCircle className="h-4 w-4 text-red-600" />
        <span className="text-sm font-medium text-red-800">File upload error</span>
      </div>
      <p className="text-sm text-red-700 mb-3">
        Something went wrong with the file upload. This could be due to a corrupted file or browser issue.
      </p>
      <Button
        onClick={resetError}
        size="sm"
        variant="outline"
        className="border-red-300 text-red-700 hover:bg-red-100"
      >
        Try Again
      </Button>
    </div>
  );
}