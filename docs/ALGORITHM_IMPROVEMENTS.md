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

3. **[DONE] Phase 3.1** - Basic polar visualization ✓
   - `SimplePolarPlot.tsx` already exists
   - Shows speed vs angle for upwind segments
   - Port/starboard separation with distance-weighted circles
   - VMG computed but not displayed

4. **[NEXT] UI Overhaul** - See UI_REDESIGN section below

5. **Phase 3.1 Enhancements** (after UI overhaul)
   - Add VMG visualization to polar
   - Show best VMG angle highlight
   - Add downwind polar data

6. **Phase 3.4** - Track comparison
   - Compare stats between different sessions
   - Compare polars across sessions/wings
   - Side-by-side or overlay views

7. **Phase 2.1** - Multi-start validation (if needed)
   - Only if users report convergence issues with good starting estimates

---

## UI Redesign Plan

**Updated:** 2024-12-24
**Status:** IN PROGRESS

### Core Insight: Map is Validation

The map isn't just visualization - it's **validation**. Users need to see WHERE each polar data point came from to trust it. The polar plot is untrustworthy without map confirmation.

### User Workflow

1. **Upload track** → auto-analysis runs
2. **Look at polar** → see performance envelope
3. **Use MAP to validate** → "do those polar dots make sense given where I was sailing?"
4. **Cherry-pick segments** → "these tacks were when I was really pushing"
5. **Maybe tweak wind 5-15°** → if it looks slightly off
6. **Trust the refined polar data** → use for gear comparison

### Current Problems (Dec 2024)

**Information Architecture Confusion:**
- Wind direction is per-file (in TrackFileCard compass)
- Other parameters (angle tolerance, min speed) are global (in ParameterControls)
- "Re-analyze Now" uses global params but unclear which file

**Too Many Cards Fighting for Attention:**
- Connection status card (rarely relevant, always visible)
- Upload card with completed files (redundant after analysis)
- Parameters card (most users never touch these sliders)
- Results card containing everything else

**The Polar Plot is Buried:**
- Nested inside SimpleAnalysisResults → Card → alongside map
- Not linked to map in any meaningful way

**Map Underutilized:**
- Shows track but segments not clearly highlighted
- No hover/click interaction with polar
- Can't toggle segment inclusion from map

### New Architecture: Map + Polar Co-Equal

```
┌─────────────────────────────────────────────────────────────────────┐
│  [track.gpx ▼]                                              [⚙️]   │
├─────────────────────────────────────┬───────────────────────────────┤
│                                     │                               │
│                                     │         POLAR PLOT            │
│              MAP                    │                               │
│                                     │   • Linked with map           │
│   • Track outline (gray)            │   • Hover dot → map highlight │
│   • Segments colored by tack        │   • Click to toggle inclusion │
│   • Hover → polar highlight         │   • Wind reference line       │
│   • Click segment → toggle          │                               │
│   • Wind arrow overlay              ├───────────────────────────────┤
│                                     │       SEGMENTS                │
│                                     │                               │
│                                     │  [✓] Port  35° 14.2kn  234m  │
│                                     │  [✓] Stbd  38° 15.1kn  312m  │
│                                     │  [ ] Port  52°  8.3kn   89m  │
│                                     │                               │
├─────────────────────────────────────┴───────────────────────────────┤
│   VMG Best: 10.7kn @ 38°   │   Avg: 13.8kn   │   12/15 active       │
└─────────────────────────────────────────────────────────────────────┘
```

### Interaction Model

**Bidirectional Linking:**
- Hover segment on map → highlights on polar AND in list
- Hover dot on polar → highlights segment on map AND in list
- Click anywhere → toggles segment inclusion
- Excluded segments: gray/dashed on map, faded on polar, unchecked in list
- Stats update live as you toggle

**Data Already Available:**
- `uploadStore.gpsData` has raw GPS points for map
- `segments` have `start_idx`/`end_idx` to link back to GPS points
- `segments` have `bearing` so we can recalculate `angle_to_wind` client-side when wind changes

### Implementation Phases

#### Phase 1: Layout + Map-Polar Linking [DONE - Dec 2024]
- [x] New `AnalysisView.tsx` component with side-by-side layout
- [x] Enhanced `TrackMap.tsx` showing track with colored segment overlays
- [x] `LinkedPolarPlot.tsx` with hover/click interactivity
- [x] `SegmentList.tsx` with basic info (tack, angle, speed, distance)
- [x] `viewStore.ts` for shared hover/exclusion state
- [x] Hover coordination between all three views

#### Phase 2: Segment Toggle + Live Stats [DONE - Dec 2024]
- [x] Checkbox/click to include/exclude individual segments
- [x] Client-side stats recalculation when segments toggled
- [x] Visual distinction: excluded = gray/dashed/faded
- [x] "X of Y segments active" indicator
- [x] VMG recalculates based on active segments only

#### Phase 3: Wind Fine-tuning [NEXT]
- [ ] Draggable wind reference line on polar plot
- [ ] Or simple number input with +/- buttons
- [ ] Client-side `angle_to_wind` recalculation (no backend call)
- [ ] Show: Historical (dotted) / Calculated (dashed) / Current (solid)
- [ ] Polar dots reposition as wind angle changes

#### Phase 4: Filters for Longer Tracks
- [ ] Time range slider (filter points before segment detection)
- [ ] Spatial rectangle selection on map
- [ ] These require re-analyze (backend call)
- [ ] Detection settings panel (gear icon → slide-out)

#### Phase 5: Averaged Performance Metrics
- [ ] "Representative VMG" - average of top N segments (e.g., best 3-5)
- [ ] "Representative angle" - average angle of top VMG segments
- [ ] Avoids single-segment outliers skewing perception
- [ ] Shows more realistic "what can I consistently achieve" picture
- [ ] Consider weighting by distance (longer segments = more reliable)

#### Phase 6: Auto-Analyze on Upload
- [ ] Automatically trigger analysis when historical wind is found
- [ ] Skip the "Analyze Track" button click for smoother flow
- [ ] Only prompt for manual wind input if historical lookup fails
- [ ] After analysis, allow wind adjustment via Phase 3 controls
- [ ] Reduces friction: drop file → see results immediately

### Cleanup Notes

**Old components to remove** (after ComparisonView is updated):
- `SimpleAnalysisResults.tsx` - replaced by `AnalysisView`
- `SimplePolarPlot.tsx` - replaced by `LinkedPolarPlot`
- `SimpleLeafletMap.tsx` - replaced by `TrackMap`

These are currently kept as fallback but can be deleted once ComparisonView
uses the new interactive components or is redesigned.

### Technical Considerations

**Client-Side Recalculation:**
```typescript
// When wind direction changes, recalculate angle_to_wind for each segment
function recalculateAngles(segments: Segment[], newWindDirection: number) {
  return segments.map(s => ({
    ...s,
    angle_to_wind: Math.abs((s.bearing - newWindDirection + 360) % 360),
    // Adjust for >180 to get angle from wind (not to wind)
  }));
}
```

**Shared Selection State:**
```typescript
// New store or context for view coordination
interface ViewState {
  hoveredSegmentId: number | null;
  selectedSegmentIds: Set<number>;  // For toggling
  excludedSegmentIds: Set<number>;  // Segments to exclude from calcs
}
```

**Map Segment Rendering:**
- GPS points already in `uploadStore.gpsData`
- Segments have `start_idx`/`end_idx` pointing into GPS array
- Draw polylines for each segment with tack-based colors
- Track outline in light gray, segments in bold colors

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
