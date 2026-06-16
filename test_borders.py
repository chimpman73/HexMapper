import cv2
import numpy as np

# Load test image
img = cv2.imread('saves/HollowMoon_Albheldri_8mph copy.png')

if img is not None:
    # Convert to HSV to isolate the Red borders
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    
    # Red has hue near 0 and 180, so we need two masks
    lower_red1 = np.array([0, 70, 50])
    upper_red1 = np.array([10, 255, 255])
    mask1 = cv2.inRange(hsv, lower_red1, upper_red1)
    
    lower_red2 = np.array([170, 70, 50])
    upper_red2 = np.array([180, 255, 255])
    mask2 = cv2.inRange(hsv, lower_red2, upper_red2)
    
    # Combine red masks
    red_mask = mask1 | mask2
    
    # Optional: clean up the mask with morphology
    kernel = np.ones((3,3), np.uint8)
    red_mask_clean = cv2.morphologyEx(red_mask, cv2.MORPH_OPEN, kernel)
    
    # Inpaint the original image to remove the red borders
    inpainted_img = cv2.inpaint(img, red_mask_clean, 3, cv2.INPAINT_TELEA)
    
    cv2.imwrite('red_mask_test.png', red_mask_clean)
    cv2.imwrite('inpainted_test.png', inpainted_img)
    
    # Let's count red pixels to see if we found the borders
    print(f"Red pixels extracted: {np.count_nonzero(red_mask_clean)}")
else:
    print("Could not load image")
