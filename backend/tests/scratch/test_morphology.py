import cv2
import numpy as np

# Load the map image
img = cv2.imread('saves/HollowMoon_Albheldri_8mph copy.png')
if img is not None:
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    # Extract ink
    ink_mask = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 15, 6)
    
    # Save original ink mask
    cv2.imwrite('ink_mask_raw.png', ink_mask[:1000, :1000])
    
    # Apply morphological opening to delete thin lines (coastlines, grid lines) but keep dense cities
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3,3))
    ink_mask_opened = cv2.morphologyEx(ink_mask, cv2.MORPH_OPEN, kernel)
    
    cv2.imwrite('ink_mask_opened.png', ink_mask_opened[:1000, :1000])
    
    print(f"Raw ink pixels: {np.count_nonzero(ink_mask)}")
    print(f"Opened ink pixels: {np.count_nonzero(ink_mask_opened)}")
