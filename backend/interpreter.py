import os
import traceback
from typing import Dict, Any

from template_manager import TemplateManager
from hex_grid import HexGrid
from image_processor import ImageProcessor
from hex_scanner import HexScanner

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def interpret_map(args: Dict[str, Any]) -> Dict[str, Any]:
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

        # 1. Initialize Objects
        template_manager = TemplateManager(BASE_DIR)
        hex_grid = HexGrid()
        image_processor = ImageProcessor(bg_scale_x, bg_scale_y, bg_offset_x, bg_offset_y)
        hex_scanner = HexScanner(BASE_DIR, template_manager, hex_grid, bg_scale_x, bg_scale_y, bg_offset_x, bg_offset_y)

        # 2. Extract Layers
        if mode == "multi_layer":
            map_data = image_processor.process_multi_layer(image_path)
        else:
            map_data = image_processor.process_aligned_map(image_path, template_manager.templates["coastline"])

        # 3. Scan Grid
        return hex_scanner.scan(map_data, map_width, map_height, orientation, use_ink_filter=(mode != "multi_layer"))

    except FileNotFoundError as e:
        return {"status": "error", "message": f"File Not Found: {str(e)}", "trace": traceback.format_exc()}
    except cv2.error as e:
        return {"status": "error", "message": f"OpenCV Processing Error: {str(e)}", "trace": traceback.format_exc()}
    except Exception as e:
        return {"status": "error", "message": str(e), "trace": traceback.format_exc()}
