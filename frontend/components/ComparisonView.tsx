'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useUploadStore } from '@/stores/uploadStore';
import { formatSpeed, formatAngle, formatDistance, formatDuration } from '@/lib/colors';
import { 
  TrendingUp, 
  TrendingDown, 
  Minus,
  Wind,
  Gauge,
  Navigation,
  Clock
} from 'lucide-react';

export function ComparisonView() {
  const { files } = useUploadStore();
  
  // Get all analyzed files
  const analyzedFiles = files.filter(f => 
    f.status === 'completed' && f.result
  );

  // Calculate aggregate statistics
  const aggregateStats = useMemo(() => {
    if (analyzedFiles.length === 0) return null;

    // Filter out undefined results and get typed array
    const allResults = analyzedFiles
      .map(f => f.result)
      .filter((r): r is NonNullable<typeof r> => r !== undefined);

    // VMG statistics
    const vmgValues = allResults
      .map(r => r.performance_metrics?.vmg_upwind)
      .filter((v): v is number => v !== null && v !== undefined);

    const avgVMG = vmgValues.length > 0
      ? vmgValues.reduce((a, b) => a + b, 0) / vmgValues.length
      : null;

    const bestVMG = vmgValues.length > 0
      ? Math.max(...vmgValues)
      : null;

    const worstVMG = vmgValues.length > 0
      ? Math.min(...vmgValues)
      : null;

    // Speed statistics
    const speedValues = allResults
      .map(r => r.performance_metrics?.avg_speed)
      .filter((v): v is number => v !== null && v !== undefined);

    const avgSpeed = speedValues.length > 0
      ? speedValues.reduce((a, b) => a + b, 0) / speedValues.length
      : null;

    // Distance statistics
    const totalDistance = allResults
      .reduce((sum, r) => sum + (r.track_summary?.total_distance || 0), 0);

    // Angle statistics
    const angleValues = allResults
      .map(r => r.performance_metrics?.best_upwind_angle)
      .filter((v): v is number => v !== null && v !== undefined);
    
    const bestAngle = angleValues.length > 0
      ? Math.min(...angleValues)
      : null;

    return {
      avgVMG,
      bestVMG,
      worstVMG,
      avgSpeed,
      totalDistance,
      bestAngle,
      trackCount: analyzedFiles.length
    };
  }, [analyzedFiles]);

  if (!aggregateStats || analyzedFiles.length < 2) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-gray-500">Upload and analyze at least 2 tracks to compare</p>
        </CardContent>
      </Card>
    );
  }

  const getTrendIcon = (value: number | null, reference: number | null, higherIsBetter = true) => {
    if (!value || !reference) return <Minus className="h-4 w-4 text-gray-400" />;
    
    const diff = value - reference;
    if (Math.abs(diff) < 0.01) return <Minus className="h-4 w-4 text-gray-400" />;
    
    const isPositive = higherIsBetter ? diff > 0 : diff < 0;
    return isPositive 
      ? <TrendingUp className="h-4 w-4 text-green-600" />
      : <TrendingDown className="h-4 w-4 text-red-600" />;
  };

  return (
    <div className="space-y-6">
      {/* Summary Statistics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">
                  {aggregateStats.avgVMG ? formatSpeed(aggregateStats.avgVMG) : 'N/A'}
                </p>
                <p className="text-sm text-gray-600">Average VMG</p>
              </div>
              <Gauge className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">
                  {aggregateStats.bestVMG ? formatSpeed(aggregateStats.bestVMG) : 'N/A'}
                </p>
                <p className="text-sm text-gray-600">Best VMG</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">
                  {aggregateStats.bestAngle ? formatAngle(aggregateStats.bestAngle) : 'N/A'}
                </p>
                <p className="text-sm text-gray-600">Best Angle</p>
              </div>
              <Wind className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">
                  {formatDistance(aggregateStats.totalDistance * 1000)}
                </p>
                <p className="text-sm text-gray-600">Total Distance</p>
              </div>
              <Navigation className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Individual Track Comparison Table */}
      <Card>
        <CardHeader>
          <CardTitle>Track Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Track</th>
                  <th className="text-center p-2">Date</th>
                  <th className="text-center p-2">VMG</th>
                  <th className="text-center p-2">Avg Speed</th>
                  <th className="text-center p-2">Best Angle</th>
                  <th className="text-center p-2">Distance</th>
                  <th className="text-center p-2">Duration</th>
                  <th className="text-center p-2">Segments</th>
                </tr>
              </thead>
              <tbody>
                {analyzedFiles.map((file, index) => {
                  const result = file.result;
                  if (!result) return null;
                  const metrics = result.performance_metrics;
                  const summary = result.track_summary;
                  const referenceMetrics = analyzedFiles[0]?.result?.performance_metrics;

                  return (
                    <tr key={file.id} className="border-b hover:bg-gray-50">
                      <td className="p-2">
                        <div>
                          <p className="font-medium truncate max-w-[200px]">
                            {file.name}
                          </p>
                          {index === 0 && (
                            <Badge variant="outline" className="text-xs mt-1">
                              Reference
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="text-center p-2 text-sm">
                        {file.metadata?.time ?
                          new Date(file.metadata.time).toLocaleDateString() :
                          '-'
                        }
                      </td>
                      <td className="text-center p-2">
                        <div className="flex items-center justify-center gap-2">
                          <span className="font-medium">
                            {metrics?.vmg_upwind ? formatSpeed(metrics.vmg_upwind) : '-'}
                          </span>
                          {index > 0 && getTrendIcon(
                            metrics?.vmg_upwind ?? null,
                            referenceMetrics?.vmg_upwind ?? null,
                            true
                          )}
                        </div>
                      </td>
                      <td className="text-center p-2">
                        {metrics?.avg_speed ? formatSpeed(metrics.avg_speed) : '-'}
                      </td>
                      <td className="text-center p-2">
                        <div className="flex items-center justify-center gap-2">
                          <span>
                            {metrics?.best_upwind_angle ? formatAngle(metrics.best_upwind_angle) : '-'}
                          </span>
                          {index > 0 && getTrendIcon(
                            metrics?.best_upwind_angle ?? null,
                            referenceMetrics?.best_upwind_angle ?? null,
                            false // Lower angle is better
                          )}
                        </div>
                      </td>
                      <td className="text-center p-2">
                        {summary?.total_distance ?
                          formatDistance(summary.total_distance * 1000) :
                          '-'
                        }
                      </td>
                      <td className="text-center p-2">
                        {summary?.duration_seconds ?
                          formatDuration(summary.duration_seconds) :
                          '-'
                        }
                      </td>
                      <td className="text-center p-2">
                        {result.segments?.length ?? 0}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          {/* Comparison insights */}
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2">Insights</h4>
            <ul className="space-y-1 text-sm text-blue-800">
              {aggregateStats.bestVMG && aggregateStats.worstVMG && (
                <li>
                  • VMG range: {formatSpeed(aggregateStats.worstVMG)} - {formatSpeed(aggregateStats.bestVMG)} 
                  ({((aggregateStats.bestVMG - aggregateStats.worstVMG) / aggregateStats.worstVMG * 100).toFixed(0)}% variation)
                </li>
              )}
              {aggregateStats.avgSpeed && (
                <li>• Average speed across all sessions: {formatSpeed(aggregateStats.avgSpeed)}</li>
              )}
              <li>• Total sailing distance: {formatDistance(aggregateStats.totalDistance * 1000)}</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}