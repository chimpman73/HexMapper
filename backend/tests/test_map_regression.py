import pytest
import json
import os
import sys

# Add backend to path so we can import interpreter directly
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import interpreter

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SAVES_DIR = os.path.join(BASE_DIR, "saves")
SCALE_FACTOR = 2.09

@pytest.fixture(params=[
    ("Albheldri_8mph_test", "Albheldri_MultiLayer.json", 39, 25),
    ("Apennines_8mph_Layers", "Apennines_MultiLayer.json", 59, 48)
])
def multi_layer_test_case(request):
    input_folder, gold_file, map_width, map_height = request.param
    input_path = os.path.join(SAVES_DIR, input_folder)
    gold_path = os.path.join(SAVES_DIR, gold_file)
    
    if not os.path.exists(input_path):
        pytest.skip(f"Input path {input_path} not found.")
    if not os.path.exists(gold_path):
        pytest.skip(f"Gold standard path {gold_path} not found.")
        
    return input_path, gold_path, map_width, map_height

def test_multi_layer_regression(multi_layer_test_case):
    input_path, gold_path, map_width, map_height = multi_layer_test_case
    
    with open(gold_path, "r") as f:
        gold_data = json.load(f)
        
    desc_path = os.path.join(input_path, "map_description.json")
    bg_scale_x, bg_scale_y = SCALE_FACTOR, SCALE_FACTOR
    bg_offset_x, bg_offset_y = 0, 0
    if os.path.exists(desc_path):
        with open(desc_path, "r") as f:
            desc = json.load(f)
            bg_scale_x = desc.get("Scale x", SCALE_FACTOR)
            bg_scale_y = desc.get("Scale y", SCALE_FACTOR)
            bg_offset_x = desc.get("Offset X", 0)
            bg_offset_y = desc.get("Offset Y", 0)

    args = {
        "mode": "multi_layer",
        "imagePath": input_path,
        "bgScaleX": bg_scale_x,
        "bgScaleY": bg_scale_y,
        "bgOffsetX": bg_offset_x,
        "bgOffsetY": bg_offset_y,
        "mapWidth": map_width,
        "mapHeight": map_height
    }
    
    map_interpreter = interpreter.MapInterpreter()
    result = map_interpreter.interpret_map(args)
    assert result.get("status") == "success", f"Interpreter failed: {result.get('message')}"
    
    output_layers = {}
    for layer in result["data"]["layers"]:
        if layer["type"] == "terrain":
            output_layers.setdefault("Terrain", {}).update(layer["data"])
        elif layer["type"] == "city":
            output_layers.setdefault("Cities", {}).update(layer["data"])
            
    gold_layers = {}
    for layer in gold_data.get("layers", []):
        if layer.get("type") == "terrain":
            gold_layers.setdefault("Terrain", {}).update(layer.get("data", {}))
        elif layer.get("type") == "city":
            gold_layers.setdefault("Cities", {}).update(layer.get("data", {}))
            
    # Terrain & City Tests
    for layer_name in ["Terrain", "Cities"]:
        if layer_name in gold_layers and layer_name in output_layers:
            diff = abs(len(output_layers[layer_name]) - len(gold_layers[layer_name]))
            assert diff <= 2, f"Layer {layer_name} length mismatch. Out: {len(output_layers[layer_name])}, Gold: {len(gold_layers[layer_name])}"
            
            match_count = 0
            for key in gold_layers[layer_name]:
                if key in output_layers[layer_name]:
                    match_count += 1
            assert match_count >= len(gold_layers[layer_name]) - 2, f"Too many missing keys in {layer_name}"

    # Cliff & Border logic verification (We want this to fail for Apennines)
    # Check global_cliffs length
    gold_cliffs_count = len(gold_data.get("globalCliffs", []))
    out_cliffs_count = len(result["data"].get("globalCliffs", []))
    
    gold_borders_count = len(gold_data.get("globalBorders", []))
    out_borders_count = len(result["data"].get("globalBorders", []))
    
    if "Albheldri" in input_path:
        assert abs(gold_cliffs_count - out_cliffs_count) <= 5, f"Cliff count mismatch. Out: {out_cliffs_count}, Gold: {gold_cliffs_count}"
        assert abs(gold_borders_count - out_borders_count) <= 5, f"Border count mismatch. Out: {out_borders_count}, Gold: {gold_borders_count}"
