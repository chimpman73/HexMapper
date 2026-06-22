import cv2
import numpy as np
from typing import List, Optional

class MaskGenerator:
    """
    Responsible purely for thresholding and topological separation of images into binary masks.
    Knows nothing about hex grids, templates, or geometry extraction.
    """
    
    @staticmethod
    def get_base_mask(img: np.ndarray) -> Optional[np.ndarray]:
        """Thresholds an image to separate drawing from background/transparency."""
        if img is None:
            return None
            
        if len(img.shape) == 3 and img.shape[2] == 4:
            # Has alpha channel
            _, m = cv2.threshold(img[:, :, 3], 5, 255, cv2.THRESH_BINARY)
            return m
        else:
            # Grayscale intensity fallback
            g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if len(img.shape) == 3 else img
            if np.mean(g) > 127:
                # Mostly white background
                _, m = cv2.threshold(g, 240, 255, cv2.THRESH_BINARY_INV)
            else:
                # Mostly black background
                _, m = cv2.threshold(g, 10, 255, cv2.THRESH_BINARY)
            return m

    @staticmethod
    def generate_coastline_masks(img: np.ndarray) -> tuple[List[tuple[tuple[int, int, int], np.ndarray]], Optional[np.ndarray]]:
        """
        Takes a coastline image and separates it into distinct binary masks.
        Uses color *only* to separate blobs, returning pure binary masks alongside their quantized color.
        Returns (list_of_tuples(color_bgr, mask), accumulated_water_mask)
        """
        base_mask = MaskGenerator.get_base_mask(img)
        if base_mask is None:
            return [], None
            
        kernel = np.ones((5, 5), np.uint8)
        water_mask_clean = cv2.morphologyEx(base_mask, cv2.MORPH_OPEN, kernel)
        water_mask_clean = cv2.morphologyEx(water_mask_clean, cv2.MORPH_CLOSE, kernel)
        
        masks = []
        
        # Multi-depth / Multi-color extraction
        if len(img.shape) == 3:
            bgr = img[:, :, :3] if img.shape[2] == 4 else img
            
            # Quantize colors purely to group similar shades into distinct binary blobs
            quantized = (bgr // 32) * np.uint8(32) + np.uint8(16)
            flat_quantized = quantized[water_mask_clean > 0]
            
            if len(flat_quantized) > 0:
                unique_colors, counts = np.unique(flat_quantized, axis=0, return_counts=True)
                total_pixels = len(flat_quantized)
                
                for color, count in zip(unique_colors, counts):
                    # Ignore noisy pixels
                    if count / total_pixels < 0.001 and count < 100:
                        continue
                        
                    color_mask = np.all(quantized == color, axis=-1)
                    final_mask = np.logical_and(color_mask, water_mask_clean > 0).astype(np.uint8) * 255
                    color_tuple = (int(color[0]), int(color[1]), int(color[2]))
                    masks.append((color_tuple, final_mask))
        else:
            # Grayscale fallback
            masks.append(((255, 255, 255), water_mask_clean))
            
        return masks, base_mask

    @staticmethod
    def generate_river_masks(img: np.ndarray) -> List[np.ndarray]:
        """Extracts the river path as a binary mask."""
        base_mask = MaskGenerator.get_base_mask(img)
        if base_mask is None:
            return []
            
        kernel_tiny = np.ones((2, 2), np.uint8)
        mask_clean = cv2.morphologyEx(base_mask, cv2.MORPH_DILATE, kernel_tiny, iterations=1)
        
        masks = []
        if len(img.shape) == 3:
            bgr = img[:, :, :3] if img.shape[2] == 4 else img
            quantized = (bgr // 32) * np.uint8(32) + np.uint8(16)
            flat_quantized = quantized[mask_clean > 0]
            
            if len(flat_quantized) > 0:
                unique_colors, counts = np.unique(flat_quantized, axis=0, return_counts=True)
                total_pixels = len(flat_quantized)
                
                for color, count in zip(unique_colors, counts):
                    if count / total_pixels < 0.001 and count < 100:
                        continue
                        
                    color_mask = np.all(quantized == color, axis=-1)
                    final_mask = np.logical_and(color_mask, mask_clean > 0).astype(np.uint8) * 255
                    color_tuple = (int(color[0]), int(color[1]), int(color[2]))
                    masks.append((color_tuple, final_mask))
        
        if not masks:
            masks.append(((255, 255, 255), mask_clean))
            
        return masks
        
    @staticmethod
    def generate_cliff_masks(img: np.ndarray) -> tuple[List[np.ndarray], Optional[np.ndarray]]:
        """Extracts cliffs into binary masks. Returns (masks, ink_mask)"""
        base_mask = MaskGenerator.get_base_mask(img)
        if base_mask is None:
            return [], None
            
        kernel_close = np.ones((21, 21), np.uint8)
        mask_closed = cv2.morphologyEx(base_mask, cv2.MORPH_CLOSE, kernel_close)
        
        kernel_open = np.ones((11, 11), np.uint8)
        mask_clean = cv2.morphologyEx(mask_closed, cv2.MORPH_OPEN, kernel_open)
        
        return [mask_clean], mask_clean

    @staticmethod
    def generate_border_masks(img: np.ndarray) -> List[np.ndarray]:
        """Extracts borders into a binary mask."""
        base_mask = MaskGenerator.get_base_mask(img)
        if base_mask is None:
            return []
            
        kernel_border = np.ones((3, 3), np.uint8)
        mask_clean = cv2.morphologyEx(base_mask, cv2.MORPH_OPEN, kernel_border)
        return [mask_clean]

