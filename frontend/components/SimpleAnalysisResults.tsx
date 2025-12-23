'use client';

import { useState } from 'react';
import { AnalysisResult } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useUploadStore } from '@/stores/uploadStore';
import dynamic from 'next/dynamic';
import { SimplePolarPlot } from '@/components/SimplePolarPlot';
import { formatSpeed, formatAngle, formatDistance, formatDuration, SAILING_COLORS } from '@/lib/colors';
import { Switch } from '@/components/ui/switch';
import { Star } from 'lucide-react';

// Dynamic import for testing
const SimpleLeafletMap = dynamic(() => import('@/components/SimpleLeafletMap').then(mod => ({ default: mod.SimpleLeafletMap })), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-96 text-gray-500">
      <p>Loading map...</p>
    </div>
  ),
});

interface SimpleAnalysisResultsProps {
  result: AnalysisResult;
  gpsData?: Array<{ latitude: number; longitude: number; time?: string }>;
  fileId?: string;
}

export function SimpleAnalysisResults({ result, gpsData, fileId }: SimpleAnalysisResultsProps) {
  const metrics = result.performance_metrics;
  const windEstimate = result.wind_estimate;
  const summary = result.track_summary;
  
  // State for VMG highlighting
  const [highlightVMG, setHighlightVMG] = useState(false);
  
  // Use provided GPS data or fall back to empty array
  const gpsPoints = gpsData || [];
  
  // Debug removed to prevent console spam
  

  return (
    <div className="space-y-6">
      {/* Map and Polar Plot */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Track Map
              <div className="flex items-center gap-2 text-sm font-normal">
                <Star className="h-4 w-4 text-yellow-500" />
                <span>Highlight VMG Segments ({metrics.vmg_segment_ids?.length || 'N/A'})</span>
                <Switch 
                  checked={highlightVMG}
                  onCheckedChange={setHighlightVMG}
                />
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div>
              <p className="mb-2 text-sm text-gray-600">
                GPS Points: {gpsPoints.length}
              </p>
              <SimpleLeafletMap 
                key="single-map"
                gpxData={gpsPoints}
                segments={result.segments}
                windDirection={windEstimate.direction}
                highlightVMG={highlightVMG}
                vmgSegmentIds={metrics.vmg_segment_ids}
              />
            </div>
          </CardContent>
        </Card>
        <SimplePolarPlot segments={result.segments} />
      </div>
      {/* Top Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{result.segments.length}</div>
            <div className="text-sm text-gray-600">Segments</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{formatAngle(windEstimate.direction)}</div>
            <div className="text-sm text-gray-600">Wind Direction</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">
              {metrics.vmg_upwind ? formatSpeed(metrics.vmg_upwind) : 'N/A'}
            </div>
            <div className="text-sm text-gray-600">VMG Upwind</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">
              {formatSpeed(summary.avg_speed_knots)}
            </div>
            <div className="text-sm text-gray-600">Avg Speed</div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Details */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium text-gray-700 mb-4">Upwind Performance</h4>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Best Upwind Angle:</span>
                  <span className="font-medium">
                    {metrics.best_upwind_angle ? formatAngle(metrics.best_upwind_angle) : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Avg Upwind Angle:</span>
                  <span className="font-medium">
                    {metrics.avg_upwind_angle ? formatAngle(metrics.avg_upwind_angle) : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">VMG Upwind:</span>
                  <span className="font-medium">
                    {metrics.vmg_upwind ? formatSpeed(metrics.vmg_upwind) : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Port Tacks:</span>
                  <span className="font-medium">{metrics.port_tack_count}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Starboard Tacks:</span>
                  <span className="font-medium">{metrics.starboard_tack_count}</span>
                </div>
              </div>
            </div>
            
            <div>
              <h4 className="font-medium text-gray-700 mb-4">Session Summary</h4>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Distance:</span>
                  <span className="font-medium">
                    {formatDistance(summary.total_distance * 1000)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Duration:</span>
                  <span className="font-medium">
                    {formatDuration(summary.duration_seconds)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Max Speed:</span>
                  <span className="font-medium">
                    {formatSpeed(summary.max_speed_knots)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Avg Speed:</span>
                  <span className="font-medium">
                    {formatSpeed(summary.avg_speed_knots)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Wind Analysis */}
      <Card>
        <CardHeader>
          <CardTitle>Wind Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-blue-600">
                {windEstimate.port_segments}
              </div>
              <div className="text-sm text-gray-600">Port Segments</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">
                {windEstimate.starboard_segments}
              </div>
              <div className="text-sm text-gray-600">Starboard Segments</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-purple-600">
                {formatAngle(windEstimate.port_average_angle)}
              </div>
              <div className="text-sm text-gray-600">Port Best Angle</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-orange-600">
                {formatAngle(windEstimate.starboard_average_angle)}
              </div>
              <div className="text-sm text-gray-600">Starboard Best Angle</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Segments Table */}
      <Card>
        <CardHeader>
          <CardTitle>Segments ({result.segments.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">ID</th>
                  <th className="text-left p-2">Tack</th>
                  <th className="text-left p-2">Direction</th>
                  <th className="text-left p-2">Speed (kn)</th>
                  <th className="text-left p-2">Angle (°)</th>
                  <th className="text-left p-2">Distance (m)</th>
                  <th className="text-left p-2">Duration (s)</th>
                </tr>
              </thead>
              <tbody>
                {result.segments.slice(0, 10).map((segment) => (
                  <tr key={segment.id} className="border-b">
                    <td className="p-2">{segment.id}</td>
                    <td className="p-2">
                      <span className={`px-2 py-1 rounded text-xs ${
                        segment.tack === 'Port' 
                          ? 'bg-blue-100 text-blue-800' 
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {segment.tack}
                      </span>
                    </td>
                    <td className="p-2">
                      <span className={`px-2 py-1 rounded text-xs ${
                        segment.direction === 'Upwind' 
                          ? 'bg-purple-100 text-purple-800' 
                          : 'bg-orange-100 text-orange-800'
                      }`}>
                        {segment.direction}
                      </span>
                    </td>
                    <td className="p-2">{segment.avg_speed_knots.toFixed(1)}</td>
                    <td className="p-2">{segment.angle_to_wind.toFixed(0)}</td>
                    <td className="p-2">{segment.distance.toFixed(0)}</td>
                    <td className="p-2">{segment.duration.toFixed(0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {result.segments.length > 10 && (
              <div className="text-center text-gray-500 text-sm mt-4">
                Showing first 10 of {result.segments.length} segments
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}