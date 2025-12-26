import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { GPSPoint, GPXMetadata } from '@/lib/gpx-parser';
import { AnalysisResult } from '@/lib/api-client';

export interface FileWithMetadata {
  file: File;
  id: string;
  name: string;
  displayName?: string; // User-editable name for the track
  size: number;
  uploadProgress: number;
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'error';
  error?: string;
  warning?: string; // Non-blocking warning (e.g., GPS parse failed but analysis succeeded)
  result?: AnalysisResult;
  gpsData?: GPSPoint[];
  metadata?: GPXMetadata;
  windDirection?: number; // Looked up or user-set wind direction
  windSpeed?: number; // Looked up wind speed (knots)
  windLookupDone?: boolean; // Whether wind lookup has completed
}

interface UploadState {
  files: FileWithMetadata[];
  isUploading: boolean;
  currentFileId: string | null;
  
  // Actions
  addFile: (file: File) => string; // Returns the generated ID
  removeFile: (id: string) => void;
  updateFileProgress: (id: string, progress: number) => void;
  updateFileStatus: (id: string, status: FileWithMetadata['status'], error?: string) => void;
  setFileResult: (id: string, result: AnalysisResult) => void;
  setFileGPSData: (id: string, gpsData: GPSPoint[], metadata: GPXMetadata) => void;
  setFileWarning: (id: string, warning: string) => void;
  setFileWindData: (id: string, windDirection: number, windSpeed?: number) => void;
  setDisplayName: (id: string, displayName: string) => void;
  setCurrentFileId: (id: string | null) => void;
  clearCompleted: () => void;
  reset: () => void;
}

export const useUploadStore = create<UploadState>()(
  immer((set) => ({
    files: [],
    isUploading: false,
    currentFileId: null,

    addFile: (file) => {
      const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      set((state) => {
        state.files.push({
          file,
          id,
          name: file.name,
          size: file.size,
          uploadProgress: 0,
          status: 'pending',
        });
      });
      return id;
    },

    removeFile: (id) =>
      set((state) => {
        state.files = state.files.filter((f) => f.id !== id);
      }),

    updateFileProgress: (id, progress) =>
      set((state) => {
        const file = state.files.find((f) => f.id === id);
        if (file) {
          file.uploadProgress = progress;
        }
      }),

    updateFileStatus: (id, status, error) =>
      set((state) => {
        const file = state.files.find((f) => f.id === id);
        if (file) {
          file.status = status;
          if (error) {
            file.error = error;
          }
        }
        // Update global uploading state
        state.isUploading = state.files.some(
          (f) => f.status === 'uploading' || f.status === 'processing'
        );
      }),

    setFileResult: (id, result) =>
      set((state) => {
        const file = state.files.find((f) => f.id === id);
        if (file) {
          file.result = result;
        }
      }),

    setFileGPSData: (id, gpsData, metadata) =>
      set((state) => {
        const file = state.files.find((f) => f.id === id);
        if (file) {
          file.gpsData = gpsData;
          file.metadata = metadata;
        }
      }),

    setFileWarning: (id, warning) =>
      set((state) => {
        const file = state.files.find((f) => f.id === id);
        if (file) {
          file.warning = warning;
        }
      }),

    setFileWindData: (id, windDirection, windSpeed) =>
      set((state) => {
        const file = state.files.find((f) => f.id === id);
        if (file) {
          file.windDirection = windDirection;
          file.windSpeed = windSpeed;
          file.windLookupDone = true;
        }
      }),

    setDisplayName: (id, displayName) =>
      set((state) => {
        const file = state.files.find((f) => f.id === id);
        if (file) {
          file.displayName = displayName.trim() || undefined;
        }
      }),

    setCurrentFileId: (id) =>
      set((state) => {
        state.currentFileId = id;
      }),

    clearCompleted: () =>
      set((state) => {
        state.files = state.files.filter(
          (f) => f.status !== 'completed' && f.status !== 'error'
        );
      }),

    reset: () =>
      set((state) => {
        state.files = [];
        state.isUploading = false;
        state.currentFileId = null;
      }),
  }))
);