import os
import cv2
import json
import math
import numpy as np
from typing import Dict, Any
from template_manager import TemplateManager

class TerrainScanner:
    def __init__(self, base_dir: str, template_manager: TemplateManager) -> None:
        self._base_dir = base_dir
        self._template_manager = template_manager

    def process_terrain(self, ctx: Dict[str, Any]) -> None:
        data = ctx["data"]
        extracted_layers = ctx["extracted_layers"]
        x_start, x_end = ctx["x_start"], ctx["x_end"]
        y_start, y_end = ctx["y_start"], ctx["y_end"]
        
        layers_to_process = [(l, "terrain") for l in data.terrain_layers]
        if hasattr(data, 'cliff_layers'):
            layers_to_process.extend([(l, "cliff") for l in data.cliff_layers])
            
        for t_layer, layer_type in layers_to_process:
            ext_key = f"{layer_type}_{t_layer.name}"
            if ext_key not in extracted_layers:
                extracted_layers[ext_key] = {"name": t_layer.name, "type": layer_type, "data": {}}
                
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
                
                valid_data_mask = land_mask.copy()
                if t_layer.ink_mask is not None:
                    layer_ink = t_layer.ink_mask[y_start:y_end, x_start:x_end]
                    # If the mask is dense (like an alpha mask from single layer export), use it
                    if np.count_nonzero(layer_ink) > layer_ink.size * 0.2:
                        valid_data_mask = cv2.bitwise_and(valid_data_mask, layer_ink)
                        
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
                            
                            # Custom Masked MSE
                            best_t_score = float('inf')
                            
                            pad_y = max(0, t_crop.shape[0] - region_bgr.shape[0])
                            pad_x = max(0, t_crop.shape[1] - region_bgr.shape[1])
                            
                            if pad_y > 0 or pad_x > 0:
                                reg_padded = cv2.copyMakeBorder(region_bgr, 0, pad_y, 0, pad_x, cv2.BORDER_CONSTANT, value=0)
                                mask_padded = cv2.copyMakeBorder(valid_data_mask, 0, pad_y, 0, pad_x, cv2.BORDER_CONSTANT, value=0)
                            else:
                                reg_padded = region_bgr
                                mask_padded = valid_data_mask
                                
                            max_dy = reg_padded.shape[0] - t_crop.shape[0]
                            max_dx = reg_padded.shape[1] - t_crop.shape[1]
                            
                            for dy in range(0, max_dy + 1, 2):
                                for dx in range(0, max_dx + 1, 2):
                                    w_reg = reg_padded[dy:dy+t_crop.shape[0], dx:dx+t_crop.shape[1]]
                                    w_mask = mask_padded[dy:dy+t_crop.shape[0], dx:dx+t_crop.shape[1]]
                                    
                                    valid_pixels = cv2.countNonZero(w_mask)
                                    if valid_pixels < 50:
                                        continue
                                        
                                    diff = cv2.absdiff(w_reg, t_crop)
                                    diff_sq = np.float32(diff) ** 2
                                    
                                    masked_diff = diff_sq[w_mask > 0]
                                    t_sq = np.sum(np.float32(t_crop[w_mask > 0]) ** 2)
                                    reg_sq = np.sum(np.float32(w_reg[w_mask > 0]) ** 2)
                                    norm = np.sqrt(t_sq * reg_sq)
                                    score = np.sum(masked_diff) / max(norm, 1e-6)
                                    
                                    if score < best_t_score:
                                        best_t_score = score
                                        
                            if best_t_score < best_score:
                                best_score = best_t_score
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
