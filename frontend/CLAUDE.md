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

```typescript
// stores/analysisStore.ts - Analysis results
// stores/uploadStore.ts - File upload state

// Zustand pattern:
const useAnalysisStore = create<AnalysisState>((set) => ({
  results: null,
  loading: false,
  setResults: (results) => set({ results }),
}));
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
| `TrackUploader` | Dropzone + renders TrackFileCards for each file | Keep for upload |
| `TrackFileCard` | Shows file metadata, wind compass, auto-lookups wind | Simplify |
| `WindCompass` | Interactive SVG compass for wind direction input | Keep |
| `SimplePolarPlot` | Polar chart showing speed vs angle for upwind segments | Enhance |
| `SimpleLeafletMap` | Track visualization on map | Enhance significantly |
| `ParameterControls` | Sliders for analysis parameters (global, not per-file) | Move to settings panel |
| `TrackNavigator` | Tabs for switching between analyzed tracks | Replace |
| `ComparisonView` | Side-by-side track comparison | Future phase |

### Data Flow

1. User drops GPX file → `TrackUploader.onDrop` → `uploadStore.addFile`
2. GPX parsed client-side → `uploadStore.setFileGPSData` (metadata, points)
3. Auto wind lookup → `useLookupWind` → `uploadStore.setFileWindData`
4. User clicks Analyze → `handleAnalyzeTrack` → POST `/api/analyze-track`
5. Results stored in both `uploadStore` (per-file) and `analysisStore` (current view)

---

## UI Overhaul (In Progress - Dec 2024)

See `docs/ALGORITHM_IMPROVEMENTS.md` for full redesign plan.

### Core Insight

The map is **validation** - users need to see WHERE polar data points come from to trust them.

### New Component Architecture

```
AnalysisView.tsx (new main component)
├── Header: file selector, settings gear
├── MainContent (side-by-side)
│   ├── TrackMap.tsx (enhanced map)
│   │   └── Shows track + colored segment overlays
│   │   └── Hover/click → highlights on polar + list
│   │   └── Wind arrow overlay
│   └── RightPanel
│       ├── PolarPlot.tsx (enhanced)
│       │   └── Linked with map via shared state
│       │   └── Click dot → toggle segment inclusion
│       │   └── Wind direction indicator (draggable later)
│       └── SegmentList.tsx (new)
│           └── Checkboxes for include/exclude
│           └── Tack, angle, speed, distance columns
│           └── Hover → highlights map + polar
├── StatsBar: VMG, avg speed, active segment count
└── SettingsPanel (slide-out): detection parameters
```

### Shared View State

New Zustand store for coordinating map/polar/list:

```typescript
// stores/viewStore.ts (to be created)
interface ViewState {
  hoveredSegmentId: number | null;
  excludedSegmentIds: Set<number>;
  adjustedWindDirection: number | null;  // null = use calculated

  // Actions
  setHoveredSegment: (id: number | null) => void;
  toggleSegmentExclusion: (id: number) => void;
  setWindDirection: (degrees: number) => void;
}
```

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

1. **Phase 1** [CURRENT]: Layout + map-polar linking with hover state
2. **Phase 2**: Segment toggle + live stats recalculation
3. **Phase 3**: Wind fine-tuning with client-side recalc
4. **Phase 4**: Time/spatial filters (requires re-analyze)

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
