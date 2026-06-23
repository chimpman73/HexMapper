import cv2
import numpy as np

img = cv2.imread('saves/HollowMoon_Albheldri_8mph copy.png')
# Assuming grid width~100, height~100. We can just test a few terrain tiles against themselves
t1 = cv2.imread('assets/tiles/Terrain/hex_061.png') # Grass
t2 = cv2.imread('assets/tiles/Terrain/hex_064.png') # Mountain

if t1 is not None and t2 is not None:
    # Resize t2 to match t1 for direct comparison
    t2_resized = cv2.resize(t2, (t1.shape[1], t1.shape[0]))
    
    # Compare t1 to t1
    score_same = cv2.matchTemplate(t1, t1, cv2.TM_CCOEFF_NORMED)[0][0]
    
    # Compare t1 to t2
    score_diff = cv2.matchTemplate(t1, t2_resized, cv2.TM_CCOEFF_NORMED)[0][0]
    
    print(f"Match score (Same): {score_same}")
    print(f"Match score (Different): {score_diff}")

    # Now let's try TM_SQDIFF_NORMED (lower is better)
    sq_same = cv2.matchTemplate(t1, t1, cv2.TM_SQDIFF_NORMED)[0][0]
    sq_diff = cv2.matchTemplate(t1, t2_resized, cv2.TM_SQDIFF_NORMED)[0][0]
    print(f"SQDIFF score (Same): {sq_same}")
    print(f"SQDIFF score (Different): {sq_diff}")
