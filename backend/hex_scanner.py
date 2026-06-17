import os
import cv2
import json
import math
import uuid
import numpy as np
from typing import List, Dict, Any, Tuple

from hex_grid import HexGrid
from template_manager import TemplateManager
from image_processor import MapData

class HexScanner:
    def __init__(self, base_dir: str, template_manager: TemplateManager, hex_grid: HexGrid, 
                 bg_scale_x: float, bg_scale_y: float, bg_offset_x: float, bg_offset_y: float):
        self.base_dir = base_dir
        self.template_manager = template_manager
        self.hex_grid = hex_grid
        self.bg_scale_x = bg_scale_x
        self.bg_scale_y = bg_scale_y
        self.bg_offset_x = bg_offset_x
        self.bg_offset_y = bg_offset_y

    def scan(self, data: MapData, map_width: int, map_height: int, orientation: str, use_ink_filter: bool = True) -> Dict[str, Any]:
        terrain_data: Dict[str, str] = {}
        coastline_data: Dict[str, str] = {}
        city_data: Dict[str, str] = {}
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
            cx, cy = self.hex_grid.hex_to_pixel(q, r, orientation)
            
            img_x = int((cx - self.bg_offset_x) / self.bg_scale_x)
            img_y = int((cy - self.bg_offset_y) / self.bg_scale_y)
            
            if 0 <= img_x < data.width and 0 <= img_y < data.height:
                if orientation == 'flat':
                    hex_w = int((2 * self.hex_grid.hex_size) / self.bg_scale_x)
                    hex_h = int((math.sqrt(3) * self.hex_grid.hex_size) / self.bg_scale_y)
                else:
                    hex_w = int((math.sqrt(3) * self.hex_grid.hex_size) / self.bg_scale_x)
                    hex_h = int((2 * self.hex_grid.hex_size) / self.bg_scale_y)
                
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
                
                # --- COASTLINE ---
                if data.source_coastlines is not None and is_coastline:
                    region_bgr = data.source_coastlines[y_start:y_end, x_start:x_end]
                    best_score = float('inf')
                    best_coast = None
                    for t in self.template_manager.templates["coastline"]:
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
                        coastline_data[key] = self.template_manager.get_asset_url(f"assets/tiles/{best_coast}")
                    else:
                        coastline_data[key] = self.template_manager.get_asset_url("assets/tiles/Coastline/hex_104.png")

                # --- TERRAIN ---
                if data.source_terrain is not None:
                    land_mask = cv2.bitwise_not(region_mask)
                    
                    has_drawn_ink = False
                    is_custom_paint = False
                    mean_color = None
                    variance = 0.0
                    ink_density = 0.0
                    
                    if data.terrain_ink_mask is not None:
                        t_ink_region = data.terrain_ink_mask[y_start:y_end, x_start:x_end]
                        painted_count = np.count_nonzero(t_ink_region)
                        has_drawn_ink = painted_count > 20
                        
                        total_pixels = (y_end - y_start) * (x_end - x_start)
                        if total_pixels > 0 and painted_count > total_pixels * 0.3:
                            is_custom_paint = True
                            region_bgr = data.source_terrain[y_start:y_end, x_start:x_end]
                            mean_color = cv2.mean(region_bgr, mask=t_ink_region)[:3]
                            gray = cv2.cvtColor(region_bgr, cv2.COLOR_BGR2GRAY)
                            variance = cv2.Laplacian(gray, cv2.CV_64F).var()
                            ink_density = painted_count / total_pixels
                    
                    if np.count_nonzero(land_mask) > 10 or has_drawn_ink:
                        region_bgr = data.source_terrain[y_start:y_end, x_start:x_end]
                        best_score = float('inf')
                        best_match_key = None
                        
                        profile_path = os.path.join(self.base_dir, "assets", "user_terrain_profile.json")
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
                            except Exception:
                                pass
                                
                        if not best_match_key:
                            for t in self.template_manager.templates["terrain"]:
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
                                    score_map = cv2.matchTemplate(t_crop, region_bgr, cv2.TM_SQDIFF_NORMED, mask=mask_3ch)
                                    score = np.min(score_map)
                                    
                                    if score < best_score:
                                        best_score = score
                                        best_match_key = t["key"]
                                        
                            if is_custom_paint and mean_color is not None and best_score > 0.05:
                                best_dist = float('inf')
                                b, g, r = mean_color
                                for t in self.template_manager.templates["terrain"]:
                                    if t.get("mean_color") is not None:
                                        tb, tg, tr = t["mean_color"]
                                        dist = math.sqrt((b - tb)**2 + (g - tg)**2 + (r - tr)**2)
                                        if dist < best_dist:
                                            best_dist = dist
                                            best_match_key = t["key"]
                                    
                        if best_match_key:
                            terrain_data[key] = self.template_manager.get_asset_url(f"assets/tiles/{best_match_key}")

                # --- CITIES & UNKNOWNS ---
                if data.source_cities is not None and data.city_ink_mask is not None:
                    ink_region = data.city_ink_mask[y_start:y_end, x_start:x_end]
                    
                    is_coastal_hex_sym = False
                    for path in data.global_coastlines:
                        for pt in path:
                            if math.hypot(pt["x"] - cx, pt["y"] - cy) < self.hex_grid.hex_size * 0.8:
                                is_coastal_hex_sym = True
                                break
                        if is_coastal_hex_sym:
                            break

                    if np.count_nonzero(ink_region) > 20:
                        best_score = float('inf')
                        best_match = None
                        match_type = None
                        
                        for cat in ["city", "ignore"]:
                            for t in self.template_manager.templates[cat]:
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
                                city_data[key] = self.template_manager.get_asset_url(f"assets/tiles/{best_match}")
                        elif not is_coastal_hex_sym and data.source_unknowns is not None:
                            os.makedirs(os.path.join(self.base_dir, "saves", ".temp_unknowns"), exist_ok=True)
                            uid = str(uuid.uuid4())
                            img_path = os.path.join(self.base_dir, "saves", ".temp_unknowns", f"{uid}.png")
                            cv2.imwrite(img_path, data.source_unknowns[y_start:y_end, x_start:x_end])
                            unknown_hexes.append({
                                "id": uid,
                                "key": key,
                                "image": self.template_manager.get_asset_url(f"saves/.temp_unknowns/{uid}.png")
                            })

        layers = [
            { "id": '1', "name": 'Terrain', "type": 'terrain', "visible": True, "opacity": 1, "data": terrain_data },
            { "id": '4', "name": 'Coastline', "type": 'coastline', "visible": True, "opacity": 1, "data": coastline_data },
            { "id": '2', "name": 'Cliffs', "type": 'cliff', "visible": True, "opacity": 1, "data": [] },
            { "id": '3', "name": 'Rivers', "type": 'river', "visible": True, "opacity": 1, "data": [] },
            { "id": '5', "name": 'Cities', "type": 'city', "visible": True, "opacity": 1, "data": city_data },
            { "id": '8', "name": 'Hex Grid', "type": 'grid', "visible": True, "opacity": 1, "data": {} },
            { "id": '6', "name": 'Borders', "type": 'border', "visible": True, "opacity": 1, "data": {} },
            { "id": '7', "name": 'Labels', "type": 'label', "visible": True, "opacity": 1, "data": [] }
        ]

        return {
            "status": "success",
            "data": {
                "layers": layers,
                "globalCoastlines": data.global_coastlines,
                "globalBorders": data.global_borders,
                "globalRivers": data.global_rivers,
                "unknowns": unknown_hexes,
                "mapWidth": map_width,
                "mapHeight": map_height,
                "orientation": orientation
            }
        }
