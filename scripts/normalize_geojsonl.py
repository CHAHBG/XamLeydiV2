import json
import sys
from pathlib import Path


def read_geojsonl(path: Path):
    features = []
    with path.open('r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
                # Some sources may have 3D coordinates; keep as-is
                if obj.get('type') == 'Feature':
                    features.append(obj)
                else:
                    # if a FeatureCollection line or other, expand
                    if obj.get('type') == 'FeatureCollection' and 'features' in obj:
                        features.extend(obj['features'])
            except json.JSONDecodeError:
                # Skip malformed lines but log to stderr
                print(f"WARN: Malformed JSON line in {path}", file=sys.stderr)
    return {
        "type": "FeatureCollection",
        "features": features,
    }


def normalize(input_path: str, output_path: str):
    inp = Path(input_path)
    outp = Path(output_path)
    outp.parent.mkdir(parents=True, exist_ok=True)
    fc = read_geojsonl(inp)
    with outp.open('w', encoding='utf-8') as f:
        json.dump(fc, f, ensure_ascii=False)
    print(f"Wrote FeatureCollection: {outp} with {len(fc['features'])} features")


if __name__ == '__main__':
    if len(sys.argv) != 3:
        print("Usage: python scripts/normalize_geojsonl.py <input.geojsonl> <output.json>", file=sys.stderr)
        sys.exit(1)
    normalize(sys.argv[1], sys.argv[2])
#!/usr/bin/env python3
"""
Normalize GeoJSONL (newline-delimited GeoJSON) files to FeatureCollection format
for use with the ParcelApp database generator.

Usage:
    python normalize_geojsonl.py

This script:
1. Reads GeoJSONL files from src/GeojsonL_to_normalise/
2. Converts each line (a Feature object) into a FeatureCollection
3. Writes the normalized JSON to src/data/ for DB generation
"""

import json
import os
from pathlib import Path
from typing import List, Dict, Any

def read_geojsonl(file_path: Path) -> List[Dict[str, Any]]:
    """
    Read a GeoJSONL file and return a list of feature objects.
    
    Args:
        file_path: Path to the .geojsonl file
        
    Returns:
        List of GeoJSON Feature objects
    """
    features = []
    line_num = 0
    
    print(f"Reading {file_path}...")
    
    with open(file_path, 'r', encoding='utf-8') as f:
        for line in f:
            line_num += 1
            line = line.strip()
            
            # Skip empty lines
            if not line:
                continue
                
            try:
                feature = json.loads(line)
                
                # Validate it's a Feature object
                if feature.get('type') == 'Feature':
                    features.append(feature)
                else:
                    print(f"Warning: Line {line_num} is not a Feature object, skipping")
                    
            except json.JSONDecodeError as e:
                print(f"Warning: Failed to parse line {line_num}: {e}")
                continue
    
    print(f"  Loaded {len(features)} features from {line_num} lines")
    return features


def create_feature_collection(features: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Create a GeoJSON FeatureCollection from a list of features.
    
    Args:
        features: List of GeoJSON Feature objects
        
    Returns:
        GeoJSON FeatureCollection object
    """
    return {
        "type": "FeatureCollection",
        "features": features
    }


def write_feature_collection(feature_collection: Dict[str, Any], output_path: Path):
    """
    Write a FeatureCollection to a JSON file.
    
    Args:
        feature_collection: GeoJSON FeatureCollection object
        output_path: Path where to write the JSON file
    """
    print(f"Writing to {output_path}...")
    
    # Create parent directory if it doesn't exist
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(feature_collection, f, ensure_ascii=False, indent=2)
    
    # Get file size for reporting
    size_mb = output_path.stat().st_size / (1024 * 1024)
    print(f"  Written {len(feature_collection['features'])} features ({size_mb:.2f} MB)")


def normalize_geojsonl_files():
    """
    Main function to normalize GeoJSONL files to FeatureCollection format.
    """
    # Define paths
    script_dir = Path(__file__).resolve().parent
    repo_root = script_dir.parent
    
    input_dir = repo_root / 'src' / 'GeojsonL_to_normalise'
    output_dir = repo_root / 'src' / 'data'
    
    # Define input/output file pairs
    files_to_process = [
        ('Parcels_Individuels.geojsonl', 'Parcels_individuels.json'),
        ('Parcels_Collectives.geojsonl', 'Parcels_collectives.json')
    ]
    
    print("=" * 80)
    print("GeoJSONL to FeatureCollection Normalizer")
    print("=" * 80)
    print()
    
    for input_filename, output_filename in files_to_process:
        input_path = input_dir / input_filename
        output_path = output_dir / output_filename
        
        if not input_path.exists():
            print(f"Warning: Input file not found: {input_path}")
            print()
            continue
        
        print(f"Processing: {input_filename} -> {output_filename}")
        print("-" * 80)
        
        try:
            # Read GeoJSONL
            features = read_geojsonl(input_path)
            
            if not features:
                print(f"Warning: No features found in {input_filename}, skipping")
                print()
                continue
            
            # Create FeatureCollection
            feature_collection = create_feature_collection(features)
            
            # Write to output
            write_feature_collection(feature_collection, output_path)
            
            print(f"✓ Successfully normalized {input_filename}")
            print()
            
        except Exception as e:
            print(f"✗ Error processing {input_filename}: {e}")
            print()
            continue
    
    print("=" * 80)
    print("Normalization complete!")
    print()
    print("Next steps:")
    print("  1. Run the database generator:")
    print("     cd ..")
    print("     python scripts/generate_prebuilt_db.py")
    print("     OR")
    print("     ./Build-Database.ps1")
    print()
    print("  2. Rebuild and install the Android app:")
    print("     cd android")
    print("     ./gradlew.bat assembleRelease -x lintVitalAnalyzeRelease")
    print("     adb install -r app/build/outputs/apk/release/app-release.apk")
    print("=" * 80)


if __name__ == '__main__':
    normalize_geojsonl_files()
