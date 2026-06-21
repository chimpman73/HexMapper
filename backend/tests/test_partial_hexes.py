import json
import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import interpreter

def test_partial_hexes():
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    test_dir = os.path.join(base_dir, "backend", "tests")
    
    img_path = os.path.join(test_dir, "artificial_map.png")
    truth_path = os.path.join(test_dir, "artificial_map_truth.json")
    
    with open(truth_path, "r") as f:
        truth_data = json.load(f)
        
    args = {
        "mode": "composite",
        "imagePath": img_path,
        "bgScaleX": 1.0,
        "bgScaleY": 1.0,
        "bgOffsetX": -150.0,
        "bgOffsetY": -150.0,
        "mapWidth": 15,
        "mapHeight": 120,
        "hexSize": 40,
        "orientation": "flat"
    }
    
    map_interpreter = interpreter.MapInterpreter()
    result = map_interpreter.interpret_map(args)
    
    if result.get("status") != "success":
        print("Interpreter failed:", result.get("message"))
        return
        
    # Process output
    output_layers = {}
    for layer in result["data"]["layers"]:
        if layer["type"] == "terrain":
            output_layers.setdefault("Terrain", {}).update(layer["data"])
        elif layer["type"] == "city":
            output_layers.setdefault("Cities", {}).update(layer["data"])
            
    # Evaluate
    evaluate_layer("Terrain", truth_data["Terrain"], output_layers.get("Terrain", {}))
    evaluate_layer("Cities", truth_data["Cities"], output_layers.get("Cities", {}))

def evaluate_layer(layer_name, truth, output):
    print(f"--- Evaluating {layer_name} ---")
    
    total = len(truth)
    correct_full = 0
    correct_half = 0
    correct_quarter = 0
    
    total_full = 0
    total_half = 0
    total_quarter = 0
    
    for coord, true_path in truth.items():
        # q=2 is full, q=6 is half, q=10 is quarter
        q = int(coord.split(',')[0])
        if q == 2: total_full += 1
        elif q == 6: total_half += 1
        elif q == 10: total_quarter += 1
        
        out_path = output.get(coord)
        
        if out_path:
            # Paths might differ slightly in slashes or absolute/relative
            true_base = os.path.basename(true_path)
            out_base = os.path.basename(out_path)
            if true_base == out_base:
                if q == 2: correct_full += 1
                elif q == 6: correct_half += 1
                elif q == 10: correct_quarter += 1
            else:
                print(f"Mismatch at {coord}: Expected {true_base}, got {out_base}")
        else:
            print(f"Missing at {coord}: Expected {os.path.basename(true_path)}")
            
    print(f"Full Hex Accuracy:    {correct_full}/{total_full} ({correct_full/max(1, total_full)*100:.1f}%)")
    print(f"Half Hex Accuracy:    {correct_half}/{total_half} ({correct_half/max(1, total_half)*100:.1f}%)")
    print(f"Quarter Hex Accuracy: {correct_quarter}/{total_quarter} ({correct_quarter/max(1, total_quarter)*100:.1f}%)")
    print()

if __name__ == "__main__":
    test_partial_hexes()
