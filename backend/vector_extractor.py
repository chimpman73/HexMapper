import cv2
import numpy as np
from typing import List, Dict, Any, Optional

class VectorExtractor:
    def __init__(self, bg_scale_x: float, bg_scale_y: float, bg_offset_x: float, bg_offset_y: float) -> None:
        self._bg_scale_x = bg_scale_x
        self._bg_scale_y = bg_scale_y
        self._bg_offset_x = bg_offset_x
        self._bg_offset_y = bg_offset_y

    def walk_skeleton_to_paths(self, skeleton: np.ndarray, min_length: int = 10, epsilon_factor: float = 0.005) -> List[List[Dict[str, float]]]:
        h, w = skeleton.shape
        visited = np.zeros((h, w), dtype=bool)
        
        endpoints = []
        for y in range(1, h-1):
            for x in range(1, w-1):
                if skeleton[y, x] > 0:
                    neighbors = (skeleton[y-1:y+2, x-1:x+2] > 0).sum() - 1
                    if neighbors == 1 or neighbors == 0:
                        endpoints.append((x, y))
        
        def get_neighbors(x, y):
            n = []
            for dy in [-1, 0, 1]:
                for dx in [-1, 0, 1]:
                    if dx == 0 and dy == 0: continue
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < w and 0 <= ny < h and skeleton[ny, nx] > 0 and not visited[ny, nx]:
                        n.append((nx, ny))
            return n

        paths = []
        for ep in endpoints:
            if visited[ep[1], ep[0]]: continue
            path = []
            curr = ep
            while curr:
                path.append(curr)
                visited[curr[1], curr[0]] = True
                n = get_neighbors(curr[0], curr[1])
                curr = n[0] if n else None
            if len(path) > 1:
                paths.append(path)
                
        for y in range(1, h-1):
            for x in range(1, w-1):
                if skeleton[y, x] > 0 and not visited[y, x]:
                    path = []
                    curr = (x, y)
                    while curr:
                        path.append(curr)
                        visited[curr[1], curr[0]] = True
                        n = get_neighbors(curr[0], curr[1])
                        curr = n[0] if n else None
                    if len(path) > 1:
                        paths.append(path)

        result = []
        for path in paths:
            if len(path) < min_length:
                continue
            pts = np.array(path, dtype=np.int32).reshape((-1, 1, 2))
            perimeter = cv2.arcLength(pts, False)
            epsilon = epsilon_factor * perimeter
            approx = cv2.approxPolyDP(pts, epsilon, False)
            path_points = []
            for p in approx:
                cx = p[0][0] * self._bg_scale_x + self._bg_offset_x
                cy = p[0][1] * self._bg_scale_y + self._bg_offset_y
                path_points.append({"x": cx, "y": cy})
            if len(path_points) > 1:
                result.append(path_points)
        return result

    def extract_borders(self, mask_clean: np.ndarray) -> List[List[Dict[str, float]]]:
        skeleton = cv2.ximgproc.thinning(mask_clean, thinningType=cv2.ximgproc.THINNING_ZHANGSUEN)
        return self.walk_skeleton_to_paths(skeleton)

    def extract_rivers(self, river_mask: np.ndarray) -> List[List[Dict[str, float]]]:
        skeleton_rivers = cv2.ximgproc.thinning(river_mask, thinningType=cv2.ximgproc.THINNING_ZHANGSUEN)
        
        h, w = skeleton_rivers.shape
        visited = np.zeros((h, w), dtype=bool)
        
        endpoints = []
        for y in range(1, h-1):
            for x in range(1, w-1):
                if skeleton_rivers[y, x] > 0:
                    neighbors = (skeleton_rivers[y-1:y+2, x-1:x+2] > 0).sum() - 1
                    if neighbors == 1 or neighbors == 0:
                        endpoints.append((x, y))
        
        def get_neighbors(x, y):
            n = []
            for dy in [-1, 0, 1]:
                for dx in [-1, 0, 1]:
                    if dx == 0 and dy == 0: continue
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < w and 0 <= ny < h and skeleton_rivers[ny, nx] > 0 and not visited[ny, nx]:
                        n.append((nx, ny))
            return n

        paths = []
        for ep in endpoints:
            if visited[ep[1], ep[0]]: continue
            path = []
            curr = ep
            while curr:
                path.append(curr)
                visited[curr[1], curr[0]] = True
                n = get_neighbors(curr[0], curr[1])
                curr = n[0] if n else None
            if len(path) > 1:
                paths.append(path)
                
        for y in range(1, h-1):
            for x in range(1, w-1):
                if skeleton_rivers[y, x] > 0 and not visited[y, x]:
                    path = []
                    curr = (x, y)
                    while curr:
                        path.append(curr)
                        visited[curr[1], curr[0]] = True
                        n = get_neighbors(curr[0], curr[1])
                        curr = n[0] if n else None
                    if len(path) > 1:
                        paths.append(path)

        result = []
        for path in paths:
            if len(path) < 10:
                continue
                
            pts = np.array(path, dtype=np.int32).reshape((-1, 1, 2))
            perimeter = cv2.arcLength(pts, False)
            epsilon = 0.005 * perimeter
            approx = cv2.approxPolyDP(pts, epsilon, False)
            path_points = []
            for p in approx:
                cx = p[0][0] * self._bg_scale_x + self._bg_offset_x
                cy = p[0][1] * self._bg_scale_y + self._bg_offset_y
                path_points.append({"x": cx, "y": cy})
            if len(path_points) > 1:
                result.append(path_points)
        return result

    def merge_paths(self, paths: List[List[Dict[str, float]]], max_raw_dist: float) -> List[List[Dict[str, float]]]:
        if not paths:
            return []
            
        max_dist = max_raw_dist * max(self._bg_scale_x, self._bg_scale_y)
        merged = []
        active_paths = paths.copy()
        
        def dist(p1, p2):
            return ((p1["x"] - p2["x"])**2 + (p1["y"] - p2["y"])**2)**0.5
            
        while active_paths:
            current = active_paths.pop(0)
            merged_something = True
            
            while merged_something:
                merged_something = False
                i = 0
                while i < len(active_paths):
                    other = active_paths[i]
                    
                    c_start, c_end = current[0], current[-1]
                    o_start, o_end = other[0], other[-1]
                    
                    if dist(c_end, o_start) <= max_dist:
                        current.extend(other)
                        active_paths.pop(i)
                        merged_something = True
                    elif dist(c_end, o_end) <= max_dist:
                        current.extend(reversed(other))
                        active_paths.pop(i)
                        merged_something = True
                    elif dist(c_start, o_end) <= max_dist:
                        current = other + current
                        active_paths.pop(i)
                        merged_something = True
                    elif dist(c_start, o_start) <= max_dist:
                        current = list(reversed(other)) + current
                        active_paths.pop(i)
                        merged_something = True
                    else:
                        i += 1
                        
            merged.append(current)
            
        return merged

    def extract_cliffs(self, cliff_mask: np.ndarray) -> List[List[Dict[str, float]]]:
        skeleton_cliffs = cv2.ximgproc.thinning(cliff_mask, thinningType=cv2.ximgproc.THINNING_ZHANGSUEN)
        paths = self.walk_skeleton_to_paths(skeleton_cliffs)
        return self.merge_paths(paths, max_raw_dist=30.0)

    def extract_coastlines(self, water_mask: np.ndarray) -> List[Dict[str, Any]]:
        coastlines = []
        contours, hierarchy = cv2.findContours(water_mask, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
        
        if hierarchy is None:
            return []
            
        hierarchy = hierarchy[0]
        
        outer_polys = {}
        holes_map = {}
        
        for i, cnt in enumerate(contours):
            perimeter = cv2.arcLength(cnt, True)
            epsilon = 0.0005 * perimeter
            approx = cv2.approxPolyDP(cnt, epsilon, True)
            path_points = []
            for p in approx:
                cx = p[0][0] * self._bg_scale_x + self._bg_offset_x
                cy = p[0][1] * self._bg_scale_y + self._bg_offset_y
                path_points.append({"x": cx, "y": cy})
                
            if len(path_points) > 2:
                parent = hierarchy[i][3]
                if parent == -1:
                    outer_polys[i] = path_points
                else:
                    if parent not in holes_map:
                        holes_map[parent] = []
                    holes_map[parent].append(path_points)

        for idx, path_points in outer_polys.items():
            pts = np.array([[p["x"], p["y"]] for p in path_points], dtype=np.float32)
            poly_area = cv2.contourArea(pts)
            
            poly_data = {"type": "polygon", "points": path_points, "area": poly_area}
            if idx in holes_map:
                poly_data["holes"] = holes_map[idx]
            coastlines.append(poly_data)
            
        return coastlines
