import backend.interpreter as interpreter
import json

args = {
    "imagePath": "saves/HollowMoon_Albheldri_8mph copy.png",
    "bgScaleX": 1,
    "bgScaleY": 1,
    "bgOffsetX": 0,
    "bgOffsetY": 0,
    "mapWidth": 5,
    "mapHeight": 5,
    "orientation": "flat"
}

try:
    result = interpreter.scan_aligned_map(args)
    print("Scan successful!")
    print(f"Unknowns found: {len(result['data']['unknowns'])}")
except Exception as e:
    print(f"Scan failed: {e}")
