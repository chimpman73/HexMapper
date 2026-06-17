import os
import cv2
import numpy as np
import urllib.parse
from typing import Dict, List, Any, Optional, Tuple

class TemplateManager:
    def __init__(self, base_dir: str, style: str = "Hollow Moon"):
        self.base_dir = base_dir
        self.style = style
        self.templates: Dict[str, List[Dict[str, Any]]] = {
            "terrain": [],
            "coastline": [],
            "city": [],
            "ignore": []
        }
        self.load_templates()

    def get_asset_url(self, rel_path: str) -> str:
        """Convert a relative path into a local:// protocol URL for the Electron frontend."""
        abs_path = os.path.join(self.base_dir, rel_path.lstrip('/\\'))
        abs_path = abs_path.replace("\\", "/")
        return f"local://file?path={urllib.parse.quote(abs_path, safe='')}"

    def load_templates(self) -> None:
        """Load all templates from the assets directory."""
        self._load_dir("Terrain", "terrain")
        self._load_dir("Coastline", "coastline")
        self._load_dir("Cities", "city", use_alpha=True)
        self._load_dir("Ignored", "ignore", use_alpha=True)

    def _load_dir(self, dir_name: str, category: str, use_alpha: bool = False) -> None:
        """Load a specific directory of template images into memory."""
        d_path = os.path.join(self.base_dir, "assets", "styles", self.style, "tiles", dir_name)
        if not os.path.exists(d_path):
            return

        for f in sorted(os.listdir(d_path)):
            if f.endswith(".png"):
                file_path = os.path.join(d_path, f)
                img = cv2.imread(file_path, cv2.IMREAD_UNCHANGED)
                
                if img is None:
                    continue
                    
                inherent_ink_count = 0
                if category == "terrain":
                    bgr_only = img[:, :, :3]
                    gray = cv2.cvtColor(bgr_only, cv2.COLOR_BGR2GRAY)
                    _, ink = cv2.threshold(gray, 100, 255, cv2.THRESH_BINARY_INV)
                    
                    if img.shape[2] == 4:
                        ink = cv2.bitwise_and(ink, ink, mask=img[:,:,3])
                        
                    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
                    ink = cv2.morphologyEx(ink, cv2.MORPH_OPEN, kernel)
                    inherent_ink_count = np.count_nonzero(ink)

                if use_alpha and len(img.shape) == 3 and img.shape[2] == 4:
                    _, mask = cv2.threshold(img[:, :, 3], 1, 255, cv2.THRESH_BINARY)
                    self.templates[category].append({"key": f"{dir_name}/{f}", "mask": mask})
                else:
                    mean_color: Optional[Tuple[float, float, float]] = None
                    if len(img.shape) == 3 and img.shape[2] == 4:
                        alpha = img[:, :, 3]
                        mean_color = cv2.mean(img[:, :, :3], mask=alpha)[:3]
                    elif len(img.shape) == 3:
                        mean_color = cv2.mean(img[:, :, :3])[:3]
                    else:
                        mean_color = (0.0, 0.0, 0.0)
                        
                    entry: Dict[str, Any] = {
                        "key": f"{dir_name}/{f}", 
                        "bgr": img[:, :, :3] if len(img.shape) == 3 else img, 
                        "mean_color": mean_color
                    }
                    
                    if category == "terrain":
                        entry["ink_count"] = inherent_ink_count
                        entry["mask"] = ink
                    self.templates[category].append(entry)
