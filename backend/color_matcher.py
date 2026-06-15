import cv2
import numpy as np
import os
import json

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SIGNATURES_FILE = os.path.join(os.path.dirname(__file__), "signatures.json")

def get_dominant_colors(image, k=3, mask=None):
    # Reshape image to a list of pixels
    if mask is not None:
        pixels_bgr = image[mask > 0]
    else:
        pixels_bgr = image.reshape((-1, 3))
        
    if len(pixels_bgr) == 0:
        return []

    # Convert to LAB for much better human perceptual color distance
    pixels_bgr_img = pixels_bgr.reshape((1, -1, 3)).astype(np.uint8)
    pixels_lab_img = cv2.cvtColor(pixels_bgr_img, cv2.COLOR_BGR2Lab)
    pixels_lab = pixels_lab_img.reshape((-1, 3)).astype(np.float32)
    
    # Define criteria and apply kmeans
    criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 10, 1.0)
    # k-means
    ret, labels, centers = cv2.kmeans(pixels_lab, min(k, len(pixels_lab)), None, criteria, 10, cv2.KMEANS_RANDOM_CENTERS)
    
    # Calculate ratio of each color
    counts = np.bincount(labels.flatten())
    total = len(pixels_lab)
    
    colors = []
    for i in range(len(centers)):
        ratio = counts[i] / total
        colors.append({
            "l": float(centers[i][0]),
            "a": float(centers[i][1]),
            "b": float(centers[i][2]),
            "ratio": float(ratio)
        })
        
    # Sort by ratio descending
    colors.sort(key=lambda x: x['ratio'], reverse=True)
    return colors

def build_signatures():
    signatures = {}
    
    # Process Terrain
    terrain_dir = os.path.join(BASE_DIR, "assets", "tiles", "Terrain")
    if os.path.exists(terrain_dir):
        for filename in os.listdir(terrain_dir):
            if filename.endswith(".png"):
                path = os.path.join(terrain_dir, filename)
                img_bgra = cv2.imread(path, cv2.IMREAD_UNCHANGED)
                if img_bgra is not None:
                    bgr = img_bgra[:, :, :3]
                    mask = None
                    if img_bgra.shape[2] == 4:
                        _, mask = cv2.threshold(img_bgra[:, :, 3], 1, 255, cv2.THRESH_BINARY)
                    
                    colors = get_dominant_colors(bgr, k=3, mask=mask)
                    signatures[f"Terrain/{filename}"] = { "type": "terrain", "colors": colors }

    # Process Coastline
    coastline_dir = os.path.join(BASE_DIR, "assets", "tiles", "Coastline")
    if os.path.exists(coastline_dir):
        for filename in os.listdir(coastline_dir):
            if filename.endswith(".png"):
                path = os.path.join(coastline_dir, filename)
                img_bgra = cv2.imread(path, cv2.IMREAD_UNCHANGED)
                if img_bgra is not None:
                    bgr = img_bgra[:, :, :3]
                    mask = None
                    if img_bgra.shape[2] == 4:
                        _, mask = cv2.threshold(img_bgra[:, :, 3], 1, 255, cv2.THRESH_BINARY)
                    
                    colors = get_dominant_colors(bgr, k=3, mask=mask)
                    signatures[f"Coastline/{filename}"] = { "type": "coastline", "colors": colors }
                
    with open(SIGNATURES_FILE, 'w') as f:
        json.dump(signatures, f, indent=2)
    return signatures

def load_signatures():
    if not os.path.exists(SIGNATURES_FILE):
        return build_signatures()
    with open(SIGNATURES_FILE, 'r') as f:
        return json.load(f)

def color_distance(c1, c2):
    return np.sqrt((c1['l'] - c2['l'])**2 + (c1['a'] - c2['a'])**2 + (c1['b'] - c2['b'])**2)

def match_hex(hex_bgr_image, signatures):
    hex_colors = get_dominant_colors(hex_bgr_image, k=3)
    if not hex_colors:
        return "Terrain/hex_061.png", "terrain" # Default fallback
        
    best_match = None
    best_type = "terrain"
    best_score = float('inf')
    
    for file_key, sig_data in signatures.items():
        sig_colors = sig_data["colors"]
        score = 0
        # Since both lists are sorted by ratio descending, compare them pairwise
        # This inherently rewards matching ratios (dominant to dominant)
        pairs_to_check = min(len(hex_colors), len(sig_colors))
        for i in range(pairs_to_check):
            hc = hex_colors[i]
            sc = sig_colors[i]
            # Multiply color distance by ratio importance
            weight = max(hc['ratio'], sc['ratio'])
            score += color_distance(hc, sc) * weight
            # Add penalty for differing ratios
            score += abs(hc['ratio'] - sc['ratio']) * 200
            
        if score < best_score:
            best_score = score
            best_match = file_key
            best_type = sig_data["type"]
            
    return best_match, best_type
