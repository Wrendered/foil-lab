'use client';

import React, { useCallback, useState } from 'react';
import { useDropzone, FileRejection, ErrorCode } from 'react-dropzone';
import { Upload, X, FileText, AlertCircle, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUploadStore, FileWithMetadata } from '@/stores/uploadStore';
import { parseGPXFile, GPXMetadata } from '@/lib/gpx-parser';
import { cn } from '@/lib/utils';

interface FileUploadProps {
  onFileSelect?: (file: File) => void;
  multiple?: boolean;
  maxSize?: number; // in bytes
  className?: string;
}

export function FileUpload({
  onFileSelect,
  multiple = false,
  maxSize = 50 * 1024 * 1024, // 50MB default
  className,
}: FileUploadProps) {
  const { files, addFile, removeFile, setFileGPSData } = useUploadStore();
  const [rejectedFiles, setRejectedFiles] = useState<
    Array<{ file: File; errors: string[] }>
  >([]);

  const onDrop = useCallback(
    (acceptedFiles: File[], fileRejections: FileRejection[]) => {
      // Clear previous rejections
      setRejectedFiles([]);

      // Handle accepted files
      acceptedFiles.forEach((file) => {
        addFile(file);
        if (onFileSelect) {
          onFileSelect(file);
        }
      });

      // Handle rejected files
      if (fileRejections.length > 0) {
        const rejected = fileRejections.map((rejection) => ({
          file: rejection.file,
          errors: rejection.errors.map((e) => {
            if (e.code === ErrorCode.FileInvalidType) {
              return 'Only GPX files are allowed';
            }
            if (e.code === ErrorCode.FileTooLarge) {
              return `File is too large (max ${(maxSize / 1024 / 1024).toFixed(
                0
              )}MB)`;
            }
            return e.message;
          }),
        }));
        setRejectedFiles(rejected);
      }
    },
    [addFile, onFileSelect, maxSize]
  );

  const { getRootProps, getInputProps, isDragActive, isDragReject } =
    useDropzone({
      onDrop,
      accept: {
        'application/gpx+xml': ['.gpx'],
        'application/xml': ['.gpx'],
      },
      maxSize,
      multiple,
    });

  interface ExtractedMetadata {
    points: number;
    time: string | null;
    name: string | null;
    bounds: GPXMetadata['bounds'];
  }

  const extractGPXMetadata = async (file: File): Promise<ExtractedMetadata | null> => {
    try {
      const { gpsPoints, metadata } = await parseGPXFile(file);

      // Store GPS data in the upload store
      const fileId = files.find(f => f.file === file)?.id;
      if (fileId) {
        setFileGPSData(fileId, gpsPoints, metadata);
      }

      return {
        points: metadata.points,
        time: metadata.time ?? null,
        name: metadata.name ?? null,
        bounds: metadata.bounds
      };
    } catch (error) {
      return null;
    }
  };

  return (
    <div className={cn('w-full', className)}>
      <div
        {...getRootProps()}
        className={cn(
          'relative rounded-lg border-2 border-dashed p-8 text-center transition-colors cursor-pointer',
          'hover:border-primary hover:bg-muted/50',
          isDragActive && 'border-primary bg-primary/5',
          isDragReject && 'border-destructive bg-destructive/5',
          className
        )}
      >
        <input {...getInputProps()} />

        <div className="flex flex-col items-center justify-center gap-4">
          <div
            className={cn(
              'rounded-full p-4 transition-colors',
              isDragActive ? 'bg-primary/10' : 'bg-muted'
            )}
          >
            <Upload
              className={cn(
                'h-8 w-8 transition-colors',
                isDragActive ? 'text-primary' : 'text-muted-foreground'
              )}
            />
          </div>

          <div className="space-y-2">
            <p className="text-lg font-medium">
              {isDragActive
                ? 'Drop your GPX file here'
                : 'Drag & drop your GPX file here'}
            </p>
            <p className="text-sm text-muted-foreground">
              or click to browse your files
            </p>
            <p className="text-xs text-muted-foreground">
              Maximum file size: {(maxSize / 1024 / 1024).toFixed(0)}MB
            </p>
          </div>

          <span className="inline-flex items-center px-3 py-2 mt-2 text-sm font-medium rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground">
            Select File
          </span>
        </div>
      </div>

      {/* File Queue */}
      {files.length > 0 && (
        <div className="mt-4 space-y-2">
          <h3 className="text-sm font-medium">Selected Files</h3>
          {files.map((file) => (
            <FileItem
              key={file.id}
              file={file}
              onRemove={() => removeFile(file.id)}
              onMetadataLoad={extractGPXMetadata}
            />
          ))}
        </div>
      )}

      {/* Rejected Files */}
      {rejectedFiles.length > 0 && (
        <div className="mt-4 space-y-2">
          <h3 className="text-sm font-medium text-destructive">
            Rejected Files
          </h3>
          {rejectedFiles.map(({ file, errors }, index) => (
            <div
              key={index}
              className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3"
            >
              <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{file.name}</p>
                {errors.map((error, i) => (
                  <p key={i} className="text-xs text-destructive">
                    {error}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface FileItemMetadata {
  points: number;
  time: string | null;
}

interface FileItemProps {
  file: FileWithMetadata;
  onRemove: () => void;
  onMetadataLoad?: (file: File) => Promise<FileItemMetadata | null>;
}

function FileItem({ file, onRemove, onMetadataLoad }: FileItemProps) {
  const [metadata, setMetadata] = useState<FileItemMetadata | null>(null);
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    if (onMetadataLoad) {
      onMetadataLoad(file.file).then((meta) => {
        setMetadata(meta);
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, [file.file, onMetadataLoad]);

  const getStatusIcon = () => {
    switch (file.status) {
      case 'uploading':
      case 'processing':
        return (
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        );
      case 'completed':
        return <Check className="h-4 w-4 text-green-600" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      default:
        return <FileText className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="flex items-start gap-3 rounded-md border bg-card p-3">
      <div className="mt-0.5">{getStatusIcon()}</div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{file.name}</p>
            <p className="text-xs text-muted-foreground">
              {(file.size / 1024).toFixed(1)} KB
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={onRemove}
            disabled={file.status === 'uploading' || file.status === 'processing'}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>

        {loading && (
          <div className="mt-2 h-4 w-32 animate-pulse rounded bg-muted" />
        )}

        {!loading && metadata && (
          <div className="mt-2 space-y-1">
            <p className="text-xs text-muted-foreground">
              Points: {metadata.points.toLocaleString()}
            </p>
            {metadata.time && (
              <p className="text-xs text-muted-foreground">
                Date: {new Date(metadata.time).toLocaleDateString()}
              </p>
            )}
          </div>
        )}

        {file.status === 'uploading' && (
          <div className="mt-2">
            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${file.uploadProgress}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {file.uploadProgress}% uploaded
            </p>
          </div>
        )}

        {file.error && (
          <p className="mt-2 text-xs text-destructive">{file.error}</p>
        )}
      </div>
    </div>
  );
}