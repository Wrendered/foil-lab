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

## Related

- [Root CLAUDE.md](../CLAUDE.md) - Monorepo overview
- [Backend CLAUDE.md](../backend/CLAUDE.md) - API and algorithms
- [API Documentation](../backend/docs/API-DOCUMENTATION.md)
