import cv2
import numpy as np
import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))
from mask_generator import MaskGenerator
from vector_extractor import VectorExtractor

def test_cliff():
    input_path = "backend/tests/saves/SyntheticCliffs/Layer_Cliffs.png"
    img = cv2.imread(input_path, cv2.IMREAD_UNCHANGED)
    if img is None:
        print("Failed to load image")
        return
        
    masks, ink = MaskGenerator.generate_cliff_masks(img)
    print(f"Number of masks: {len(masks)}")
    for i, mask in enumerate(masks):
        print(f"Mask {i} non-zero: {cv2.countNonZero(mask)}")
        ve = VectorExtractor(1, 1, 0, 0)
        paths = ve.extract_cliffs(mask)
        print(f"Number of paths: {len(paths)}")
        for j, path in enumerate(paths):
            print(f"Path {j} length: {len(path)}")

test_cliff()
