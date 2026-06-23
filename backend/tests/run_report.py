import json
import os
import sys
import glob

# Add backend to path so we can import interpreter directly
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import interpreter

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
TESTS_DIR = os.path.dirname(os.path.abspath(__file__))
GOLDEN_DIR = os.path.join(TESTS_DIR, "goldenfiles")
SCALE_FACTOR = 2.09

def parse_layers(layers):
    data = {
        'smooth_borders': 0,
        'snapped_borders': 0,
        'rivers': 0,
        'terrain_layers': {},
        'coastline_layers': {},
        'city_layers': {},
        'cliffs': 0,
        'roads': 0
    }
    
    for layer in layers:
        l_type = layer.get('type')
        l_data = layer.get('data', [])
        l_name = layer.get('name', 'Unknown')
        
        if l_type == 'border':
            for b in l_data:
                if b.get('borderStyle') == 'snapped':
                    data['snapped_borders'] += 1
                else:
                    data['smooth_borders'] += 1
        elif l_type == 'river':
            data['rivers'] += len(l_data)
        elif l_type == 'coastline':
            data['coastline_layers'][l_name] = len(l_data)
        elif l_type == 'cliff':
            if isinstance(l_data, dict):
                data['cliffs'] += len(l_data.get('lines', []))
            else:
                data['cliffs'] += len(l_data)
        elif l_type == 'terrain':
            data['terrain_layers'][l_name] = l_data
        elif l_type == 'city':
            data['city_layers'][l_name] = l_data
        elif l_type == 'road':
            data['roads'] += len(l_data)
            
    return data

def main():
    gold_files = glob.glob(os.path.join(GOLDEN_DIR, "outputs", "*_MultiLayer.json"))
    
    results = {}
    
    for gold_path in gold_files:
        basename = os.path.basename(gold_path)
        map_name = basename.split('_')[0]
        
        # Find input folder
        input_folders = glob.glob(os.path.join(GOLDEN_DIR, "inputs", f"{map_name}*"))
        if not input_folders:
            print(f"Skipping {map_name}: no input folder found.")
            continue
        input_path = input_folders[0]
        
        with open(gold_path, "r") as f:
            gold_json = json.load(f)
            
        gold_layers = gold_json.get("layers", [])
        gold_data = parse_layers(gold_layers)
        gold_data['unknowns'] = len(gold_json.get("unknowns", []))
        map_width = gold_json.get("mapWidth", 0)
        map_height = gold_json.get("mapHeight", 0)
        
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
        print(f"Running MapInterpreter on {map_name}...")
        result = map_interpreter.interpret_map(args)
        
        if result.get("status") != "success":
            print(f"Error processing {map_name}: {result.get('message')}")
            continue
            
        out_layers = result["data"].get("layers", [])
        out_data = parse_layers(out_layers)
        out_data['unknowns'] = len(result["data"].get("unknowns", []))
        
        results[map_name] = {
            'gold': gold_data,
            'out': out_data
        }
        
    # Print Table
    if not results:
        print("No results to display.")
        return
        
    map_names = list(results.keys())
    
    output_lines = []
    # Header
    col_width = 25
    header = f"{'Test':<30}" + "".join([f"{name:<{col_width}}" for name in map_names])
    output_lines.append("\n" + "=" * len(header))
    output_lines.append(header)
    output_lines.append("-" * len(header))
    
    # Rows
    def get_status(actual, expected):
        if expected == 0:
            return "PASS" if actual == 0 else "FAIL"
        if actual == expected:
            return "PASS"
        ratio = actual / expected
        if 0.8 <= ratio < 1.0:
            return "WARN"
        return "FAIL"
        
    def print_row(test_name, key):
        row = f"{test_name:<30}"
        for name in map_names:
            expected = results[name]['gold'][key]
            actual = results[name]['out'][key]
            status = get_status(actual, expected)
            cell = f"{actual}/{expected} {status}"
            row += f"{cell:<{col_width}}"
        output_lines.append(row)
        
    print_row("Borders (Smooth)", 'smooth_borders')
    print_row("Borders (Snapped)", 'snapped_borders')
    print_row("Rivers (Count)", 'rivers')
    
    all_terrain_names = set()
    for name in map_names:
        all_terrain_names.update(results[name]['gold']['terrain_layers'].keys())
        all_terrain_names.update(results[name]['out']['terrain_layers'].keys())
        
    for t_name in sorted(list(all_terrain_names)):
        row_t = f"{'Terrain: ' + t_name[:20]:<30}"
        for name in map_names:
            g_terrains = results[name]['gold']['terrain_layers']
            o_terrains = results[name]['out']['terrain_layers']
            
            if t_name in g_terrains and t_name in o_terrains:
                expected = len(g_terrains[t_name])
                matched = 0
                for k in g_terrains[t_name]:
                    if k in o_terrains[t_name]:
                        matched += 1
                status = get_status(matched, expected)
                cell = f"{matched}/{expected} {status}"
            elif t_name in g_terrains:
                expected = len(g_terrains[t_name])
                cell = f"0/{expected} FAIL"
            elif t_name in o_terrains:
                actual = len(o_terrains[t_name])
                cell = f"{actual}/0 FAIL"
            else:
                cell = "-"
            row_t += f"{cell:<{col_width}}"
        output_lines.append(row_t)

    all_city_names = set()
    for name in map_names:
        all_city_names.update(results[name]['gold']['city_layers'].keys())
        all_city_names.update(results[name]['out']['city_layers'].keys())
        
    for c_name in sorted(list(all_city_names)):
        row_c = f"{'City: ' + c_name[:22]:<30}"
        for name in map_names:
            g_cities = results[name]['gold']['city_layers']
            o_cities = results[name]['out']['city_layers']
            
            if c_name in g_cities and c_name in o_cities:
                expected = len(g_cities[c_name])
                matched = 0
                for k in g_cities[c_name]:
                    if k in o_cities[c_name]:
                        matched += 1
                status = get_status(matched, expected)
                cell = f"{matched}/{expected} {status}"
            elif c_name in g_cities:
                expected = len(g_cities[c_name])
                cell = f"0/{expected} FAIL"
            elif c_name in o_cities:
                actual = len(o_cities[c_name])
                cell = f"{actual}/0 FAIL"
            else:
                cell = "-"
            row_c += f"{cell:<{col_width}}"
        output_lines.append(row_c)

    all_coastline_names = set()
    for name in map_names:
        all_coastline_names.update(results[name]['gold']['coastline_layers'].keys())
        all_coastline_names.update(results[name]['out']['coastline_layers'].keys())
        
    for c_name in sorted(list(all_coastline_names)):
        row_c = f"{'Coastline: ' + c_name[:18]:<30}"
        for name in map_names:
            g_coastlines = results[name]['gold']['coastline_layers']
            o_coastlines = results[name]['out']['coastline_layers']
            
            if c_name in g_coastlines and c_name in o_coastlines:
                expected = g_coastlines[c_name]
                actual = o_coastlines[c_name]
                status = get_status(actual, expected)
                cell = f"{actual}/{expected} {status}"
            elif c_name in g_coastlines:
                expected = g_coastlines[c_name]
                cell = f"0/{expected} FAIL"
            elif c_name in o_coastlines:
                actual = o_coastlines[c_name]
                cell = f"{actual}/0 FAIL"
            else:
                cell = "-"
            row_c += f"{cell:<{col_width}}"
        output_lines.append(row_c)

    print_row("Cliffs (Count)", 'cliffs')
    print_row("Roads (Count)", 'roads')
    print_row("Unknowns (Count)", 'unknowns')
    output_lines.append("=" * len(header) + "\n")
    
    for line in output_lines:
        print(line)
        
    import datetime
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    results_dir = os.path.join(TESTS_DIR, "results")
    os.makedirs(results_dir, exist_ok=True)
    out_path = os.path.join(results_dir, f"run_report_{timestamp}.txt")
    with open(out_path, "w") as f:
        f.write("\n".join(output_lines) + "\n")
    print(f"Saved report to {out_path}")

if __name__ == '__main__':
    main()
