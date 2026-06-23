import sys
import cv2
import numpy as np
import os
sys.path.append('backend')
from image_processor import ImageProcessor
from template_manager import TemplateManager
from hex_grid import HexGrid
from hex_scanner import HexScanner

tm = TemplateManager('c:/John/Code/HexMapper')
hg = HexGrid()
ip = ImageProcessor(2.09, 2.09, 0, 0)
hs = HexScanner('c:/John/Code/HexMapper', tm, hg, 2.09, 2.09, 0, 0)

data = ip.process_aligned_map('c:/John/Code/HexMapper/saves/HollowMoon_Albheldri_8mph copy.png', tm.templates['coastline'])

print("Data initialized.")

import math

orientation = 'flat'
bg_scale_x = 2.09
bg_scale_y = 2.09
bg_offset_x = 0
bg_offset_y = 0

q = 0
r = 10
cx, cy = hg.hex_to_pixel(q, r, orientation)
img_x = int((cx - bg_offset_x) / bg_scale_x)
img_y = int((cy - bg_offset_y) / bg_scale_y)

hex_w = int((2 * hg.hex_size) / bg_scale_x)
hex_h = int((math.sqrt(3) * hg.hex_size) / bg_scale_y)
margin_x = max(2, int(hex_w * 0.35))
margin_y = max(2, int(hex_h * 0.35))
x_start = max(0, img_x - margin_x)
x_end = min(data.width, img_x + margin_x)
y_start = max(0, img_y - margin_y)
y_end = min(data.height, img_y + margin_y)

region_mask = data.water_mask[y_start:y_end, x_start:x_end]
water_pixels = np.count_nonzero(region_mask)
total_pixels = (y_end - y_start) * (x_end - x_start)

land_mask = cv2.bitwise_not(region_mask)
has_drawn_ink = False

print("Region bounds:", x_start, x_end, y_start, y_end)
print("Total Pixels:", total_pixels)
print("Water Pixels:", water_pixels)
print("Nonzero land_mask:", np.count_nonzero(land_mask))

if np.count_nonzero(land_mask) > 10:
    region_bgr = data.source_terrain[y_start:y_end, x_start:x_end]
    best_score = float('inf')
    best_match_key = None
    
    for t in tm.templates["terrain"]:
        if True: # use_ink_filter is True
            if not has_drawn_ink and t.get("ink_count", 0) > 200:
                continue
            if has_drawn_ink and t.get("ink_count", 0) < 50:
                continue
                
        t_margin_x = max(2, int(hex_w * 0.40))
        t_margin_y = max(2, int(hex_h * 0.40))
        resized = cv2.resize(t["bgr"], (hex_w, hex_h))
        t_cx, t_cy = hex_w // 2, hex_h // 2
        t_crop = resized[max(0, t_cy - t_margin_y):min(hex_h, t_cy + t_margin_y), 
                            max(0, t_cx - t_margin_x):min(hex_w, t_cx + t_margin_x)]
        
        print("T_CROP shape:", t_crop.shape, "REGION_BGR shape:", region_bgr.shape)
        if region_bgr.shape[0] <= t_crop.shape[0] and region_bgr.shape[1] <= t_crop.shape[1]:
            mask_3ch = cv2.merge([land_mask, land_mask, land_mask])
            score_map = cv2.matchTemplate(t_crop, region_bgr, cv2.TM_SQDIFF_NORMED, mask=mask_3ch)
            score = np.min(score_map)
            print("Score for", t["key"], ":", score)
            if score < best_score:
                best_score = score
                best_match_key = t["key"]
                
    print("BEST MATCH:", best_match_key)
