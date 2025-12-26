"""
Time and spatial filtering for track segments.

This module provides functions to filter segments by:
1. Time range - keep segments that overlap with [time_start, time_end]
2. Spatial bounds - keep segments where any point is within lat/lon bounds

These filters are applied AFTER segment detection but BEFORE wind analysis,
so wind estimation only considers segments within the selected region/timeframe.
"""

import logging
from datetime import datetime
from typing import Optional, Tuple

import pandas as pd
import numpy as np

logger = logging.getLogger(__name__)


def filter_segments_by_time(
    segments: pd.DataFrame,
    time_start: Optional[datetime] = None,
    time_end: Optional[datetime] = None
) -> pd.DataFrame:
    """
    Filter segments to keep only those that overlap with the specified time range.

    A segment is kept if it overlaps with [time_start, time_end], meaning:
    - The segment ends after time_start (if specified)
    - The segment starts before time_end (if specified)

    Args:
        segments: DataFrame with 'start_time' and 'end_time' columns
        time_start: Keep segments that end after this time (inclusive)
        time_end: Keep segments that start before this time (inclusive)

    Returns:
        Filtered DataFrame with only segments overlapping the time range
    """
    if segments.empty:
        return segments

    # Check if we have time data
    if 'start_time' not in segments.columns or 'end_time' not in segments.columns:
        logger.warning("Segments missing time columns, skipping time filter")
        return segments

    # Check if any segments have valid time data
    has_time_data = segments['start_time'].notna().any() and segments['end_time'].notna().any()
    if not has_time_data:
        logger.warning("Segments have no valid time data, skipping time filter")
        return segments

    filtered = segments.copy()
    initial_count = len(filtered)

    if time_start is not None:
        # Keep segments that end after time_start
        mask = filtered['end_time'].notna() & (filtered['end_time'] >= time_start)
        # Also keep segments with no time data (don't exclude them)
        mask = mask | filtered['end_time'].isna()
        filtered = filtered[mask]
        logger.debug(f"Time start filter: {initial_count} -> {len(filtered)} segments")

    if time_end is not None:
        # Keep segments that start before time_end
        mask = filtered['start_time'].notna() & (filtered['start_time'] <= time_end)
        # Also keep segments with no time data
        mask = mask | filtered['start_time'].isna()
        filtered = filtered[mask]
        logger.debug(f"Time end filter: {len(filtered)} segments remaining")

    logger.info(f"Time filter: {initial_count} -> {len(filtered)} segments")
    return filtered


def filter_segments_by_spatial_bounds(
    segments: pd.DataFrame,
    track_data: pd.DataFrame,
    lat_bounds: Optional[Tuple[float, float]] = None,
    lon_bounds: Optional[Tuple[float, float]] = None
) -> pd.DataFrame:
    """
    Filter segments to keep only those with at least one point within spatial bounds.

    A segment is kept if ANY of its GPS points fall within the specified
    latitude and longitude bounds. This allows partial segments to be included
    if they pass through the selected region.

    Args:
        segments: DataFrame with 'start_idx' and 'end_idx' columns
        track_data: Original GPS DataFrame with 'latitude' and 'longitude' columns
        lat_bounds: Tuple of (min_lat, max_lat) in degrees, or None to skip
        lon_bounds: Tuple of (min_lon, max_lon) in degrees, or None to skip

    Returns:
        Filtered DataFrame with only segments having points within bounds
    """
    if segments.empty:
        return segments

    if lat_bounds is None and lon_bounds is None:
        return segments

    # Validate required columns
    if 'start_idx' not in segments.columns or 'end_idx' not in segments.columns:
        logger.warning("Segments missing index columns, skipping spatial filter")
        return segments

    if 'latitude' not in track_data.columns or 'longitude' not in track_data.columns:
        logger.warning("Track data missing lat/lon columns, skipping spatial filter")
        return segments

    initial_count = len(segments)

    # Extract bounds
    lat_min, lat_max = lat_bounds if lat_bounds else (-90, 90)
    lon_min, lon_max = lon_bounds if lon_bounds else (-180, 180)

    # Validate bounds
    if lat_min > lat_max:
        lat_min, lat_max = lat_max, lat_min
    if lon_min > lon_max:
        lon_min, lon_max = lon_max, lon_min

    def segment_in_bounds(row) -> bool:
        """Check if any point in segment is within bounds."""
        start_idx = int(row['start_idx'])
        end_idx = int(row['end_idx'])

        # Get points for this segment
        segment_points = track_data.iloc[start_idx:end_idx + 1]

        if segment_points.empty:
            return False

        # Check if any point is within bounds
        in_lat = (segment_points['latitude'] >= lat_min) & (segment_points['latitude'] <= lat_max)
        in_lon = (segment_points['longitude'] >= lon_min) & (segment_points['longitude'] <= lon_max)

        return (in_lat & in_lon).any()

    # Apply filter
    mask = segments.apply(segment_in_bounds, axis=1)
    filtered = segments[mask]

    logger.info(f"Spatial filter ({lat_min:.4f},{lon_min:.4f}) to ({lat_max:.4f},{lon_max:.4f}): "
                f"{initial_count} -> {len(filtered)} segments")

    return filtered


def apply_filters(
    segments: pd.DataFrame,
    track_data: pd.DataFrame,
    time_start: Optional[datetime] = None,
    time_end: Optional[datetime] = None,
    lat_bounds: Optional[Tuple[float, float]] = None,
    lon_bounds: Optional[Tuple[float, float]] = None
) -> pd.DataFrame:
    """
    Apply all time and spatial filters to segments.

    This is the main entry point for filtering. It applies filters in order:
    1. Time range filter
    2. Spatial bounds filter

    Args:
        segments: DataFrame of detected segments
        track_data: Original GPS DataFrame
        time_start: Optional start of time range
        time_end: Optional end of time range
        lat_bounds: Optional (min_lat, max_lat) tuple
        lon_bounds: Optional (min_lon, max_lon) tuple

    Returns:
        Filtered segments DataFrame
    """
    if segments.empty:
        return segments

    initial_count = len(segments)

    # Apply time filter
    if time_start is not None or time_end is not None:
        segments = filter_segments_by_time(segments, time_start, time_end)

    # Apply spatial filter
    if lat_bounds is not None or lon_bounds is not None:
        segments = filter_segments_by_spatial_bounds(
            segments, track_data, lat_bounds, lon_bounds
        )

    final_count = len(segments)
    if initial_count != final_count:
        logger.info(f"Filters applied: {initial_count} -> {final_count} segments "
                   f"({initial_count - final_count} filtered out)")

    return segments


def validate_filter_params(
    time_start: Optional[datetime] = None,
    time_end: Optional[datetime] = None,
    lat_bounds: Optional[Tuple[float, float]] = None,
    lon_bounds: Optional[Tuple[float, float]] = None
) -> Tuple[bool, Optional[str]]:
    """
    Validate filter parameters.

    Args:
        time_start: Optional start time
        time_end: Optional end time
        lat_bounds: Optional (min, max) latitude
        lon_bounds: Optional (min, max) longitude

    Returns:
        Tuple of (is_valid, error_message)
    """
    # Validate time range
    if time_start is not None and time_end is not None:
        if time_start > time_end:
            return False, "time_start must be before time_end"

    # Validate latitude bounds
    if lat_bounds is not None:
        lat_min, lat_max = lat_bounds
        if lat_min < -90 or lat_max > 90:
            return False, "Latitude must be between -90 and 90"
        if lat_min > lat_max:
            return False, "lat_min must be less than lat_max"

    # Validate longitude bounds
    if lon_bounds is not None:
        lon_min, lon_max = lon_bounds
        if lon_min < -180 or lon_max > 180:
            return False, "Longitude must be between -180 and 180"
        if lon_min > lon_max:
            return False, "lon_min must be less than lon_max"

    return True, None
