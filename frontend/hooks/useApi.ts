import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getConfig,
  healthCheck,
  analyzeTrack,
  lookupWind,
  apiKeys,
  AnalysisResult,
  ConfigResponse,
  HistoricalWindResponse,
  APIError,
  FilterParameters,
} from '@/lib/api-client';
import { AnalysisParameters } from '@/stores/analysisStore';
import { useUploadStore } from '@/stores/uploadStore';
import { parseGPXFile } from '@/lib/gpx-parser';

// Configuration hook
export function useConfig() {
  return useQuery({
    queryKey: apiKeys.config(),
    queryFn: getConfig,
    staleTime: 1000 * 60 * 60, // 1 hour - config rarely changes
    gcTime: 1000 * 60 * 60 * 24, // 24 hours
    retry: (failureCount, error) => {
      // Don't retry on 4xx errors
      if (error instanceof APIError && error.status >= 400 && error.status < 500) {
        return false;
      }
      return failureCount < 2;
    },
  });
}

// Health check hook
export function useHealthCheck() {
  return useQuery({
    queryKey: apiKeys.health(),
    queryFn: healthCheck,
    staleTime: 1000 * 30, // 30 seconds
    gcTime: 1000 * 60 * 5, // 5 minutes
    retry: 1,
    refetchInterval: 1000 * 60 * 5, // Check every 5 minutes
  });
}

// Track analysis hook
export function useTrackAnalysis() {
  const queryClient = useQueryClient();
  const uploadStore = useUploadStore();

  return useMutation({
    mutationFn: async ({
      file,
      params,
      fileId,
      filters,
    }: {
      file: File;
      params: Partial<AnalysisParameters>;
      fileId: string;
      filters?: FilterParameters;
    }) => {
      const onProgress = (progress: number) => {
        uploadStore.updateFileProgress(fileId, progress);
      };

      uploadStore.updateFileStatus(fileId, 'uploading');

      try {
        const result = await analyzeTrack(file, params, onProgress, filters);

        uploadStore.updateFileStatus(fileId, 'completed');
        uploadStore.setFileResult(fileId, result);

        // Parse GPS data if not already available
        const existingFile = uploadStore.files.find(f => f.id === fileId);
        if (existingFile && !existingFile.gpsData) {
          try {
            const { gpsPoints, metadata } = await parseGPXFile(file);
            uploadStore.setFileGPSData(fileId, gpsPoints, metadata);
          } catch (error) {
            console.error('Failed to parse GPS data:', error);
          }
        }

        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Analysis failed';
        uploadStore.updateFileStatus(fileId, 'error', errorMessage);
        throw error;
      }
    },
    onSuccess: (data, variables) => {
      // Cache the analysis result
      queryClient.setQueryData(
        apiKeys.analysis(variables.file, variables.params),
        data
      );
    },
    onError: (error, variables) => {
      console.error('Analysis failed:', error);
      
      // Invalidate related queries on error
      queryClient.invalidateQueries({
        queryKey: apiKeys.tracks(),
      });
    },
  });
}

// Batch analysis hook for multiple files
export function useBatchAnalysis() {
  const trackAnalysis = useTrackAnalysis();
  const uploadStore = useUploadStore();

  return useMutation({
    mutationFn: async ({
      files,
      params,
    }: {
      files: Array<{ file: File; fileId: string }>;
      params: Partial<AnalysisParameters>;
    }) => {
      const results: AnalysisResult[] = [];
      
      // Process files sequentially to avoid overwhelming the server
      for (const { file, fileId } of files) {
        try {
          const result = await trackAnalysis.mutateAsync({
            file,
            params,
            fileId,
          });
          results.push(result);
        } catch (error) {
          console.error(`Failed to analyze ${file.name}:`, error);
          // Continue with other files even if one fails
        }
      }

      return results;
    },
  });
}

// Hook to get cached analysis result
export function useAnalysisResult(file: File | null, params: Partial<AnalysisParameters>) {
  return useQuery({
    queryKey: file ? apiKeys.analysis(file, params) : ['analysis', 'empty'],
    queryFn: () => {
      throw new Error('Analysis result should be set via mutation');
    },
    enabled: false, // Only get from cache, never fetch
  });
}

// Connection status hook
export function useConnectionStatus() {
  const { data: health, error, isLoading } = useHealthCheck();
  
  const status = error
    ? 'disconnected'
    : isLoading
    ? 'checking'
    : health
    ? 'connected'
    : 'unknown';

  return {
    status,
    isConnected: status === 'connected',
    isChecking: status === 'checking',
    error: error instanceof Error ? error.message : null,
  };
}

// Hook for retrying failed requests
export function useRetryMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (queryKey: readonly unknown[]) => {
      await queryClient.refetchQueries({ queryKey });
    },
  });
}

// Global error handler hook
export function useGlobalErrorHandler() {
  const queryClient = useQueryClient();

  const clearErrors = () => {
    queryClient.resetQueries({
      predicate: (query) => query.state.status === 'error',
    });
  };

  const retryAll = () => {
    queryClient.refetchQueries({
      predicate: (query) => query.state.status === 'error',
    });
  };

  return {
    clearErrors,
    retryAll,
  };
}

// Wind lookup hook
export function useLookupWind() {
  return useMutation({
    mutationFn: async ({
      latitude,
      longitude,
      date,
      hour,
    }: {
      latitude: number;
      longitude: number;
      date: string;
      hour: number;
    }) => {
      return lookupWind(latitude, longitude, date, hour);
    },
  });
}