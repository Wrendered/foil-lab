# CLAUDE.md - Foil Lab Backend

This file provides guidance to Claude Code when working with the FastAPI backend.

## Project Overview

**Foil Lab Backend** is a FastAPI-based REST API for wingfoil/sailing GPS track analysis:
- GPX file parsing and track segmentation
- Wind direction estimation (iterative algorithm with tack reclassification)
- Performance metrics calculation (VMG, angles, speeds)

## Structure

```
backend/
├── api/
│   └── main.py                 # FastAPI endpoints
├── core/                       # Core algorithms (pure functions)
│   ├── gpx.py                  # GPX file parsing
│   ├── segments/               # Track segmentation
│   ├── wind/                   # Wind estimation
│   │   ├── algorithms.py       # Iterative algorithm
│   │   ├── factory.py          # Algorithm factory
│   │   └── models.py           # WindEstimate dataclass
│   ├── filtering.py            # Time/spatial filtering
│   ├── metrics.py              # Basic metrics
│   ├── metrics_advanced.py     # VMG, quality scoring
│   ├── calculations.py         # Wind angle calculations
│   └── constants.py            # Algorithm constants
├── services/
│   ├── track_analysis_service.py   # Main analysis pipeline
│   └── wind_service.py             # Wind estimation service
├── config/
│   └── settings.py             # Default parameters
├── utils/
│   ├── segment_analysis.py     # Segment utilities
│   └── geo.py                  # Geographic conversions
├── tests/                      # Test suite
├── docs/                       # Documentation
├── data/                       # Sample GPX files
└── run_api.py                  # Dev server script
```

## Key Commands

```bash
# Setup
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Run API server
python run_api.py
# or
uvicorn api.main:app --reload --port 8000

# Run tests
python -m pytest tests/
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check |
| `/api/config` | GET | Default parameters and ranges |
| `/api/lookup-wind` | GET | Historical wind from Open-Meteo API |
| `/api/analyze-track` | POST | Analyze GPX file |
| `/api/estimate-wind` | POST | Standalone wind estimation |

### GET /api/lookup-wind Parameters
- `latitude` (float): Location latitude
- `longitude` (float): Location longitude
- `date` (string): Date in YYYY-MM-DD format
- `hour` (int): Hour of day (0-23), defaults to 12

Returns historical wind direction and speed from Open-Meteo (free, no API key).

### POST /api/analyze-track Parameters
- `wind_direction` (float): Initial wind estimate (degrees)
- `angle_tolerance` (float): Max bearing variation in segments
- `min_duration` (float): Minimum segment duration (seconds)
- `min_distance` (float): Minimum segment distance (meters)
- `min_speed` (float): Minimum speed threshold (knots)
- `time_start` (string, optional): ISO 8601 timestamp to filter track start
- `time_end` (string, optional): ISO 8601 timestamp to filter track end
- `lat_min/lat_max` (float, optional): Latitude bounds for spatial filter
- `lon_min/lon_max` (float, optional): Longitude bounds for spatial filter

## Wind Estimation Algorithm

The **iterative algorithm** (`core/wind/algorithms.py`) is production:

1. Start with user's initial wind estimate
2. Classify segments as port/starboard tack
3. Calculate median angles for each tack
4. Adjust wind to balance port/starboard angles
5. **Reclassify segments with new wind** (key fix)
6. Repeat until convergence (<0.5 degree change)

This fixes the bug where tacks classified once were never updated.

## Technical Concepts

### Wind Direction
- Wind direction = where wind comes FROM (0=N, 90=E, 180=S, 270=W)
- Example: 270 means wind blowing FROM west TO east

### Key Metrics
- **Segments**: Consistent sailing stretches with stable bearing
- **Tacks**: Port (wind from left) vs Starboard (wind from right)
- **VMG**: Velocity Made Good = Speed x cos(angle to wind)

### Confidence Levels
- **High**: Both tacks present, angles balanced (<10 degree diff)
- **Medium**: Both tacks, moderate balance (<20 degree diff)
- **Low**: Missing tack or poor balance

## Architecture Layers

- **core/**: Pure algorithms, no framework dependencies
- **services/**: Business logic orchestration
- **api/**: HTTP endpoints, request/response handling

## Development Workflow

### Adding Features
1. Implement in `core/` (pure functions)
2. Add service layer in `services/` if needed
3. Expose via API in `api/main.py`
4. Update frontend in `../frontend/`

### Adding Parameters
1. Add default to `config/settings.py`
2. Add constant to `core/constants.py` if algorithm-related
3. Update `/api/config` endpoint ranges
4. Frontend fetches dynamically

## Related

- [Root CLAUDE.md](../CLAUDE.md) - Monorepo overview
- [Frontend CLAUDE.md](../frontend/CLAUDE.md) - React UI
- [API Documentation](docs/API-DOCUMENTATION.md)
- [Architecture](docs/architecture.md)
