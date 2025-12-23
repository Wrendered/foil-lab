#!/usr/bin/env python3
"""
Deep dive into the convergence issue revealed by the validation script.

The validation showed that different initial guesses can converge to very
different wind estimates (e.g., 270° test file: 90° guess → 59°, 270° guess → 248°).

This script investigates WHY this happens.
"""

import sys
import os
import numpy as np
import pandas as pd
from pathlib import Path

# Add backend to path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

from core.gpx import load_gpx_from_path
from core.segments.detector import find_consistent_angle_stretches
from core.calculations import analyze_wind_angles
from core.constants import UPWIND_DOWNWIND_BOUNDARY_DEGREES


def analyze_bearing_clustering(segments: pd.DataFrame):
    """Analyze how bearings cluster - this reveals the actual sailing pattern."""

    bearings = segments['bearing'].values
    distances = segments['distance'].values

    print("\n" + "="*80)
    print("BEARING CLUSTER ANALYSIS")
    print("="*80)

    # Create bearing bins every 10 degrees
    bins = np.arange(0, 370, 10)
    hist, edges = np.histogram(bearings, bins=bins, weights=distances/1000)

    print("\nDistance-weighted bearing distribution (km per 10° bin):")
    print("Angle  |  Distance (km)")
    print("-" * 30)

    for i, (angle, dist_km) in enumerate(zip(edges[:-1], hist)):
        if dist_km > 0.1:  # Only show bins with significant distance
            bar = "█" * int(dist_km * 2)
            print(f"{angle:3.0f}°-{angle+10:3.0f}° | {dist_km:5.2f} {bar}")

    # Find the dominant bearings (peaks in the distribution)
    # Look for bins with more than 10% of max
    threshold = np.max(hist) * 0.2
    dominant_bins = []

    for i, (angle, dist_km) in enumerate(zip(edges[:-1], hist)):
        if dist_km > threshold:
            dominant_bins.append((angle + 5, dist_km))  # Use midpoint of bin

    print(f"\nDominant bearings (>{threshold:.2f} km):")
    for bearing, dist in dominant_bins:
        print(f"  {bearing:.0f}°: {dist:.2f} km")

    # Group into approximate pairs (opposite directions)
    print("\nPossible tack pairs (bearings ~180° apart):")
    for i, (b1, d1) in enumerate(dominant_bins):
        for j, (b2, d2) in enumerate(dominant_bins[i+1:], i+1):
            diff = abs(b1 - b2)
            if 150 < diff < 210 or 150 < (360 - diff) < 210:
                # These could be port/starboard tacks
                bisector = ((b1 + b2) / 2) % 360
                print(f"  {b1:.0f}° ({d1:.2f}km) ↔ {b2:.0f}° ({d2:.2f}km) → Wind estimate: {bisector:.0f}° or {(bisector + 180) % 360:.0f}°")

    return dominant_bins


def test_multiple_initial_guesses(segments: pd.DataFrame, expected_wind: float):
    """Test the algorithm with many initial guesses to map the convergence landscape."""

    from core.wind.algorithms import estimate_wind_direction_iterative

    print("\n" + "="*80)
    print("CONVERGENCE LANDSCAPE - Testing Initial Guesses Every 30°")
    print("="*80)

    # Test every 30 degrees
    test_angles = range(0, 360, 30)
    results = []

    for initial in test_angles:
        result = estimate_wind_direction_iterative(
            segments,
            initial_wind=initial,
            suspicious_angle_threshold=15,
            min_segment_distance=10,
            max_iterations=5
        )

        error = min(abs(result.direction - expected_wind),
                   360 - abs(result.direction - expected_wind))

        results.append({
            'initial': initial,
            'final': result.direction,
            'error': error,
            'confidence': result.confidence,
            'port_count': result.port_count,
            'starboard_count': result.starboard_count
        })

        print(f"Initial: {initial:3.0f}° → Final: {result.direction:6.1f}° (error: {error:5.1f}°) " +
              f"[{result.confidence:6s}] P:{result.port_count:3d} S:{result.starboard_count:3d}")

    # Group by final result
    print("\n" + "-"*80)
    print("CONVERGENCE GROUPS (which initial guesses lead to which finals?)")
    print("-"*80)

    # Round to nearest 5 degrees for grouping
    final_groups = {}
    for r in results:
        final_rounded = round(r['final'] / 5) * 5
        if final_rounded not in final_groups:
            final_groups[final_rounded] = []
        final_groups[final_rounded].append(r['initial'])

    for final in sorted(final_groups.keys()):
        initials = final_groups[final]
        error = min(abs(final - expected_wind), 360 - abs(final - expected_wind))
        print(f"Final ~{final:3.0f}° (error: {error:5.1f}°): Initial guesses: {initials}")

    return results


def analyze_tack_classification_flip(segments: pd.DataFrame, wind1: float, wind2: float):
    """Compare how segments are classified as port/starboard under two different wind directions."""

    print("\n" + "="*80)
    print(f"TACK CLASSIFICATION COMPARISON: {wind1:.0f}° vs {wind2:.0f}°")
    print("="*80)

    # Analyze with both wind directions
    analyzed1 = analyze_wind_angles(segments, wind1)
    analyzed2 = analyze_wind_angles(segments, wind2)

    # Get upwind segments for both
    upwind1 = analyzed1[analyzed1['angle_to_wind'] < UPWIND_DOWNWIND_BOUNDARY_DEGREES]
    upwind2 = analyzed2[analyzed2['angle_to_wind'] < UPWIND_DOWNWIND_BOUNDARY_DEGREES]

    print(f"\nWind {wind1:.0f}°: {len(upwind1)} upwind segments")
    port1 = upwind1[upwind1['tack'] == 'Port']
    stbd1 = upwind1[upwind1['tack'] == 'Starboard']
    print(f"  Port: {len(port1)} segments, mean bearing: {port1['bearing'].mean():.1f}°")
    print(f"  Starboard: {len(stbd1)} segments, mean bearing: {stbd1['bearing'].mean():.1f}°")

    print(f"\nWind {wind2:.0f}°: {len(upwind2)} upwind segments")
    port2 = upwind2[upwind2['tack'] == 'Port']
    stbd2 = upwind2[upwind2['tack'] == 'Starboard']
    print(f"  Port: {len(port2)} segments, mean bearing: {port2['bearing'].mean():.1f}°")
    print(f"  Starboard: {len(stbd2)} segments, mean bearing: {stbd2['bearing'].mean():.1f}°")

    # Show how classification changed
    print("\nKey insight: The algorithm converges to different local minima because")
    print("the tack classification changes completely with different initial guesses!")


def main():
    """Analyze the 270° test file in detail."""

    print("="*80)
    print("DEEP DIVE: Why Does 270° Wind Test Fail?")
    print("="*80)

    # Load the problematic file
    file_path = backend_dir / "data/test_file_270_degrees.gpx"
    gpx_data, metadata = load_gpx_from_path(str(file_path))

    print(f"\nLoaded: {metadata['name']}")
    print(f"GPS points: {len(gpx_data)}")

    # Detect segments
    segments = find_consistent_angle_stretches(
        gpx_data,
        angle_tolerance=25,
        min_duration_seconds=2,
        min_distance_meters=10
    )

    print(f"Segments detected: {len(segments)}")
    print(f"Total distance: {segments['distance'].sum() / 1000:.2f} km")

    # Step 1: Analyze the actual bearing pattern
    dominant_bearings = analyze_bearing_clustering(segments)

    # Step 2: Test convergence with many initial guesses
    expected_wind = 270
    results = test_multiple_initial_guesses(segments, expected_wind)

    # Step 3: Compare the two main solutions
    print("\n" + "="*80)
    print("HYPOTHESIS: Multiple Local Minima")
    print("="*80)
    print("\nThe algorithm appears to have multiple 'attractors' - different wind")
    print("directions that each produce internally consistent (but wrong) solutions.")

    # Find the two main convergence points
    finals = [r['final'] for r in results]
    unique_finals = list(set([round(f / 10) * 10 for f in finals]))

    if len(unique_finals) >= 2:
        wind_a = unique_finals[0]
        wind_b = unique_finals[1]

        analyze_tack_classification_flip(segments, wind_a, wind_b)

    # Step 4: What's the ACTUAL wind based on sailing pattern?
    print("\n" + "="*80)
    print("DETERMINING TRUE WIND FROM SAILING PATTERN")
    print("="*80)

    print("\nIf sailors are sailing upwind (tacking), the wind should be:")
    print("1. Perpendicular to the bisector of their port/starboard bearings")
    print("2. The direction that makes both tacks have similar angles")

    # Find the two most-sailed bearings
    bearings = segments['bearing'].values
    distances = segments['distance'].values

    # Weighted histogram
    bins = np.arange(0, 370, 10)
    hist, edges = np.histogram(bearings, bins=bins, weights=distances)

    # Find top 2 peaks
    peak_indices = np.argsort(hist)[-4:]  # Top 4 bins
    peak_bearings = [(edges[i] + 5) for i in peak_indices if hist[i] > np.max(hist) * 0.15]

    print(f"\nMost-sailed bearings: {[f'{b:.0f}°' for b in peak_bearings]}")

    # Try to find opposite pairs
    for i, b1 in enumerate(peak_bearings):
        for b2 in peak_bearings[i+1:]:
            diff = abs(b1 - b2)
            if 120 < diff < 240:  # Could be tacks
                bisector1 = (b1 + b2) / 2
                bisector2 = (bisector1 + 180) % 360
                wind_est1 = (bisector1 + 90) % 360
                wind_est2 = (bisector1 - 90) % 360

                print(f"\nIf {b1:.0f}° and {b2:.0f}° are port/starboard tacks:")
                print(f"  Bearing bisector: {bisector1:.0f}° (or {bisector2:.0f}°)")
                print(f"  Implied wind: {wind_est1:.0f}° or {wind_est2:.0f}°")

                # Check which is closer to expected
                for w in [wind_est1, wind_est2]:
                    err = min(abs(w - expected_wind), 360 - abs(w - expected_wind))
                    print(f"    {w:.0f}° has error of {err:.0f}° from expected {expected_wind}°")


if __name__ == "__main__":
    main()
