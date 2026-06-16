import cv2
import numpy as np
import time
import json
import os

with open('backend/signatures.json', 'r') as f:
    signatures = json.load(f)

img = cv2.imread('saves/HollowMoon_Albheldri_8mph copy.png')
if img is None:
    print("Could not load image. Looking for typical map.")
    # Fallback to test image
    img = np.zeros((1000, 1000, 3), dtype=np.uint8)

start = time.time()
img_lab = cv2.cvtColor(img, cv2.COLOR_BGR2Lab).astype(np.float32)

water_mask = np.zeros(img.shape[:2], dtype=np.uint8)
coastline_sigs = [v['colors'][0] for k, v in signatures.items() if v['type'] == 'coastline']

for sig in coastline_sigs:
    diff = img_lab - np.array([sig['l'], sig['a'], sig['b']], dtype=np.float32)
    dist_sq = np.sum(diff**2, axis=2)
    water_mask[dist_sq < 30.0**2] = 255

kernel = np.ones((5,5), np.uint8)
water_mask = cv2.morphologyEx(water_mask, cv2.MORPH_OPEN, kernel)
water_mask = cv2.morphologyEx(water_mask, cv2.MORPH_CLOSE, kernel)

contours, _ = cv2.findContours(water_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

print(f"Extraction took {time.time() - start:.3f} seconds.")
print(f"Found {len(contours)} water bodies.")
cv2.imwrite('C:/Users/chimp/.gemini/antigravity-ide/brain/ebe7173e-f373-4855-8059-f0ba2813905c/water_mask_test.png', water_mask)
