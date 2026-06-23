import cv2
import numpy as np

img = cv2.imread('saves/HollowMoon_Albheldri_8mph copy.png')
hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)

# Define a general blue range
lower_blue = np.array([90, 50, 50])
upper_blue = np.array([130, 255, 255])

blue_mask = cv2.inRange(hsv, lower_blue, upper_blue)

# Save the raw blue mask
cv2.imwrite('blue_mask.png', blue_mask[:1000, :1000])

# Since oceans are large blue blobs and rivers are thin blue lines,
# we can use a morphological open with a large kernel to isolate the oceans
# and then subtract the oceans from the raw blue mask to get the rivers (Top-Hat)!
kernel_large = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))
oceans = cv2.morphologyEx(blue_mask, cv2.MORPH_OPEN, kernel_large)

rivers = cv2.subtract(blue_mask, oceans)

# Clean up rivers by removing tiny noise
kernel_small = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
rivers = cv2.morphologyEx(rivers, cv2.MORPH_OPEN, kernel_small)

cv2.imwrite('oceans.png', oceans[:1000, :1000])
cv2.imwrite('rivers.png', rivers[:1000, :1000])

print(f"Blue pixels: {np.count_nonzero(blue_mask)}")
print(f"Ocean pixels: {np.count_nonzero(oceans)}")
print(f"River pixels: {np.count_nonzero(rivers)}")
