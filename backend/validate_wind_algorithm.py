#!/usr/bin/env python3
"""
Comprehensive Wind Estimation Algorithm Validation Script

This script thoroughly validates the wind estimation algorithm against test files
with known wind directions. It provides detailed analysis of:
- Wind estimation accuracy and convergence
- Segment distribution and bearing patterns
- Port/starboard tack balance
- Iteration-by-iteration convergence behavior
- Suspicious segment filtering effects

Author: Claude Code
"""

import sys
import os
import logging
import numpy as np
import pandas as pd
from pathlib import Path
from typing import Dict, Any, List, Tuple

# Add backend to path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

# Import backend modules
from core.gpx import load_gpx_from_path
from core.segments.detector import find_consistent_angle_stretches
from core.wind.algorithms import estimate_wind_direction_iterative
from core.calculations import analyze_wind_angles
from utils.segment_analysis import detect_suspicious_segments
from core.constants import (
    UPWIND_DOWNWIND_BOUNDARY_DEGREES,
    DEFAULT_SUSPICIOUS_ANGLE_THRESHOLD,
    MIN_RELIABLE_SEGMENT_LENGTH_METERS
)

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(levelname)s: %(message)s'
)
logger = logging.getLogger(__name__)


# Test file configuration
TEST_FILES = [
    {
        'path': 'data/test_file_270_degrees.gpx',
        'expected_wind': 270,
        'description': 'Test file with 270° wind'
    },
    {
        'path': 'data/3m_rocket_18kn_90degrees.gpx',
        'expected_wind': 90,
        'description': '3m rocket in 18kn wind at 90°'
    },
    {
        'path': 'data/test_file_short_tacks_300degrees.gpx',
        'expected_wind': 300,
        'description': 'Short tacks with 300° wind'
    },
    {
        'path': 'data/test_file_short_tacks_330degrees.gpx',
        'expected_wind': 330,
        'description': 'Short tacks with 330° wind'
    }
]


def print_section_header(title: str, char: str = "="):
    """Print a formatted section header."""
    print("\n" + char * 80)
    print(f"  {title}")
    print(char * 80 + "\n")


def print_subsection(title: str):
    """Print a formatted subsection header."""
    print(f"\n--- {title} ---")


def analyze_segment_bearings(segments: pd.DataFrame) -> Dict[str, Any]:
    """Analyze the distribution of segment bearings."""
    if segments.empty:
        return {}

    bearings = segments['bearing'].values
    distances = segments['distance'].values

    # Calculate statistics
    stats = {
        'count': len(segments),
        'bearing_mean': np.mean(bearings),
        'bearing_median': np.median(bearings),
        'bearing_std': np.std(bearings),
        'bearing_min': np.min(bearings),
        'bearing_max': np.max(bearings),
        'bearing_range': np.max(bearings) - np.min(bearings),
        'distance_total_km': np.sum(distances) / 1000,
        'distance_mean_m': np.mean(distances),
        'distance_median_m': np.median(distances),
        'distance_min_m': np.min(distances),
        'distance_max_m': np.max(distances)
    }

    # Bearing histogram (every 30 degrees)
    bearing_bins = np.arange(0, 361, 30)
    bearing_hist, _ = np.histogram(bearings, bins=bearing_bins)
    stats['bearing_histogram'] = list(zip(bearing_bins[:-1], bearing_hist))

    return stats


def analyze_tack_distribution(segments: pd.DataFrame, wind_direction: float) -> Dict[str, Any]:
    """Analyze how segments are distributed across tacks."""
    if segments.empty:
        return {}

    # Analyze with wind direction
    analyzed = analyze_wind_angles(segments, wind_direction)

    # Split by tack
    port = analyzed[analyzed['tack'] == 'Port']
    starboard = analyzed[analyzed['tack'] == 'Starboard']

    # Split by upwind/downwind
    upwind = analyzed[analyzed['angle_to_wind'] < UPWIND_DOWNWIND_BOUNDARY_DEGREES]
    downwind = analyzed[analyzed['angle_to_wind'] >= UPWIND_DOWNWIND_BOUNDARY_DEGREES]

    port_upwind = upwind[upwind['tack'] == 'Port']
    starboard_upwind = upwind[upwind['tack'] == 'Starboard']

    return {
        'total_segments': len(analyzed),
        'port_count': len(port),
        'starboard_count': len(starboard),
        'upwind_count': len(upwind),
        'downwind_count': len(downwind),
        'port_upwind_count': len(port_upwind),
        'starboard_upwind_count': len(starboard_upwind),
        'port_upwind_angles': port_upwind['angle_to_wind'].values if len(port_upwind) > 0 else [],
        'starboard_upwind_angles': starboard_upwind['angle_to_wind'].values if len(starboard_upwind) > 0 else [],
        'port_upwind_bearings': port_upwind['bearing'].values if len(port_upwind) > 0 else [],
        'starboard_upwind_bearings': starboard_upwind['bearing'].values if len(starboard_upwind) > 0 else []
    }


def analyze_suspicious_filtering(segments: pd.DataFrame,
                                 suspicious_angle_threshold: float = DEFAULT_SUSPICIOUS_ANGLE_THRESHOLD,
                                 min_segment_length: float = MIN_RELIABLE_SEGMENT_LENGTH_METERS) -> Dict[str, Any]:
    """Analyze the effect of suspicious segment filtering."""
    if segments.empty:
        return {}

    # Detect suspicious segments
    analyzed = detect_suspicious_segments(
        segments,
        min_angle_to_wind=suspicious_angle_threshold,
        min_segment_length=min_segment_length
    )

    suspicious = analyzed[analyzed['suspicious']]
    clean = analyzed[~analyzed['suspicious']]

    return {
        'total_count': len(analyzed),
        'suspicious_count': len(suspicious),
        'clean_count': len(clean),
        'suspicious_percentage': len(suspicious) / len(analyzed) * 100 if len(analyzed) > 0 else 0,
        'suspicious_angles': suspicious['angle_to_wind'].values if len(suspicious) > 0 else [],
        'suspicious_distances': suspicious['distance'].values if len(suspicious) > 0 else [],
        'clean_angles': clean['angle_to_wind'].values if len(clean) > 0 else [],
        'clean_distances': clean['distance'].values if len(clean) > 0 else []
    }


def test_wind_estimation(file_path: str,
                        expected_wind: float,
                        initial_guesses: List[float],
                        description: str) -> Dict[str, Any]:
    """Test wind estimation for a single file with multiple initial guesses."""

    print_section_header(f"Testing: {description}", "=")

    # Load GPX file
    print(f"Loading GPX file: {file_path}")
    full_path = backend_dir / file_path
    if not full_path.exists():
        print(f"ERROR: File not found: {full_path}")
        return {}

    gpx_data, metadata = load_gpx_from_path(str(full_path))
    print(f"Loaded {len(gpx_data)} GPS points")
    print(f"Track name: {metadata.get('name', 'Unknown')}")

    # Detect segments
    print("\nDetecting segments...")
    segments = find_consistent_angle_stretches(
        gpx_data,
        angle_tolerance=25,
        min_duration_seconds=2,
        min_distance_meters=10
    )

    if segments.empty:
        print("ERROR: No segments detected!")
        return {}

    print(f"Detected {len(segments)} segments")
    print(f"Total distance: {segments['distance'].sum() / 1000:.2f} km")

    # Analyze raw segment bearings
    print_subsection("Raw Segment Analysis")
    bearing_stats = analyze_segment_bearings(segments)
    print(f"Segment count: {bearing_stats['count']}")
    print(f"Bearing range: {bearing_stats['bearing_min']:.1f}° - {bearing_stats['bearing_max']:.1f}° (spread: {bearing_stats['bearing_range']:.1f}°)")
    print(f"Bearing mean: {bearing_stats['bearing_mean']:.1f}°, median: {bearing_stats['bearing_median']:.1f}°, std: {bearing_stats['bearing_std']:.1f}°")
    print(f"Distance range: {bearing_stats['distance_min_m']:.0f}m - {bearing_stats['distance_max_m']:.0f}m")
    print(f"Distance mean: {bearing_stats['distance_mean_m']:.0f}m, median: {bearing_stats['distance_median_m']:.0f}m")

    print("\nBearing distribution (every 30°):")
    for angle, count in bearing_stats['bearing_histogram']:
        if count > 0:
            bar = "█" * int(count / max([c for _, c in bearing_stats['bearing_histogram']]) * 40)
            print(f"  {angle:3.0f}°-{angle+30:3.0f}°: {count:3d} {bar}")

    # Test each initial guess
    results = []
    for initial_guess in initial_guesses:
        print_section_header(f"Wind Estimation: Initial Guess = {initial_guess}°", "-")

        # Run iterative wind estimation
        wind_result = estimate_wind_direction_iterative(
            segments,
            initial_wind=initial_guess,
            suspicious_angle_threshold=DEFAULT_SUSPICIOUS_ANGLE_THRESHOLD,
            min_segment_distance=10,
            max_iterations=5
        )

        # Calculate error
        estimated = wind_result.direction
        error = abs(estimated - expected_wind)
        if error > 180:
            error = 360 - error

        print(f"\nRESULTS:")
        print(f"  Expected wind:    {expected_wind}°")
        print(f"  Estimated wind:   {estimated:.1f}°")
        print(f"  Error:            {error:.1f}°")
        print(f"  Confidence:       {wind_result.confidence}")
        print(f"  Port angle:       {wind_result.port_angle:.1f}° ({wind_result.port_count} segments)" if wind_result.port_angle else "  Port angle:       None")
        print(f"  Starboard angle:  {wind_result.starboard_angle:.1f}° ({wind_result.starboard_count} segments)" if wind_result.starboard_angle else "  Starboard angle:  None")

        if wind_result.port_angle and wind_result.starboard_angle:
            imbalance = abs(wind_result.port_angle - wind_result.starboard_angle)
            print(f"  Angle imbalance:  {imbalance:.1f}°")

        # Analyze tack distribution with final wind estimate
        print_subsection("Tack Distribution Analysis")
        tack_stats = analyze_tack_distribution(segments, estimated)
        print(f"Total segments: {tack_stats['total_segments']}")
        print(f"Port tack: {tack_stats['port_count']} ({tack_stats['port_count']/tack_stats['total_segments']*100:.1f}%)")
        print(f"Starboard tack: {tack_stats['starboard_count']} ({tack_stats['starboard_count']/tack_stats['total_segments']*100:.1f}%)")
        print(f"Upwind: {tack_stats['upwind_count']} ({tack_stats['upwind_count']/tack_stats['total_segments']*100:.1f}%)")
        print(f"Downwind: {tack_stats['downwind_count']} ({tack_stats['downwind_count']/tack_stats['total_segments']*100:.1f}%)")
        print(f"Port upwind: {tack_stats['port_upwind_count']}")
        print(f"Starboard upwind: {tack_stats['starboard_upwind_count']}")

        # Show upwind angles
        if len(tack_stats['port_upwind_angles']) > 0:
            port_angles = tack_stats['port_upwind_angles']
            print(f"\nPort upwind angles: mean={np.mean(port_angles):.1f}°, median={np.median(port_angles):.1f}°, std={np.std(port_angles):.1f}°")
            print(f"  Range: {np.min(port_angles):.1f}° - {np.max(port_angles):.1f}°")

        if len(tack_stats['starboard_upwind_angles']) > 0:
            stbd_angles = tack_stats['starboard_upwind_angles']
            print(f"Starboard upwind angles: mean={np.mean(stbd_angles):.1f}°, median={np.median(stbd_angles):.1f}°, std={np.std(stbd_angles):.1f}°")
            print(f"  Range: {np.min(stbd_angles):.1f}° - {np.max(stbd_angles):.1f}°")

        # Show upwind bearings
        if len(tack_stats['port_upwind_bearings']) > 0:
            port_bearings = tack_stats['port_upwind_bearings']
            print(f"\nPort upwind bearings: mean={np.mean(port_bearings):.1f}°, median={np.median(port_bearings):.1f}°")

        if len(tack_stats['starboard_upwind_bearings']) > 0:
            stbd_bearings = tack_stats['starboard_upwind_bearings']
            print(f"Starboard upwind bearings: mean={np.mean(stbd_bearings):.1f}°, median={np.median(stbd_bearings):.1f}°")

        # Analyze suspicious filtering
        analyzed_for_suspicious = analyze_wind_angles(segments, estimated)
        upwind_segs = analyzed_for_suspicious[analyzed_for_suspicious['angle_to_wind'] < UPWIND_DOWNWIND_BOUNDARY_DEGREES]

        if not upwind_segs.empty:
            print_subsection("Suspicious Segment Filtering")
            sus_stats = analyze_suspicious_filtering(upwind_segs)
            print(f"Total upwind segments: {sus_stats['total_count']}")
            print(f"Suspicious segments: {sus_stats['suspicious_count']} ({sus_stats['suspicious_percentage']:.1f}%)")
            print(f"Clean segments: {sus_stats['clean_count']}")

            if len(sus_stats['suspicious_angles']) > 0:
                print(f"\nSuspicious segment angles: {sus_stats['suspicious_angles']}")
                print(f"Suspicious segment distances: {sus_stats['suspicious_distances']}")

        results.append({
            'initial_guess': initial_guess,
            'estimated_wind': estimated,
            'error': error,
            'confidence': wind_result.confidence,
            'port_angle': wind_result.port_angle,
            'starboard_angle': wind_result.starboard_angle,
            'port_count': wind_result.port_count,
            'starboard_count': wind_result.starboard_count
        })

    return {
        'file_path': file_path,
        'expected_wind': expected_wind,
        'description': description,
        'segment_count': len(segments),
        'bearing_stats': bearing_stats,
        'results': results
    }


def detailed_segment_analysis(file_path: str, description: str):
    """Perform detailed analysis on a single file's segments."""

    print_section_header(f"DETAILED SEGMENT ANALYSIS: {description}", "=")

    # Load GPX file
    full_path = backend_dir / file_path
    gpx_data, metadata = load_gpx_from_path(str(full_path))

    # Detect segments
    segments = find_consistent_angle_stretches(
        gpx_data,
        angle_tolerance=25,
        min_duration_seconds=2,
        min_distance_meters=10
    )

    if segments.empty:
        print("No segments detected")
        return

    print(f"\nAnalyzing {len(segments)} segments:")
    print("\nSegment-by-segment breakdown:")
    print(f"{'#':<4} {'Bearing':>8} {'Distance':>10} {'Duration':>10} {'Speed':>8}")
    print("-" * 50)

    for i, row in segments.iterrows():
        print(f"{i+1:<4} {row['bearing']:>8.1f}° {row['distance']:>9.0f}m {row['duration']:>9.1f}s {row['avg_speed_knots']:>7.1f}kn")

    # Group segments by bearing (30° bins)
    print("\n\nSegments grouped by bearing (30° bins):")
    bearing_bins = np.arange(0, 361, 30)
    segments['bearing_bin'] = pd.cut(segments['bearing'], bins=bearing_bins, labels=bearing_bins[:-1], include_lowest=True)

    grouped = segments.groupby('bearing_bin', observed=True).agg({
        'bearing': ['count', 'mean'],
        'distance': ['sum', 'mean'],
        'duration': ['sum', 'mean'],
        'avg_speed_knots': 'mean'
    }).round(1)

    print(grouped)


def main():
    """Main validation routine."""

    print_section_header("WIND ESTIMATION ALGORITHM VALIDATION", "=")
    print("This script validates the wind estimation algorithm against test files")
    print("with known wind directions.\n")

    all_results = []

    # Test each file
    for test_file in TEST_FILES:
        # Test with initial guess of 90° and the correct answer
        initial_guesses = [90, test_file['expected_wind']]

        result = test_wind_estimation(
            test_file['path'],
            test_file['expected_wind'],
            initial_guesses,
            test_file['description']
        )

        if result:
            all_results.append(result)

    # Detailed analysis on one file
    if TEST_FILES:
        detailed_segment_analysis(
            TEST_FILES[0]['path'],
            TEST_FILES[0]['description']
        )

    # Summary
    print_section_header("VALIDATION SUMMARY", "=")

    for result in all_results:
        print(f"\n{result['description']}:")
        print(f"  Expected wind: {result['expected_wind']}°")
        print(f"  Segments detected: {result['segment_count']}")

        for test_result in result['results']:
            print(f"\n  Initial guess: {test_result['initial_guess']}°")
            print(f"    → Estimated: {test_result['estimated_wind']:.1f}°")
            print(f"    → Error: {test_result['error']:.1f}°")
            print(f"    → Confidence: {test_result['confidence']}")
            if test_result['port_angle'] and test_result['starboard_angle']:
                imbalance = abs(test_result['port_angle'] - test_result['starboard_angle'])
                print(f"    → Port/Starboard balance: {imbalance:.1f}° difference")

    # Critical analysis
    print_section_header("CRITICAL ANALYSIS", "=")

    print("\n1. CONVERGENCE FROM DIFFERENT STARTING POINTS:")
    for result in all_results:
        estimates = [r['estimated_wind'] for r in result['results']]
        if len(set([round(e, 0) for e in estimates])) > 1:
            print(f"   ⚠ {result['description']}: Different initial guesses converged to different results!")
            for r in result['results']:
                print(f"      Initial {r['initial_guess']}° → {r['estimated_wind']:.1f}°")
        else:
            print(f"   ✓ {result['description']}: Consistent convergence")

    print("\n2. ACCURACY RELATIVE TO EXPECTED VALUES:")
    errors = []
    for result in all_results:
        for test_result in result['results']:
            errors.append(test_result['error'])
            if test_result['error'] > 10:
                print(f"   ⚠ {result['description']}: Large error of {test_result['error']:.1f}°")

    if errors:
        print(f"\n   Mean absolute error: {np.mean(errors):.1f}°")
        print(f"   Median absolute error: {np.median(errors):.1f}°")
        print(f"   Max error: {np.max(errors):.1f}°")

    print("\n3. PORT/STARBOARD BALANCE:")
    for result in all_results:
        for test_result in result['results']:
            if test_result['port_angle'] and test_result['starboard_angle']:
                imbalance = abs(test_result['port_angle'] - test_result['starboard_angle'])
                if imbalance > 5:
                    print(f"   ⚠ {result['description']}: Imbalanced angles ({imbalance:.1f}° difference)")
                else:
                    print(f"   ✓ {result['description']}: Well balanced ({imbalance:.1f}° difference)")

    print("\n4. CONFIDENCE LEVELS:")
    for result in all_results:
        for test_result in result['results']:
            confidence = test_result['confidence']
            error = test_result['error']
            if confidence == 'high' and error > 10:
                print(f"   ⚠ {result['description']}: High confidence but large error ({error:.1f}°)")
            elif confidence == 'low' and error < 5:
                print(f"   ? {result['description']}: Low confidence but small error ({error:.1f}°)")

    print("\n" + "=" * 80)
    print("Validation complete!")
    print("=" * 80)


if __name__ == "__main__":
    main()
