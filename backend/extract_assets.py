import cv2
import numpy as np
import os
import sys
from typing import List, Tuple

class AssetExtractor:
    def __init__(self) -> None:
        pass

    def extract_hexes(self, image_path: str, output_dir: str) -> None:
        if not os.path.exists(output_dir):
            os.makedirs(output_dir)

        print(f"Reading {image_path}...")
        if not os.path.exists(image_path):
            raise FileNotFoundError(f"Image not found at {image_path}")
            
        img = cv2.imread(image_path)
        if img is None:
            raise cv2.error(f"Could not read image at {image_path}")

        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        # The legend has black borders around the hexes.
        # Inverse thresholding makes the black borders white.
        _, thresh = cv2.threshold(gray, 100, 255, cv2.THRESH_BINARY_INV)

        # Use RETR_TREE to find all contours, but we will filter them
        contours, hierarchy = cv2.findContours(thresh, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)

        hex_count: int = 0
        centers: List[Tuple[int, int]] = []

        for contour in contours:
            x, y, w, h = cv2.boundingRect(contour)
            
            # Filter by size
            if w < 30 or h < 30 or w > 150 or h > 150:
                continue
                
            aspect_ratio: float = w / float(h)
            if aspect_ratio < 0.7 or aspect_ratio > 1.3:
                continue
                
            # Filter out contours that aren't roughly hexagonal
            epsilon = 0.02 * cv2.arcLength(contour, True)
            approx = cv2.approxPolyDP(contour, epsilon, True)
            
            # Hexagons should have roughly 6 vertices (give or take some noise)
            if len(approx) < 5 or len(approx) > 8:
                continue

            center = (x + w//2, y + h//2)
            # Check if we already processed a contour near this center
            is_duplicate = False
            for cx, cy in centers:
                if abs(cx - center[0]) < 10 and abs(cy - center[1]) < 10:
                    is_duplicate = True
                    break
            
            if is_duplicate:
                continue
                
            centers.append(center)

            roi = img[y:y+h, x:x+w]
            
            # Create a mask for the hex
            shifted_contour = contour - [x, y]
            mask = np.zeros((h, w), dtype=np.uint8)
            cv2.drawContours(mask, [shifted_contour], -1, (255), thickness=cv2.FILLED) # type: ignore
            
            # Apply mask
            b, g, r = cv2.split(roi)
            rgba = cv2.merge((b, g, r, mask))
            
            output_path = os.path.join(output_dir, f"hex_{hex_count:03d}.png")
            cv2.imwrite(output_path, rgba)
            hex_count += 1

        print(f"Extraction complete. Saved {hex_count} hexes to {output_dir}")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python extract_assets.py <path_to_legend_png> <output_directory>")
        sys.exit(1)
        
    extractor = AssetExtractor()
    try:
        extractor.extract_hexes(sys.argv[1], sys.argv[2])
    except Exception as e:
        print(f"Extraction failed: {e}")
        sys.exit(1)
