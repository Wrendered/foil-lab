'use client';

import { useEffect, useState } from 'react';
import { ParameterControls } from '@/features/track-analysis/components/ParameterControls';
import { SimpleAnalysisResults } from '@/components/SimpleAnalysisResults';
import { TrackUploader } from '@/components/TrackUploader';
import { TrackNavigator } from '@/components/TrackNavigator';
import { ComparisonView } from '@/components/ComparisonView';
import { useUploadStore } from '@/stores/uploadStore';
import { useAnalysisStore } from '@/stores/analysisStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ClientOnly } from '@/components/ClientOnly';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useConfig, useTrackAnalysis, useConnectionStatus } from '@/hooks/useApi';
import { useToast } from '@/components/ui/toast';
import { Loader2, Wifi, WifiOff, AlertCircle } from 'lucide-react';
import { isNetworkError, isServerError, isAPIError } from '@/lib/api-client';
import { DEFAULT_PARAMETERS } from '@/lib/defaults';

export default function AnalyzePage() {
  const uploadStore = useUploadStore();
  const analysisStore = useAnalysisStore();
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

  const handleAnalyzeTrack = (file: File, windDirection: number) => {
    const fileWithMeta = uploadStore.files.find((f) => f.file === file);
    if (!fileWithMeta) return;

    // Update wind direction in params for this analysis
    const params = {
      ...analysisStore.parameters,
      windDirection,
    };

    // Start analysis
    analysisStore.setAnalyzing(true);

    trackAnalysis.mutate(
      {
        file,
        params,
        fileId: fileWithMeta.id,
      },
      {
        onSuccess: (result) => {
          // Update analysis store with results
          analysisStore.setSegments(result.segments || []);
          analysisStore.setWindAnalysis({
            estimatedDirection: result.wind_estimate.direction,
            confidence: result.wind_estimate.confidence,
            algorithmDirection: result.wind_estimate.direction,
            isOverridden: false,
          });
          analysisStore.setPerformanceMetrics({
            avgSpeed: result.performance_metrics.avg_speed,
            avgUpwindAngle: result.performance_metrics.avg_upwind_angle,
            bestUpwindAngle: result.performance_metrics.best_upwind_angle,
            vmgUpwind: result.performance_metrics.vmg_upwind,
            vmgDownwind: result.performance_metrics.vmg_downwind,
            portTackCount: result.performance_metrics.port_tack_count,
            starboardTackCount: result.performance_metrics.starboard_tack_count,
          });
          analysisStore.setAnalyzing(false);
          
          // Set this as the current file if no file is currently selected
          if (!uploadStore.currentFileId) {
            uploadStore.setCurrentFileId(fileWithMeta.id);
          }

          addToast({
            title: 'Analysis Complete',
            description: `Successfully analyzed ${file.name}`,
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
            duration: 8000, // Show longer for errors
          });
        },
      }
    );
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

  // Handle track selection
  const handleTrackSelect = (fileId: string) => {
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
        {/* Header with Status */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold mb-2">Track Analysis</h1>
              <p className="text-gray-600">
                Upload your GPX files to analyze sailing performance
              </p>
            </div>
            
            {/* Connection Status */}
            <Card className="p-3">
              <div className="flex items-center gap-2 text-sm">
                {connectionStatus.isConnected ? (
                  <>
                    <Wifi className="h-4 w-4 text-green-600" />
                    <span className="text-green-600">Connected</span>
                  </>
                ) : connectionStatus.isChecking ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                    <span className="text-gray-600">Checking...</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="h-4 w-4 text-red-600" />
                    <span className="text-red-600">Disconnected</span>
                  </>
                )}
              </div>
            </Card>
          </div>

          {/* Configuration Status */}
          {configLoading && (
            <Card className="mb-4 p-4">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                <span>Loading configuration...</span>
              </div>
            </Card>
          )}

          {configError && (
            <Card className="mb-4 p-4 border-yellow-200 bg-yellow-50">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-yellow-600" />
                <span className="text-yellow-800">Using default configuration</span>
              </div>
            </Card>
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
              onParametersChange={(params) => {
                // Parameters already updated via store in ParameterControls
                // Could add analytics tracking here if needed
              }}
              onReanalyze={() => {
                // Re-analyze current file with new parameters
                if (currentFile) {
                  handleAnalyzeTrack(currentFile.file, analysisStore.parameters.windDirection);
                }
              }}
              disabled={analysisStore.isAnalyzing || !connectionStatus.isConnected}
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
                    /* Individual Track Results */
                    currentResult && (
                      <Card className="mb-8">
                        <CardHeader>
                          <CardTitle>Analysis Results</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <SimpleAnalysisResults 
                            result={currentResult} 
                            gpsData={currentFile?.gpsData}
                            fileId={currentFile?.id}
                          />
                        </CardContent>
                      </Card>
                    )
                  )}
                </>
              )}
              
            </ClientOnly>
          </div>
        </div>

        {/* Feedback and Bug Report Section */}
        <Card className="mt-12 border-amber-200 bg-amber-50">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <span className="text-2xl">🐛</span>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-amber-900 mb-2">
                  Found a Bug or Have Feedback?
                </h3>
                <p className="text-amber-800 mb-4 leading-relaxed">
                  This is a prototype built in spare time - you'll probably find bugs, quirks, or things that don't work as expected. 
                  That's totally normal! Your feedback helps make this tool better for everyone.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <a 
                    href="https://www.instagram.com/heart_wrench/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-amber-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-amber-700 transition-colors"
                  >
                    <span>📱</span>
                    Report Bug on Instagram
                  </a>
                  <span className="text-amber-700 text-sm flex items-center">
                    Screenshots and details are super helpful!
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
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