import cv2
import numpy as np
import json
import os
import math
from typing import List, Dict, Any, Tuple, Optional

from layer_data import LayerData
from map_data import MapData
from vector_extractor import VectorExtractor
from mask_generator import MaskGenerator

class ImageProcessor:
    def __init__(self, bg_scale_x: float, bg_scale_y: float, bg_offset_x: float, bg_offset_y: float) -> None:
        self._bg_scale_x = bg_scale_x
        self._bg_scale_y = bg_scale_y
        self._bg_offset_x = bg_offset_x
        self._bg_offset_y = bg_offset_y
        self._vector_extractor = VectorExtractor(bg_scale_x, bg_scale_y, bg_offset_x, bg_offset_y)



    def process_aligned_map(self, image_path: str, coastline_templates: List[Dict[str, Any]]) -> MapData:
        data = MapData()
        
        img = cv2.imread(image_path, cv2.IMREAD_UNCHANGED)
        if img is None:
            raise FileNotFoundError(f"Could not load image: {image_path}")

        alpha_mask = None
        if len(img.shape) == 3 and img.shape[2] == 4:
            _, alpha_mask = cv2.threshold(img[:, :, 3], 10, 255, cv2.THRESH_BINARY)
            img = img[:, :, :3]

        height, width, _ = img.shape
        data.width = width
        data.height = height
        
        # STEP 0: BORDER EXTRACTION AND INPAINTING
        print(json.dumps({"progress": True, "message": "Extracting borders...", "percent": 5}), flush=True)
        hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)

        # BORDER EXTRACTION
        lower_red1 = np.array([0, 70, 50])
        upper_red1 = np.array([10, 255, 255])
        mask1 = cv2.inRange(hsv, lower_red1, upper_red1)
        
        lower_red2 = np.array([170, 70, 50])
        upper_red2 = np.array([180, 255, 255])
        mask2 = cv2.inRange(hsv, lower_red2, upper_red2)
        
        red_mask = mask1 | mask2
        kernel_border = np.ones((3, 3), np.uint8)
        red_mask_clean = cv2.morphologyEx(red_mask, cv2.MORPH_OPEN, kernel_border)
        
        num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(red_mask_clean, connectivity=8)
        min_size = 500
        for i in range(1, num_labels):
            if stats[i, cv2.CC_STAT_AREA] < min_size:
                red_mask_clean[labels == i] = 0
        
        data.global_borders.extend(self._vector_extractor.extract_borders(red_mask_clean))

        print(json.dumps({"progress": True, "message": "Extracting rivers...", "percent": 15}), flush=True)
        # RIVER EXTRACTION
        lower_blue = np.array([90, 50, 50])
        upper_blue = np.array([130, 255, 255])
        blue_mask = cv2.inRange(hsv, lower_blue, upper_blue)
        
        kernel_large = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))
        oceans = cv2.morphologyEx(blue_mask, cv2.MORPH_OPEN, kernel_large)
        rivers = cv2.subtract(blue_mask, oceans)
        
        kernel_small = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
        river_mask = cv2.morphologyEx(rivers, cv2.MORPH_OPEN, kernel_small)
        river_mask = cv2.morphologyEx(river_mask, cv2.MORPH_DILATE, kernel_small, iterations=1)
        
        for p in self._vector_extractor.extract_rivers(river_mask):
            data.global_rivers.append({"points": p, "color": "#3b82f6"})

        print(json.dumps({"progress": True, "message": "Inpainting artifacts...", "percent": 25}), flush=True)
        # INPAINTING
        inpaint_mask = cv2.bitwise_or(red_mask_clean, river_mask)
        inpaint_mask = cv2.dilate(inpaint_mask, np.ones((5, 5), np.uint8), iterations=1)
        img = cv2.inpaint(img, inpaint_mask, 3, cv2.INPAINT_TELEA)
        
        print(json.dumps({"progress": True, "message": "Detecting coastlines...", "percent": 35}), flush=True)
        # GLOBAL SHORELINE GEOMETRY
        img_lab = cv2.cvtColor(img, cv2.COLOR_BGR2Lab).astype(np.float32)
        water_mask = np.zeros((height, width), dtype=np.uint8)
        
        coastline_colors = []
        for t in coastline_templates:
            avg_bgr = cv2.mean(t["bgr"])[:3]
            lab = cv2.cvtColor(np.uint8([[avg_bgr]]), cv2.COLOR_BGR2Lab)[0][0]
            coastline_colors.append(lab)

        for sig in coastline_colors:
            diff = img_lab - np.array([sig[0], sig[1], sig[2]], dtype=np.float32)
            dist_sq = np.sum(diff**2, axis=2)
            water_mask[dist_sq < 30.0**2] = 255
            
        kernel = np.ones((5, 5), np.uint8)
        water_mask = cv2.morphologyEx(water_mask, cv2.MORPH_OPEN, kernel)
        water_mask = cv2.morphologyEx(water_mask, cv2.MORPH_CLOSE, kernel)
        data.water_mask = water_mask
        
        data.global_coastlines.extend(self._vector_extractor.extract_coastlines(water_mask))

        data.coastline_layers.append(LayerData("Coastline", img, None))
        data.terrain_layers.append(LayerData("Terrain", img, alpha_mask))
        
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        _, ink_mask = cv2.threshold(gray, 100, 255, cv2.THRESH_BINARY_INV)
        if alpha_mask is not None:
            ink_mask = cv2.bitwise_and(ink_mask, alpha_mask)
        kernel_ink = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
        ink_mask = cv2.morphologyEx(ink_mask, cv2.MORPH_OPEN, kernel_ink)
        
        data.city_layers.append(LayerData("Cities", img, ink_mask))
        data.source_unknowns = img
        
        return data


    def _process_single_file(self, img: np.ndarray, filename: str, data: MapData, accumulated_water_mask: Optional[np.ndarray]) -> Optional[np.ndarray]:
        def composite_over_bg(img: np.ndarray) -> Optional[np.ndarray]:
            if img is None: return None
            if len(img.shape) == 3 and img.shape[2] == 4:
                alpha = img[:, :, 3] / 255.0
                bg = np.full_like(img[:, :, :3], [200, 240, 253], dtype=np.uint8)
                bgr = img[:, :, :3]
                for c in range(3):
                    bg[:, :, c] = (alpha * bgr[:, :, c] + (1 - alpha) * bg[:, :, c]).astype(np.uint8)
                return bg
            elif len(img.shape) == 3:
                return img[:, :, :3]
            return img

        lname = filename.lower()
        layer_name = os.path.splitext(filename)[0]

        if lname.startswith("border"):
            masks = MaskGenerator.generate_border_masks(img)
            for mask in masks:
                data.global_borders.extend(self._vector_extractor.extract_borders(mask))
                        
        elif lname.startswith("river"):
            masks = MaskGenerator.generate_river_masks(img)
            for mask in masks:
                paths = self._vector_extractor.extract_rivers(mask)
                for p in paths:
                    samples = []
                    for pt in p:
                        cx = int((pt["x"] - self._vector_extractor._bg_offset_x) / self._vector_extractor._bg_scale_x)
                        cy = int((pt["y"] - self._vector_extractor._bg_offset_y) / self._vector_extractor._bg_scale_y)
                        if 0 <= cy < img.shape[0] and 0 <= cx < img.shape[1]:
                            if img.shape[2] == 4 and img[cy, cx, 3] == 0:
                                continue
                            samples.append(img[cy, cx, :3])
                    
                    hex_color = "#3b82f6" # default fallback
                    if samples:
                        avg_bgr = np.median(samples, axis=0)
                        hex_color = f"#{int(avg_bgr[2]):02x}{int(avg_bgr[1]):02x}{int(avg_bgr[0]):02x}"
                        
                    data.global_rivers.append({"points": p, "source_color": hex_color})

        elif lname.startswith("cliff"):
            masks, ink_mask = MaskGenerator.generate_cliff_masks(img)
            for mask in masks:
                data.global_cliffs.extend(self._vector_extractor.extract_cliffs(mask))
                
            bgr = composite_over_bg(img)
            data.cliff_layers.append(LayerData(layer_name, bgr, ink_mask))
                        
        elif lname.startswith("coastline"):
            masks, base_mask = MaskGenerator.generate_coastline_masks(img)
            layer_coastlines = []
            
            if base_mask is not None:
                if accumulated_water_mask is None:
                    accumulated_water_mask = np.zeros(base_mask.shape, dtype=np.uint8)
                accumulated_water_mask = cv2.bitwise_or(accumulated_water_mask, base_mask)
                
                for color_bgr, mask in masks:
                    polygons = self._vector_extractor.extract_coastlines(mask)
                    hex_color = f"#{int(color_bgr[2]):02x}{int(color_bgr[1]):02x}{int(color_bgr[0]):02x}"
                    for p in polygons:
                        p["source_color"] = hex_color
                    layer_coastlines.extend(polygons)
                    
                layer_coastlines.sort(key=lambda p: p.get("area", 0), reverse=True)
                data.global_coastlines.extend(layer_coastlines)
            
            bgr = composite_over_bg(img)
            data.coastline_layers.append(LayerData(layer_name, bgr, base_mask, layer_coastlines))
            
        elif lname.startswith("cit"):
            c_mask = MaskGenerator.get_base_mask(img)
            ink_mask = None
            if c_mask is not None:
                kernel_city = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
                ink_mask = cv2.morphologyEx(c_mask, cv2.MORPH_OPEN, kernel_city)
            
            bgr = img[:, :, :3] if len(img.shape) == 3 else cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
            data.city_layers.append(LayerData(layer_name, img, ink_mask))
            
            if data.source_unknowns is None:
                data.source_unknowns = img
                
        elif lname.startswith("terrain"):
            bgr = composite_over_bg(img)
            ink_mask = None
            if len(img.shape) == 3 and img.shape[2] == 4:
                _, ink_mask = cv2.threshold(img[:, :, 3], 10, 255, cv2.THRESH_BINARY)
            elif bgr is not None:
                gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
                _, ink_mask = cv2.threshold(gray, 220, 255, cv2.THRESH_BINARY_INV)
            
            data.terrain_layers.append(LayerData(layer_name, bgr, ink_mask))
            
        return accumulated_water_mask

    def process_multi_layer(self, dir_path: str) -> MapData:
        data = MapData()
        accumulated_water_mask = None
        width, height = 0, 0
        
        png_files = [f for f in os.listdir(dir_path) if f.lower().endswith(".png")]
        total_files = len(png_files)
        processed = 0

        for filename in png_files:
            processed += 1
            print(json.dumps({"progress": True, "message": f"Processing layer {filename}...", "percent": int((processed / total_files) * 100)}), flush=True)
            
            path = os.path.join(dir_path, filename)
            img = cv2.imread(path, cv2.IMREAD_UNCHANGED)
            if img is None: continue
            
            if width == 0:
                height, width = img.shape[:2]
                data.width = width
                data.height = height

            accumulated_water_mask = self._process_single_file(img, filename, data, accumulated_water_mask)

        if width == 0:
            raise FileNotFoundError("No valid PNG layer files found in the selected directory")

        if accumulated_water_mask is not None:
            data.water_mask = accumulated_water_mask

        return data