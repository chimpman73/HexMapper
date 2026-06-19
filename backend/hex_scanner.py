import os
import cv2
import json
import math
import uuid
import numpy as np
from typing import List, Dict, Any, Tuple

from hex_grid import HexGrid
from template_manager import TemplateManager
from map_data import MapData

class HexScanner:
    def __init__(self, base_dir: str, template_manager: TemplateManager, hex_grid: HexGrid, 
                 bg_scale_x: float, bg_scale_y: float, bg_offset_x: float, bg_offset_y: float):
        self._base_dir = base_dir
        self._template_manager = template_manager
        self._hex_grid = hex_grid
        self._bg_scale_x = bg_scale_x
        self._bg_scale_y = bg_scale_y
        self._bg_offset_x = bg_offset_x
        self._bg_offset_y = bg_offset_y

    def scan(self, data: MapData, map_width: int, map_height: int, orientation: str, existing_layers: List[Dict[str, Any]] = None, use_ink_filter: bool = True) -> Dict[str, Any]:
        if existing_layers is None:
            existing_layers = []
        extracted_layers = {}
        unknown_hexes: List[Dict[str, str]] = []

        hexes: List[Tuple[int, int]] = []
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
            cx, cy = self._hex_grid.hex_to_pixel(q, r, orientation)
            
            img_x = int((cx - self._bg_offset_x) / self._bg_scale_x)
            img_y = int((cy - self._bg_offset_y) / self._bg_scale_y)
            
            if 0 <= img_x < data.width and 0 <= img_y < data.height:
                if orientation == 'flat':
                    hex_w = int((2 * self._hex_grid.hex_size) / self._bg_scale_x)
                    hex_h = int((math.sqrt(3) * self._hex_grid.hex_size) / self._bg_scale_y)
                else:
                    hex_w = int((math.sqrt(3) * self._hex_grid.hex_size) / self._bg_scale_x)
                    hex_h = int((2 * self._hex_grid.hex_size) / self._bg_scale_y)
                
                # Generate exact hex polygon for accurate masks
                R_x = self._hex_grid.hex_size / self._bg_scale_x
                R_y = self._hex_grid.hex_size / self._bg_scale_y
                hex_poly = []
                for i in range(6):
                    angle_deg = 60 * i + (0 if orientation == 'flat' else 30)
                    angle_rad = math.pi / 180 * angle_deg
                    hex_poly.append({'x': img_x + R_x * math.cos(angle_rad), 'y': img_y + R_y * math.sin(angle_rad)})
                
                margin_x = max(2, int(hex_w * 0.35))
                margin_y = max(2, int(hex_h * 0.35))
                
                x_start = max(0, img_x - margin_x)
                x_end = min(data.width, img_x + margin_x)
                y_start = max(0, img_y - margin_y)
                y_end = min(data.height, img_y + margin_y)
                
                if x_end <= x_start or y_end <= y_start:
                    continue
                
                t_margin_x = max(2, int(hex_w * 0.40))
                t_margin_y = max(2, int(hex_h * 0.40))
                
                region_mask = data.water_mask[y_start:y_end, x_start:x_end]
                water_pixels = np.count_nonzero(region_mask)
                total_pixels = (y_end - y_start) * (x_end - x_start)
                if total_pixels == 0: continue
                
                s = -q - r
                key = f"{q},{r},{s}"
                
                is_coastline = (water_pixels / total_pixels) > 0.05
                
                # Helper contexts
                ctx = {
                    "data": data, "q": q, "r": r, "key": key, "cx": cx, "cy": cy,
                    "x_start": x_start, "x_end": x_end, "y_start": y_start, "y_end": y_end,
                    "hex_w": hex_w, "hex_h": hex_h, "t_margin_x": t_margin_x, "t_margin_y": t_margin_y,
                    "hex_poly": hex_poly, "region_mask": region_mask, "total_pixels": total_pixels,
                    "is_coastline": is_coastline, "extracted_layers": extracted_layers,
                    "unknown_hexes": unknown_hexes, "use_ink_filter": use_ink_filter
                }

                self._process_terrain(ctx)
                self._process_cities(ctx)

        if not existing_layers:
            existing_layers = [
                { "id": '1', "name": 'Terrain', "type": 'terrain', "visible": True, "opacity": 1, "data": {} },
                { "id": '4', "name": 'Coastline', "type": 'coastline', "visible": True, "opacity": 1, "data": {} },
                { "id": '2', "name": 'Cliffs', "type": 'cliff', "visible": True, "opacity": 1, "data": [] },
                { "id": '3', "name": 'Rivers', "type": 'river', "visible": True, "opacity": 1, "data": [] },
                { "id": '5', "name": 'Cities', "type": 'city', "visible": True, "opacity": 1, "data": {} },
                { "id": '8', "name": 'Hex Grid', "type": 'grid', "visible": True, "opacity": 1, "data": {} },
                { "id": '6', "name": 'Borders', "type": 'border', "visible": True, "opacity": 1, "data": {} },
                { "id": '7', "name": 'Labels', "type": 'label', "visible": True, "opacity": 1, "data": [] }
            ]

        # Merge extracted layers back into existing_layers
        for ext_key, ext_info in extracted_layers.items():
            matched = False
            for layer in existing_layers:
                # Prioritize matching by sourceFilename, fallback to matching by display name
                is_match = (layer.get("sourceFilename") == ext_info["name"] and layer.get("type") == ext_info["type"])
                if not is_match:
                    is_match = (layer.get("name") == ext_info["name"] and layer.get("type") == ext_info["type"])
                    
                if is_match:
                    if isinstance(layer.get("data"), dict):
                        layer["data"].update(ext_info["data"])
                    if "vectors" in ext_info:
                        layer["vectors"] = ext_info["vectors"]
                    matched = True
                    break
                    
            if not matched:
                insert_idx = -1
                for i, layer in enumerate(existing_layers):
                    if layer.get("type") == ext_info["type"]:
                        insert_idx = i
                        break
                        
                new_layer = {
                    "id": f"layer_{str(uuid.uuid4())[:8]}",
                    "name": ext_info["name"],
                    "type": ext_info["type"],
                    "visible": True,
                    "opacity": 1,
                    "sourceFilename": ext_info["name"],
                    "data": ext_info["data"],
                    "vectors": ext_info.get("vectors", [])
                }
                
                if insert_idx != -1:
                    existing_layers.insert(insert_idx, new_layer)
                else:
                    existing_layers.append(new_layer)



        # Convert global rivers to vector lines
        if data.global_rivers:
            river_layer = next((l for l in existing_layers if l.get("type") == "river"), None)
            if river_layer:
                if not isinstance(river_layer.get("data"), list):
                    river_layer["data"] = []
                for path_points in data.global_rivers:
                    if len(path_points) < 2: continue
                    
                    flat_points = []
                    for p in path_points:
                        flat_points.extend([p["x"], p["y"]])
                        
                    # Snap one endpoint to the nearest coastline if within threshold
                    if data.global_coastlines:
                        start_pt = {"x": flat_points[0], "y": flat_points[1]}
                        end_pt = {"x": flat_points[-2], "y": flat_points[-1]}
                        
                        best_dist = float('inf')
                        best_snap_pt = None
                        is_start = True
                        
                        threshold = self._hex_grid.hex_size * 0.8
                        
                        for c_path in data.global_coastlines:
                            for i in range(len(c_path) - 1):
                                p1 = c_path[i]
                                p2 = c_path[i+1]
                                
                                # Distance to start_pt
                                l2 = (p2["x"] - p1["x"])**2 + (p2["y"] - p1["y"])**2
                                if l2 > 0:
                                    t = max(0, min(1, ((start_pt["x"] - p1["x"]) * (p2["x"] - p1["x"]) + (start_pt["y"] - p1["y"]) * (p2["y"] - p1["y"])) / l2))
                                    proj_x = p1["x"] + t * (p2["x"] - p1["x"])
                                    proj_y = p1["y"] + t * (p2["y"] - p1["y"])
                                    dist = math.hypot(start_pt["x"] - proj_x, start_pt["y"] - proj_y)
                                    if dist < best_dist:
                                        best_dist = dist
                                        best_snap_pt = {"x": proj_x, "y": proj_y}
                                        is_start = True
                                        
                                # Distance to end_pt
                                if l2 > 0:
                                    t = max(0, min(1, ((end_pt["x"] - p1["x"]) * (p2["x"] - p1["x"]) + (end_pt["y"] - p1["y"]) * (p2["y"] - p1["y"])) / l2))
                                    proj_x = p1["x"] + t * (p2["x"] - p1["x"])
                                    proj_y = p1["y"] + t * (p2["y"] - p1["y"])
                                    dist = math.hypot(end_pt["x"] - proj_x, end_pt["y"] - proj_y)
                                    if dist < best_dist:
                                        best_dist = dist
                                        best_snap_pt = {"x": proj_x, "y": proj_y}
                                        is_start = False
                                        
                        if best_snap_pt and best_dist < threshold:
                            if is_start:
                                flat_points[0] = best_snap_pt["x"]
                                flat_points[1] = best_snap_pt["y"]
                            else:
                                flat_points[-2] = best_snap_pt["x"]
                                flat_points[-1] = best_snap_pt["y"]

                    river_layer["data"].append({
                        "id": f"river_{str(uuid.uuid4())[:8]}",
                        "points": flat_points,
                        "stroke": "#3b82f6",
                        "strokeWidth": 4,
                        "tension": 0.5,
                        "riverStyle": "river"
                    })

        # Convert global borders to vector lines
        if data.global_borders:
            border_layer = next((l for l in existing_layers if l.get("type") == "border"), None)
            if border_layer:
                if not isinstance(border_layer.get("data"), list):
                    border_layer["data"] = []
                for path_points in data.global_borders:
                    if len(path_points) < 2: continue
                    
                    flat_points = []
                    for p in path_points:
                        flat_points.extend([p["x"], p["y"]])

                    # Heuristic to detect if it's a snapped line:
                    # If most points are close to a hex corner, it's snapped.
                    snapped = False
                    if len(path_points) > 2:
                        close_points = 0
                        for p in path_points:
                            px, py = p["x"], p["y"]
                            q_f = (2.0 / 3.0 * px) / self._hex_grid.hex_size if orientation == "flat" else (math.sqrt(3) / 3.0 * px - 1.0 / 3.0 * py) / self._hex_grid.hex_size
                            r_f = (-1.0 / 3.0 * px + math.sqrt(3) / 3.0 * py) / self._hex_grid.hex_size if orientation == "flat" else (2.0 / 3.0 * py) / self._hex_grid.hex_size
                            q, r, s = round(q_f), round(r_f), round(-q_f-r_f)
                            q_diff, r_diff, s_diff = abs(q - q_f), abs(r - r_f), abs(s - (-q_f-r_f))
                            if q_diff > r_diff and q_diff > s_diff: q = -r-s
                            elif r_diff > s_diff: r = -q-s
                            else: s = -q-r
                            
                            cx, cy = self._hex_grid.hex_to_pixel(q, r, orientation)
                            corners = []
                            for i in range(6):
                                angle_deg = 60 * i - 30 if orientation == "flat" else 60 * i
                                angle_rad = math.pi / 180 * angle_deg
                                corners.append((cx + self._hex_grid.hex_size * math.cos(angle_rad), cy + self._hex_grid.hex_size * math.sin(angle_rad)))
                            
                            min_d = min(math.hypot(px - c[0], py - c[1]) for c in corners)
                            if min_d < self._hex_grid.hex_size * 0.25:
                                close_points += 1
                                
                        if close_points / len(path_points) > 0.6:
                            snapped = True

                    border_layer["data"].append({
                        "id": f"border_{str(uuid.uuid4())[:8]}",
                        "points": flat_points,
                        "stroke": "#dc2626",
                        "strokeWidth": 5,
                        "tension": 0 if snapped else 0.5,
                        "borderStyle": "snapped" if snapped else "smooth"
                    })

        # Convert coastline layers to vector layers with matched colors
        if data.coastline_layers:
            for c_layer in data.coastline_layers:
                if not c_layer.vectors:
                    continue
                    
                mean_color = None
                if c_layer.img_bgr is not None and c_layer.ink_mask is not None:
                    mean_color = cv2.mean(c_layer.img_bgr, mask=c_layer.ink_mask)[:3]
                    
                best_match_key = "Coastline/hex_104.png"
                best_fill_hex = "#3b82f6"
                
                if mean_color is not None:
                    best_dist = float('inf')
                    b, g, r = mean_color
                    for t in self._template_manager.templates["coastline"]:
                        if t.get("mean_color") is not None:
                            tb, tg, tr = t["mean_color"]
                            dist = math.sqrt((b - tb)**2 + (g - tg)**2 + (r - tr)**2)
                            if dist < best_dist:
                                best_dist = dist
                                best_match_key = t["key"]
                                best_fill_hex = f"#{int(tr):02x}{int(tg):02x}{int(tb):02x}"
                
                # Check if layer already exists
                layer_obj = next((l for l in existing_layers if l.get("name") == c_layer.name and l.get("type") == "coastline"), None)
                if not layer_obj:
                    layer_obj = {
                        "id": f"layer_{str(uuid.uuid4())[:8]}",
                        "name": c_layer.name,
                        "type": "coastline",
                        "visible": True,
                        "opacity": 1,
                        "sourceFilename": c_layer.name,
                        "data": []
                    }
                    insert_idx = -1
                    for i, l in enumerate(existing_layers):
                        if l.get("type") == "coastline":
                            insert_idx = i
                            break
                    if insert_idx != -1:
                        existing_layers.insert(insert_idx, layer_obj)
                    else:
                        existing_layers.append(layer_obj)
                    
                if not isinstance(layer_obj.get("data"), list):
                    layer_obj["data"] = []
                    
                for path_points in c_layer.vectors:
                    flat_points = []
                    for p in path_points:
                        flat_points.extend([p["x"], p["y"]])
                    layer_obj["data"].append({
                        "id": f"coastline_{str(uuid.uuid4())[:8]}",
                        "points": flat_points,
                        "stroke": "#222222",
                        "strokeWidth": 3,
                        "tension": 0.5,
                        "coastlineStyle": "smooth",
                        "brushKey": best_match_key,
                        "fill": best_fill_hex
                    })

        # QoL: Clean up empty terrain and coastline layers if multiple exist and at least one has data
        for layer_type in ["terrain", "coastline"]:
            type_layers = [l for l in existing_layers if l.get("type") == layer_type]
            if len(type_layers) > 1:
                has_items = any(len(l.get("data", {})) > 0 for l in type_layers)
                if has_items:
                    existing_layers = [l for l in existing_layers if not (l.get("type") == layer_type and len(l.get("data", {})) == 0)]

        return {
            "status": "success",
            "data": {
                "layers": existing_layers,
                "globalCoastlines": data.global_coastlines,
                "globalBorders": data.global_borders,
                "globalRivers": data.global_rivers,
                "unknowns": unknown_hexes,
                "mapWidth": map_width,
                "mapHeight": map_height,
                "orientation": orientation
            }
        }

    def _process_coastlines(self, ctx: Dict[str, Any]):
        data = ctx["data"]
        extracted_layers = ctx["extracted_layers"]
        x_start, x_end = ctx["x_start"], ctx["x_end"]
        y_start, y_end = ctx["y_start"], ctx["y_end"]
        
        for c_layer in data.coastline_layers:
            ext_key = f"coastline_{c_layer.name}"
            if ext_key not in extracted_layers:
                extracted_layers[ext_key] = {"name": c_layer.name, "type": "coastline", "data": {}, "vectors": c_layer.vectors}
                
            if c_layer.img_bgr is not None:
                c_is_coastline = ctx["is_coastline"]
                if c_layer.ink_mask is not None:
                    c_water_region = c_layer.ink_mask[y_start:y_end, x_start:x_end]
                    hex_poly_shifted = np.array([[p['x'] - x_start, p['y'] - y_start] for p in ctx["hex_poly"]], np.int32)
                    hex_mask = np.zeros((y_end - y_start, x_end - x_start), dtype=np.uint8)
                    cv2.fillPoly(hex_mask, [hex_poly_shifted], 255)
                    c_water_region = cv2.bitwise_and(c_water_region, hex_mask)
                    c_water_pixels = np.count_nonzero(c_water_region)
                    hex_area = np.count_nonzero(hex_mask)
                    c_is_coastline = (c_water_pixels / hex_area) > 0.05 if hex_area > 0 else False
                    
                if not c_is_coastline:
                    continue
                    
                region_bgr = c_layer.img_bgr[y_start:y_end, x_start:x_end]
                best_score = float('inf')
                best_coast = None
                for t in self._template_manager.templates["coastline"]:
                    resized = cv2.resize(t["bgr"], (ctx["hex_w"], ctx["hex_h"]))
                    t_cx, t_cy = ctx["hex_w"] // 2, ctx["hex_h"] // 2
                    t_crop = resized[max(0, t_cy - ctx["t_margin_y"]):min(ctx["hex_h"], t_cy + ctx["t_margin_y"]), 
                                     max(0, t_cx - ctx["t_margin_x"]):min(ctx["hex_w"], t_cx + ctx["t_margin_x"])]
                    
                    if region_bgr.shape[0] <= t_crop.shape[0] and region_bgr.shape[1] <= t_crop.shape[1]:
                        use_mask = c_water_region if c_layer.ink_mask is not None else ctx["region_mask"]
                        mask_3ch = cv2.merge([use_mask, use_mask, use_mask])
                        score_map = cv2.matchTemplate(t_crop, region_bgr, cv2.TM_SQDIFF, mask=mask_3ch)
                        score = np.min(score_map)
                        if score < best_score:
                            best_score = score
                            best_coast = t["key"]
                            
                if best_coast:
                    extracted_layers[ext_key]["data"][ctx["key"]] = best_coast
                else:
                    extracted_layers[ext_key]["data"][ctx["key"]] = "Coastline/hex_104.png"

    def _process_terrain(self, ctx: Dict[str, Any]):
        data = ctx["data"]
        extracted_layers = ctx["extracted_layers"]
        x_start, x_end = ctx["x_start"], ctx["x_end"]
        y_start, y_end = ctx["y_start"], ctx["y_end"]
        
        for t_layer in data.terrain_layers:
            ext_key = f"terrain_{t_layer.name}"
            if ext_key not in extracted_layers:
                extracted_layers[ext_key] = {"name": t_layer.name, "type": "terrain", "data": {}}
                
            if t_layer.img_bgr is not None:
                land_mask = cv2.bitwise_not(ctx["region_mask"])
                
                has_drawn_ink = False
                is_custom_paint = False
                mean_color = None
                variance = 0.0
                ink_density = 0.0
                
                if t_layer.ink_mask is not None:
                    t_ink_region = t_layer.ink_mask[y_start:y_end, x_start:x_end]
                    hex_poly_shifted = np.array([[p['x'] - x_start, p['y'] - y_start] for p in ctx["hex_poly"]], np.int32)
                    hex_mask = np.zeros((y_end - y_start, x_end - x_start), dtype=np.uint8)
                    cv2.fillPoly(hex_mask, [hex_poly_shifted], 255)
                    t_ink_region = cv2.bitwise_and(t_ink_region, hex_mask)
                    painted_count = np.count_nonzero(t_ink_region)
                    has_drawn_ink = painted_count > 20
                    
                    if painted_count < 10:
                        continue
                        
                    if ctx["total_pixels"] > 0 and painted_count > ctx["total_pixels"] * 0.3:
                        is_custom_paint = True
                        region_bgr = t_layer.img_bgr[y_start:y_end, x_start:x_end]
                        mean_color = cv2.mean(region_bgr, mask=t_ink_region)[:3]
                        gray = cv2.cvtColor(region_bgr, cv2.COLOR_BGR2GRAY)
                        variance = cv2.Laplacian(gray, cv2.CV_64F).var()
                        ink_density = painted_count / ctx["total_pixels"]
                
                if np.count_nonzero(land_mask) > 10 or has_drawn_ink:
                    region_bgr = t_layer.img_bgr[y_start:y_end, x_start:x_end]
                    best_score = float('inf')
                    best_match_key = None
                    
                    profile_path = os.path.join(self._base_dir, "assets", "styles", self._template_manager._style, "user_terrain_profile.json")
                    profile_match = None
                    
                    if is_custom_paint and os.path.exists(profile_path):
                        try:
                            with open(profile_path, "r") as f:
                                profile = json.load(f)
                            
                            best_profile_dist = float('inf')
                            for p in profile:
                                if mean_color is None: continue
                                db = (mean_color[0] - p["b"]) ** 2
                                dg = (mean_color[1] - p["g"]) ** 2
                                dr = (mean_color[2] - p["r"]) ** 2
                                color_dist = math.sqrt(db + dg + dr)
                                
                                var_dist = abs(variance - p["variance"]) / 1000.0
                                
                                total_dist = color_dist + var_dist
                                if total_dist < best_profile_dist:
                                    best_profile_dist = total_dist
                                    profile_match = p["label"]
                                    
                            if best_profile_dist < 15.0 and profile_match:
                                best_match_key = f"Terrain/{profile_match}"
                        except (FileNotFoundError, json.JSONDecodeError):
                            pass
                            
                    if not best_match_key:
                        for t in self._template_manager.templates["terrain"]:
                            if ctx["use_ink_filter"]:
                                if not has_drawn_ink and t.get("ink_count", 0) > 200:
                                    continue
                                if has_drawn_ink and t.get("ink_count", 0) < 50:
                                    continue

                            resized = cv2.resize(t["bgr"], (ctx["hex_w"], ctx["hex_h"]))
                            t_cx, t_cy = ctx["hex_w"] // 2, ctx["hex_h"] // 2
                            t_crop = resized[max(0, t_cy - ctx["t_margin_y"]):min(ctx["hex_h"], t_cy + ctx["t_margin_y"]), 
                                             max(0, t_cx - ctx["t_margin_x"]):min(ctx["hex_w"], t_cx + ctx["t_margin_x"])]
                            
                            if region_bgr.shape[0] <= t_crop.shape[0] and region_bgr.shape[1] <= t_crop.shape[1]:
                                mask_3ch = cv2.merge([land_mask, land_mask, land_mask])
                                score_map = cv2.matchTemplate(t_crop, region_bgr, cv2.TM_SQDIFF_NORMED, mask=mask_3ch)
                                score = np.min(score_map)
                                
                                if score < best_score:
                                    best_score = score
                                    best_match_key = t["key"]
                                    
                        if is_custom_paint and mean_color is not None and best_score > 0.05:
                            best_dist = float('inf')
                            b, g, r = mean_color
                            for t in self._template_manager.templates["terrain"]:
                                if t.get("mean_color") is not None:
                                    tb, tg, tr = t["mean_color"]
                                    dist = math.sqrt((b - tb)**2 + (g - tg)**2 + (r - tr)**2)
                                    if dist < best_dist:
                                        best_dist = dist
                                        best_match_key = t["key"]
                                
                    if best_match_key:
                        extracted_layers[ext_key]["data"][ctx["key"]] = best_match_key

    def _process_cities(self, ctx: Dict[str, Any]):
        data = ctx["data"]
        extracted_layers = ctx["extracted_layers"]
        unknown_hexes = ctx["unknown_hexes"]
        x_start, x_end = ctx["x_start"], ctx["x_end"]
        y_start, y_end = ctx["y_start"], ctx["y_end"]

        for city_layer in data.city_layers:
            ext_key = f"city_{city_layer.name}"
            if ext_key not in extracted_layers:
                extracted_layers[ext_key] = {"name": city_layer.name, "type": "city", "data": {}}
                
            if city_layer.img_bgr is not None and city_layer.ink_mask is not None:
                ink_region = city_layer.ink_mask[y_start:y_end, x_start:x_end]
                
                is_coastal_hex_sym = False
                for path in data.global_coastlines:
                    for pt in path:
                        if math.hypot(pt["x"] - ctx["cx"], pt["y"] - ctx["cy"]) < self._hex_grid.hex_size * 0.8:
                            is_coastal_hex_sym = True
                            break
                    if is_coastal_hex_sym:
                        break

                if np.count_nonzero(ink_region) > 20:
                    best_score = float('inf')
                    best_match = None
                    match_type = None
                    
                    for cat in ["city", "ignore"]:
                        for t in self._template_manager.templates[cat]:
                            resized = cv2.resize(t["mask"], (ctx["hex_w"], ctx["hex_h"]))
                            t_cx, t_cy = ctx["hex_w"] // 2, ctx["hex_h"] // 2
                            t_crop = resized[max(0, t_cy - ctx["t_margin_y"]):min(ctx["hex_h"], t_cy + ctx["t_margin_y"]), 
                                             max(0, t_cx - ctx["t_margin_x"]):min(ctx["hex_w"], t_cx + ctx["t_margin_x"])]
                                             
                            if ink_region.shape[0] <= t_crop.shape[0] and ink_region.shape[1] <= t_crop.shape[1]:
                                score_map = cv2.matchTemplate(t_crop, ink_region, cv2.TM_SQDIFF_NORMED)
                                score = np.min(score_map)
                                if score < best_score:
                                    best_score = score
                                    best_match = t["key"]
                                    match_type = cat
                                
                    if best_score < 0.3 and best_match:
                        if match_type == 'city':
                            extracted_layers[ext_key]["data"][ctx["key"]] = best_match
                    elif not is_coastal_hex_sym and data.source_unknowns is not None:
                        os.makedirs(os.path.join(self._base_dir, "saves", ".temp_unknowns"), exist_ok=True)
                        uid = str(uuid.uuid4())
                        img_path = os.path.join(self._base_dir, "saves", ".temp_unknowns", f"{uid}.png")
                        cv2.imwrite(img_path, data.source_unknowns[y_start:y_end, x_start:x_end])
                        unknown_hexes.append({
                            "id": uid,
                            "key": ctx["key"],
                            "image": self._template_manager.get_asset_url(f"saves/.temp_unknowns/{uid}.png")
                        })
