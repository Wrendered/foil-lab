'use client';

import { useCallback, useRef, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface WindCompassProps {
  value: number;
  onChange: (degrees: number) => void;
  size?: number;
  disabled?: boolean;
  className?: string;
}

function getCardinalDirection(degrees: number): string {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
                      'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(degrees / 22.5) % 16;
  return directions[index];
}

export function WindCompass({
  value,
  onChange,
  size = 120,
  disabled = false,
  className
}: WindCompassProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const calculateAngle = useCallback((clientX: number, clientY: number) => {
    if (!svgRef.current) return value;

    const rect = svgRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const dx = clientX - centerX;
    const dy = clientY - centerY;

    // atan2 gives angle from positive x-axis, we want from north (negative y-axis)
    // Also, we want clockwise degrees, so we negate
    let angle = Math.atan2(dx, -dy) * (180 / Math.PI);
    if (angle < 0) angle += 360;

    return Math.round(angle);
  }, [value]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (disabled) return;
    e.preventDefault();
    setIsDragging(true);
    const newAngle = calculateAngle(e.clientX, e.clientY);
    onChange(newAngle);
  }, [disabled, calculateAngle, onChange]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || disabled) return;
    const newAngle = calculateAngle(e.clientX, e.clientY);
    onChange(newAngle);
  }, [isDragging, disabled, calculateAngle, onChange]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (disabled) return;
    e.preventDefault();
    setIsDragging(true);
    const touch = e.touches[0];
    const newAngle = calculateAngle(touch.clientX, touch.clientY);
    onChange(newAngle);
  }, [disabled, calculateAngle, onChange]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isDragging || disabled) return;
    e.preventDefault();
    const touch = e.touches[0];
    const newAngle = calculateAngle(touch.clientX, touch.clientY);
    onChange(newAngle);
  }, [isDragging, disabled, calculateAngle, onChange]);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleTouchMove, { passive: false });
      window.addEventListener('touchend', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp, handleTouchMove]);

  const center = size / 2;
  const radius = size / 2 - 8;
  const arrowLength = radius - 5;

  // Calculate arrow end point (wind comes FROM this direction)
  const arrowAngleRad = (value - 90) * (Math.PI / 180);
  const arrowX = center + Math.cos(arrowAngleRad) * arrowLength;
  const arrowY = center + Math.sin(arrowAngleRad) * arrowLength;

  // Arrow head points
  const headLength = 12;
  const headAngle = 25 * (Math.PI / 180);
  const head1X = arrowX - headLength * Math.cos(arrowAngleRad - headAngle);
  const head1Y = arrowY - headLength * Math.sin(arrowAngleRad - headAngle);
  const head2X = arrowX - headLength * Math.cos(arrowAngleRad + headAngle);
  const head2Y = arrowY - headLength * Math.sin(arrowAngleRad + headAngle);

  const cardinals = [
    { label: 'N', angle: 0 },
    { label: 'E', angle: 90 },
    { label: 'S', angle: 180 },
    { label: 'W', angle: 270 },
  ];

  return (
    <div className={cn('flex flex-col items-center gap-2', className)}>
      <svg
        ref={svgRef}
        width={size}
        height={size}
        className={cn(
          'cursor-pointer select-none',
          disabled && 'opacity-50 cursor-not-allowed',
          isDragging && 'cursor-grabbing'
        )}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      >
        {/* Outer circle */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="white"
          stroke="#cbd5e1"
          strokeWidth="2"
        />

        {/* Tick marks */}
        {[...Array(36)].map((_, i) => {
          const angle = i * 10;
          const angleRad = (angle - 90) * (Math.PI / 180);
          const isMajor = angle % 90 === 0;
          const isMinor = angle % 30 === 0;
          const tickStart = isMajor ? radius - 12 : isMinor ? radius - 8 : radius - 5;
          const tickEnd = radius - 2;

          return (
            <line
              key={i}
              x1={center + Math.cos(angleRad) * tickStart}
              y1={center + Math.sin(angleRad) * tickStart}
              x2={center + Math.cos(angleRad) * tickEnd}
              y2={center + Math.sin(angleRad) * tickEnd}
              stroke={isMajor ? '#1e3a5f' : '#94a3b8'}
              strokeWidth={isMajor ? 2 : 1}
            />
          );
        })}

        {/* Cardinal direction labels */}
        {cardinals.map(({ label, angle }) => {
          const angleRad = (angle - 90) * (Math.PI / 180);
          const labelRadius = radius - 24;
          const x = center + Math.cos(angleRad) * labelRadius;
          const y = center + Math.sin(angleRad) * labelRadius;

          return (
            <text
              key={label}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="central"
              className="text-xs font-bold fill-slate-700 pointer-events-none"
            >
              {label}
            </text>
          );
        })}

        {/* Center dot */}
        <circle
          cx={center}
          cy={center}
          r={4}
          fill="#3b82f6"
        />

        {/* Wind direction arrow */}
        <line
          x1={center}
          y1={center}
          x2={arrowX}
          y2={arrowY}
          stroke="#3b82f6"
          strokeWidth="3"
          strokeLinecap="round"
        />

        {/* Arrow head */}
        <polygon
          points={`${arrowX},${arrowY} ${head1X},${head1Y} ${head2X},${head2Y}`}
          fill="#3b82f6"
        />

        {/* Draggable indicator at arrow tip */}
        <circle
          cx={arrowX}
          cy={arrowY}
          r={8}
          fill="#3b82f6"
          stroke="white"
          strokeWidth="2"
          className={cn(
            'transition-transform',
            isDragging && 'scale-125'
          )}
        />
      </svg>

      {/* Degree readout */}
      <div className="text-center">
        <span className="text-lg font-bold text-slate-800">{value}°</span>
        <span className="text-sm text-slate-600 ml-1">({getCardinalDirection(value)})</span>
      </div>
    </div>
  );
}
