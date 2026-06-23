import cv2
import numpy as np
import os

# Load a city template and create its binary mask
city_img = cv2.imread('assets/tiles/Cities/hex_022.png', cv2.IMREAD_UNCHANGED)
_, city_mask = cv2.threshold(city_img[:, :, 3], 1, 255, cv2.THRESH_BINARY)

# Load a different city template
city2_img = cv2.imread('assets/tiles/Cities/hex_023.png', cv2.IMREAD_UNCHANGED)
_, city2_mask = cv2.threshold(city2_img[:, :, 3], 1, 255, cv2.THRESH_BINARY)
city2_mask = cv2.resize(city2_mask, (city_mask.shape[1], city_mask.shape[0]))

# Match same mask
score_same = cv2.matchTemplate(city_mask, city_mask, cv2.TM_SQDIFF_NORMED)[0][0]

# Match different mask
score_diff = cv2.matchTemplate(city_mask, city2_mask, cv2.TM_SQDIFF_NORMED)[0][0]

print(f"City Mask SQDIFF (Same): {score_same}")
print(f"City Mask SQDIFF (Different): {score_diff}")
