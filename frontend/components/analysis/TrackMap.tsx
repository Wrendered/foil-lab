'use client';

import { useEffect, useRef, useCallback } from 'react';
import type { Map as LeafletMap, Layer, Polyline } from 'leaflet';
import { TrackSegment } from '@/lib/api-client';
import { useViewStore } from '@/stores/viewStore';
import { GPSPoint } from '@/lib/gpx-parser';

interface TrackMapProps {
  gpsData: GPSPoint[];
  segments: TrackSegment[];
  windDirection?: number;
  className?: string;
}

export function TrackMap({ gpsData, segments, windDirection = 0, className = '' }: TrackMapProps) {
  const mapRef = useRef<LeafletMap | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const layersRef = useRef<Layer[]>([]);
  const segmentLayersRef = useRef<Map<number, Polyline>>(new Map());
  const boundsSetRef = useRef(false);

  const hoveredSegmentId = useViewStore((state) => state.hoveredSegmentId);
  const excludedSegmentIds = useViewStore((state) => state.excludedSegmentIds);
  const setHoveredSegment = useViewStore((state) => state.setHoveredSegment);
  const toggleSegmentExclusion = useViewStore((state) => state.toggleSegmentExclusion);

  // Get segment color based on tack
  const getSegmentColor = useCallback((segment: TrackSegment, isHovered: boolean, isExcluded: boolean) => {
    if (isExcluded) return '#9CA3AF'; // Gray for excluded
    if (isHovered) return '#FBBF24'; // Yellow for hovered
    return segment.tack === 'Port' ? '#3B82F6' : '#10B981'; // Blue/Green for tacks
  }, []);

  // Update segment styles when hover or exclusion changes
  useEffect(() => {
    segmentLayersRef.current.forEach((layer, segmentId) => {
      const segment = segments.find((s) => s.id === segmentId);
      if (!segment) return;

      const isHovered = hoveredSegmentId === segmentId;
      const isExcluded = excludedSegmentIds.has(segmentId);
      const color = getSegmentColor(segment, isHovered, isExcluded);
      const weight = isHovered ? 8 : 5;
      const opacity = isExcluded ? 0.4 : 0.9;

      layer.setStyle({ color, weight, opacity });
    });
  }, [hoveredSegmentId, excludedSegmentIds, segments, getSegmentColor]);

  // Create/update map content
  const updateMapContent = useCallback((L: typeof import('leaflet')) => {
    const map = mapRef.current;
    if (!map || gpsData.length === 0) return;

    // Clear existing layers
    layersRef.current.forEach((layer) => {
      if (map.hasLayer(layer)) {
        map.removeLayer(layer);
      }
    });
    layersRef.current = [];
    segmentLayersRef.current.clear();

    const trackCoords: [number, number][] = gpsData.map((p) => [p.latitude, p.longitude]);

    // Calculate track bounds for wind overlay
    const lats = gpsData.map((p) => p.latitude);
    const lngs = gpsData.map((p) => p.longitude);
    const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
    const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
    const latSpan = Math.max(...lats) - Math.min(...lats);
    const lngSpan = Math.max(...lngs) - Math.min(...lngs);
    const maxSpan = Math.max(latSpan, lngSpan) * 1.5; // Extend beyond track

    // Draw wind direction grid lines
    // Wind direction is where wind comes FROM, so line points in that direction
    const windRad = (windDirection * Math.PI) / 180;
    const perpRad = windRad + Math.PI / 2; // Perpendicular for offset lines

    // Helper to calculate point offset from center
    const getOffsetPoint = (dist: number, angle: number): [number, number] => {
      // Approximate: 1 degree lat ≈ 111km, 1 degree lng ≈ 111km * cos(lat)
      const latOffset = dist * Math.cos(angle);
      const lngOffset = dist * Math.sin(angle) / Math.cos((centerLat * Math.PI) / 180);
      return [centerLat + latOffset, centerLng + lngOffset];
    };

    // Draw parallel wind lines (center + 2 on each side)
    const lineOffsets = [0, -0.3, 0.3, -0.6, 0.6]; // Fraction of maxSpan
    lineOffsets.forEach((offset, i) => {
      const offsetDist = offset * maxSpan;
      const baseLat = centerLat + offsetDist * Math.cos(perpRad);
      const baseLng = centerLng + offsetDist * Math.sin(perpRad) / Math.cos((centerLat * Math.PI) / 180);

      // Line extends in wind direction from this offset point
      const lineStart: [number, number] = [
        baseLat - maxSpan * Math.cos(windRad),
        baseLng - maxSpan * Math.sin(windRad) / Math.cos((centerLat * Math.PI) / 180),
      ];
      const lineEnd: [number, number] = [
        baseLat + maxSpan * Math.cos(windRad),
        baseLng + maxSpan * Math.sin(windRad) / Math.cos((centerLat * Math.PI) / 180),
      ];

      const isCenter = i === 0;
      const windLine = L.polyline([lineStart, lineEnd], {
        color: isCenter ? '#7C3AED' : '#A78BFA', // Purple, lighter for non-center
        weight: isCenter ? 2 : 1,
        opacity: isCenter ? 0.7 : 0.4,
        dashArray: isCenter ? '8, 8' : '4, 8',
      });
      windLine.addTo(map);
      layersRef.current.push(windLine);
    });

    // Add wind arrow at center pointing downwind (where wind goes TO)
    const arrowLength = maxSpan * 0.15;
    const arrowStart = getOffsetPoint(arrowLength * 0.5, windRad + Math.PI); // Upwind of center
    const arrowEnd = getOffsetPoint(arrowLength * 0.5, windRad); // Downwind of center
    const arrowLine = L.polyline([arrowStart, arrowEnd], {
      color: '#7C3AED',
      weight: 3,
      opacity: 0.8,
    });
    arrowLine.addTo(map);
    layersRef.current.push(arrowLine);

    // Arrowhead
    const headLength = arrowLength * 0.3;
    const headAngle = 0.5; // radians, ~30 degrees
    const headLeft: [number, number] = [
      arrowEnd[0] - headLength * Math.cos(windRad - headAngle),
      arrowEnd[1] - headLength * Math.sin(windRad - headAngle) / Math.cos((centerLat * Math.PI) / 180),
    ];
    const headRight: [number, number] = [
      arrowEnd[0] - headLength * Math.cos(windRad + headAngle),
      arrowEnd[1] - headLength * Math.sin(windRad + headAngle) / Math.cos((centerLat * Math.PI) / 180),
    ];
    const arrowHead = L.polyline([headLeft, arrowEnd, headRight], {
      color: '#7C3AED',
      weight: 3,
      opacity: 0.8,
    });
    arrowHead.addTo(map);
    layersRef.current.push(arrowHead);

    // Draw full track in light gray
    const trackLayer = L.polyline(trackCoords, {
      color: '#D1D5DB',
      weight: 2,
      opacity: 0.6,
    });
    trackLayer.addTo(map);
    layersRef.current.push(trackLayer);

    // Draw upwind segments with interactivity
    const upwindSegments = segments.filter((s) => s.direction === 'Upwind');
    upwindSegments.forEach((segment) => {
      const segmentCoords = trackCoords.slice(segment.start_idx, segment.end_idx + 1);
      if (segmentCoords.length < 2) return;

      const isHovered = hoveredSegmentId === segment.id;
      const isExcluded = excludedSegmentIds.has(segment.id);
      const color = getSegmentColor(segment, isHovered, isExcluded);

      const segmentLayer = L.polyline(segmentCoords, {
        color,
        weight: isHovered ? 8 : 5,
        opacity: isExcluded ? 0.4 : 0.9,
      });

      // Add interactivity
      segmentLayer.on('mouseover', () => setHoveredSegment(segment.id));
      segmentLayer.on('mouseout', () => setHoveredSegment(null));
      segmentLayer.on('click', () => toggleSegmentExclusion(segment.id));

      segmentLayer.addTo(map);
      layersRef.current.push(segmentLayer);
      segmentLayersRef.current.set(segment.id, segmentLayer);
    });

    // Add start/end markers
    if (trackCoords.length > 0) {
      const startIcon = L.divIcon({
        className: 'custom-marker',
        html: '<div style="width: 12px; height: 12px; background: #22C55E; border: 2px solid white; border-radius: 50%; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
        iconSize: [12, 12],
        iconAnchor: [6, 6],
      });
      const endIcon = L.divIcon({
        className: 'custom-marker',
        html: '<div style="width: 12px; height: 12px; background: #EF4444; border: 2px solid white; border-radius: 50%; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
        iconSize: [12, 12],
        iconAnchor: [6, 6],
      });

      const startMarker = L.marker(trackCoords[0], { icon: startIcon });
      const endMarker = L.marker(trackCoords[trackCoords.length - 1], { icon: endIcon });
      startMarker.addTo(map);
      endMarker.addTo(map);
      layersRef.current.push(startMarker, endMarker);
    }

    // Fit bounds on first load
    if (!boundsSetRef.current && trackCoords.length > 0) {
      const lats = gpsData.map((p) => p.latitude);
      const lngs = gpsData.map((p) => p.longitude);
      const bounds: [[number, number], [number, number]] = [
        [Math.min(...lats), Math.min(...lngs)],
        [Math.max(...lats), Math.max(...lngs)],
      ];
      map.fitBounds(bounds, { padding: [30, 30] });
      boundsSetRef.current = true;
    }
  }, [gpsData, segments, hoveredSegmentId, excludedSegmentIds, getSegmentColor, setHoveredSegment, toggleSegmentExclusion, windDirection]);

  // Initialize map
  useEffect(() => {
    if (typeof window === 'undefined' || !containerRef.current) return;

    import('leaflet').then((L) => {
      if (mapRef.current) {
        updateMapContent(L);
        return;
      }

      // Clear container
      if (containerRef.current) {
        while (containerRef.current.firstChild) {
          containerRef.current.removeChild(containerRef.current.firstChild);
        }
        (containerRef.current as HTMLDivElement & { _leaflet_id?: number })._leaflet_id = undefined;
      }

      // Determine initial center
      let center: [number, number] = [37.86, -122.32]; // SF Bay default
      if (gpsData.length > 0 && gpsData[0]) {
        center = [gpsData[0].latitude, gpsData[0].longitude];
      }

      // Create map
      const map = L.map(containerRef.current!, {
        center,
        zoom: 15,
        zoomControl: true,
        scrollWheelZoom: true,
      });

      // Add tile layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      setTimeout(() => {
        if (map.getContainer()) {
          map.invalidateSize();
        }
      }, 100);

      mapRef.current = map;
      updateMapContent(L);
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      boundsSetRef.current = false;
    };
  }, [gpsData.length, segments.length]);

  // Update content when segments change
  useEffect(() => {
    if (mapRef.current && typeof window !== 'undefined') {
      import('leaflet').then((L) => updateMapContent(L));
    }
  }, [updateMapContent]);

  return (
    <div className={`relative ${className}`} style={{ minHeight: '300px' }}>
      {/* Map container */}
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: '100%',
          minHeight: '300px',
          borderRadius: '8px',
          overflow: 'hidden',
        }}
      />

      {/* Wind direction overlay */}
      <div
        className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm rounded-lg shadow-md px-3 py-2 flex items-center gap-2 z-[1000]"
        title={`Wind from ${Math.round(windDirection)}°`}
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          className="text-purple-600"
          style={{ transform: `rotate(${windDirection - 90}deg)` }}
        >
          {/* Arrow pointing right at 0°, rotated to show wind source direction */}
          <path
            d="M2 12 L22 12 M22 12 L16 6 M22 12 L16 18"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className="text-sm font-medium text-slate-700">{Math.round(windDirection)}°</span>
      </div>
    </div>
  );
}
