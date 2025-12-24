# Algorithm Improvements Plan

**Created:** 2024-12-22
**Goal:** Build accurate polar performance data to answer "What angle off the wind can a certain sail fly, at what speed, resulting in what VMG?"

---

## Current State Assessment

### What We Have
- GPX parsing with full metadata (date, time, location, track name)
- Segment detection (angle-based state machine)
- Iterative wind estimation algorithm
- VMG calculations
- Playwright e2e tests passing

### Critical Issue Discovered

**The wind estimation algorithm has a multiple local minima problem.**

Testing against files with known wind directions revealed:

| File | Expected | From 90° Start | Error | Confidence |
|------|----------|----------------|-------|------------|
| 270_degrees.gpx | 270° | 59° | **149°** | HIGH |
| 90_degrees.gpx | 90° | 84° | 6° | HIGH |
| 300_degrees.gpx | 300° | 78° | **138°** | MEDIUM |

**The algorithm reports HIGH confidence even when 150° wrong.**

### Root Cause

The algorithm's core assumption: *"If port and starboard angles are balanced, the wind estimate is correct."*

**The flaw:** Multiple wind directions can produce balanced angles. The algorithm finds *a* local minimum, not *the* correct answer.

---

## Available Data We're Not Using

### 1. GPX Metadata
Every GPX file contains:
```xml
<metadata>
  <time>2025-04-23T21:16:26Z</time>
</metadata>
<trkpt lat="37.8582510" lon="-122.3164200">
```

**We have:** Date, time, and location for every track.

### 2. Historical Weather APIs

[Open-Meteo Historical Weather API](https://open-meteo.com/en/docs/historical-weather-api):
- **Free** for non-commercial use
- **No API key required**
- 80+ years of hourly data
- Wind direction and speed included
- 9km spatial resolution

Example API call:
```
https://archive-api.open-meteo.com/v1/archive?
  latitude=37.86&longitude=-122.32
  &start_date=2025-04-23&end_date=2025-04-23
  &hourly=wind_direction_10m,wind_speed_10m
```

### 3. User Already Provides Estimate

Current UI asks for wind direction but says "Don't worry about being precise!"
**Problem:** Precision actually matters a lot for the algorithm to converge correctly.

---

## Improvement Strategy

### Phase 1: Better Wind Input (Highest Impact, Low Effort)

**1.1 Show GPX Context**
- Display: "Track from April 23, 2025 near Berkeley Marina"
- Helps user remember conditions

**1.2 Auto-Lookup Wind Data**
- Add "Look up wind" button
- Calls Open-Meteo API with GPX date/location
- Auto-populates wind direction field
- Shows: "Wind was 285° at 12kts on this day"

**1.3 Update UI Messaging**
- Change from "Don't worry about being precise" to "Your estimate helps the algorithm start in the right direction"
- Show compass rose for easier input

### Phase 2: Algorithm Robustness (Medium Effort)

**2.1 Multi-Start Validation**
- Run algorithm from 4 starting points (0°, 90°, 180°, 270°)
- If they converge to different answers (>30° apart), warn user
- Pick solution with best quality score

**2.2 Better Quality Metric**
Current: Just "balanced angles"
Add:
- Total upwind distance (correct wind maximizes this)
- Suspicious segment percentage (wrong wind creates many impossible angles)
- Bearing distribution symmetry

**2.3 Global Search Before Refinement**
- Test every 30° as candidate (12 candidates)
- Score each, pick best
- Then run iterative refinement from there

### Phase 3: Polar Output (The Actual Goal)

Once wind estimation is reliable:

**3.1 Build Polar Data Structure**
```
angle_to_wind | avg_speed | best_speed | vmg | segment_count
     35°      |   12.3    |    14.1    | 10.1 |      8
     40°      |   13.8    |    15.2    | 10.6 |     12
     45°      |   15.1    |    16.8    | 10.7 |     15
```

**3.2 Polar Visualization**
- Plot speed vs angle
- Plot VMG vs angle
- Show best VMG angle

**3.3 Session Comparison**
- Compare polars across sessions/wings
- Normalize for wind speed if known

**3.4 Track Comparison UI**
- Easy way to compare stats between different tracks
- Side-by-side polar plots
- Overlay mode to see differences
- Filter/select which tracks to compare
- Export comparison data

---

## Implementation Priority

1. **[DONE] Phase 1.2** - Add Open-Meteo wind lookup ✓
   - Backend endpoint: `/api/lookup-wind`
   - Frontend: Auto-lookup on file upload
   - Interactive compass for wind direction input

2. **[DONE] Phase 1.1** - Show GPX context in UI ✓
   - Date and location shown after file upload

3. **[NEXT] Phase 3.1** - Polar data output
   - Build polar data structure
   - Visualize speed vs angle

4. **Phase 3.4** - Track comparison
   - Compare stats between different sessions
   - Compare polars across sessions/wings
   - Side-by-side or overlay views

5. **Phase 2.1** - Multi-start validation (if needed)
   - Only if users report convergence issues with good starting estimates

---

## Technical Notes

### Open-Meteo Integration

No API key needed. Example Python:
```python
import requests
from datetime import datetime

def lookup_historical_wind(lat: float, lon: float, date: datetime) -> dict:
    """Look up historical wind from Open-Meteo."""
    url = "https://archive-api.open-meteo.com/v1/archive"
    params = {
        "latitude": lat,
        "longitude": lon,
        "start_date": date.strftime("%Y-%m-%d"),
        "end_date": date.strftime("%Y-%m-%d"),
        "hourly": "wind_direction_10m,wind_speed_10m",
        "timezone": "auto"
    }
    response = requests.get(url, params=params)
    data = response.json()

    # Find the hour closest to the track time
    hour = date.hour
    return {
        "direction": data["hourly"]["wind_direction_10m"][hour],
        "speed_kmh": data["hourly"]["wind_speed_10m"][hour]
    }
```

### GPX Metadata Already Extracted

In `backend/core/gpx.py`:
- `metadata['time']` - track start time
- `gpx_data['latitude']`, `gpx_data['longitude']` - location points
- `gpx_data['time']` - timestamp per point

---

## Validation Files

Test files with known winds in `backend/data/`:
- `test_file_270_degrees.gpx` - ~270° wind
- `3m_rocket_18kn_90degrees.gpx` - 90° wind, 18kts
- `test_file_short_tacks_300degrees.gpx` - 300° wind
- `test_file_short_tacks_330degrees.gpx` - 330° wind

Validation scripts:
- `backend/validate_wind_algorithm.py`
- `backend/analyze_convergence_issue.py`
- `backend/WIND_ALGORITHM_VALIDATION_RESULTS.md`

---

## Open Questions

1. **Wind variation during session:** Should we estimate wind per time window?
2. **Wind speed impact:** Should polar be normalized by wind speed?
3. **Foil vs displacement:** Different craft have different polar shapes
4. **Ground truth:** How do we validate improvements? Need known-wind sessions.
