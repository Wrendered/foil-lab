'use client';

import { useState } from 'react';
import { useUploadStore } from '@/stores/uploadStore';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  FileText, 
  BarChart3, 
  AlertCircle, 
  Loader2, 
  X,
  CheckCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface TrackNavigatorProps {
  onTrackSelect: (fileId: string) => void;
  onCompareMode: () => void;
  currentFileId: string | null;
  isCompareMode?: boolean;
}

export function TrackNavigator({ 
  onTrackSelect, 
  onCompareMode, 
  currentFileId,
  isCompareMode = false
}: TrackNavigatorProps) {
  const { files, removeFile } = useUploadStore();
  
  // Filter files that have been analyzed
  const analyzedFiles = files.filter(f => 
    f.status === 'completed' && f.result
  );

  if (analyzedFiles.length === 0) {
    return null;
  }

  const getFileIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-3 w-3 text-green-600" />;
      case 'error':
        return <AlertCircle className="h-3 w-3 text-red-600" />;
      case 'processing':
      case 'uploading':
        return <Loader2 className="h-3 w-3 animate-spin" />;
      default:
        return <FileText className="h-3 w-3" />;
    }
  };

  const truncateFileName = (name: string, maxLength = 20) => {
    if (name.length <= maxLength) return name;
    const ext = name.split('.').pop();
    const nameWithoutExt = name.substring(0, name.lastIndexOf('.'));
    const truncated = nameWithoutExt.substring(0, maxLength - 5 - (ext?.length || 0));
    return `${truncated}...${ext}`;
  };

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-700">Track Analysis</h3>
        {analyzedFiles.length > 1 && (
          <Badge variant="secondary" className="text-xs">
            {analyzedFiles.length} tracks loaded
          </Badge>
        )}
      </div>
      
      <Tabs 
        value={isCompareMode ? 'compare' : currentFileId || ''} 
        className="w-full"
      >
        <TabsList className="w-full flex-wrap h-auto p-1 gap-1">
          {/* Individual track tabs */}
          {analyzedFiles.map((file) => (
            <TabsTrigger
              key={file.id}
              value={file.id}
              onClick={() => onTrackSelect(file.id)}
              className={cn(
                "relative group data-[state=active]:bg-primary data-[state=active]:text-primary-foreground",
                "flex items-center gap-2 px-3 py-1.5"
              )}
            >
              {getFileIcon(file.status)}
              <span className="text-sm">
                {truncateFileName(file.name)}
              </span>
              
              {/* Remove button - only show on hover */}
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  removeFile(file.id);
                }}
                className={cn(
                  "ml-1 p-0.5 rounded-sm opacity-0 group-hover:opacity-100 cursor-pointer",
                  "hover:bg-gray-200 dark:hover:bg-gray-700 transition-opacity",
                  "data-[state=active]:hover:bg-primary-foreground/20"
                )}
              >
                <X className="h-3 w-3" />
              </span>
            </TabsTrigger>
          ))}
          
          {/* Compare mode tab - only show when 2+ tracks */}
          {analyzedFiles.length >= 2 && (
            <TabsTrigger
              value="compare"
              onClick={onCompareMode}
              className={cn(
                "ml-2 border-2 border-dashed",
                isCompareMode ? "border-primary bg-primary/10" : "border-gray-300",
                "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              )}
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              Compare All ({analyzedFiles.length})
            </TabsTrigger>
          )}
        </TabsList>
      </Tabs>
      
      {/* Quick stats for current track */}
      {currentFileId && !isCompareMode && (
        <div className="mt-3 flex gap-4 text-xs text-gray-600">
          {(() => {
            const currentFile = analyzedFiles.find(f => f.id === currentFileId);
            const result = currentFile?.result;
            if (!result) return null;
            
            return (
              <>
                <span>{result.segments?.length || 0} segments</span>
                <span>•</span>
                <span>VMG: {result.performance_metrics?.vmg_upwind?.toFixed(1) || 'N/A'} kn</span>
                <span>•</span>
                <span>
                  {result.track_summary?.total_distance?.toFixed(1) || 0} km
                </span>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}