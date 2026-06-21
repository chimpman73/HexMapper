import os
import cv2
import numpy as np

def generate_textures(style="Hollow Moon"):
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    tiles_dir = os.path.join(base_dir, "assets", "styles", style, "tiles", "Coastline")
    textures_dir = os.path.join(base_dir, "assets", "styles", style, "textures", "Coastline")
    
    os.makedirs(textures_dir, exist_ok=True)
    
    if not os.path.exists(tiles_dir):
        print(f"Directory not found: {tiles_dir}")
        return
        
    for f in os.listdir(tiles_dir):
        if f.endswith(".png"):
            in_path = os.path.join(tiles_dir, f)
            out_path = os.path.join(textures_dir, f)
            
            img = cv2.imread(in_path, cv2.IMREAD_UNCHANGED)
            if img is None:
                continue
                
            h, w = img.shape[:2]
            cx, cy = w // 2, h // 2
            
            # Crop the inner 50x50 area
            crop_size = 50
            half = crop_size // 2
            crop = img[cy-half:cy+half, cx-half:cx+half]
            
            # Kaleidoscope mirror tiling to make it 100x100 seamless
            top_right = cv2.flip(crop, 1)
            bottom_left = cv2.flip(crop, 0)
            bottom_right = cv2.flip(top_right, 0)
            
            top = np.hstack([crop, top_right])
            bottom = np.hstack([bottom_left, bottom_right])
            seamless = np.vstack([top, bottom])
            
            cv2.imwrite(out_path, seamless)
            print(f"Generated texture: {out_path}")

if __name__ == "__main__":
    generate_textures()
