import cv2
import numpy as np

img = cv2.imread('saves/HollowMoon_Albheldri_8mph copy.png')
gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

# Global thresholding
_, global_ink = cv2.threshold(gray, 100, 255, cv2.THRESH_BINARY_INV)

# Adaptive thresholding
adaptive_ink = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 15, 6)

cv2.imwrite('ink_global.png', global_ink[:1000, :1000])
cv2.imwrite('ink_adaptive.png', adaptive_ink[:1000, :1000])

print(f"Global ink pixels: {np.count_nonzero(global_ink)}")
print(f"Adaptive ink pixels: {np.count_nonzero(adaptive_ink)}")
