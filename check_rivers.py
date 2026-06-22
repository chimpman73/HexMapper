import json
import os
import sys

base_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(os.path.join(base_dir, "backend"))
from backend.interpreter import MapInterpreter

input_path = os.path.join(base_dir, "backend", "tests", "goldenfiles", "inputs", "Albheldri_8mph_test")
args = {
    "mode": "multi_layer",
    "imagePath": input_path,
    "bgScaleX": 1.0,
    "bgScaleY": 1.0,
    "bgOffsetX": 0,
    "bgOffsetY": 0,
    "mapWidth": 39,
    "mapHeight": 25
}

interpreter = MapInterpreter()
result = interpreter.interpret_map(args)

if result.get("status") != "success":
    print("FAILED", result)
    sys.exit(1)

out_rivers = []
for layer in result["data"]["layers"]:
    if layer["type"] == "river":
        out_rivers.extend(layer.get("data", []))

print(f"OUTPUT ALBHELDRI - Total Rivers: {len(out_rivers)}")

golden_path = os.path.join(base_dir, "backend", "tests", "goldenfiles", "outputs", "Albheldri_MultiLayer.json")
with open(golden_path, "r") as f:
    gold_data = json.load(f)

gold_rivers = []
for layer in gold_data.get("layers", []):
    if layer.get("type") == "river":
        gold_rivers.extend(layer.get("data", []))

print(f"GOLDEN ALBHELDRI - Total Rivers: {len(gold_rivers)}")
