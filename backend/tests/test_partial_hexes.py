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
        "mapWidth": 40,
        "mapHeight": 200,
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
            
    with open("test_output_layers.json", "w") as f:
        json.dump(output_layers, f, indent=2)
        
    output_lines = []
    terrain_lines, terrain_fails = evaluate_layer("Terrain", truth_data["Terrain"], output_layers.get("Terrain", {}), base_dir)
    city_lines, city_fails = evaluate_layer("Cities", truth_data["Cities"], output_layers.get("Cities", {}), base_dir)
    
    output_lines.extend(terrain_lines)
    output_lines.extend(city_lines)
    
    all_fails = terrain_fails + city_fails
    output_lines.append("--- Failing Hexes ---")
    if not all_fails:
        output_lines.append("All hexes matched perfectly!")
    else:
        for fail in all_fails:
            output_lines.append(fail)
    output_lines.append("")
    
    for line in output_lines:
        print(line)
        
    import datetime
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    results_dir = os.path.join(test_dir, "results")
    os.makedirs(results_dir, exist_ok=True)
    out_path = os.path.join(results_dir, f"partial_hexes_report_{timestamp}.txt")
    with open(out_path, "w") as f:
        f.write("\n".join(output_lines) + "\n")
    print(f"Saved report to {out_path}")

def evaluate_layer(layer_name, truth, output, base_dir):
    lines = []
    lines.append(f"--- Evaluating {layer_name} ---")
    
    hex_stats = {}
    for coord, true_path in truth.items():
        q = int(coord.split(',')[0])
        if q == 2: type_str = "full"
        elif q in [6, 10, 14, 18]: type_str = "half"
        elif q in [22, 26, 30, 34]: type_str = "quarter"
        else: continue
            
        true_base = os.path.basename(true_path)
        if true_base not in hex_stats:
            hex_stats[true_base] = {
                "full_total": 0, "full_correct": 0,
                "half_total": 0, "half_correct": 0,
                "quarter_total": 0, "quarter_correct": 0,
                "failures": []
            }
            
        hex_stats[true_base][f"{type_str}_total"] += 1
        
        out_path = output.get(coord)
        if out_path:
            out_base = os.path.basename(out_path)
            if true_base == out_base:
                hex_stats[true_base][f"{type_str}_correct"] += 1
            else:
                hex_stats[true_base]["failures"].append(f"[{layer_name}] Expected {true_base} at {coord} ({type_str}) but got {out_base}")
        else:
            hex_stats[true_base]["failures"].append(f"[{layer_name}] Expected {true_base} at {coord} ({type_str}) but got NO MATCH")

    profile_labels = set()
    profile_path = os.path.join(base_dir, "assets", "styles", "Hollow Moon", "user_terrain_profile.json")
    try:
        with open(profile_path, "r") as f:
            profile = json.load(f)
            profile_labels = set(p["label"] for p in profile)
    except:
        pass

    lines.append(f"{'Hex Type':<35} | {'Full Accuracy':<15} | {'Half Accuracy':<15} | {'Quarter Accuracy':<18} | {'Training Type'}")
    lines.append("-" * 110)
    
    for hex_base, stats in sorted(hex_stats.items()):
        f_t = stats["full_total"]
        f_c = stats["full_correct"]
        f_str = f"{f_c}/{f_t}" if f_t > 0 else "N/A"
        
        h_t = stats["half_total"]
        h_c = stats["half_correct"]
        h_str = f"{h_c}/{h_t}" if h_t > 0 else "N/A"
        
        q_t = stats["quarter_total"]
        q_c = stats["quarter_correct"]
        q_str = f"{q_c}/{q_t}" if q_t > 0 else "N/A"
        
        if layer_name == "Terrain":
            training = "Color Profile + Full Template" if hex_base in profile_labels else "Full Template Only"
        else:
            training = "Full Template Only"
            
        lines.append(f"{hex_base:<35} | {f_str:<15} | {h_str:<15} | {q_str:<18} | {training}")
    lines.append("")
    
    all_failures = []
    for stats in hex_stats.values():
        all_failures.extend(stats["failures"])
        
    return lines, all_failures

if __name__ == "__main__":
    test_partial_hexes()
