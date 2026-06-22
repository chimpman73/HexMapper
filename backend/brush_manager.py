import os
import shutil
import cv2
from typing import Dict, Any

class BrushManager:
    def __init__(self, base_dir: str) -> None:
        self._base_dir = base_dir

    def save_brush(self, uid: str, name: str) -> Dict[str, Any]:
        src_path = os.path.join(self._base_dir, "saves", ".temp_unknowns", f"{uid}.png")
        if not name.endswith(".png"):
            name += ".png"
            
        dest_path = os.path.join(self._base_dir, "assets", "tiles", "Cities", name)
        
        try:
            shutil.copy(src_path, dest_path)
            return {"success": True, "data": {"message": "Brush saved successfully"}}
        except (FileNotFoundError, PermissionError, OSError) as e:
            return {"success": False, "error": f"File operation failed: {str(e)}", "code": "BRUSH_ERROR"}

    def ignore_brush(self, uid: str) -> Dict[str, Any]:
        src_path = os.path.join(self._base_dir, "saves", ".temp_unknowns", f"{uid}.png")
        
        try:
            # We need to extract the ink and save it as an alpha-masked PNG in Ignored
            img = cv2.imread(src_path)
            if img is None:
                raise FileNotFoundError(f"Could not read image {src_path}")
                
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            ink_mask = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 15, 6)
            
            # Create a 4-channel image
            b, g, r = cv2.split(img)
            bgra = cv2.merge((b, g, r, ink_mask))
            
            ignore_dir = os.path.join(self._base_dir, "assets", "tiles", "Ignored")
            os.makedirs(ignore_dir, exist_ok=True)
            
            dest_path = os.path.join(ignore_dir, f"{uid}.png")
            if not cv2.imwrite(dest_path, bgra):
                raise cv2.error(f"Failed to write image to {dest_path}")
            
            return {"success": True, "data": {"message": "Brush ignored successfully"}}
        except FileNotFoundError as e:
            return {"success": False, "error": str(e), "code": "BRUSH_ERROR"}
        except cv2.error as e:
            return {"success": False, "error": f"OpenCV processing error: {str(e)}", "code": "BRUSH_ERROR"}
        except OSError as e:
            return {"success": False, "error": f"File system error: {str(e)}", "code": "BRUSH_ERROR"}
