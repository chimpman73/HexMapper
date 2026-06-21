import os
import traceback
import cv2
from typing import Dict, Any

from template_manager import TemplateManager
from hex_grid import HexGrid
from image_processor import ImageProcessor
from hex_scanner import HexScanner

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

class MapInterpreter:
    def interpret_map(self, args: Dict[str, Any]) -> Dict[str, Any]:
        try:
            mode = args.get("mode", "composite")
            
            bg_scale_x = float(args.get("bgScaleX", 1.0))
            bg_scale_y = float(args.get("bgScaleY", 1.0))
            bg_offset_x = float(args.get("bgOffsetX", 0.0))
            bg_offset_y = float(args.get("bgOffsetY", 0.0))
            map_width = int(args.get("mapWidth", 30))
            map_height = int(args.get("mapHeight", 30))
            orientation = args.get("orientation", "flat")
            image_path = args.get("imagePath", "")
            style = args.get("style", "Hollow Moon")

            # 1. Initialize Objects
            template_manager = TemplateManager(BASE_DIR, style)
            hex_grid = HexGrid()
            image_processor = ImageProcessor(bg_scale_x, bg_scale_y, bg_offset_x, bg_offset_y)
            hex_scanner = HexScanner(BASE_DIR, template_manager, hex_grid, bg_scale_x, bg_scale_y, bg_offset_x, bg_offset_y)

            # 2. Extract Layers
            if mode == "multi_layer":
                map_data = image_processor.process_multi_layer(image_path)
            else:
                map_data = image_processor.process_aligned_map(image_path, template_manager.templates["coastline"])

            # 3. Scan Grid
            existing_layers = args.get("layers", [])
            return hex_scanner.scan(map_data, map_width, map_height, orientation, existing_layers, use_ink_filter=(mode != "multi_layer"))

        except FileNotFoundError as e:
            return {"success": False, "error": f"File Not Found: {str(e)}", "code": "FILE_NOT_FOUND", "data": {"trace": traceback.format_exc()}}
        except cv2.error as e:
            return {"success": False, "error": f"OpenCV Processing Error: {str(e)}", "code": "OPENCV_ERROR", "data": {"trace": traceback.format_exc()}}
        except Exception as e:
            return {"success": False, "error": str(e), "code": "INTERPRETER_ERROR", "data": {"trace": traceback.format_exc()}}
