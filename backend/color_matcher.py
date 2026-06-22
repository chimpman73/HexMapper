import cv2
import numpy as np
import math
from typing import Dict, Any, List

class ColorMatcher:
    """
    Responsible purely for matching extracted geometry against approved templates.
    Knows nothing about mask generation or vector extraction.
    """
    
    def __init__(self, template_manager):
        self._template_manager = template_manager

    def _get_mean_color(self, img: np.ndarray, path_points: List[Dict[str, float]], bg_scale_x: float, bg_scale_y: float, bg_offset_x: float, bg_offset_y: float) -> tuple[float, float, float]:
        """Calculates the average color of the original image underneath the given polygon path."""
        if img is None or not path_points:
            return None
            
        height, width = img.shape[:2]
        mask = np.zeros((height, width), dtype=np.uint8)
        pts = []
        for p in path_points:
            img_x = int((p["x"] - bg_offset_x) / bg_scale_x)
            img_y = int((p["y"] - bg_offset_y) / bg_scale_y)
            pts.append([img_x, img_y])
            
        if len(pts) >= 3:
            cv2.fillPoly(mask, [np.array(pts, dtype=np.int32)], 255)
        else:
            cv2.polylines(mask, [np.array(pts, dtype=np.int32)], False, 255, 2)
            
        if cv2.countNonZero(mask) > 0:
            mean_color = cv2.mean(img, mask=mask)[:3]
            return mean_color  # B, G, R
        return None

    def match_coastline_color(self, source_hex: str) -> tuple[str, str]:
        """Returns (best_fill_hex, best_match_key) for a coastline."""
        default_hex = "#3b82f6"
        default_key = "Coastline/hex_104.png"
        
        if not source_hex or len(source_hex) != 7:
            return default_hex, default_key
            
        r = int(source_hex[1:3], 16)
        g = int(source_hex[3:5], 16)
        b = int(source_hex[5:7], 16)
        
        best_dist = float('inf')
        
        templates = self._template_manager.templates.get("coastline", [])
        if not templates:
            return default_hex, default_key
            
        for t in templates:
            if t.get("mean_color") is not None:
                tb, tg, tr = t["mean_color"]
                dist = math.sqrt((b - tb)**2 + (g - tg)**2 + (r - tr)**2)
                if dist < best_dist:
                    best_dist = dist
                    default_key = t["key"]
                    default_hex = f"#{int(tr):02x}{int(tg):02x}{int(tb):02x}"
                    
        return default_hex, default_key

    def match_river_color(self, source_hex: str) -> tuple[str, str]:
        """Returns (best_stroke_hex, style_name) for a river."""
        default_hex = "#3b82f6"
        default_style = "River"
        
        templates = self._template_manager.templates.get("river", [])
        
        for t in templates:
            if t["key"].endswith("hex_River.png") and t.get("mean_color") is not None:
                tb, tg, tr = t["mean_color"]
                default_hex = f"#{int(tr):02x}{int(tg):02x}{int(tb):02x}"
                break
                
        if not source_hex or len(source_hex) != 7:
            return default_hex, default_style
            
        r = int(source_hex[1:3], 16)
        g = int(source_hex[3:5], 16)
        b = int(source_hex[5:7], 16)
        
        best_dist = float('inf')
            
        for t in templates:
            if t.get("mean_color") is not None and "hex_" in t["key"].lower():
                tb, tg, tr = t["mean_color"]
                dist = math.sqrt((b - tb)**2 + (g - tg)**2 + (r - tr)**2)
                if dist < best_dist:
                    best_dist = dist
                    filename = t["key"].split('/')[-1]
                    default_style = filename.lower().replace('hex_', '').replace('.png', '')
                    default_hex = f"#{int(tr):02x}{int(tg):02x}{int(tb):02x}"
                    
        return default_hex, default_style

    def match_cliff_color(self, img: np.ndarray, path_points: List[Dict[str, float]], bg_scale_x: float, bg_scale_y: float, bg_offset_x: float, bg_offset_y: float) -> tuple[str, str]:
        """Returns (best_stroke_hex, style_name) for a cliff."""
        # Current implementation just defaults cliffs
        return "#555555", "default"

    def match_road_color(self, img: np.ndarray, path_points: List[Dict[str, float]], bg_scale_x: float, bg_scale_y: float, bg_offset_x: float, bg_offset_y: float) -> tuple[str, str]:
        """Returns (best_stroke_hex, style_name) for a road."""
        return "#8B4513", "path"
