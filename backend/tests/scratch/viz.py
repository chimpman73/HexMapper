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

ve = VectorExtractor(bg_scale_x=1, bg_scale_y=1, bg_offset_x=0, bg_offset_y=0)

c = 15
kernel_close = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (c, c))
mask_closed = cv2.morphologyEx(ink_mask, cv2.MORPH_CLOSE, kernel_close)

o = 11
kernel_open = np.ones((o, o), np.uint8)
mask_clean = cv2.morphologyEx(mask_closed, cv2.MORPH_OPEN, kernel_open)

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

def dist(p1, p2):
    return ((p1['x']-p2['x'])**2 + (p1['y']-p2['y'])**2)**0.5

drawn_pairs = set()

for i in range(len(paths)):
    min_d = float('inf')
    best_pair = None
    for j in range(len(paths)):
        if i == j: continue
        p1 = paths[i]
        p2 = paths[j]
        d1 = dist(p1[-1], p2[0])
        d2 = dist(p1[-1], p2[-1])
        d3 = dist(p1[0], p2[0])
        d4 = dist(p1[0], p2[-1])
        
        d = min(d1, d2, d3, d4)
        if d < min_d:
            min_d = d
            if min_d == d1: best_pair = (p1[-1], p2[0])
            elif min_d == d2: best_pair = (p1[-1], p2[-1])
            elif min_d == d3: best_pair = (p1[0], p2[0])
            elif min_d == d4: best_pair = (p1[0], p2[-1])
            
    if best_pair and min_d < 100:
        pt1 = (int(best_pair[0]['x']), int(best_pair[0]['y']))
        pt2 = (int(best_pair[1]['x']), int(best_pair[1]['y']))
        pair_key = tuple(sorted([pt1, pt2]))
        
        if pair_key not in drawn_pairs:
            cv2.line(vis, pt1, pt2, (0, 0, 255), 1)
            mid = ((pt1[0]+pt2[0])//2, (pt1[1]+pt2[1])//2)
            cv2.putText(vis, f"{min_d:.1f}px", mid, cv2.FONT_HERSHEY_SIMPLEX, 0.4, (255, 255, 255), 1)
            drawn_pairs.add(pair_key)

cv2.imwrite('C:/Users/chimp/.gemini/antigravity-ide/brain/d4cf25a6-c629-4ae9-9c85-841123f5c5c6/cliff_breaks.png', vis)
