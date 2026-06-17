import argparse
import json
import os
import cv2
import numpy as np
import math

HEX_SIZE = 40

def hex_to_pixel(q, r, orientation):
    if orientation == 'flat':
        x = HEX_SIZE * (3.0/2.0 * q)
        y = HEX_SIZE * (math.sqrt(3) / 2.0 * q + math.sqrt(3) * r)
    else: # pointy
        x = HEX_SIZE * (math.sqrt(3) * q + math.sqrt(3) / 2.0 * r)
        y = HEX_SIZE * (3.0/2.0 * r)
    return x, y

def main():
    parser = argparse.ArgumentParser(description="Train custom terrain profile")
    parser.add_argument("--dir", required=True, help="Directory containing Terrain.png")
    parser.add_argument("--fix", required=True, help="Path to fixed JSON map")
    parser.add_argument("--out", default="assets/user_terrain_profile.json", help="Output profile JSON")
    parser.add_argument("--scale_x", type=float, default=None, help="Background X scale")
    parser.add_argument("--scale_y", type=float, default=None, help="Background Y scale")
    parser.add_argument("--offset_x", type=float, default=None, help="Background X offset")
    parser.add_argument("--offset_y", type=float, default=None, help="Background Y offset")
    
    args = parser.parse_args()
    
    terrain_path = os.path.join(args.dir, "Terrain.png")
    if not os.path.exists(terrain_path):
        print(f"Error: {terrain_path} not found.")
        return
        
    img_terrain = cv2.imread(terrain_path, cv2.IMREAD_UNCHANGED)
    if img_terrain is None:
        print("Error loading Terrain.png")
        return
        
    # Composite over parchment background
    if len(img_terrain.shape) == 3 and img_terrain.shape[2] == 4:
        alpha = img_terrain[:, :, 3] / 255.0
        bg = np.full_like(img_terrain[:, :, :3], [200, 240, 253], dtype=np.uint8)
        bgr = img_terrain[:, :, :3]
        for c in range(3):
            bg[:, :, c] = (alpha * bgr[:, :, c] + (1 - alpha) * bg[:, :, c]).astype(np.uint8)
        img_terrain_bgr = bg
        _, terrain_ink_mask = cv2.threshold(img_terrain[:,:,3], 10, 255, cv2.THRESH_BINARY)
    else:
        img_terrain_bgr = img_terrain[:, :, :3] if len(img_terrain.shape) == 3 else img_terrain
        gray = cv2.cvtColor(img_terrain_bgr, cv2.COLOR_BGR2GRAY)
        _, terrain_ink_mask = cv2.threshold(gray, 220, 255, cv2.THRESH_BINARY_INV)

    with open(args.fix, "r") as f:
        fix_data = json.load(f)
        
    map_width = fix_data.get("mapWidth", 30)
    map_height = fix_data.get("mapHeight", 30)
    orientation = fix_data.get("orientation", "flat")
    
    bg_scale_x = args.scale_x if args.scale_x is not None else float(fix_data.get("bgScaleX", 1.0))
    bg_scale_y = args.scale_y if args.scale_y is not None else float(fix_data.get("bgScaleY", 1.0))
    bg_offset_x = args.offset_x if args.offset_x is not None else float(fix_data.get("bgOffsetX", 0.0))
    bg_offset_y = args.offset_y if args.offset_y is not None else float(fix_data.get("bgOffsetY", 0.0))
    
    terrain_layer = {}
    for layer in fix_data.get("layers", []):
        if layer.get("name") == "Terrain":
            terrain_layer = layer.get("data", {})
            break
            
    height, width = img_terrain.shape[:2]
    
    profile = []
    
    for key, hex_val in terrain_layer.items():
        parts = key.split(',')
        if len(parts) != 3: continue
        q, r, s = int(parts[0]), int(parts[1]), int(parts[2])
        
        cx, cy = hex_to_pixel(q, r, orientation)
        img_x = int((cx - bg_offset_x) / bg_scale_x)
        img_y = int((cy - bg_offset_y) / bg_scale_y)
        
        if 0 <= img_x < width and 0 <= img_y < height:
            if orientation == 'flat':
                hex_w = int((2 * HEX_SIZE) / bg_scale_x)
                hex_h = int((math.sqrt(3) * HEX_SIZE) / bg_scale_y)
            else:
                hex_w = int((math.sqrt(3) * HEX_SIZE) / bg_scale_x)
                hex_h = int((2 * HEX_SIZE) / bg_scale_y)
                
            margin_x = max(2, int(hex_w * 0.35))
            margin_y = max(2, int(hex_h * 0.35))
            
            x_start = max(0, img_x - margin_x)
            x_end = min(width, img_x + margin_x)
            y_start = max(0, img_y - margin_y)
            y_end = min(height, img_y + margin_y)
            
            if x_end <= x_start or y_end <= y_start:
                continue
                
            t_ink_region = terrain_ink_mask[y_start:y_end, x_start:x_end]
            painted_count = np.count_nonzero(t_ink_region)
            total_pixels = (y_end - y_start) * (x_end - x_start)
            
            # Only train on hexes that the user actively painted
            if total_pixels > 0 and painted_count > total_pixels * 0.1:
                region_bgr = img_terrain_bgr[y_start:y_end, x_start:x_end]
                mean_color = cv2.mean(region_bgr, mask=t_ink_region)[:3]
                
                gray = cv2.cvtColor(region_bgr, cv2.COLOR_BGR2GRAY)
                variance = cv2.Laplacian(gray, cv2.CV_64F).var()
                
                ink_density = painted_count / total_pixels
                
                # Extract filename from "local://file?path=.../hex_087.png"
                import urllib.parse
                parsed = urllib.parse.urlparse(hex_val)
                qs = urllib.parse.parse_qs(parsed.query)
                if 'path' in qs:
                    path_str = qs['path'][0]
                    label = os.path.basename(path_str)
                else:
                    label = os.path.basename(hex_val)
                
                profile.append({
                    "b": mean_color[0],
                    "g": mean_color[1],
                    "r": mean_color[2],
                    "variance": variance,
                    "ink": ink_density,
                    "label": label
                })

    with open(args.out, "w") as f:
        json.dump(profile, f, indent=2)
        
    print(f"Successfully trained profile with {len(profile)} samples.")
    print(f"Saved to {args.out}")

if __name__ == "__main__":
    main()
