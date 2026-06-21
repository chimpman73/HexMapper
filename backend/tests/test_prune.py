import cv2
import numpy as np

def prune_skeleton(skeleton, max_prune_length=40):
    # Make a copy to edit
    pruned = skeleton.copy()
    
    # Neighborhood kernel for counting neighbors
    kernel = np.array([[1, 1, 1],
                       [1, 0, 1],
                       [1, 1, 1]], dtype=np.uint8)

    while True:
        # Find endpoints: pixels with exactly 1 neighbor
        neighbors = cv2.filter2D(pruned // 255, -1, kernel, borderType=cv2.BORDER_CONSTANT)
        endpoints = np.where((pruned > 0) & (neighbors == 1))
        
        if len(endpoints[0]) == 0:
            break
            
        points_to_remove = []
        for y, x in zip(endpoints[0], endpoints[1]):
            # Trace from endpoint
            curr_y, curr_x = y, x
            path = [(curr_y, curr_x)]
            
            while len(path) < max_prune_length:
                # Get neighbors of current pixel
                y0, y1 = max(0, curr_y-1), min(pruned.shape[0], curr_y+2)
                x0, x1 = max(0, curr_x-1), min(pruned.shape[1], curr_x+2)
                
                roi = pruned[y0:y1, x0:x1]
                ny, nx = np.where(roi > 0)
                
                next_pixel = None
                for dy, dx in zip(ny, nx):
                    abs_y = y0 + dy
                    abs_x = x0 + dx
                    if (abs_y, abs_x) not in path:
                        # Check if this neighbor is a branch point (in the original pruned image)
                        n_neighbors = neighbors[abs_y, abs_x]
                        if n_neighbors > 2:
                            # It's a branch point, we reached the spine
                            break
                        next_pixel = (abs_y, abs_x)
                        break
                
                if next_pixel:
                    path.append(next_pixel)
                    curr_y, curr_x = next_pixel[0], next_pixel[1]
                else:
                    # We hit a branch point or ran out of pixels
                    break
            
            # If we stopped because we hit a branch point, and path length <= max_prune_length,
            # it's a hachure! If we just ran out of pixels but didn't hit a branch point,
            # it might be the tip of the main spine, so we shouldn't prune it, 
            # UNLESS it's just a tiny isolated speck.
            # Actually, to be safe, we only prune if we hit a branch point or it's an isolated small line.
            # But wait, if we trace and hit a branch point, the loop breaks and next_pixel is None.
            # Let's just say any leaf branch shorter than max_prune_length is pruned!
            if len(path) <= max_prune_length:
                points_to_remove.extend(path)
                
        if not points_to_remove:
            break
            
        for py, px in points_to_remove:
            pruned[py, px] = 0
            
    return pruned

img = cv2.imread('saves/Apennines_8mph_Layers/Cliffs.png', cv2.IMREAD_UNCHANGED)
mask = img[:, :, 3]

# Standard skeletonization without heavy morphology
kernel = np.ones((3,3), np.uint8)
mask_clean = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
skeleton = cv2.ximgproc.thinning(mask_clean, thinningType=cv2.ximgproc.THINNING_ZHANGSUEN)

pruned_skeleton = prune_skeleton(skeleton, max_prune_length=50)

# How many paths now?
import sys
sys.path.append('backend')
from vector_extractor import VectorExtractor
ve = VectorExtractor(1, 1, 0, 0)
paths = ve.walk_skeleton_to_paths(pruned_skeleton)
print("Found", len(paths), "cliffs")
cv2.imwrite('backend/tests/pruned_skeleton.png', pruned_skeleton)
