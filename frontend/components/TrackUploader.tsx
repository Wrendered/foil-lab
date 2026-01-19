'use client';

import { useCallback, useState } from 'react';
import { useDropzone, FileRejection, ErrorCode } from 'react-dropzone';
import { Upload, AlertCircle, ChevronDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { TrackFileCard } from '@/components/TrackFileCard';
import { useUploadStore } from '@/stores/uploadStore';
import { parseGPXFile } from '@/lib/gpx-parser';
import { loadSampleGPX } from '@/lib/sample-loader';
import { cn } from '@/lib/utils';

interface TrackUploaderProps {
  onAnalyze: (file: File, windDirection: number) => void;
  isAnalyzing?: boolean;
  disabled?: boolean;
  className?: string;
}

export function TrackUploader({
  onAnalyze,
  isAnalyzing = false,
  disabled = false,
  className,
}: TrackUploaderProps) {
  const uploadStore = useUploadStore();
  const [rejectedFiles, setRejectedFiles] = useState<Array<{ file: File; errors: string[] }>>([]);
  const maxSize = 50 * 1024 * 1024; // 50MB

  const onDrop = useCallback(
    async (acceptedFiles: File[], fileRejections: FileRejection[]) => {
      setRejectedFiles([]);

      // Handle accepted files
      for (const file of acceptedFiles) {
        const fileId = uploadStore.addFile(file);

        // Parse metadata immediately after adding
        try {
          const { gpsPoints, metadata } = await parseGPXFile(file);
          uploadStore.setFileGPSData(fileId, gpsPoints, metadata);
        } catch (error) {
          console.error('Failed to parse GPX:', error);
          uploadStore.updateFileStatus(fileId, 'error', 'Failed to parse GPX file');
        }
      }

      // Handle rejected files
      if (fileRejections.length > 0) {
        const rejected = fileRejections.map((rejection) => ({
          file: rejection.file,
          errors: rejection.errors.map((e) => {
            if (e.code === ErrorCode.FileInvalidType) {
              return 'Only GPX files are allowed';
            }
            if (e.code === ErrorCode.FileTooLarge) {
              return `File is too large (max ${(maxSize / 1024 / 1024).toFixed(0)}MB)`;
            }
            return e.message;
          }),
        }));
        setRejectedFiles(rejected);
      }
    },
    [uploadStore, maxSize]
  );

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: {
      'application/gpx+xml': ['.gpx'],
      'application/xml': ['.gpx'],
    },
    maxSize,
    multiple: true,
  });

  const handleAnalyze = (fileId: string, windDirection: number) => {
    const file = uploadStore.files.find(f => f.id === fileId);
    if (file) {
      onAnalyze(file.file, windDirection);
    }
  };

  const handleRemove = (fileId: string) => {
    uploadStore.removeFile(fileId);
  };

  const handleLoadSample = async () => {
    try {
      const sampleFiles = await loadSampleGPX();
      onDrop(sampleFiles, []);
    } catch (error) {
      console.error('Failed to load samples:', error);
    }
  };

  const pendingFiles = uploadStore.files.filter(f => f.status === 'pending');
  const processingFiles = uploadStore.files.filter(f => f.status === 'uploading' || f.status === 'processing');
  const completedFiles = uploadStore.files.filter(f => f.status === 'completed');

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Upload GPX Tracks</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Dropzone */}
        <div
          {...getRootProps()}
          className={cn(
            'relative rounded-lg border-2 border-dashed p-6 text-center transition-colors cursor-pointer',
            'hover:border-primary hover:bg-muted/50',
            isDragActive && 'border-primary bg-primary/5',
            isDragReject && 'border-destructive bg-destructive/5',
          )}
        >
          <input {...getInputProps()} />

          <div className="flex flex-col items-center gap-3">
            <div className={cn(
              'rounded-full p-3 transition-colors',
              isDragActive ? 'bg-primary/10' : 'bg-muted'
            )}>
              <Upload className={cn(
                'h-6 w-6 transition-colors',
                isDragActive ? 'text-primary' : 'text-muted-foreground'
              )} />
            </div>

            <div className="space-y-1">
              <p className="font-medium">
                {isDragActive ? 'Drop your GPX files here' : 'Drag & drop GPX files'}
              </p>
              <p className="text-sm text-muted-foreground">
                or click to browse
              </p>
            </div>
          </div>
        </div>

        {/* Sample & Help Section */}
        <div className="flex items-center justify-center gap-3 text-xs">
          <button
            type="button"
            onClick={handleLoadSample}
            className="text-blue-600 hover:text-blue-700 hover:underline"
          >
            Try with sample data
          </button>
          <span className="text-gray-300">|</span>
          <Collapsible className="relative">
            <CollapsibleTrigger className="text-blue-600 hover:text-blue-700 flex items-center gap-0.5">
              How to export from Strava
              <ChevronDown className="h-3 w-3" />
            </CollapsibleTrigger>
            <CollapsibleContent className="absolute z-50 mt-2 bg-white border rounded-lg shadow-lg p-4 max-w-xs text-left">
              <ol className="space-y-2 text-xs text-gray-600 list-decimal list-inside">
                <li>Go to <span className="font-medium">strava.com</span> (website, not app)</li>
                <li>Open your activity</li>
                <li>Click the <span className="font-medium">"GPX"</span> button on the map</li>
                <li>Drop the downloaded file here</li>
              </ol>
              <p className="mt-2 text-xs text-gray-400">Free for your own activities. No mobile app export available.</p>
            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* Rejected files */}
        {rejectedFiles.length > 0 && (
          <div className="space-y-2">
            {rejectedFiles.map(({ file, errors }, index) => (
              <div
                key={index}
                className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3"
              >
                <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{file.name}</p>
                  {errors.map((error, i) => (
                    <p key={i} className="text-xs text-destructive">{error}</p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Track file cards */}
        {uploadStore.files.length > 0 && (
          <div className="space-y-3">
            {/* Pending files first */}
            {pendingFiles.map((file) => (
              <TrackFileCard
                key={file.id}
                file={file}
                onAnalyze={(windDir) => handleAnalyze(file.id, windDir)}
                onRemove={() => handleRemove(file.id)}
                isAnalyzing={isAnalyzing}
                disabled={disabled}
              />
            ))}

            {/* Processing files */}
            {processingFiles.map((file) => (
              <TrackFileCard
                key={file.id}
                file={file}
                onAnalyze={(windDir) => handleAnalyze(file.id, windDir)}
                onRemove={() => handleRemove(file.id)}
                isAnalyzing={true}
                disabled={disabled}
              />
            ))}

            {/* Completed files */}
            {completedFiles.map((file) => (
              <TrackFileCard
                key={file.id}
                file={file}
                onAnalyze={(windDir) => handleAnalyze(file.id, windDir)}
                onRemove={() => handleRemove(file.id)}
                isAnalyzing={false}
                disabled={disabled}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
