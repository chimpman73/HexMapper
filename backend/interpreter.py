import cv2
import numpy as np
import json
import math

import os
import urllib.parse
import color_matcher

HEX_SIZE = 40
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Preload signatures
try:
    signatures = color_matcher.load_signatures()
except Exception as e:
    print("Failed to load signatures:", e)
    signatures = {}

def get_asset_url(rel_path):
    abs_path = os.path.join(BASE_DIR, rel_path.lstrip('/\\'))
    abs_path = abs_path.replace("\\", "/")
    return f"local://file?path={urllib.parse.quote(abs_path, safe='')}"

def hex_to_pixel(q, r, orientation):
    if orientation == 'flat':
        x = HEX_SIZE * (3.0/2.0 * q)
        y = HEX_SIZE * (math.sqrt(3) / 2.0 * q + math.sqrt(3) * r)
    else: # pointy
        x = HEX_SIZE * (math.sqrt(3) * q + math.sqrt(3) / 2.0 * r)
        y = HEX_SIZE * (3.0/2.0 * r)
    return x, y

def scan_aligned_map(args):
    image_path = args.get("imagePath")
    bg_scale_x = float(args.get("bgScaleX", 1))
    bg_scale_y = float(args.get("bgScaleY", 1))
    bg_offset_x = float(args.get("bgOffsetX", 0))
    bg_offset_y = float(args.get("bgOffsetY", 0))
    map_width = int(args.get("mapWidth", 30))
    map_height = int(args.get("mapHeight", 30))
    orientation = args.get("orientation", "flat")

    img = cv2.imread(image_path)
    if img is None:
        raise ValueError("Could not load image")

    height, width, _ = img.shape
    terrain_data = {}
    coastline_data = {}
    city_data = {}

    hexes = []
    if orientation == 'flat':
        for q in range(0, map_width):
            offset = q // 2
            for row in range(0, map_height):
                r = row - offset
                hexes.append((q, r))
    else:
        for row in range(0, map_height):
            offset = row // 2
            for col in range(0, map_width):
                q = col - offset
                r = row - offset
                hexes.append((q, r))

    for (q, r) in hexes:
        cx, cy = hex_to_pixel(q, r, orientation)
        
        # Convert canvas coords to image pixel coords
        img_x = int((cx - bg_offset_x) / bg_scale_x)
        img_y = int((cy - bg_offset_y) / bg_scale_y)
        
        # Check if this center is inside the image
        if 0 <= img_x < width and 0 <= img_y < height:
            # Sample a region that covers the inner portion of the hex
            hex_w = int(HEX_SIZE / bg_scale_x)
            hex_h = int(HEX_SIZE / bg_scale_y)
            
            margin_x = max(2, int(hex_w * 0.35))
            margin_y = max(2, int(hex_h * 0.35))
            
            x_start = max(0, img_x - margin_x)
            x_end = min(width, img_x + margin_x)
            y_start = max(0, img_y - margin_y)
            y_end = min(height, img_y + margin_y)
            
            region = img[y_start:y_end, x_start:x_end]
            if region.size > 0:
                hex_colors = color_matcher.get_dominant_colors(region, k=5)
                best_match_key, match_type = color_matcher.match_hex(hex_colors, signatures)
                s = -q - r
                key = f"{q},{r},{s}"
                
                url = get_asset_url(f"assets/tiles/{best_match_key}")
                
                if match_type == "coastline":
                    coastline_data[key] = url
                else:
                    terrain_data[key] = url

                # Dual-Pass: Extract City Overlays
                city_match = color_matcher.extract_city(hex_colors, signatures)
                if city_match:
                    city_data[key] = get_asset_url(f"assets/tiles/{city_match}")

    # Return reconstructed layers
    layers = [
        { "id": '1', "name": 'Terrain', "type": 'terrain', "visible": True, "opacity": 1, "data": terrain_data },
        { "id": '2', "name": 'Cliffs', "type": 'cliff', "visible": True, "opacity": 1, "data": [] },
        { "id": '3', "name": 'Rivers', "type": 'river', "visible": True, "opacity": 1, "data": [] },
        { "id": '4', "name": 'Coastline', "type": 'coastline', "visible": True, "opacity": 1, "data": coastline_data },
        { "id": '5', "name": 'Cities', "type": 'city', "visible": True, "opacity": 1, "data": city_data },
        { "id": '6', "name": 'Borders', "type": 'border', "visible": True, "opacity": 1, "data": {} },
        { "id": '7', "name": 'Labels', "type": 'label', "visible": True, "opacity": 1, "data": [] }
    ]

    return {
        "status": "success",
        "data": {
            "layers": layers,
            "mapWidth": map_width,
            "mapHeight": map_height,
            "orientation": orientation
        }
    }

def interpret_map(args):
    try:
        return scan_aligned_map(args)
    except Exception as e:
        import traceback
        return {"status": "error", "message": str(e), "trace": traceback.format_exc()}
