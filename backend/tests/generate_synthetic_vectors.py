import os
import cv2
import numpy as np

def generate_synthetic_images():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    saves_dir = os.path.join(base_dir, "saves")
    os.makedirs(saves_dir, exist_ok=True)
    
    # 1. Synthetic Cliffs (A line with perpendicular hachures)
    cliff_dir = os.path.join(saves_dir, "SyntheticCliffs")
    os.makedirs(cliff_dir, exist_ok=True)
    img_cliff = np.zeros((500, 500, 4), dtype=np.uint8)
    
    # Main cliff line
    cv2.line(img_cliff, (100, 100), (400, 100), (0, 0, 0, 255), 8)
    # Draw long hachures to test that they are ignored (main line is horizontal)
    for x in range(120, 380, 20):
        cv2.line(img_cliff, (x, 100), (x, 150), (0, 0, 0, 255), 4)
    cv2.imwrite(os.path.join(cliff_dir, "Cliffs.png"), img_cliff)

    # 2. Synthetic Borders (A wobbly line that SHOULD be snapped)
    border_dir = os.path.join(saves_dir, "SyntheticBorders")
    os.makedirs(border_dir, exist_ok=True)
    img_border = np.zeros((500, 500, 4), dtype=np.uint8)
    
    import sys
    sys.path.append(os.path.dirname(base_dir))
    from hex_grid import HexGrid
    hg = HexGrid()
    
    # We need a line that has >60% overlap with the hex grid to trigger snapping.
    # The grid has hexSize=40. Let's draw a line that exactly follows some hex edges.
    v1 = hg.get_hex_vertices(2, 2, "flat")
    v2 = hg.get_hex_vertices(2, 3, "flat")
    
    # Draw a path connecting some vertices
    pts = np.array([
        v1[0], v1[1], v1[2], v2[1], v2[2], v2[3]
    ], np.int32)
    cv2.polylines(img_border, [pts], False, (0, 0, 0, 255), 8)
    cv2.imwrite(os.path.join(border_dir, "Borders.png"), img_border)
    
    # 3. Synthetic Coastline & Rivers (Snapping logic)
    water_dir = os.path.join(saves_dir, "SyntheticWater")
    os.makedirs(water_dir, exist_ok=True)
    img_coast = np.zeros((500, 500, 4), dtype=np.uint8)
    img_river = np.zeros((500, 500, 4), dtype=np.uint8)
    
    # Fill water on the bottom half
    cv2.rectangle(img_coast, (0, 250), (500, 500), (0, 0, 0, 255), -1)
    
    # Draw a river that stops just shy of the coastline (ends at y=230)
    cv2.line(img_river, (250, 50), (250, 230), (0, 0, 0, 255), 3)
    
    cv2.imwrite(os.path.join(water_dir, "Coastlines.png"), img_coast)
    cv2.imwrite(os.path.join(water_dir, "Rivers.png"), img_river)
    
    print(f"Generated synthetic vector images in {saves_dir}")

if __name__ == "__main__":
    generate_synthetic_images()
