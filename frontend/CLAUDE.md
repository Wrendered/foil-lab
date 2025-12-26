# CLAUDE.md - Foil Lab Frontend

This file provides guidance to Claude Code when working with the Next.js frontend.

## Project Overview

**Foil Lab Frontend** is the React-based UI for the Foil Lab track analysis platform. It provides GPX file upload, parameter controls, map visualization, and polar plots.

## Structure

```
frontend/
├── app/                        # Next.js App Router pages
│   ├── layout.tsx             # Root layout with navigation
│   ├── page.tsx               # Home page
│   ├── analyze/page.tsx       # Track analysis interface
│   └── globals.css            # Global styles
├── components/                # Reusable React components
│   ├── WindCompass.tsx        # Interactive wind direction compass
│   ├── TrackFileCard.tsx      # File card with auto wind lookup
│   ├── TrackUploader.tsx      # Dropzone + file cards
│   ├── SimpleLeafletMap.tsx   # Map visualization
│   ├── SimplePolarPlot.tsx    # Polar plot charts
│   ├── TrackNavigator.tsx     # Multi-track tabs
│   └── ComparisonView.tsx     # Track comparison
├── features/                  # Feature modules
│   └── track-analysis/
│       ├── FileUpload.tsx
│       └── ParameterControls.tsx
├── stores/                    # Zustand state management
│   ├── analysisStore.ts
│   └── uploadStore.ts
├── hooks/                     # Custom React hooks
│   └── useApi.ts              # API integration
├── lib/                       # Utilities
│   ├── api-client.ts          # API client
│   ├── defaults.ts            # Default values
│   └── gpx-parser.ts          # GPX parsing
└── components/ui/             # UI primitives
```

## Key Commands

```bash
npm install         # Install dependencies
npm run dev         # Development server at :3000
npm run build       # Production build
npm run lint        # ESLint
```

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript (strict)
- **Styling**: Tailwind CSS
- **State**: Zustand stores
- **API**: Axios + React Query patterns
- **Maps**: Leaflet
- **Icons**: lucide-react

## API Integration

The frontend fetches configuration and sends analysis requests to the backend:

```typescript
// lib/api-client.ts
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Endpoints used:
// GET  /api/config         - Default parameters and ranges
// POST /api/analyze-track  - GPX file analysis
// GET  /api/health         - Backend health check
// GET  /api/lookup-wind    - Historical wind from Open-Meteo
```

## State Management

Three Zustand stores with clear separation of concerns:

```typescript
// stores/uploadStore.ts - Per-track data (source of truth)
// - files[] with result, gpsData, displayName, windSpeed, warning
// - currentFileId

// stores/analysisStore.ts - GLOBAL settings
// - parameters (windDirection, angleTolerance, minSpeed, minDistance, minDuration)
// - isAnalyzing, error (UI state)
// Note: Parameters apply to ALL tracks. When re-analyzing, all tracks
// use the same detection settings.

// stores/viewStore.ts - Per-track VIEW state (resets on track switch)
// - adjustedWindDirection (manual wind override)
// - excludedSegmentIds (toggled segments)
// - hoveredSegmentId
// - filterBounds (time/spatial filter for trim feature)
```

## Core Types

```typescript
interface WindEstimate {
  direction: number;
  confidence: string;
  port_average_angle: number;
  starboard_average_angle: number;
  total_segments: number;
}

interface PerformanceMetrics {
  avg_speed: number | null;
  vmg_upwind: number | null;
  vmg_downwind: number | null;
  port_tack_count: number;
  starboard_tack_count: number;
}
```

## Styling Guidelines

- Use Tailwind utilities
- Responsive: `lg:`, `md:` prefixes
- Interactive: `hover:`, `disabled:` states
- Metric cards: blue, green, purple, orange color coding

## Error Handling

```typescript
try {
  const result = await analyzeTrack(file, params);
} catch (err: any) {
  setError(
    err.response?.data?.detail ||
    'Analysis failed. Please check your file and try again.'
  );
}
```

## Development Tips

- Backend must be running for API calls
- Set `NEXT_PUBLIC_API_URL=http://localhost:8000` in `.env.local`
- Clear `.next/` if seeing stale builds
- Check console for API errors

## Current Architecture (Dec 2024)

### Existing Components

| Component | Purpose | Status |
|-----------|---------|--------|
| `TrackUploader` | Dropzone + renders TrackFileCards for each file | Active |
| `TrackFileCard` | Shows file metadata, wind compass, auto-lookups wind, auto-analyze | Active |
| `WindCompass` | Interactive SVG compass for wind direction input | Active |
| `ParameterControls` | Collapsible detection settings with tooltips | Active |
| `AnalysisView` | Main results view with map-polar-list linking | Active |
| `TrackMap` | Track visualization with segment overlays, wind arrow | Active |
| `LinkedPolarPlot` | Interactive polar chart linked to map/list | Active |
| `SegmentList` | Segment table with include/exclude toggles | Active |
| `FilterControls` | Time trim slider at bottom of map | Active |
| `TrackNavigator` | Tabs for switching between analyzed tracks | Active |
| `ComparisonView` | Track comparison with overlay polar + stats | Active |
| `ComparisonPolarPlot` | Multi-track overlay polar chart | Active |

### Data Flow

1. User drops GPX file → `TrackUploader.onDrop` → `uploadStore.addFile`
2. GPX parsed client-side → `uploadStore.setFileGPSData` (metadata, points)
3. Auto wind lookup → `useLookupWind` → `uploadStore.setFileWindData`
4. **Auto-analyze triggers** (if historical wind found) → POST `/api/analyze-track`
5. Results stored in both `uploadStore` (per-file) and `analysisStore` (current view)
6. User can adjust wind ±2° → client-side recalculation (no backend call)
7. User can toggle segments → stats recalculate live

---

## UI Architecture (Dec 2024)

See `docs/ALGORITHM_IMPROVEMENTS.md` for full redesign history.

### Core Insight

The map is **validation** - users need to see WHERE polar data points come from to trust them.

### Component Architecture

```
analyze/page.tsx
├── Header: title, connection status (only when disconnected)
├── Left sidebar
│   ├── TrackUploader → TrackFileCard (per file)
│   │   └── Auto wind lookup + auto-analyze
│   │   └── WindCompass for manual adjustment
│   └── ParameterControls (collapsible)
│       └── Detection settings with help tooltips
├── Main content
│   └── AnalysisView.tsx
│       ├── Header: wind adjustment ±2°, settings gear
│       ├── TrackMap.tsx (left)
│       │   └── Track + colored segment overlays
│       │   └── Wind arrow overlay
│       │   └── Hover/click → highlights polar + list
│       ├── RightPanel
│       │   ├── LinkedPolarPlot.tsx
│       │   │   └── Interactive dots linked to map/list
│       │   └── SegmentList.tsx
│       │       └── Include/exclude toggles
│       │       └── Hover → highlights map + polar
│       └── StatsBar: Rep VMG, Best VMG, Avg Speed, Segments, Distance
└── Footer: feedback link
```

### Shared View State

viewStore coordinates map/polar/list interactions:

```typescript
// stores/viewStore.ts
interface ViewState {
  hoveredSegmentId: number | null;
  excludedSegmentIds: Set<number>;
  adjustedWindDirection: number | null;  // null = use calculated
  filterBounds: FilterBounds;  // time/spatial bounds for trim feature

  // Actions - reset() clears all when switching tracks
  setHoveredSegment: (id: number | null) => void;
  toggleSegmentExclusion: (id: number) => void;
  setWindDirection: (degrees: number | null) => void;
  setFilterBounds: (bounds: Partial<FilterBounds>) => void;
  clearFilterBounds: () => void;
  reset: () => void;  // Called by page.tsx on track switch
}
```

**Important**: viewStore is reset when switching tracks or re-analyzing.
This is handled in `app/analyze/page.tsx` (handleTrackSelect, handleAnalyzeTrack).

### Client-Side Recalculation

When wind direction changes or segments are toggled, recalculate stats without backend call:

```typescript
// Recalculate angle_to_wind for each segment
function recalculateAngles(segments: Segment[], windDirection: number) {
  return segments.map(s => {
    let angleToWind = (s.bearing - windDirection + 360) % 360;
    if (angleToWind > 180) angleToWind = 360 - angleToWind;
    return { ...s, angle_to_wind: angleToWind };
  });
}

// Recalculate stats from active segments only
function calculateStats(segments: Segment[], excludedIds: Set<number>) {
  const active = segments.filter(s => !excludedIds.has(s.id));
  // ... compute avg speed, VMG, etc.
}
```

### Implementation Phases

1. **Phase 1** [DONE]: Layout + map-polar linking with hover state
2. **Phase 2** [DONE]: Segment toggle + live stats recalculation
3. **Phase 3** [DONE]: Wind fine-tuning with client-side recalc (+/- 2° buttons, live update)
4. **Phase 3.5** [DONE]: Wind direction overlay on map (arrow indicator)
5. **Phase 5** [DONE]: Averaged performance metrics (Rep VMG = top 3 segments, distance-weighted)
6. **Phase 6** [DONE]: Auto-analyze on upload (when historical wind found)
7. **UI Cleanup** [DONE]: Collapsible parameters, better descriptions, tooltips
8. **Phase 3.4** [DONE]: Track comparison (overlay polar + stats table)
9. **Phase 4** [DONE]: Time filter with live map preview (trim slider at map bottom)

### Cleanup Notes

Old components removed (Dec 2024):
- ~~`SimpleAnalysisResults.tsx`~~ → replaced by `AnalysisView` ✓
- ~~`SimplePolarPlot.tsx`~~ → replaced by `LinkedPolarPlot` ✓
- ~~`SimpleLeafletMap.tsx`~~ → replaced by `TrackMap` ✓

### Key Data Available

From `uploadStore` after GPX parse:
- `gpsData: GPSPoint[]` - lat, lon, time for every point
- `metadata` - track date, bounds, point count

From analysis result:
- `segments[]` - each has `start_idx`, `end_idx` into gpsData
- `segments[].bearing` - allows client-side wind adjustment
- `wind_estimate.direction` - calculated wind

## Related

- [Root CLAUDE.md](../CLAUDE.md) - Monorepo overview
- [Backend CLAUDE.md](../backend/CLAUDE.md) - API and algorithms
- [Algorithm Improvements](../docs/ALGORITHM_IMPROVEMENTS.md) - Roadmap + UI redesign plan
- [API Documentation](../backend/docs/API-DOCUMENTATION.md)
