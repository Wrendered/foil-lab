'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrackSegment } from '@/lib/api-client';
import { Compass } from 'lucide-react';

interface SimplePolarPlotProps {
  segments: TrackSegment[];
  className?: string;
}

export function SimplePolarPlot({ segments, className = '' }: SimplePolarPlotProps) {
  
  // Process data for polar plot
  const polarData = useMemo(() => {
    const upwindSegments = segments.filter(s => s.direction === 'Upwind');
    
    // Group segments by angle ranges for cleaner visualization
    const angleRanges = Array.from({ length: 9 }, (_, i) => i * 10 + 20); // 20-110 degrees
    
    return angleRanges.map(angle => {
      const rangeSegments = upwindSegments.filter(s => 
        s.angle_to_wind >= angle && s.angle_to_wind < angle + 10
      );
      
      if (rangeSegments.length === 0) return null;
      
      const avgSpeed = rangeSegments.reduce((sum, s) => sum + s.avg_speed_knots, 0) / rangeSegments.length;
      const avgAngle = rangeSegments.reduce((sum, s) => sum + s.angle_to_wind, 0) / rangeSegments.length;
      const vmg = avgSpeed * Math.cos((avgAngle * Math.PI) / 180);
      
      // Separate port and starboard
      const portSegments = rangeSegments.filter(s => s.tack === 'Port');
      const starboardSegments = rangeSegments.filter(s => s.tack === 'Starboard');
      
      // Calculate total distances
      const totalDistance = rangeSegments.reduce((sum, s) => sum + s.distance, 0);
      const portDistance = portSegments.reduce((sum, s) => sum + s.distance, 0);
      const starboardDistance = starboardSegments.reduce((sum, s) => sum + s.distance, 0);
      
      return {
        angle: avgAngle,
        speed: avgSpeed,
        vmg: Math.max(0, vmg),
        count: rangeSegments.length,
        totalDistance,
        portCount: portSegments.length,
        starboardCount: starboardSegments.length,
        portDistance,
        starboardDistance,
        portSpeed: portSegments.length > 0 ? 
          portSegments.reduce((sum, s) => sum + s.avg_speed_knots, 0) / portSegments.length : 0,
        starboardSpeed: starboardSegments.length > 0 ? 
          starboardSegments.reduce((sum, s) => sum + s.avg_speed_knots, 0) / starboardSegments.length : 0,
      };
    }).filter(Boolean);
  }, [segments]);

  // Calculate scale values outside of createPolarPlot so they're accessible everywhere
  const scaleInfo = useMemo(() => {
    if (polarData.length === 0) {
      return { scaleMin: 0, scaleMax: 20, scaleRange: 20 };
    }
    
    const speeds = polarData.map(d => d!.speed);
    const maxSpeed = Math.max(...speeds);
    const minSpeed = Math.min(...speeds);
    const speedRange = maxSpeed - minSpeed;
    
    let scaleMin = minSpeed;
    let scaleMax = maxSpeed;
    
    if (speedRange < 3) {
      // For small ranges, pad by 2 knots below and minimal above
      scaleMin = Math.max(0, minSpeed - 2);
      scaleMax = maxSpeed + 0.1;
    } else {
      // For larger ranges, use 70% of min speed as floor and no headroom
      scaleMin = Math.max(0, minSpeed * 0.7);
      scaleMax = maxSpeed;
    }
    
    const scaleRange = scaleMax - scaleMin || 1;
    
    return { scaleMin, scaleMax, scaleRange };
  }, [polarData]);

  // Create polar plot SVG
  const createPolarPlot = () => {
    const centerX = 150;
    const centerY = 150;
    const maxRadius = 120;
    
    const { scaleMin, scaleMax, scaleRange } = scaleInfo;
    const maxDistance = Math.max(...polarData.map(d => d!.totalDistance)) || 1;
    
    return (
      <svg viewBox="0 0 300 300" className="w-full h-64">
        {/* Background circles */}
        {[0.25, 0.5, 0.75, 1].map(fraction => (
          <circle
            key={fraction}
            cx={centerX}
            cy={centerY}
            r={maxRadius * fraction}
            fill="none"
            stroke="#E5E7EB"
            strokeWidth="1"
          />
        ))}
        
        {/* Inner boundary circle if we have a non-zero minimum */}
        {scaleMin > 0 && (
          <circle
            cx={centerX}
            cy={centerY}
            r={2}
            fill="none"
            stroke="#9CA3AF"
            strokeWidth="1"
            strokeDasharray="2,2"
          />
        )}
        
        {/* Angle lines for both sides */}
        {[0, 30, 45, 60, 90].map(angle => {
          const radian = (angle * Math.PI) / 180;
          
          // Right side (starboard)
          const x2Right = centerX + Math.cos(radian - Math.PI/2) * maxRadius;
          const y2Right = centerY + Math.sin(radian - Math.PI/2) * maxRadius;
          
          // Left side (port) - mirror
          const x2Left = centerX - Math.cos(radian - Math.PI/2) * maxRadius;
          const y2Left = centerY + Math.sin(radian - Math.PI/2) * maxRadius;
          
          return (
            <g key={angle}>
              {/* Right side line */}
              <line
                x1={centerX}
                y1={centerY}
                x2={x2Right}
                y2={y2Right}
                stroke="#E5E7EB"
                strokeWidth="1"
              />
              
              {/* Left side line */}
              <line
                x1={centerX}
                y1={centerY}
                x2={x2Left}
                y2={y2Left}
                stroke="#E5E7EB"
                strokeWidth="1"
              />
              
              {/* Right side label */}
              <text
                x={centerX + Math.cos(radian - Math.PI/2) * (maxRadius + 15)}
                y={centerY + Math.sin(radian - Math.PI/2) * (maxRadius + 15)}
                textAnchor="middle"
                fontSize="10"
                fill="#6B7280"
              >
                {angle}°
              </text>
              
              {/* Left side label */}
              <text
                x={centerX - Math.cos(radian - Math.PI/2) * (maxRadius + 15)}
                y={centerY + Math.sin(radian - Math.PI/2) * (maxRadius + 15)}
                textAnchor="middle"
                fontSize="10"
                fill="#6B7280"
              >
                {angle}°
              </text>
            </g>
          );
        })}
        
        {/* Speed labels */}
        {[0.25, 0.5, 0.75, 1].map((fraction, i) => {
          const speed = scaleMin + (scaleRange * fraction);
          return (
            <text
              key={i}
              x={centerX + 5}
              y={centerY - maxRadius * fraction}
              fontSize="10"
              fill="#374151"
              fontWeight="500"
            >
              {speed.toFixed(1)}kn
            </text>
          );
        })}
        
        {/* Data points */}
        {polarData.map((data, index) => {
          if (!data) return null;
          
          const radian = (data.angle * Math.PI) / 180;
          // Scale radius based on the new min/max range
          const normalizedSpeed = (data.speed - scaleMin) / scaleRange;
          const radius = Math.max(0, Math.min(maxRadius, normalizedSpeed * maxRadius));
          
          // Port side (left)
          const portX = centerX - Math.cos(radian - Math.PI/2) * radius;
          const portY = centerY + Math.sin(radian - Math.PI/2) * radius;
          
          // Starboard side (right)  
          const starboardX = centerX + Math.cos(radian - Math.PI/2) * radius;
          const starboardY = centerY + Math.sin(radian - Math.PI/2) * radius;
          
          return (
            <g key={index}>
              {/* Port point */}
              {data.portCount > 0 && (
                <circle
                  cx={portX}
                  cy={portY}
                  r={Math.max(3, Math.min(12, 3 + (data.portDistance / maxDistance) * 8))}
                  fill="#3B82F6"
                  opacity="0.7"
                  stroke="white"
                  strokeWidth="1"
                >
                  <title>
                    Port: {data.angle.toFixed(0)}° - {data.portSpeed.toFixed(1)} kn ({data.portDistance.toFixed(0)}m)
                  </title>
                </circle>
              )}
              
              {/* Starboard point */}
              {data.starboardCount > 0 && (
                <circle
                  cx={starboardX}
                  cy={starboardY}
                  r={Math.max(3, Math.min(12, 3 + (data.starboardDistance / maxDistance) * 8))}
                  fill="#10B981"
                  opacity="0.7"
                  stroke="white"
                  strokeWidth="1"
                >
                  <title>
                    Starboard: {data.angle.toFixed(0)}° - {data.starboardSpeed.toFixed(1)} kn ({data.starboardDistance.toFixed(0)}m)
                  </title>
                </circle>
              )}
            </g>
          );
        })}
        
        {/* Center point */}
        <circle cx={centerX} cy={centerY} r="2" fill="#6B7280" />
        
      </svg>
    );
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Compass className="h-5 w-5" />
          Polar Performance
        </CardTitle>
      </CardHeader>
      <CardContent>
        {polarData.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-gray-500">
            <div className="text-center">
              <Compass className="h-8 w-8 mx-auto mb-2 text-gray-400" />
              <p>No upwind data for polar plot</p>
            </div>
          </div>
        ) : (
          <div>
            {createPolarPlot()}
            
            {/* Legend */}
            <div className="mt-4 flex justify-center gap-6">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                <span className="text-sm text-gray-600">Port Tack</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span className="text-sm text-gray-600">Starboard Tack</span>
              </div>
            </div>
            
            <div className="mt-2 text-xs text-gray-600 text-center">
              Circle size indicates total distance. Distance from center shows speed.
              {scaleInfo.scaleMin > 0 && (
                <div className="mt-1">
                  Speed scale: {scaleInfo.scaleMin.toFixed(1)} - {scaleInfo.scaleMax.toFixed(1)} knots
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}