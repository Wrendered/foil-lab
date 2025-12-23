import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { GPSPoint, GPXMetadata } from '@/lib/gpx-parser';
import { AnalysisResult } from '@/lib/api-client';

export interface FileWithMetadata {
  file: File;
  id: string;
  name: string;
  size: number;
  uploadProgress: number;
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'error';
  error?: string;
  result?: AnalysisResult;
  gpsData?: GPSPoint[];
  metadata?: GPXMetadata;
}

interface UploadState {
  files: FileWithMetadata[];
  isUploading: boolean;
  currentFileId: string | null;
  
  // Actions
  addFile: (file: File) => void;
  removeFile: (id: string) => void;
  updateFileProgress: (id: string, progress: number) => void;
  updateFileStatus: (id: string, status: FileWithMetadata['status'], error?: string) => void;
  setFileResult: (id: string, result: AnalysisResult) => void;
  setFileGPSData: (id: string, gpsData: GPSPoint[], metadata: GPXMetadata) => void;
  setCurrentFileId: (id: string | null) => void;
  clearCompleted: () => void;
  reset: () => void;
}

export const useUploadStore = create<UploadState>()(
  immer((set) => ({
    files: [],
    isUploading: false,
    currentFileId: null,

    addFile: (file) =>
      set((state) => {
        const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        state.files.push({
          file,
          id,
          name: file.name,
          size: file.size,
          uploadProgress: 0,
          status: 'pending',
        });
      }),

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