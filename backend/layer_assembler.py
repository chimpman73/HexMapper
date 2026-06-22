import uuid
import math
import numpy as np
import cv2
from typing import Dict, Any, List
from hex_grid import HexGrid
from template_manager import TemplateManager
from map_data import MapData
from color_matcher import ColorMatcher

class LayerAssembler:
    def __init__(self, template_manager: TemplateManager, hex_grid: HexGrid, bg_scale_x: float, bg_scale_y: float, bg_offset_x: float, bg_offset_y: float) -> None:
        self._template_manager = template_manager
        self._hex_grid = hex_grid
        self._bg_scale_x = bg_scale_x
        self._bg_scale_y = bg_scale_y
        self._bg_offset_x = bg_offset_x
        self._bg_offset_y = bg_offset_y
        self._color_matcher = ColorMatcher(template_manager)

    def _snap_path_to_hex_vertices(self, path_points: List[Dict[str, float]], orientation: str) -> List[Dict[str, float]]:
        snapped_path = []
        for p in path_points:
            q, r = self._hex_grid.pixel_to_hex(p["x"], p["y"], orientation)
            hq, hr = self._hex_grid.hex_round(q, r)
            vertices = self._hex_grid.get_hex_vertices(hq, hr, orientation)
            
            best_dist = float('inf')
            best_v = None
            for vx, vy in vertices:
                dist = (p["x"] - vx)**2 + (p["y"] - vy)**2
                if dist < best_dist:
                    best_dist = dist
                    best_v = {"x": vx, "y": vy}
            
            if not snapped_path:
                snapped_path.append(best_v)
            else:
                last_v = snapped_path[-1]
                if abs(last_v["x"] - best_v["x"]) > 0.1 or abs(last_v["y"] - best_v["y"]) > 0.1:
                    snapped_path.append(best_v)
                    
        return snapped_path

    def assemble(self, data: MapData, extracted_layers: Dict[str, Any], existing_layers: List[Dict[str, Any]], hex_grid_mask: np.ndarray, orientation: str = 'flat', is_reimport: bool = False) -> List[Dict[str, Any]]:
        if not existing_layers and not is_reimport:
            existing_layers = [
                { "id": '1', "name": 'Terrain', "type": 'terrain', "visible": True, "opacity": 1, "data": {} },
                { "id": '4', "name": 'Coastline', "type": 'coastline', "visible": True, "opacity": 1, "data": [] },
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
                    if isinstance(layer.get("data"), dict) and isinstance(ext_info["data"], dict):
                        layer["data"].update(ext_info["data"])
                    elif isinstance(layer.get("data"), list) and isinstance(ext_info["data"], list):
                        layer["data"].extend(ext_info["data"])
                    
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
            if not river_layer:
                river_layer = {
                    "id": f"layer_{str(uuid.uuid4())[:8]}",
                    "name": "Rivers",
                    "type": "river",
                    "visible": True,
                    "opacity": 1,
                    "sourceFilename": "Rivers",
                    "data": []
                }
                insert_idx = next((i for i, l in enumerate(existing_layers) if l.get("type") == "coastline"), 0)
                existing_layers.insert(insert_idx, river_layer)

            if not isinstance(river_layer.get("data"), list):
                river_layer["data"] = []
                
            for path_data in data.global_rivers:
                if isinstance(path_data, dict):
                    path_points = path_data["points"]
                    source_color = path_data.get("source_color", "")
                else:
                    path_points = path_data
                    source_color = ""
                
                # Match river style based on exact source color
                river_color, river_style = self._color_matcher.match_river_color(source_color)

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
                    
                    for c_path_obj in data.global_coastlines:
                        c_path = c_path_obj.get("points", []) if isinstance(c_path_obj, dict) else c_path_obj
                        for i in range(len(c_path)):
                            p1 = c_path[i]
                            p2 = c_path[(i+1) % len(c_path)]
                            
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
                    "stroke": river_color,
                    "strokeWidth": 4,
                    "tension": 0.5,
                    "riverStyle": river_style
                })

        # Convert global borders to vector lines
        if data.global_borders:
            border_layer = next((l for l in existing_layers if l.get("type") == "border"), None)
            if not border_layer:
                border_layer = {
                    "id": f"layer_{str(uuid.uuid4())[:8]}",
                    "name": "Borders",
                    "type": "border",
                    "visible": True,
                    "opacity": 1,
                    "sourceFilename": "Borders",
                    "data": []
                }
                existing_layers.append(border_layer)
                
            if not isinstance(border_layer.get("data"), list):
                border_layer["data"] = []
                
            for path_points in data.global_borders:
                if len(path_points) < 2: continue
                    
                # Heuristic to detect if it's a snapped line vs smooth
                snapped = False
                if len(path_points) > 2:
                    border_mask = np.zeros((data.height, data.width), dtype=np.uint8)
                    pts = []
                    for p in path_points:
                        img_x = int((p["x"] - self._bg_offset_x) / self._bg_scale_x)
                        img_y = int((p["y"] - self._bg_offset_y) / self._bg_scale_y)
                        pts.append([img_x, img_y])
                        
                    cv2.polylines(border_mask, [np.array(pts, dtype=np.int32)], False, 255, 1)
                        
                    # Slightly dilate the hex grid mask (which is already 4px thick) to tolerate hand-drawn wobble
                    kernel = np.ones((3, 3), np.uint8)
                    thick_grid_mask = cv2.morphologyEx(hex_grid_mask, cv2.MORPH_DILATE, kernel)
                        
                    overlap = cv2.bitwise_and(border_mask, thick_grid_mask)
                        
                    total_pixels = cv2.countNonZero(border_mask)
                    overlap_pixels = cv2.countNonZero(overlap)
                        
                    # 60% overlap is enough to confirm it intended to follow the grid
                    if total_pixels > 0 and (overlap_pixels / total_pixels) > 0.6:
                        snapped = True
                            
                if snapped:
                    final_points = self._snap_path_to_hex_vertices(path_points, orientation)
                    if len(final_points) < 2:
                        # Too short to span between hex vertices, it was likely just a small smooth detail
                        snapped = False
                        final_points = path_points
                else:
                    final_points = path_points
                        
                flat_points = []
                for p in final_points:
                    flat_points.extend([p["x"], p["y"]])

                border_layer["data"].append({
                    "id": f"border_{str(uuid.uuid4())[:8]}",
                    "points": flat_points,
                    "stroke": "#dc2626",
                    "strokeWidth": 5,
                    "tension": 0 if snapped else 0.5,
                    "borderStyle": "snapped" if snapped else "smooth"
                })

        # Convert global cliffs to vector lines
        if data.global_cliffs:
            cliff_layer = next((l for l in existing_layers if l.get("type") == "cliff"), None)
            if not cliff_layer:
                cliff_layer = {
                    "id": f"layer_{str(uuid.uuid4())[:8]}",
                    "name": "Cliffs",
                    "type": "cliff",
                    "visible": True,
                    "opacity": 1,
                    "sourceFilename": "Cliffs",
                    "data": {"lines": [], "hexes": {}}
                }
                existing_layers.append(cliff_layer)
                
            if not isinstance(cliff_layer.get("data"), dict):
                cliff_layer["data"] = {"lines": [], "hexes": {}}
            elif "lines" not in cliff_layer.get("data", {}):
                old_data = cliff_layer["data"]
                cliff_layer["data"] = {"lines": [], "hexes": old_data}
                
            for path_points in data.global_cliffs:
                if len(path_points) < 2: continue
                
                flat_points = []
                for p in path_points:
                    flat_points.extend([p["x"], p["y"]])

                cliff_layer["data"]["lines"].append({
                    "id": f"cliff_{str(uuid.uuid4())[:8]}",
                    "points": flat_points,
                    "stroke": "#555555",
                    "strokeWidth": 8,
                    "tension": 0.5,
                    "cliffStyle": "default"
                })

        # Convert coastline layers to vector layers with matched colors
        if data.coastline_layers:
            for c_layer in data.coastline_layers:
                if not c_layer.vectors:
                    continue
                
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
                    
                for poly_data in c_layer.vectors:
                    if isinstance(poly_data, dict):
                        path_points = poly_data.get("points", [])
                        holes = poly_data.get("holes", [])
                        source_hex = poly_data.get("source_color", "")
                    else:
                        path_points = poly_data
                        holes = []
                        source_hex = ""
                        
                    # Match coastline template using ColorMatcher
                    best_fill_hex, best_match_key = self._color_matcher.match_coastline_color(source_hex)
                                            
                    flat_points = []
                    for p in path_points:
                        flat_points.extend([p["x"], p["y"]])
                        
                    flat_holes = []
                    for h in holes:
                        flat_h = []
                        for hp in h:
                            flat_h.extend([hp["x"], hp["y"]])
                        flat_holes.append(flat_h)
                        
                    layer_obj["data"].append({
                        "id": f"coastline_{str(uuid.uuid4())[:8]}",
                        "points": flat_points,
                        "holes": flat_holes if flat_holes else None,
                        "stroke": "#222222",
                        "strokeWidth": 3,
                        "tension": 0.5,
                        "coastlineStyle": "smooth",
                        "brushKey": best_match_key,
                        "fill": best_fill_hex,
                        "fillPatternUrl": best_match_key
                    })

        # QoL: Clean up empty terrain and coastline layers if multiple exist and at least one has data
        for layer_type in ["terrain", "coastline"]:
            type_layers = [l for l in existing_layers if l.get("type") == layer_type]
            if len(type_layers) > 1:
                has_items = any(len(l.get("data", {})) > 0 for l in type_layers)
                if has_items:
                    existing_layers = [l for l in existing_layers if not (l.get("type") == layer_type and len(l.get("data", {})) == 0)]

        return existing_layers
