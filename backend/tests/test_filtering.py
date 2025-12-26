"""
Tests for time and spatial filtering of track segments.
"""

import pytest
import pandas as pd
from datetime import datetime, timedelta

from core.filtering import (
    filter_segments_by_time,
    filter_segments_by_spatial_bounds,
    apply_filters,
    validate_filter_params,
)


class TestFilterSegmentsByTime:
    """Tests for filter_segments_by_time function."""

    def test_empty_dataframe_returns_empty(self):
        """Empty segments should return empty without error."""
        segments = pd.DataFrame()
        result = filter_segments_by_time(segments)
        assert result.empty

    def test_missing_time_columns_returns_unchanged(self):
        """Missing time columns should return segments unchanged."""
        segments = pd.DataFrame({'id': [1, 2, 3], 'speed': [10, 12, 11]})
        result = filter_segments_by_time(segments)
        assert len(result) == 3

    def test_no_filters_returns_unchanged(self):
        """No time filters should return all segments."""
        base_time = datetime(2024, 1, 15, 10, 0, 0)
        segments = pd.DataFrame({
            'id': [1, 2, 3],
            'start_time': [base_time, base_time + timedelta(minutes=5), base_time + timedelta(minutes=10)],
            'end_time': [base_time + timedelta(minutes=3), base_time + timedelta(minutes=8), base_time + timedelta(minutes=13)],
        })
        result = filter_segments_by_time(segments)
        assert len(result) == 3

    def test_time_start_filter(self):
        """Segments ending before time_start should be excluded."""
        base_time = datetime(2024, 1, 15, 10, 0, 0)
        segments = pd.DataFrame({
            'id': [1, 2, 3],
            'start_time': [base_time, base_time + timedelta(minutes=5), base_time + timedelta(minutes=10)],
            'end_time': [base_time + timedelta(minutes=3), base_time + timedelta(minutes=8), base_time + timedelta(minutes=13)],
        })
        # Filter: keep segments ending after 10:06
        result = filter_segments_by_time(segments, time_start=base_time + timedelta(minutes=6))
        assert len(result) == 2  # Segments 2 and 3
        assert list(result['id']) == [2, 3]

    def test_time_end_filter(self):
        """Segments starting after time_end should be excluded."""
        base_time = datetime(2024, 1, 15, 10, 0, 0)
        segments = pd.DataFrame({
            'id': [1, 2, 3],
            'start_time': [base_time, base_time + timedelta(minutes=5), base_time + timedelta(minutes=10)],
            'end_time': [base_time + timedelta(minutes=3), base_time + timedelta(minutes=8), base_time + timedelta(minutes=13)],
        })
        # Filter: keep segments starting before 10:06
        result = filter_segments_by_time(segments, time_end=base_time + timedelta(minutes=6))
        assert len(result) == 2  # Segments 1 and 2
        assert list(result['id']) == [1, 2]

    def test_both_time_filters(self):
        """Both time filters should narrow to overlapping segments."""
        base_time = datetime(2024, 1, 15, 10, 0, 0)
        segments = pd.DataFrame({
            'id': [1, 2, 3],
            'start_time': [base_time, base_time + timedelta(minutes=5), base_time + timedelta(minutes=10)],
            'end_time': [base_time + timedelta(minutes=3), base_time + timedelta(minutes=8), base_time + timedelta(minutes=13)],
        })
        # Filter: 10:04 to 10:09 - only segment 2 overlaps
        result = filter_segments_by_time(
            segments,
            time_start=base_time + timedelta(minutes=4),
            time_end=base_time + timedelta(minutes=9)
        )
        assert len(result) == 1
        assert result.iloc[0]['id'] == 2

    def test_all_nan_time_data_returns_unchanged(self):
        """Segments with all NaN time data should return unchanged."""
        segments = pd.DataFrame({
            'id': [1, 2],
            'start_time': [pd.NaT, pd.NaT],
            'end_time': [pd.NaT, pd.NaT],
        })
        result = filter_segments_by_time(segments, time_start=datetime.now())
        assert len(result) == 2


class TestFilterSegmentsBySpatialBounds:
    """Tests for filter_segments_by_spatial_bounds function."""

    def test_empty_segments_returns_empty(self):
        """Empty segments should return empty."""
        segments = pd.DataFrame()
        track_data = pd.DataFrame({'latitude': [45.0], 'longitude': [-120.0]})
        result = filter_segments_by_spatial_bounds(segments, track_data, lat_bounds=(44, 46))
        assert result.empty

    def test_no_bounds_returns_unchanged(self):
        """No spatial bounds should return all segments."""
        segments = pd.DataFrame({'id': [1], 'start_idx': [0], 'end_idx': [2]})
        track_data = pd.DataFrame({
            'latitude': [45.0, 45.1, 45.2],
            'longitude': [-120.0, -120.1, -120.2]
        })
        result = filter_segments_by_spatial_bounds(segments, track_data)
        assert len(result) == 1

    def test_segment_in_bounds_included(self):
        """Segment with points in bounds should be included."""
        segments = pd.DataFrame({'id': [1], 'start_idx': [0], 'end_idx': [2]})
        track_data = pd.DataFrame({
            'latitude': [45.0, 45.1, 45.2],
            'longitude': [-120.0, -120.1, -120.2]
        })
        result = filter_segments_by_spatial_bounds(
            segments, track_data,
            lat_bounds=(44.5, 45.5),
            lon_bounds=(-121, -119)
        )
        assert len(result) == 1

    def test_segment_outside_bounds_excluded(self):
        """Segment with all points outside bounds should be excluded."""
        segments = pd.DataFrame({'id': [1], 'start_idx': [0], 'end_idx': [2]})
        track_data = pd.DataFrame({
            'latitude': [45.0, 45.1, 45.2],
            'longitude': [-120.0, -120.1, -120.2]
        })
        result = filter_segments_by_spatial_bounds(
            segments, track_data,
            lat_bounds=(50, 51),  # Far from actual data
            lon_bounds=(-121, -119)
        )
        assert len(result) == 0

    def test_swapped_bounds_auto_corrected(self):
        """Swapped min/max bounds should be auto-corrected."""
        segments = pd.DataFrame({'id': [1], 'start_idx': [0], 'end_idx': [2]})
        track_data = pd.DataFrame({
            'latitude': [45.0, 45.1, 45.2],
            'longitude': [-120.0, -120.1, -120.2]
        })
        # Intentionally swap min/max
        result = filter_segments_by_spatial_bounds(
            segments, track_data,
            lat_bounds=(45.5, 44.5),  # Swapped
            lon_bounds=(-119, -121)   # Swapped
        )
        assert len(result) == 1  # Should still work


class TestValidateFilterParams:
    """Tests for validate_filter_params function."""

    def test_valid_params_returns_true(self):
        """Valid parameters should return (True, None)."""
        is_valid, error = validate_filter_params(
            time_start=datetime(2024, 1, 1, 10, 0),
            time_end=datetime(2024, 1, 1, 11, 0),
            lat_bounds=(44.0, 46.0),
            lon_bounds=(-121.0, -119.0)
        )
        assert is_valid is True
        assert error is None

    def test_time_start_after_end_invalid(self):
        """time_start after time_end should be invalid."""
        is_valid, error = validate_filter_params(
            time_start=datetime(2024, 1, 1, 12, 0),
            time_end=datetime(2024, 1, 1, 11, 0)
        )
        assert is_valid is False
        assert "time_start" in error.lower()

    def test_latitude_out_of_range_invalid(self):
        """Latitude outside -90 to 90 should be invalid."""
        is_valid, error = validate_filter_params(lat_bounds=(-100, 45))
        assert is_valid is False
        assert "latitude" in error.lower()

    def test_longitude_out_of_range_invalid(self):
        """Longitude outside -180 to 180 should be invalid."""
        is_valid, error = validate_filter_params(lon_bounds=(-200, -120))
        assert is_valid is False
        assert "longitude" in error.lower()

    def test_lat_min_greater_than_max_invalid(self):
        """lat_min > lat_max should be invalid."""
        is_valid, error = validate_filter_params(lat_bounds=(46, 44))
        assert is_valid is False
        assert "lat_min" in error.lower()


class TestApplyFilters:
    """Tests for apply_filters orchestration function."""

    def test_empty_segments_returns_empty(self):
        """Empty segments should return empty."""
        segments = pd.DataFrame()
        track_data = pd.DataFrame()
        result = apply_filters(segments, track_data)
        assert result.empty

    def test_no_filters_returns_unchanged(self):
        """No filters should return segments unchanged."""
        base_time = datetime(2024, 1, 15, 10, 0, 0)
        segments = pd.DataFrame({
            'id': [1, 2],
            'start_time': [base_time, base_time + timedelta(minutes=5)],
            'end_time': [base_time + timedelta(minutes=3), base_time + timedelta(minutes=8)],
            'start_idx': [0, 10],
            'end_idx': [9, 19],
        })
        track_data = pd.DataFrame({
            'latitude': [45.0] * 20,
            'longitude': [-120.0] * 20
        })
        result = apply_filters(segments, track_data)
        assert len(result) == 2

    def test_combined_filters(self):
        """Both time and spatial filters should be applied."""
        base_time = datetime(2024, 1, 15, 10, 0, 0)
        segments = pd.DataFrame({
            'id': [1, 2, 3],
            'start_time': [base_time, base_time + timedelta(minutes=5), base_time + timedelta(minutes=10)],
            'end_time': [base_time + timedelta(minutes=3), base_time + timedelta(minutes=8), base_time + timedelta(minutes=13)],
            'start_idx': [0, 5, 10],
            'end_idx': [4, 9, 14],
        })
        # Segment 1: in-bounds lat/lon
        # Segment 2: in-bounds lat/lon
        # Segment 3: out-of-bounds lat/lon
        track_data = pd.DataFrame({
            'latitude': [45.0, 45.1, 45.2, 45.3, 45.4,  # Seg 1: in bounds
                        45.0, 45.1, 45.2, 45.3, 45.4,   # Seg 2: in bounds
                        50.0, 50.1, 50.2, 50.3, 50.4],  # Seg 3: out of bounds
            'longitude': [-120.0] * 15
        })

        # Time filter: keep segments starting before 10:08 (excludes seg 3)
        # Spatial filter: keep segments with lat 44-46 (excludes seg 3)
        result = apply_filters(
            segments, track_data,
            time_end=base_time + timedelta(minutes=8),
            lat_bounds=(44, 46)
        )
        assert len(result) == 2
        assert list(result['id']) == [1, 2]
