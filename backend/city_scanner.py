import os
import cv2
import uuid
import math
import numpy as np
from typing import Dict, Any
from template_manager import TemplateManager
from hex_grid import HexGrid

class CityScanner:
    def __init__(self, base_dir: str, template_manager: TemplateManager, hex_grid: HexGrid):
        self._base_dir = base_dir
        self._template_manager = template_manager
        self._hex_grid = hex_grid

    def process_cities(self, ctx: Dict[str, Any]):
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

                if cv2.countNonZero(ink_region) > 20:
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
