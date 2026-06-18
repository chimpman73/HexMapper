import cv2
import numpy as np
import os
import math
from typing import List, Dict, Any, Tuple, Optional

class LayerData:
    def __init__(self, name: str, img_bgr: np.ndarray, ink_mask: Optional[np.ndarray] = None, vectors: Optional[List] = None):
        self._name = name
        self._img_bgr = img_bgr
        self._ink_mask = ink_mask
        self._vectors = vectors or []

    @property
    def name(self) -> str: return self._name
    @property
    def img_bgr(self) -> np.ndarray: return self._img_bgr
    @property
    def ink_mask(self) -> Optional[np.ndarray]: return self._ink_mask
    @property
    def vectors(self) -> List: return self._vectors

class MapData:
    """Data class to hold the preprocessed image layers and global vectors."""
    def __init__(self):
        self._width: int = 0
        self._height: int = 0
        self._water_mask: np.ndarray = np.array([])
        self._global_coastlines: List[List[Dict[str, float]]] = []
        self._global_borders: List[List[Dict[str, float]]] = []
        self._global_rivers: List[List[Dict[str, float]]] = []
        self._terrain_layers: List[LayerData] = []
        self._coastline_layers: List[LayerData] = []
        self._city_layers: List[LayerData] = []
        self._source_unknowns: Optional[np.ndarray] = None

    @property
    def width(self) -> int: return self._width
    @width.setter
    def width(self, value: int): self._width = value

    @property
    def height(self) -> int: return self._height
    @height.setter
    def height(self, value: int): self._height = value

    @property
    def water_mask(self) -> np.ndarray: return self._water_mask
    @water_mask.setter
    def water_mask(self, value: np.ndarray): self._water_mask = value

    @property
    def global_coastlines(self) -> List[List[Dict[str, float]]]: return self._global_coastlines
    @property
    def global_borders(self) -> List[List[Dict[str, float]]]: return self._global_borders
    @property
    def global_rivers(self) -> List[List[Dict[str, float]]]: return self._global_rivers
    @property
    def terrain_layers(self) -> List[LayerData]: return self._terrain_layers
    @property
    def coastline_layers(self) -> List[LayerData]: return self._coastline_layers
    @property
    def city_layers(self) -> List[LayerData]: return self._city_layers
    @property
    def source_unknowns(self) -> Optional[np.ndarray]: return self._source_unknowns
    @source_unknowns.setter
    def source_unknowns(self, value: Optional[np.ndarray]): self._source_unknowns = value

class ImageProcessor:
    def __init__(self, bg_scale_x: float, bg_scale_y: float, bg_offset_x: float, bg_offset_y: float):
        self._bg_scale_x = bg_scale_x
        self._bg_scale_y = bg_scale_y
        self._bg_offset_x = bg_offset_x
        self._bg_offset_y = bg_offset_y

    def _extract_borders(self, mask_clean: np.ndarray) -> List[List[Dict[str, float]]]:
        borders = []
        border_contours, _ = cv2.findContours(mask_clean, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
        for cnt in border_contours:
            epsilon = 0.0005 * cv2.arcLength(cnt, True)
            approx = cv2.approxPolyDP(cnt, epsilon, True)
            path_points = []
            for p in approx:
                cx = p[0][0] * self._bg_scale_x + self._bg_offset_x
                cy = p[0][1] * self._bg_scale_y + self._bg_offset_y
                path_points.append({"x": cx, "y": cy})
            if len(path_points) > 2:
                borders.append(path_points)
        return borders

    def _extract_rivers(self, river_mask: np.ndarray) -> List[List[Dict[str, float]]]:
        rivers = []
        skeleton_rivers = cv2.ximgproc.thinning(river_mask, thinningType=cv2.ximgproc.THINNING_ZHANGSUEN)
        river_contours, _ = cv2.findContours(skeleton_rivers, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        for cnt in river_contours:
            perimeter = cv2.arcLength(cnt, True)
            if perimeter < 30:
                continue
            epsilon = 0.005 * perimeter
            approx = cv2.approxPolyDP(cnt, epsilon, False)
            path_points = []
            for pt in approx:
                cx = pt[0][0] * self._bg_scale_x + self._bg_offset_x
                cy = pt[0][1] * self._bg_scale_y + self._bg_offset_y
                path_points.append({"x": cx, "y": cy})
            if len(path_points) > 1:
                rivers.append(path_points)
        return rivers

    def _extract_coastlines(self, water_mask: np.ndarray) -> List[List[Dict[str, float]]]:
        coastlines = []
        contours, _ = cv2.findContours(water_mask, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
        for cnt in contours:
            perimeter = cv2.arcLength(cnt, True)
            epsilon = 0.0005 * perimeter
            approx = cv2.approxPolyDP(cnt, epsilon, True)
            path_points = []
            for p in approx:
                cx = p[0][0] * self._bg_scale_x + self._bg_offset_x
                cy = p[0][1] * self._bg_scale_y + self._bg_offset_y
                path_points.append({"x": cx, "y": cy})
            if len(path_points) > 2:
                coastlines.append(path_points)
        return coastlines

    def process_aligned_map(self, image_path: str, coastline_templates: List[Dict[str, Any]]) -> MapData:
        data = MapData()
        
        img = cv2.imread(image_path)
        if img is None:
            raise FileNotFoundError(f"Could not load image: {image_path}")

        height, width, _ = img.shape
        data.width = width
        data.height = height
        
        # STEP 0: BORDER EXTRACTION AND INPAINTING
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
        
        data.global_borders.extend(self._extract_borders(red_mask_clean))

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
        
        data.global_rivers.extend(self._extract_rivers(river_mask))

        # INPAINTING
        inpaint_mask = cv2.bitwise_or(red_mask_clean, river_mask)
        inpaint_mask = cv2.dilate(inpaint_mask, np.ones((5, 5), np.uint8), iterations=1)
        img = cv2.inpaint(img, inpaint_mask, 3, cv2.INPAINT_TELEA)
        
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
        
        data.global_coastlines.extend(self._extract_coastlines(water_mask))

        data.coastline_layers.append(LayerData("Coastline", img, None))
        data.terrain_layers.append(LayerData("Terrain", img, None))
        
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        _, ink_mask = cv2.threshold(gray, 100, 255, cv2.THRESH_BINARY_INV)
        kernel_ink = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
        ink_mask = cv2.morphologyEx(ink_mask, cv2.MORPH_OPEN, kernel_ink)
        
        data.city_layers.append(LayerData("Cities", img, ink_mask))
        data.source_unknowns = img
        
        return data

    def process_multi_layer(self, dir_path: str) -> MapData:
        data = MapData()
        
        def get_layer_mask(img: np.ndarray) -> Optional[np.ndarray]:
            if img is None: return None
            if len(img.shape) == 3 and img.shape[2] == 4:
                _, m = cv2.threshold(img[:, :, 3], 5, 255, cv2.THRESH_BINARY)
                return m
            else:
                g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
                if np.mean(g) > 127:
                    _, m = cv2.threshold(g, 240, 255, cv2.THRESH_BINARY_INV)
                else:
                    _, m = cv2.threshold(g, 10, 255, cv2.THRESH_BINARY)
                return m

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

        accumulated_water_mask = None
        width, height = 0, 0

        for filename in os.listdir(dir_path):
            if not filename.lower().endswith(".png"): continue
            
            path = os.path.join(dir_path, filename)
            img = cv2.imread(path, cv2.IMREAD_UNCHANGED)
            if img is None: continue
            
            if width == 0:
                height, width = img.shape[:2]
                data.width = width
                data.height = height
                accumulated_water_mask = np.zeros((height, width), dtype=np.uint8)

            lname = filename.lower()
            layer_name = os.path.splitext(filename)[0]

            if lname.startswith("border"):
                mask = get_layer_mask(img)
                if mask is not None:
                    kernel_border = np.ones((3, 3), np.uint8)
                    mask_clean = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel_border)
                    data.global_borders.extend(self._extract_borders(mask_clean))
                            
            elif lname.startswith("river"):
                mask = get_layer_mask(img)
                if mask is not None:
                    kernel_tiny = np.ones((2, 2), np.uint8)
                    mask = cv2.morphologyEx(mask, cv2.MORPH_DILATE, kernel_tiny, iterations=1)
                    data.global_rivers.extend(self._extract_rivers(mask))
                            
            elif lname.startswith("coastline"):
                water_mask = get_layer_mask(img)
                if water_mask is not None:
                    accumulated_water_mask = cv2.bitwise_or(accumulated_water_mask, water_mask)
                    kernel = np.ones((5, 5), np.uint8)
                    water_mask_clean = cv2.morphologyEx(water_mask, cv2.MORPH_OPEN, kernel)
                    water_mask_clean = cv2.morphologyEx(water_mask_clean, cv2.MORPH_CLOSE, kernel)
                    
                    layer_coastlines = self._extract_coastlines(water_mask_clean)
                    data.global_coastlines.extend(layer_coastlines)
                else:
                    layer_coastlines = []
                
                bgr = composite_over_bg(img)
                data.coastline_layers.append(LayerData(layer_name, bgr, water_mask, layer_coastlines))
                
            elif lname.startswith("cit"):
                c_mask = get_layer_mask(img)
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

        if width == 0:
            raise FileNotFoundError("No valid PNG layer files found in the selected directory")

        if accumulated_water_mask is not None:
            data.water_mask = accumulated_water_mask

        return data