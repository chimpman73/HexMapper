import cv2
import numpy as np
import sys
import os

sys.path.append(os.path.abspath('backend'))
from vector_extractor import VectorExtractor

img = cv2.imread('backend/tests/goldenfiles/inputs/Apennines_8mph_Layers/Cliffs.png', cv2.IMREAD_UNCHANGED)
h, w = img.shape[:2]
gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
_, ink_mask = cv2.threshold(gray, 100, 255, cv2.THRESH_BINARY_INV)
_, alpha_mask = cv2.threshold(img[:, :, 3], 10, 255, cv2.THRESH_BINARY)
ink_mask = cv2.bitwise_and(ink_mask, alpha_mask)

kernel_open_first = np.ones((5, 5), np.uint8)
mask_opened = cv2.morphologyEx(ink_mask, cv2.MORPH_OPEN, kernel_open_first)

kernel_close = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (25, 25))
mask_closed = cv2.morphologyEx(mask_opened, cv2.MORPH_CLOSE, kernel_close)

kernel_open2 = np.ones((7, 7), np.uint8)
mask_clean = cv2.morphologyEx(mask_closed, cv2.MORPH_OPEN, kernel_open2)

ve = VectorExtractor(bg_scale_x=1, bg_scale_y=1, bg_offset_x=0, bg_offset_y=0)
skeleton = cv2.ximgproc.thinning(mask_clean, thinningType=cv2.ximgproc.THINNING_ZHANGSUEN)
paths = ve.walk_skeleton_to_paths(skeleton)
paths = ve.merge_paths(paths, max_raw_dist=30.0)

vis = np.zeros((h, w, 3), dtype=np.uint8)
vis[ink_mask > 0] = (50, 50, 50)

colors = [
    (255, 0, 0), (0, 255, 0), (0, 0, 255),
    (255, 255, 0), (0, 255, 255), (255, 0, 255),
    (255, 165, 0), (0, 165, 255)
]

for i, p in enumerate(paths):
    color = colors[i % len(colors)]
    pts = np.array([[(pt['x'], pt['y']) for pt in p]], dtype=np.int32)
    cv2.polylines(vis, pts, False, color, 2)
    
    pt1 = (int(p[0]['x']), int(p[0]['y']))
    pt2 = (int(p[-1]['x']), int(p[-1]['y']))
    cv2.circle(vis, pt1, 4, (255, 255, 255), -1)
    cv2.circle(vis, pt2, 4, (255, 255, 255), -1)

cv2.imwrite('C:/Users/chimp/.gemini/antigravity-ide/brain/d4cf25a6-c629-4ae9-9c85-841123f5c5c6/cliffs_open_first_vis.png', vis)
