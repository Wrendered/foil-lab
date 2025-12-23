# Foil Lab Architecture

## System Overview

Foil Lab is a monorepo for analyzing wingfoil/sailing GPS tracks:

```
foil-lab/
├── backend/     # FastAPI Python API
└── frontend/    # Next.js React app
```

## High-Level Architecture

```
┌─────────────────────────────────────┐
│         Next.js Frontend            │
│         (frontend/)                 │
│                                     │
│    - File upload UI                 │
│    - Parameter controls             │
│    - Map visualization              │
│    - Polar plots                    │
│                                     │
│    Deployed: Vercel                 │
└──────────────┬──────────────────────┘
               │
               │ HTTPS/REST
               ▼
┌─────────────────────────────────────┐
│         FastAPI Backend             │
│         (backend/)                  │
│                                     │
│    - GPX parsing                    │
│    - Segment detection              │
│    - Wind estimation                │
│    - Performance metrics            │
│                                     │
│    Deployed: Railway                │
└─────────────────────────────────────┘
```

## Backend Structure

```
backend/
├── api/
│   └── main.py                 # FastAPI endpoints
├── core/                       # Core algorithms (pure functions)
│   ├── gpx.py                  # GPX file parsing
│   ├── segments/               # Track segmentation
│   │   ├── detector.py         # Segment detection
│   │   └── analyzer.py         # Segment analysis
│   ├── wind/                   # Wind estimation
│   │   ├── algorithms.py       # Iterative algorithm
│   │   ├── factory.py          # Algorithm factory
│   │   └── models.py           # WindEstimate dataclass
│   ├── calculations.py         # Wind angle calculations
│   ├── metrics.py              # Basic metrics
│   ├── metrics_advanced.py     # VMG, quality scoring
│   ├── constants.py            # Algorithm constants
│   ├── validation.py           # Input validation
│   └── models/                 # Domain models
├── services/                   # Business logic layer
│   ├── track_analysis_service.py
│   └── wind_service.py
├── config/
│   └── settings.py             # Default parameters
├── utils/                      # Helper utilities
│   ├── segment_analysis.py
│   ├── geo.py
│   └── test_data_generator.py
├── tests/                      # Test suite
├── docs/                       # Documentation
└── data/                       # Sample GPX files
```

## Data Flow

### Track Analysis Pipeline

```
POST /api/analyze-track
        │
        ▼
┌─────────────────────────────────┐
│  GPX Parser (core/gpx.py)       │
│  Parse file -> DataFrame        │
└───────────────┬─────────────────┘
                │
                ▼
┌─────────────────────────────────┐
│  Segment Detector               │
│  (core/segments/detector.py)    │
│  Find consistent angle stretches│
└───────────────┬─────────────────┘
                │
                ▼
┌─────────────────────────────────┐
│  Wind Estimator                 │
│  (core/wind/algorithms.py)      │
│  Iterative tack balancing       │
└───────────────┬─────────────────┘
                │
                ▼
┌─────────────────────────────────┐
│  Metrics Calculator             │
│  (core/metrics_advanced.py)     │
│  VMG, angles, performance       │
└───────────────┬─────────────────┘
                │
                ▼
        JSON Response
```

## Key Design Principles

1. **API-Only Backend**: No UI code, just REST endpoints
2. **Pure Functions**: Core algorithms are stateless and testable
3. **Single Responsibility**: Each module has one clear purpose
4. **Framework Independence**: Core logic has no web framework dependencies
5. **Configuration Centralized**: All defaults in `config/settings.py`

## Layer Responsibilities

### API Layer (`api/`)
- HTTP request/response handling
- Input validation
- Error responses
- CORS configuration

### Service Layer (`services/`)
- Orchestrates core algorithms
- Business logic coordination
- Result aggregation

### Core Layer (`core/`)
- Pure algorithm implementations
- No side effects
- Framework-agnostic
- Fully testable

### Utils Layer (`utils/`)
- Helper functions
- Unit conversions
- Quality checks

## Deployment

```
┌─────────────────┐         ┌─────────────────┐
│    Next.js      │         │    FastAPI      │
│    Vercel       │ ──────► │    Railway      │
│  (frontend/)    │  HTTPS  │  (backend/)     │
└─────────────────┘         └─────────────────┘

Frontend: https://foil-lab-web.vercel.app
Backend:  https://strava-tracks-analyzer-production.up.railway.app
```

Both deploy automatically from `main` branch with subdirectory configuration.
