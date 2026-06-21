import os
import glob
import cv2
import numpy as np
import json
import sys
import math

# Add parent dir to path so we can import hex_grid
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from hex_grid import HexGrid

def generate_map():
    # Setup paths
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    terrain_dir = os.path.join(base_dir, "assets", "styles", "Hollow Moon", "tiles", "Terrain")
    city_dir = os.path.join(base_dir, "assets", "styles", "Hollow Moon", "tiles", "Cities")
    
    terrain_files = glob.glob(os.path.join(terrain_dir, "*.png"))
    city_files = glob.glob(os.path.join(city_dir, "*.png"))
    
    hex_size = 40
    grid = HexGrid(hex_size)
    bg_color = (202, 240, 252) # BGR parchment
    water_color = (255, 0, 0) # BGR pure blue for K-Means water separation
    
    all_brushes = terrain_files + city_files
    num_brushes = len(all_brushes)
    
    map_width = int(20 * hex_size * 2)
    map_height = int((num_brushes * 2 + 5) * hex_size * math.sqrt(3))
    
    img = np.full((map_height, map_width, 3), bg_color, dtype=np.uint8)
    
    ground_truth = {
        "Terrain": {},
        "Cities": {}
    }
    
    for i, file_path in enumerate(all_brushes):
        filename = os.path.basename(file_path)
        is_city = file_path in city_files
        layer_name = "Cities" if is_city else "Terrain"
        
        # Load brush (it has alpha)
        brush = cv2.imread(file_path, cv2.IMREAD_UNCHANGED)
        if brush is None: 
            print(f"Warning: Could not load {file_path}")
            continue

        # Resize brush to match hex size
        hex_w = int(2 * hex_size)
        hex_h = int(math.sqrt(3) * hex_size)
        brush = cv2.resize(brush, (hex_w, hex_h))
            
        h, w = brush.shape[:2]
        
        # Row index (space them out vertically)
        r = i * 2 
        
        # Col indices for full, half, quarter
        q_full = 2
        q_half = 6
        q_quarter = 10
        
        rel_path = f"assets/styles/Hollow Moon/tiles/{'Cities' if is_city else 'Terrain'}/{filename}"
        
        # Draw full hex
        draw_brush(img, brush, grid, q_full, r, w, h)
        ground_truth[layer_name][f"{q_full},{r},{-q_full-r}"] = rel_path
        
        # Draw half hex
        cx, cy = draw_brush(img, brush, grid, q_half, r, w, h)
        # Cover left half with water
        cv2.rectangle(img, (int(cx - w/2), int(cy - h/2)), (int(cx), int(cy + h/2)), water_color, -1)
        ground_truth[layer_name][f"{q_half},{r},{-q_half-r}"] = rel_path
        
        # Draw quarter hex
        cx, cy = draw_brush(img, brush, grid, q_quarter, r, w, h)
        # Cover bottom 3/4 with water
        cv2.rectangle(img, (int(cx - w/2), int(cy - h/4)), (int(cx + w/2), int(cy + h/2)), water_color, -1)
        ground_truth[layer_name][f"{q_quarter},{r},{-q_quarter-r}"] = rel_path

    # Save
    out_dir = os.path.join(base_dir, "backend", "tests")
    os.makedirs(out_dir, exist_ok=True)
    out_img_path = os.path.join(out_dir, "artificial_map.png")
    cv2.imwrite(out_img_path, img)
    
    with open(os.path.join(out_dir, "artificial_map_truth.json"), "w") as f:
        json.dump(ground_truth, f, indent=2)
        
    print(f"Saved artificial map to {out_img_path}")

def draw_brush(img, brush, grid, q, r, w, h):
    x, y = grid.hex_to_pixel(q, r, 'flat')
    # hex_to_pixel returns the center
    x_offset = 150 # map padding
    y_offset = 150
    cx = x + x_offset
    cy = y + y_offset
    
    x1 = int(cx - w/2)
    y1 = int(cy - h/2)
    x2 = x1 + w
    y2 = y1 + h
    
    # Ensure we don't go out of bounds
    img_h, img_w = img.shape[:2]
    if x1 < 0 or y1 < 0 or x2 > img_w or y2 > img_h:
        return cx, cy

    alpha = brush[:, :, 3] / 255.0
    for c in range(3):
        img[y1:y2, x1:x2, c] = (brush[:, :, c] * alpha + img[y1:y2, x1:x2, c] * (1 - alpha))
        
    return cx, cy

if __name__ == "__main__":
    generate_map()
