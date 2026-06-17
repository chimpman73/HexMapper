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
                        # Precompute inherent ink for terrain templates
                        inherent_ink_count = 0
                        if category == "terrain":
                            bgr_only = img[:, :, :3]
                            gray = cv2.cvtColor(bgr_only, cv2.COLOR_BGR2GRAY)
                            _, ink = cv2.threshold(gray, 100, 255, cv2.THRESH_BINARY_INV)
                            kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3,3))
                            ink = cv2.morphologyEx(ink, cv2.MORPH_OPEN, kernel)
                            inherent_ink_count = np.count_nonzero(ink)

                        if use_alpha and img.shape[2] == 4:
                            _, mask = cv2.threshold(img[:, :, 3], 1, 255, cv2.THRESH_BINARY)
                            templates[category].append({"key": f"{dir_name}/{f}", "mask": mask})
                        else:
                            mean_color = None
                            if img.shape[2] == 4:
                                alpha = img[:,:,3]
                                mean_color = cv2.mean(img[:,:,:3], mask=alpha)[:3]
                            else:
                                mean_color = cv2.mean(img[:,:,:3])[:3]
                                
                            entry = {"key": f"{dir_name}/{f}", "bgr": img[:, :, :3], "mean_color": mean_color}
                            if category == "terrain":
                                entry["ink_count"] = inherent_ink_count
                                entry["mask"] = ink
                            templates[category].append(entry)
                            
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
    # Convert to HSV to isolate the Red borders and Blue rivers
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)

    # --- BORDER EXTRACTION ---
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

    # --- RIVER EXTRACTION ---
    lower_blue = np.array([90, 50, 50])
    upper_blue = np.array([130, 255, 255])
    blue_mask = cv2.inRange(hsv, lower_blue, upper_blue)
    
    # Top-Hat Transform: Erase thin lines to isolate massive ocean blobs
    kernel_large = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))
    oceans = cv2.morphologyEx(blue_mask, cv2.MORPH_OPEN, kernel_large)
    
    # Subtract oceans to get only the thin rivers
    rivers = cv2.subtract(blue_mask, oceans)
    
    # Clean up rivers
    kernel_small = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    river_mask = cv2.morphologyEx(rivers, cv2.MORPH_OPEN, kernel_small)
    river_mask = cv2.morphologyEx(river_mask, cv2.MORPH_DILATE, kernel_small, iterations=1)
    
    # Skeletonize the rivers to get a 1-pixel thick line
    skeleton_rivers = cv2.ximgproc.thinning(river_mask, thinningType=cv2.ximgproc.THINNING_ZHANGSUEN)
    
    # Find the paths
    river_contours, _ = cv2.findContours(skeleton_rivers, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    global_rivers = []
    
    for cnt in river_contours:
        perimeter = cv2.arcLength(cnt, True)
        if perimeter < 30: # Rivers can be shorter than borders
            continue
            
        epsilon = 0.005 * perimeter
        approx = cv2.approxPolyDP(cnt, epsilon, False)
        
        path_points = []
        for pt in approx:
            x, y = pt[0]
            cx = x * bg_scale_x + bg_offset_x
            cy = y * bg_scale_y + bg_offset_y
            path_points.append({"x": cx, "y": cy})
            
        if len(path_points) > 1:
            global_rivers.append(path_points)

    # --- INPAINTING ---
    # Combine border mask and river mask for inpainting
    inpaint_mask = cv2.bitwise_or(red_mask_clean, river_mask)
    # Expand slightly so it covers anti-aliased edges
    inpaint_mask = cv2.dilate(inpaint_mask, np.ones((5,5), np.uint8), iterations=1)
    
    # Inpaint the original image to seamlessly erase the red lines and blue rivers
    img = cv2.inpaint(img, inpaint_mask, 3, cv2.INPAINT_TELEA)
    
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
        perimeter = cv2.arcLength(cnt, True)
        epsilon = 0.0005 * perimeter
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
    # STEP 2: BUILD SOURCE MAPS & DELEGATE TO UNIFIED HEX SCANNER
    # -------------------------------------------------------------------------
    
    # In single-layer mode, the source images for all terrain/coastlines is the inpainted map
    source_coastlines = img
    source_terrain = img
    
    # We generate a global ink mask for cities and terrain
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    _, ink_mask = cv2.threshold(gray, 100, 255, cv2.THRESH_BINARY_INV)
    kernel_ink = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3,3))
    ink_mask = cv2.morphologyEx(ink_mask, cv2.MORPH_OPEN, kernel_ink)
    
    terrain_ink_mask = None
    city_ink_mask = ink_mask
    source_cities = img
    source_unknowns = region if 'region' in locals() else img # Fallback, actually we pass img
    source_unknowns = img
    
    return scan_hex_grid(
        templates, map_width, map_height, orientation, bg_scale_x, bg_scale_y, bg_offset_x, bg_offset_y,
        width, height, water_mask, global_coastlines, global_borders, global_rivers,
        source_coastlines, source_terrain, terrain_ink_mask, source_cities, city_ink_mask, source_unknowns,
        use_ink_filter=True
    )

def scan_hex_grid(templates, map_width, map_height, orientation, bg_scale_x, bg_scale_y, bg_offset_x, bg_offset_y,
                  width, height, water_mask, global_coastlines, global_borders, global_rivers,
                  source_coastlines, source_terrain, terrain_ink_mask, source_cities, city_ink_mask, source_unknowns,
                  use_ink_filter=True):
    import uuid
    import math
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
            
            if x_end <= x_start or y_end <= y_start:
                continue
            
            # Extract 80% from the templates so the region can slide around for perfect alignment
            t_margin_x = max(2, int(hex_w * 0.40))
            t_margin_y = max(2, int(hex_h * 0.40))
            
            region_mask = water_mask[y_start:y_end, x_start:x_end]
            water_pixels = np.count_nonzero(region_mask)
            total_pixels = (y_end - y_start) * (x_end - x_start)
            if total_pixels == 0: continue
            
            s = -q - r
            key = f"{q},{r},{s}"
            
            is_coastline = (water_pixels / total_pixels) > 0.05
            
            # --- COASTLINE ---
            if source_coastlines is not None and is_coastline:
                region_bgr = source_coastlines[y_start:y_end, x_start:x_end]
                best_score = float('inf')
                best_coast = None
                for t in templates["coastline"]:
                    resized = cv2.resize(t["bgr"], (hex_w, hex_h))
                    t_cx, t_cy = hex_w // 2, hex_h // 2
                    t_crop = resized[max(0, t_cy - t_margin_y):min(hex_h, t_cy + t_margin_y), 
                                     max(0, t_cx - t_margin_x):min(hex_w, t_cx + t_margin_x)]
                    
                    if region_bgr.shape[0] <= t_crop.shape[0] and region_bgr.shape[1] <= t_crop.shape[1]:
                        mask_3ch = cv2.merge([region_mask, region_mask, region_mask])
                        score_map = cv2.matchTemplate(t_crop, region_bgr, cv2.TM_SQDIFF, mask=mask_3ch)
                        score = np.min(score_map)
                        if score < best_score:
                            best_score = score
                            best_coast = t["key"]
                            
                if best_coast:
                    coastline_data[key] = get_asset_url(f"assets/tiles/{best_coast}")
                else:
                    coastline_data[key] = get_asset_url("assets/tiles/Coastline/hex_104.png")

            # --- TERRAIN ---
            if source_terrain is not None:
                land_mask = cv2.bitwise_not(region_mask)
                
                has_drawn_ink = False
                is_custom_paint = False
                mean_color = None
                variance = 0
                ink_density = 0
                
                if terrain_ink_mask is not None:
                    t_ink_region = terrain_ink_mask[y_start:y_end, x_start:x_end]
                    painted_count = np.count_nonzero(t_ink_region)
                    has_drawn_ink = painted_count > 20
                    
                    total_pixels = (y_end - y_start) * (x_end - x_start)
                    # If a significant portion of the hex is painted with alpha
                    if total_pixels > 0 and painted_count > total_pixels * 0.3:
                        is_custom_paint = True
                        region_bgr = source_terrain[y_start:y_end, x_start:x_end]
                        mean_color = cv2.mean(region_bgr, mask=t_ink_region)[:3]
                        gray = cv2.cvtColor(region_bgr, cv2.COLOR_BGR2GRAY)
                        variance = cv2.Laplacian(gray, cv2.CV_64F).var()
                        ink_density = painted_count / total_pixels
                
                if np.count_nonzero(land_mask) > 10 or has_drawn_ink:
                    region_bgr = source_terrain[y_start:y_end, x_start:x_end]
                    best_score = float('inf')
                    best_match_key = None
                    
                    profile_path = os.path.join(BASE_DIR, "assets", "user_terrain_profile.json")
                    profile_match = None
                    
                    if is_custom_paint and os.path.exists(profile_path):
                        try:
                            with open(profile_path, "r") as f:
                                profile = json.load(f)
                            
                            # Calculate k-NN distance (k=1 for simplicity, we find the absolute closest trained hex)
                            best_profile_dist = float('inf')
                            for p in profile:
                                # Feature weighting: color differences dominate, but texture provides a nudge
                                db = (mean_color[0] - p["b"]) ** 2
                                dg = (mean_color[1] - p["g"]) ** 2
                                dr = (mean_color[2] - p["r"]) ** 2
                                color_dist = math.sqrt(db + dg + dr)
                                
                                # Variance ranges massively (100 to 30000+). Scale it.
                                var_dist = abs(variance - p["variance"]) / 1000.0
                                
                                total_dist = color_dist + var_dist
                                if total_dist < best_profile_dist:
                                    best_profile_dist = total_dist
                                    profile_match = p["label"]
                                    
                            # If we have a very confident profile match (distance < 15), skip template matching!
                            if best_profile_dist < 15.0 and profile_match:
                                best_match_key = f"Terrain/{profile_match}"
                        except Exception as e:
                            pass
                            
                    # Only do OpenCV Template Matching if the AI Profile didn't confidently classify it
                    if not best_match_key:
                        for t in templates["terrain"]:
                            if use_ink_filter:
                                if not has_drawn_ink and t.get("ink_count", 0) > 200:
                                    continue
                                if has_drawn_ink and t.get("ink_count", 0) < 50:
                                    continue

                            resized = cv2.resize(t["bgr"], (hex_w, hex_h))
                            t_cx, t_cy = hex_w // 2, hex_h // 2
                            t_crop = resized[max(0, t_cy - t_margin_y):min(hex_h, t_cy + t_margin_y), 
                                             max(0, t_cx - t_margin_x):min(hex_w, t_cx + t_margin_x)]
                            
                            if region_bgr.shape[0] <= t_crop.shape[0] and region_bgr.shape[1] <= t_crop.shape[1]:
                                mask_3ch = cv2.merge([land_mask, land_mask, land_mask])
                                # Use NORMED to get an absolute confidence score
                                score_map = cv2.matchTemplate(t_crop, region_bgr, cv2.TM_SQDIFF_NORMED, mask=mask_3ch)
                                score = np.min(score_map)
                                
                                if score < best_score:
                                    best_score = score
                                    best_match_key = t["key"]
                                    
                        # FALLBACK: If the user painted this hex, and template matching failed to find a high-confidence match
                        if is_custom_paint and mean_color is not None and best_score > 0.05:
                            best_dist = float('inf')
                            b, g, r = mean_color
                            for t in templates["terrain"]:
                                if t.get("mean_color") is not None:
                                    tb, tg, tr = t["mean_color"]
                                    dist = math.sqrt((b - tb)**2 + (g - tg)**2 + (r - tr)**2)
                                    if dist < best_dist:
                                        best_dist = dist
                                        best_match_key = t["key"]
                                
                    if best_match_key:
                        terrain_data[key] = get_asset_url(f"assets/tiles/{best_match_key}")

            # --- CITIES & UNKNOWNS ---
            if source_cities is not None and city_ink_mask is not None:
                ink_region = city_ink_mask[y_start:y_end, x_start:x_end]
                
                is_coastal_hex_sym = False
                for path in global_coastlines:
                    for pt in path:
                        if math.hypot(pt["x"] - cx, pt["y"] - cy) < HEX_SIZE * 0.8:
                            is_coastal_hex_sym = True
                            break
                    if is_coastal_hex_sym:
                        break

                if np.count_nonzero(ink_region) > 20:
                    best_score = float('inf')
                    best_match = None
                    match_type = None
                    
                    for cat in ["city", "ignore"]:
                        for t in templates[cat]:
                            resized = cv2.resize(t["mask"], (hex_w, hex_h))
                            t_cx, t_cy = hex_w // 2, hex_h // 2
                            t_crop = resized[max(0, t_cy - t_margin_y):min(hex_h, t_cy + t_margin_y), 
                                             max(0, t_cx - t_margin_x):min(hex_w, t_cx + t_margin_x)]
                                             
                            if ink_region.shape[0] <= t_crop.shape[0] and ink_region.shape[1] <= t_crop.shape[1]:
                                score_map = cv2.matchTemplate(t_crop, ink_region, cv2.TM_SQDIFF_NORMED)
                                score = np.min(score_map)
                                if score < best_score:
                                    best_score = score
                                    best_match = t["key"]
                                    match_type = cat
                                
                    if best_score < 0.3 and best_match:
                        if match_type == 'city':
                            city_data[key] = get_asset_url(f"assets/tiles/{best_match}")
                    elif not is_coastal_hex_sym and source_unknowns is not None:
                        os.makedirs(os.path.join(BASE_DIR, "saves", ".temp_unknowns"), exist_ok=True)
                        uid = str(uuid.uuid4())
                        img_path = os.path.join(BASE_DIR, "saves", ".temp_unknowns", f"{uid}.png")
                        cv2.imwrite(img_path, source_unknowns[y_start:y_end, x_start:x_end])
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
            "globalRivers": global_rivers,
            "unknowns": unknown_hexes,
            "mapWidth": map_width,
            "mapHeight": map_height,
            "orientation": orientation
        }
    }


def scan_multi_layer(args):
    import uuid
    dir_path = args.get("imagePath")
    bg_scale_x = float(args.get("bgScaleX", 1))
    bg_scale_y = float(args.get("bgScaleY", 1))
    bg_offset_x = float(args.get("bgOffsetX", 0))
    bg_offset_y = float(args.get("bgOffsetY", 0))
    map_width = int(args.get("mapWidth", 30))
    map_height = int(args.get("mapHeight", 30))
    orientation = args.get("orientation", "flat")

    global_borders = []
    global_rivers = []
    global_coastlines = []
    terrain_data = {}
    coastline_data = {}
    city_data = {}
    unknown_hexes = []

    img_borders = cv2.imread(os.path.join(dir_path, "Borders.png"), cv2.IMREAD_UNCHANGED)
    img_rivers = cv2.imread(os.path.join(dir_path, "Rivers.png"), cv2.IMREAD_UNCHANGED)
    img_coastlines = cv2.imread(os.path.join(dir_path, "Coastlines.png"), cv2.IMREAD_UNCHANGED)
    img_terrain = cv2.imread(os.path.join(dir_path, "Terrain.png"), cv2.IMREAD_UNCHANGED)
    img_cities = cv2.imread(os.path.join(dir_path, "Cities.png"), cv2.IMREAD_UNCHANGED)

    def get_layer_mask(img):
        if img is None: return None
        if len(img.shape) == 3 and img.shape[2] == 4:
            _, m = cv2.threshold(img[:,:,3], 5, 255, cv2.THRESH_BINARY)
            return m
        else:
            g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            if np.mean(g) > 127:
                _, m = cv2.threshold(g, 240, 255, cv2.THRESH_BINARY_INV)
            else:
                _, m = cv2.threshold(g, 10, 255, cv2.THRESH_BINARY)
            return m

    def composite_over_bg(img):
        if img is None: return None
        if len(img.shape) == 3 and img.shape[2] == 4:
            alpha = img[:, :, 3] / 255.0
            # Use parchment background color (B=200, G=240, R=253)
            bg = np.full_like(img[:, :, :3], [200, 240, 253], dtype=np.uint8)
            bgr = img[:, :, :3]
            for c in range(3):
                bg[:, :, c] = (alpha * bgr[:, :, c] + (1 - alpha) * bg[:, :, c]).astype(np.uint8)
            return bg
        elif len(img.shape) == 3:
            return img[:, :, :3]
        return img

    img_coastlines_bgr = composite_over_bg(img_coastlines)
    img_terrain_bgr = composite_over_bg(img_terrain)

    width, height = 0, 0
    for img in [img_borders, img_rivers, img_coastlines, img_terrain, img_cities]:
        if img is not None:
            height, width = img.shape[:2]
            break
            
    if width == 0:
        raise ValueError("No valid PNG layer files found in the selected directory")

    # BORDERS
    if img_borders is not None:
        mask = get_layer_mask(img_borders)
        kernel_border = np.ones((3,3), np.uint8)
        mask_clean = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel_border)
        border_contours, _ = cv2.findContours(mask_clean, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
        for cnt in border_contours:
            epsilon = 0.0005 * cv2.arcLength(cnt, True)
            approx = cv2.approxPolyDP(cnt, epsilon, True)
            path_points = []
            for p in approx:
                cx = p[0][0] * bg_scale_x + bg_offset_x
                cy = p[0][1] * bg_scale_y + bg_offset_y
                path_points.append({"x": cx, "y": cy})
            if len(path_points) > 2:
                global_borders.append(path_points)

    # RIVERS
    if img_rivers is not None:
        mask = get_layer_mask(img_rivers)
        # Dilate slightly to connect fragmented anti-aliased lines before skeletonizing
        kernel_tiny = np.ones((2,2), np.uint8)
        mask = cv2.morphologyEx(mask, cv2.MORPH_DILATE, kernel_tiny, iterations=1)
        skeleton_rivers = cv2.ximgproc.thinning(mask, thinningType=cv2.ximgproc.THINNING_ZHANGSUEN)
        river_contours, _ = cv2.findContours(skeleton_rivers, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        for cnt in river_contours:
            perimeter = cv2.arcLength(cnt, True)
            if perimeter < 30: continue
            epsilon = 0.005 * perimeter
            approx = cv2.approxPolyDP(cnt, epsilon, False)
            path_points = []
            for pt in approx:
                cx = pt[0][0] * bg_scale_x + bg_offset_x
                cy = pt[0][1] * bg_scale_y + bg_offset_y
                path_points.append({"x": cx, "y": cy})
            if len(path_points) > 1:
                global_rivers.append(path_points)

    # COASTLINES
    water_mask = np.zeros((height, width), dtype=np.uint8)
    if img_coastlines is not None:
        water_mask = get_layer_mask(img_coastlines)
        kernel = np.ones((5,5), np.uint8)
        water_mask_clean = cv2.morphologyEx(water_mask, cv2.MORPH_OPEN, kernel)
        water_mask_clean = cv2.morphologyEx(water_mask_clean, cv2.MORPH_CLOSE, kernel)
        
        contours, _ = cv2.findContours(water_mask_clean, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
        for cnt in contours:
            perimeter = cv2.arcLength(cnt, True)
            epsilon = 0.0005 * perimeter
            approx = cv2.approxPolyDP(cnt, epsilon, True)
            path_points = []
            for p in approx:
                cx = p[0][0] * bg_scale_x + bg_offset_x
                cy = p[0][1] * bg_scale_y + bg_offset_y
                path_points.append({"x": cx, "y": cy})
            if len(path_points) > 2:
                global_coastlines.append(path_points)

    # CITIES GLOBAL MASK
    cities_mask_global = np.zeros((height, width), dtype=np.uint8)
    if img_cities is not None:
        cities_mask_global = get_layer_mask(img_cities)
        kernel_city = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3,3))
        cities_mask_global = cv2.morphologyEx(cities_mask_global, cv2.MORPH_OPEN, kernel_city)

    source_coastlines = img_coastlines_bgr
    source_terrain = img_terrain_bgr
    
    terrain_ink_mask = None
    if img_terrain is not None:
        if len(img_terrain.shape) == 3 and img_terrain.shape[2] == 4:
            _, terrain_ink_mask = cv2.threshold(img_terrain[:,:,3], 10, 255, cv2.THRESH_BINARY)
        else:
            gray = cv2.cvtColor(img_terrain_bgr, cv2.COLOR_BGR2GRAY)
            _, terrain_ink_mask = cv2.threshold(gray, 220, 255, cv2.THRESH_BINARY_INV)
            
    city_ink_mask = cities_mask_global
    source_cities = img_cities
    source_unknowns = img_cities
    
    return scan_hex_grid(
        templates, map_width, map_height, orientation, bg_scale_x, bg_scale_y, bg_offset_x, bg_offset_y,
        width, height, water_mask, global_coastlines, global_borders, global_rivers,
        source_coastlines, source_terrain, terrain_ink_mask, source_cities, city_ink_mask, source_unknowns,
        use_ink_filter=False
    )

def interpret_map(args):
    try:
        mode = args.get("mode", "composite")
        if mode == "multi_layer":
            return scan_multi_layer(args)
        else:
            return scan_aligned_map(args)
    except Exception as e:
        import traceback
        return {"status": "error", "message": str(e), "trace": traceback.format_exc()}
