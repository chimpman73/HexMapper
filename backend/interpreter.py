import cv2
import numpy as np
import json
import math

import os
import urllib.parse

HEX_SIZE = 40
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def load_templates():
    templates = {"terrain": [], "coastline": [], "city": [], "ignore": []}
    
    def load_dir(dir_name, category, use_alpha=False):
        d_path = os.path.join(BASE_DIR, "assets", "tiles", dir_name)
        if os.path.exists(d_path):
            for f in os.listdir(d_path):
                if f.endswith(".png"):
                    img = cv2.imread(os.path.join(d_path, f), cv2.IMREAD_UNCHANGED)
                    if img is not None:
                        if use_alpha and img.shape[2] == 4:
                            _, mask = cv2.threshold(img[:, :, 3], 1, 255, cv2.THRESH_BINARY)
                            templates[category].append({"key": f"{dir_name}/{f}", "mask": mask})
                        else:
                            templates[category].append({"key": f"{dir_name}/{f}", "bgr": img[:, :, :3]})
                            
    load_dir("Terrain", "terrain")
    load_dir("Coastline", "coastline")
    load_dir("Cities", "city", use_alpha=True)
    load_dir("Ignored", "ignore", use_alpha=True)
    
    return templates

templates = load_templates()

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
    
    # -------------------------------------------------------------------------
    # STEP 0: BORDER EXTRACTION AND INPAINTING
    # -------------------------------------------------------------------------
    # Convert to HSV to isolate the Red borders
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    
    # Red has hue near 0 and 180
    lower_red1 = np.array([0, 70, 50])
    upper_red1 = np.array([10, 255, 255])
    mask1 = cv2.inRange(hsv, lower_red1, upper_red1)
    
    lower_red2 = np.array([170, 70, 50])
    upper_red2 = np.array([180, 255, 255])
    mask2 = cv2.inRange(hsv, lower_red2, upper_red2)
    
    red_mask = mask1 | mask2
    
    # Clean up the mask with morphology
    kernel_border = np.ones((3,3), np.uint8)
    red_mask_clean = cv2.morphologyEx(red_mask, cv2.MORPH_OPEN, kernel_border)
    
    # Extract Contours for the borders to render on the frontend
    border_contours, _ = cv2.findContours(red_mask_clean, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    global_borders = []
    
    for cnt in border_contours:
        epsilon = 0.0005 * cv2.arcLength(cnt, True)
        approx = cv2.approxPolyDP(cnt, epsilon, True)
        path_points = []
        for p in approx:
            x, y = p[0]
            cx = x * bg_scale_x + bg_offset_x
            cy = y * bg_scale_y + bg_offset_y
            path_points.append({"x": cx, "y": cy})
            
        if len(path_points) > 2:
            global_borders.append(path_points)
            
    # Inpaint the original image to physically erase the red borders so they don't block water/terrain
    img = cv2.inpaint(img, red_mask_clean, 3, cv2.INPAINT_TELEA)
    
    # -------------------------------------------------------------------------
    # STEP 1: GLOBAL SHORELINE GEOMETRY
    # -------------------------------------------------------------------------
    img_lab = cv2.cvtColor(img, cv2.COLOR_BGR2Lab).astype(np.float32)
    water_mask = np.zeros((height, width), dtype=np.uint8)
    
    coastline_colors = []
    for t in templates["coastline"]:
        avg_bgr = cv2.mean(t["bgr"])[:3] # (B,G,R)
        # Convert BGR to Lab for distance comparison
        lab = cv2.cvtColor(np.uint8([[avg_bgr]]), cv2.COLOR_BGR2Lab)[0][0]
        coastline_colors.append(lab)

    for sig in coastline_colors:
        diff = img_lab - np.array([sig[0], sig[1], sig[2]], dtype=np.float32)
        dist_sq = np.sum(diff**2, axis=2)
        water_mask[dist_sq < 30.0**2] = 255
        
    # Clean up the mask using morphology
    kernel = np.ones((5,5), np.uint8)
    water_mask = cv2.morphologyEx(water_mask, cv2.MORPH_OPEN, kernel)
    water_mask = cv2.morphologyEx(water_mask, cv2.MORPH_CLOSE, kernel)
    
    # Extract Contours (use RETR_LIST to capture both outer boundaries and inner island holes)
    contours, _ = cv2.findContours(water_mask, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    global_coastlines = []
    
    for cnt in contours:
        # Decrease epsilon to increase the number of vertices for smoother, higher-fidelity shorelines
        epsilon = 0.0005 * cv2.arcLength(cnt, True)
        approx = cv2.approxPolyDP(cnt, epsilon, True)
        
        path_points = []
        for p in approx:
            # p is [[x, y]]
            x, y = p[0]
            # Convert to Canvas coordinates
            cx = x * bg_scale_x + bg_offset_x
            cy = y * bg_scale_y + bg_offset_y
            path_points.append({"x": cx, "y": cy})
            
        if len(path_points) > 2:
            global_coastlines.append(path_points)

    # -------------------------------------------------------------------------
    # STEP 2: MASK-AWARE HEX SCANNING
    # -------------------------------------------------------------------------
    terrain_data = {}
    coastline_data = {}
    city_data = {}
    unknown_hexes = []

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
            # Calculate exact map hex dimensions
            if orientation == 'flat':
                hex_w = int((2 * HEX_SIZE) / bg_scale_x)
                hex_h = int((math.sqrt(3) * HEX_SIZE) / bg_scale_y)
            else:
                hex_w = int((math.sqrt(3) * HEX_SIZE) / bg_scale_x)
                hex_h = int((2 * HEX_SIZE) / bg_scale_y)
            
            # Extract 70% of the hex from the map as our target region
            margin_x = max(2, int(hex_w * 0.35))
            margin_y = max(2, int(hex_h * 0.35))
            
            x_start = max(0, img_x - margin_x)
            x_end = min(width, img_x + margin_x)
            y_start = max(0, img_y - margin_y)
            y_end = min(height, img_y + margin_y)
            
            # Extract 80% from the templates so the region can slide around for perfect alignment
            t_margin_x = max(2, int(hex_w * 0.40))
            t_margin_y = max(2, int(hex_h * 0.40))
            
            region = img[y_start:y_end, x_start:x_end]
            region_mask = water_mask[y_start:y_end, x_start:x_end]
            
            if region.size > 0:
                s = -q - r
                key = f"{q},{r},{s}"
                
                # Check if this hex has ANY water
                water_pixels = np.count_nonzero(region_mask)
                total_pixels = region.shape[0] * region.shape[1]
                
                # If there's a significant amount of water, it's a coastline hex!
                is_coastline = (water_pixels / total_pixels) > 0.05
                
                if is_coastline:
                    best_score = float('inf')
                    best_coast = None
                    for t in templates["coastline"]:
                        resized = cv2.resize(t["bgr"], (hex_w, hex_h))
                        t_cx, t_cy = hex_w // 2, hex_h // 2
                        t_crop = resized[max(0, t_cy - t_margin_y):min(hex_h, t_cy + t_margin_y), 
                                         max(0, t_cx - t_margin_x):min(hex_w, t_cx + t_margin_x)]
                        
                        # Match the 70% map region inside the 80% template crop
                        if region.shape[0] <= t_crop.shape[0] and region.shape[1] <= t_crop.shape[1]:
                            mask_3ch = cv2.merge([region_mask, region_mask, region_mask])
                            score_map = cv2.matchTemplate(t_crop, region, cv2.TM_SQDIFF, mask=mask_3ch)
                            score = np.min(score_map)
                            if score < best_score:
                                best_score = score
                                best_coast = t["key"]
                            
                    if best_coast:
                        coastline_data[key] = get_asset_url(f"assets/tiles/{best_coast}")
                    else:
                        coastline_data[key] = get_asset_url("assets/tiles/Coastline/hex_104.png")
                    
                # Now we want to identify the TERRAIN.
                # If it's a shoreline, we MUST ignore the water pixels so they don't confuse the terrain scanner!
                # We do this by creating a land mask (inverse of water mask)
                land_mask = cv2.bitwise_not(region_mask)
                
                if np.count_nonzero(land_mask) > 10:
                    best_score = float('inf')
                    best_match_key = None
                    
                    for t in templates["terrain"]:
                        resized = cv2.resize(t["bgr"], (hex_w, hex_h))
                        t_cx, t_cy = hex_w // 2, hex_h // 2
                        t_crop = resized[max(0, t_cy - t_margin_y):min(hex_h, t_cy + t_margin_y), 
                                         max(0, t_cx - t_margin_x):min(hex_w, t_cx + t_margin_x)]
                        
                        if region.shape[0] <= t_crop.shape[0] and region.shape[1] <= t_crop.shape[1]:
                            # Mask out the water pixels in both the map region and the template crop
                            region_masked = cv2.bitwise_and(region, region, mask=land_mask)
                            
                            # Because t_crop is larger than region, we must iterate over the slide offsets
                            # Or we can just use matchTemplate without NORMED to prevent divide-by-zero variance
                            # Wait, matchTemplate doesn't automatically mask the sliding template.
                            # Since we just want the best slide, let's use the native mask parameter!
                            mask_3ch = cv2.merge([land_mask, land_mask, land_mask])
                            
                            # matchTemplate with mask requires TM_SQDIFF or TM_CCORR_NORMED
                            score_map = cv2.matchTemplate(t_crop, region, cv2.TM_SQDIFF, mask=mask_3ch)
                            score = np.min(score_map)
                            
                            if score < best_score:
                                best_score = score
                                best_match_key = t["key"]
                            
                    if best_match_key:
                        terrain_data[key] = get_asset_url(f"assets/tiles/{best_match_key}")

                # -------------------------------------------------------------------------
                # PHASE 2: BLACK-PIXEL SYMBOL ISOLATION (CITIES & UNKNOWNS)
                # -------------------------------------------------------------------------
                gray = cv2.cvtColor(region, cv2.COLOR_BGR2GRAY)
                # Adaptive thresholding isolates high-contrast lines (ink)
                ink_mask = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 15, 6)
                
                # If there are enough ink pixels to form a symbol
                if np.count_nonzero(ink_mask) > 20:
                    best_score = float('inf')
                    best_match = None
                    match_type = None
                    
                    for cat in ["city", "ignore"]:
                        for t in templates[cat]:
                            resized = cv2.resize(t["mask"], (hex_w, hex_h))
                            t_cx, t_cy = hex_w // 2, hex_h // 2
                            t_crop = resized[max(0, t_cy - t_margin_y):min(hex_h, t_cy + t_margin_y), 
                                             max(0, t_cx - t_margin_x):min(hex_w, t_cx + t_margin_x)]
                                             
                            if ink_mask.shape[0] <= t_crop.shape[0] and ink_mask.shape[1] <= t_crop.shape[1]:
                                score_map = cv2.matchTemplate(t_crop, ink_mask, cv2.TM_SQDIFF_NORMED)
                                score = np.min(score_map)
                                if score < best_score:
                                    best_score = score
                                    best_match = t["key"]
                                    match_type = cat
                                
                    if best_score < 0.3 and best_match:
                        if match_type == 'city':
                            # Found a known city!
                            city_data[key] = get_asset_url(f"assets/tiles/{best_match}")
                        elif match_type == 'ignore':
                            # Safely ignored by user preference!
                            pass
                    else:
                        # UNKNOWN SYMBOL DETECTED!
                        # We crop the full hex block from the original image and save it for the UI
                        import uuid
                        os.makedirs(os.path.join(BASE_DIR, "saves", ".temp_unknowns"), exist_ok=True)
                        uid = str(uuid.uuid4())
                        img_path = os.path.join(BASE_DIR, "saves", ".temp_unknowns", f"{uid}.png")
                        
                        # We save the raw region (with its background) so the user sees it exactly as it appeared
                        cv2.imwrite(img_path, region)
                        
                        unknown_hexes.append({
                            "id": uid,
                            "key": key,
                            "image": get_asset_url(f"saves/.temp_unknowns/{uid}.png")
                        })

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
            "globalCoastlines": global_coastlines,
            "globalBorders": global_borders,
            "unknowns": unknown_hexes,
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
