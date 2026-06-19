import os
import cv2
import numpy as np
import math
from typing import List, Dict, Any, Tuple

from hex_grid import HexGrid
from template_manager import TemplateManager
from map_data import MapData
from terrain_scanner import TerrainScanner
from city_scanner import CityScanner
from layer_assembler import LayerAssembler

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
        
        self._terrain_scanner = TerrainScanner(base_dir, template_manager)
        self._city_scanner = CityScanner(base_dir, template_manager, hex_grid)
        self._layer_assembler = LayerAssembler(template_manager, hex_grid, bg_scale_x, bg_scale_y, bg_offset_x, bg_offset_y)

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

        hex_grid_mask = np.zeros((data.height, data.width), dtype=np.uint8)
        for (q, r) in hexes:
            cx, cy = self._hex_grid.hex_to_pixel(q, r, orientation)
            img_x = int((cx - self._bg_offset_x) / self._bg_scale_x)
            img_y = int((cy - self._bg_offset_y) / self._bg_scale_y)
            R_x = self._hex_grid.hex_size / self._bg_scale_x
            R_y = self._hex_grid.hex_size / self._bg_scale_y
            hex_poly = []
            for i in range(6):
                angle_deg = 60 * i - 30 if orientation == 'flat' else 60 * i
                angle_rad = math.pi / 180 * angle_deg
                hex_poly.append([int(img_x + R_x * math.cos(angle_rad)), int(img_y + R_y * math.sin(angle_rad))])
            cv2.polylines(hex_grid_mask, [np.array(hex_poly, dtype=np.int32)], True, 255, 4)

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

                self._terrain_scanner.process_terrain(ctx)
                self._city_scanner.process_cities(ctx)

        # Assemble final layers using the LayerAssembler
        final_layers = self._layer_assembler.assemble(data, extracted_layers, existing_layers, hex_grid_mask)

        return {
            "status": "success",
            "data": {
                "layers": final_layers,
                "globalCoastlines": data.global_coastlines,
                "globalBorders": data.global_borders,
                "globalRivers": data.global_rivers,
                "unknowns": unknown_hexes,
                "mapWidth": map_width,
                "mapHeight": map_height,
                "orientation": orientation
            }
        }
