# Foil Lab Frontend

Next.js/React frontend for wingfoil and sailing GPS track analysis.

## Quick Start

```bash
npm install
npm run dev
# Open http://localhost:3000
```

**Environment Setup:**
```bash
cp .env.example .env.local
# Edit .env.local:
# NEXT_PUBLIC_API_URL=http://localhost:8000  (local backend)
# NEXT_PUBLIC_API_URL=https://foil-lab-production.up.railway.app  (production)
```

## Project Structure

```
frontend/
├── app/                    # Next.js App Router pages
│   ├── analyze/           # Main analysis interface
│   ├── layout.tsx         # Root layout
│   └── globals.css        # Global styles
├── components/            # Reusable React components
│   ├── SimpleLeafletMap.tsx     # Interactive map
│   ├── TrackNavigator.tsx       # Multi-track tabs
│   ├── ComparisonView.tsx       # Track comparison
│   └── SimpleAnalysisResults.tsx # Results display
├── features/             # Feature-specific components
│   └── track-analysis/   # File upload and controls
├── stores/               # Zustand state management
├── hooks/                # Custom React hooks
├── lib/                  # Utilities and API client
└── public/               # Static assets
```

## Key Features

- **Multi-file Upload**: Drag & drop multiple GPX files
- **Interactive Maps**: Leaflet-based track visualization
- **VMG Highlighting**: Velocity made good analysis
- **Track Comparison**: Side-by-side performance metrics
- **Responsive Design**: Desktop and mobile support

## Environment Variables

```env
# Required
NEXT_PUBLIC_API_URL=http://localhost:8000

# Optional
NEXT_PUBLIC_APP_ENV=development
NEXT_PUBLIC_ENABLE_WIND_LINES=true
NEXT_PUBLIC_ENABLE_VMG_HIGHLIGHT=true
```

## Development

```bash
npm run dev        # Development server
npm run build      # Production build
npm run lint       # Linting
npm run type-check # TypeScript check
```

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State**: Zustand
- **Maps**: Leaflet
- **API**: React Query

## Deployment

Deployed on Vercel, auto-deploys from `main` branch.

See [Deployment Guide](../backend/docs/DEPLOYMENT-GUIDE.md) for details.
