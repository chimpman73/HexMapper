import cv2
import numpy as np

img = cv2.imread('saves/HollowMoon_Albheldri_8mph copy.png')
gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
ink_mask = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 15, 6)

contours, _ = cv2.findContours(ink_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
clean_ink = np.zeros_like(ink_mask)

for c in contours:
    area = cv2.contourArea(c)
    if area > 10:
        x,y,w,h = cv2.boundingRect(c)
        extent = float(area) / (w * h)
        if extent > 0.15: # Ignore very thin diagonal lines
            cv2.drawContours(clean_ink, [c], -1, 255, -1)

cv2.imwrite('ink_mask_extent.png', clean_ink[:1000, :1000])
print(f"Raw ink pixels: {np.count_nonzero(ink_mask)}")
print(f"Clean ink pixels: {np.count_nonzero(clean_ink)}")
