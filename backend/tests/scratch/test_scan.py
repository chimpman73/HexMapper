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
    unknowns = result['data']['unknowns']
    print(f"Unknowns found: {len(unknowns)}")
    
    terrain_data = result['data']['layers'][0]['data']
    for u in unknowns:
        k = u["key"]
        terrain = terrain_data.get(k, "None")
        print(f"Unknown at {k}, terrain: {terrain}")
except Exception as e:
    import traceback
    traceback.print_exc()
    print(f"Scan failed: {e}")
