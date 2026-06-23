import cv2
import numpy as np
import os
import glob

def check_terrain_ink():
    paths = glob.glob('assets/tiles/Terrain/*.png')
    for path in paths:
        img = cv2.imread(path)
        if img is None:
            continue
            
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        _, ink = cv2.threshold(gray, 100, 255, cv2.THRESH_BINARY_INV)
        
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3,3))
        ink = cv2.morphologyEx(ink, cv2.MORPH_OPEN, kernel)
        
        count = np.count_nonzero(ink)
        print(f"{os.path.basename(path)}: {count} ink pixels")

if __name__ == "__main__":
    check_terrain_ink()
