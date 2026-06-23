import cv2
import numpy as np

img = cv2.imread('saves/HollowMoon_Albheldri_8mph copy.png')
if img is not None:
    # Crop a small region where we know there's a symbol
    # Let's just run it on the whole image and save a section
    h, w = img.shape[:2]
    
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    ink_mask = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 15, 6)
    
    # Clean up the ink mask slightly
    kernel = np.ones((2,2), np.uint8)
    ink_mask = cv2.morphologyEx(ink_mask, cv2.MORPH_OPEN, kernel)
    
    # Save a 1000x1000 crop so we can see it
    cv2.imwrite('C:/Users/chimp/.gemini/antigravity-ide/brain/ebe7173e-f373-4855-8059-f0ba2813905c/ink_mask_test.png', ink_mask[:1000, :1000])
    cv2.imwrite('C:/Users/chimp/.gemini/antigravity-ide/brain/ebe7173e-f373-4855-8059-f0ba2813905c/ink_mask_orig.png', img[:1000, :1000])
    print("Ink mask generated.")
