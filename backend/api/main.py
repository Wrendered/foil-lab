"""
FastAPI backend for Foil Lab.

This provides REST API endpoints for track analysis, wind estimation,
and other core algorithms, enabling framework-agnostic frontend development.
"""

from fastapi import FastAPI, UploadFile, File, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Dict, List, Optional, Any
from datetime import datetime
import pandas as pd
import numpy as np
import logging
import io
import sys
import os
import httpx

# Add parent directory to path to import our modules
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Initialize logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="Foil Lab API",
    description="Backend API for wingfoil GPS track analysis",
    version="1.0.0"
)

# Add CORS middleware for frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",  # Next.js dev server
        "http://localhost:3001",  # Next.js dev server (alt port)
        "http://localhost:3002",  # Next.js dev server (alt port)
        "http://localhost:3003",  # Next.js dev server (alt port)
        "https://foil-lab-web.vercel.app",  # Production frontend (Vercel)
        "https://foil-lab.vercel.app",  # Alternative production domain
        "https://gracious-love-production-ec22.up.railway.app",  # Production frontend (Railway)
        "https://foillab.wrenchat.work",  # Custom domain
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

# Import our services
from services.track_analysis_service import analyze_track_data, TrackAnalysisResult
from services.wind_service import get_wind_service
from core.gpx import load_gpx_file


# Pydantic models for API requests/responses
class AnalysisParameters(BaseModel):
    wind_direction: float = 90.0
    angle_tolerance: float = 25.0
    min_duration: float = 10.0
    min_distance: float = 50.0
    min_speed: float = 5.0
    suspicious_angle_threshold: float = 20.0


class WindEstimateResponse(BaseModel):
    direction: float
    confidence: str
    port_average_angle: float
    starboard_average_angle: float
    total_segments: int
    port_segments: int
    starboard_segments: int


class PerformanceMetrics(BaseModel):
    avg_speed: Optional[float]
    avg_upwind_angle: Optional[float]
    best_upwind_angle: Optional[float]
    vmg_upwind: Optional[float]
    vmg_downwind: Optional[float]
    port_tack_count: int
    starboard_tack_count: int
    vmg_segment_ids: List[int]


class TrackAnalysisResponse(BaseModel):
    segments: List[Dict[str, Any]]
    wind_estimate: WindEstimateResponse
    performance_metrics: PerformanceMetrics
    track_summary: Dict[str, Any]


class HistoricalWindResponse(BaseModel):
    """Response from historical wind lookup."""
    wind_direction: float  # degrees (0-360)
    wind_speed_kmh: float  # km/h
    wind_speed_knots: float  # knots
    source: str  # "open-meteo"
    location: str  # human-readable location description
    timestamp: str  # ISO format timestamp used for lookup


@app.get("/")
async def root():
    """Root endpoint with API information."""
    return {
        "message": "Foil Lab API",
        "version": "1.0.0",
        "endpoints": {
            "POST /api/analyze-track": "Analyze a GPX track file",
            "GET /api/health": "Health check endpoint"
        }
    }


@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "foil-lab-api"}


@app.get("/api/config")
async def get_config():
    """Get default configuration values."""
    from config.settings import (
        DEFAULT_MIN_DURATION, DEFAULT_MIN_DISTANCE, DEFAULT_ANGLE_TOLERANCE,
        DEFAULT_MIN_SPEED
    )
    from core.constants import DEFAULT_SUSPICIOUS_ANGLE_THRESHOLD
    
    return {
        "defaults": {
            "wind_direction": 90.0,  # Default wind direction (East)
            "angle_tolerance": DEFAULT_ANGLE_TOLERANCE,
            "min_duration": DEFAULT_MIN_DURATION,
            "min_distance": DEFAULT_MIN_DISTANCE,
            "min_speed": DEFAULT_MIN_SPEED,
            "suspicious_angle_threshold": DEFAULT_SUSPICIOUS_ANGLE_THRESHOLD
        },
        "ranges": {
            "wind_direction": {"min": 0, "max": 359, "step": 1},
            "angle_tolerance": {"min": 5, "max": 45, "step": 1},
            "min_duration": {"min": 5, "max": 60, "step": 1},
            "min_distance": {"min": 10, "max": 200, "step": 10},
            "min_speed": {"min": 3, "max": 15, "step": 0.5},
            "suspicious_angle_threshold": {"min": 15, "max": 35, "step": 1}
        }
    }


@app.get("/api/lookup-wind", response_model=HistoricalWindResponse)
async def lookup_historical_wind(
    latitude: float = Query(..., description="Latitude of the location"),
    longitude: float = Query(..., description="Longitude of the location"),
    date: str = Query(..., description="Date in YYYY-MM-DD format"),
    hour: int = Query(12, ge=0, le=23, description="Hour of day (0-23)")
):
    """
    Look up historical wind data from Open-Meteo API.

    This endpoint fetches historical weather data for a specific location and time,
    which can be used to get accurate wind direction for GPS track analysis.

    Args:
        latitude: Latitude of the location (-90 to 90)
        longitude: Longitude of the location (-180 to 180)
        date: Date in YYYY-MM-DD format
        hour: Hour of the day (0-23), defaults to noon

    Returns:
        Historical wind direction and speed for the specified location and time
    """
    try:
        # Validate coordinates
        if not -90 <= latitude <= 90:
            raise HTTPException(status_code=400, detail="Latitude must be between -90 and 90")
        if not -180 <= longitude <= 180:
            raise HTTPException(status_code=400, detail="Longitude must be between -180 and 180")

        # Validate date format
        try:
            parsed_date = datetime.strptime(date, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="Date must be in YYYY-MM-DD format")

        # Check if date is not in the future
        if parsed_date.date() > datetime.now().date():
            raise HTTPException(status_code=400, detail="Cannot lookup wind for future dates")

        # Call Open-Meteo Historical Weather API
        # Documentation: https://open-meteo.com/en/docs/historical-weather-api
        url = "https://archive-api.open-meteo.com/v1/archive"
        params = {
            "latitude": latitude,
            "longitude": longitude,
            "start_date": date,
            "end_date": date,
            "hourly": "wind_direction_10m,wind_speed_10m",
            "timezone": "auto"
        }

        async with httpx.AsyncClient() as client:
            response = await client.get(url, params=params, timeout=10.0)

            if response.status_code != 200:
                logger.error(f"Open-Meteo API error: {response.status_code} - {response.text}")
                raise HTTPException(
                    status_code=502,
                    detail=f"Weather service returned error: {response.status_code}"
                )

            data = response.json()

        # Extract wind data for the specified hour
        hourly = data.get("hourly", {})
        wind_directions = hourly.get("wind_direction_10m", [])
        wind_speeds = hourly.get("wind_speed_10m", [])

        if not wind_directions or not wind_speeds or hour >= len(wind_directions):
            raise HTTPException(
                status_code=404,
                detail="No wind data available for the specified time"
            )

        wind_direction = wind_directions[hour]
        wind_speed_kmh = wind_speeds[hour]

        # Handle null values from API
        if wind_direction is None or wind_speed_kmh is None:
            raise HTTPException(
                status_code=404,
                detail="Wind data not available for this location/time"
            )

        # Convert km/h to knots (1 km/h = 0.539957 knots)
        wind_speed_knots = wind_speed_kmh * 0.539957

        # Create human-readable location description
        lat_dir = "N" if latitude >= 0 else "S"
        lon_dir = "E" if longitude >= 0 else "W"
        location_str = f"{abs(latitude):.2f}°{lat_dir}, {abs(longitude):.2f}°{lon_dir}"

        # Create timestamp string
        timestamp_str = f"{date}T{hour:02d}:00:00"

        logger.info(f"Wind lookup: {location_str} on {date} at {hour}:00 = {wind_direction}° at {wind_speed_knots:.1f}kts")

        return HistoricalWindResponse(
            wind_direction=float(wind_direction),
            wind_speed_kmh=float(wind_speed_kmh),
            wind_speed_knots=round(wind_speed_knots, 1),
            source="open-meteo",
            location=location_str,
            timestamp=timestamp_str
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error looking up wind: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error looking up wind: {str(e)}")


@app.post("/api/analyze-track", response_model=TrackAnalysisResponse)
async def analyze_track(
    file: UploadFile = File(...),
    wind_direction: float = 90.0,
    angle_tolerance: float = 25.0,
    min_duration: float = 10.0,
    min_distance: float = 50.0,
    min_speed: float = 5.0,
    suspicious_angle_threshold: float = 20.0,
    time_start: Optional[str] = None,
    time_end: Optional[str] = None,
    lat_min: Optional[float] = None,
    lat_max: Optional[float] = None,
    lon_min: Optional[float] = None,
    lon_max: Optional[float] = None
):
    """
    Analyze a GPX track file.

    Args:
        file: GPX file to analyze
        wind_direction: Initial wind direction estimate (0-359 degrees)
        angle_tolerance: Maximum angle variation within segments
        min_duration: Minimum segment duration in seconds
        min_distance: Minimum segment distance in meters
        min_speed: Minimum speed in knots
        suspicious_angle_threshold: Threshold for filtering suspicious angles
        time_start: Optional ISO format datetime to filter segments (keep after this time)
        time_end: Optional ISO format datetime to filter segments (keep before this time)
        lat_min: Optional minimum latitude for spatial filtering
        lat_max: Optional maximum latitude for spatial filtering
        lon_min: Optional minimum longitude for spatial filtering
        lon_max: Optional maximum longitude for spatial filtering

    Returns:
        Analysis results including segments, wind estimate, and performance metrics
    """
    try:
        # Validate file type
        if not file.filename or not file.filename.lower().endswith(('.gpx', '.GPX')):
            raise HTTPException(status_code=400, detail="Only GPX files are allowed")
        
        # Read file content
        content = await file.read()
        
        # Validate file size (50MB limit for prototype)
        max_size = 50 * 1024 * 1024  # 50MB in bytes
        if len(content) > max_size:
            raise HTTPException(
                status_code=413, 
                detail=f"File too large. Maximum size is 50MB, received {len(content) / 1024 / 1024:.1f}MB"
            )
        
        # Validate minimum file size (empty files)
        if len(content) < 100:  # Minimum reasonable GPX file size
            raise HTTPException(status_code=400, detail="File appears to be empty or corrupted")
        
        file_obj = io.BytesIO(content)
        
        # Load GPX data
        logger.info(f"Processing file: {file.filename}")
        track_data, metadata = load_gpx_file(file_obj)
        
        if track_data.empty:
            raise HTTPException(status_code=400, detail="No valid track data found in GPX file")
        
        # Parse time filter parameters
        parsed_time_start = None
        parsed_time_end = None
        if time_start:
            try:
                parsed_time_start = datetime.fromisoformat(time_start.replace('Z', '+00:00'))
            except ValueError as e:
                raise HTTPException(status_code=400, detail=f"Invalid time_start format: {e}")
        if time_end:
            try:
                parsed_time_end = datetime.fromisoformat(time_end.replace('Z', '+00:00'))
            except ValueError as e:
                raise HTTPException(status_code=400, detail=f"Invalid time_end format: {e}")

        # Build spatial bounds tuples
        lat_bounds = (lat_min, lat_max) if lat_min is not None and lat_max is not None else None
        lon_bounds = (lon_min, lon_max) if lon_min is not None and lon_max is not None else None

        # Validate filter parameters
        from core.filtering import validate_filter_params
        is_valid, error_msg = validate_filter_params(
            time_start=parsed_time_start,
            time_end=parsed_time_end,
            lat_bounds=lat_bounds,
            lon_bounds=lon_bounds
        )
        if not is_valid:
            raise HTTPException(status_code=400, detail=error_msg)

        # Use our track analysis function
        result = analyze_track_data(
            track_data=track_data,
            initial_wind_direction=wind_direction,
            filename=file.filename,
            angle_tolerance=angle_tolerance,
            min_duration=min_duration,
            min_distance=min_distance,
            min_speed=min_speed,
            suspicious_angle_threshold=suspicious_angle_threshold,
            time_start=parsed_time_start,
            time_end=parsed_time_end,
            lat_bounds=lat_bounds,
            lon_bounds=lon_bounds
        )
        
        # Count tacks
        port_tack_count = len(result.segments[result.segments.get('tack', '') == 'Port']) if 'tack' in result.segments.columns else 0
        starboard_tack_count = len(result.segments[result.segments.get('tack', '') == 'Starboard']) if 'tack' in result.segments.columns else 0
        
        # Prepare response
        # Add index as 'id' column for segments to ensure proper ID matching
        segments_with_id = result.segments.copy()
        segments_with_id['id'] = segments_with_id.index
        response = TrackAnalysisResponse(
            segments=[segment.to_dict() for _, segment in segments_with_id.iterrows()],
            wind_estimate=WindEstimateResponse(
                direction=result.refined_wind,
                confidence=result.wind_confidence,
                port_average_angle=result.best_port_angle or 0,
                starboard_average_angle=result.best_starboard_angle or 0,
                total_segments=len(result.segments),
                port_segments=port_tack_count,
                starboard_segments=starboard_tack_count
            ),
            performance_metrics=PerformanceMetrics(
                avg_speed=result.avg_speed,
                avg_upwind_angle=result.avg_upwind_angle,
                best_upwind_angle=min(filter(None, [result.best_port_angle, result.best_starboard_angle]), default=None),
                vmg_upwind=result.vmg_upwind,
                vmg_downwind=None,  # Not calculated in current implementation
                port_tack_count=port_tack_count,
                starboard_tack_count=starboard_tack_count,
                vmg_segment_ids=result.vmg_segment_ids
            ),
            track_summary={
                'total_distance': float(result.total_distance),
                'duration_seconds': float(len(result.track_data)),
                'avg_speed_knots': float(result.avg_speed),
                'max_speed_knots': float(result.max_speed),
                'filename': file.filename
            }
        )
        
        return response
        
    except Exception as e:
        logger.error(f"Error analyzing track: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error analyzing track: {str(e)}")


@app.post("/api/estimate-wind")
async def estimate_wind(
    file: UploadFile = File(...),
    initial_wind_direction: float = 90.0,
    method: str = "iterative"
):
    """
    Estimate wind direction from a GPX track.
    
    Args:
        file: GPX file to analyze
        initial_wind_direction: Starting estimate for wind direction
        method: Estimation method (iterative, weighted, or basic)
        
    Returns:
        Wind direction estimate with confidence
    """
    try:
        # Read and process file
        content = await file.read()
        file_obj = io.BytesIO(content)
        track_data, metadata = load_gpx_file(file_obj)
        
        if track_data.empty:
            raise HTTPException(status_code=400, detail="No valid track data found")
        
        # Detect segments
        from core.segments import find_consistent_angle_stretches
        segments = find_consistent_angle_stretches(track_data)
        
        if segments.empty:
            raise HTTPException(status_code=400, detail="No segments detected")
        
        # Estimate wind direction
        wind_service = get_wind_service()
        wind_estimate = wind_service.estimate_wind_direction(
            segments=segments,
            method=method
        )
        
        return WindEstimateResponse(
            direction=wind_estimate.direction,
            confidence=wind_estimate.confidence,
            port_average_angle=wind_estimate.port_average_angle,
            starboard_average_angle=wind_estimate.starboard_average_angle,
            total_segments=wind_estimate.total_segments,
            port_segments=wind_estimate.port_segments,
            starboard_segments=wind_estimate.starboard_segments
        )
        
    except Exception as e:
        logger.error(f"Error estimating wind: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error estimating wind: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)