import pytest
import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import interpreter

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SAVES_DIR = os.path.join(BASE_DIR, "backend", "tests", "saves")
SCALE_FACTOR = 1.0

def test_cliff_extraction():
    # Cliffs should be a single continuous path, ignoring perpendicular hachures.
    input_path = os.path.join(SAVES_DIR, "SyntheticCliffs")
    
    args = {
        "mode": "multi_layer",
        "imagePath": input_path,
        "bgScaleX": SCALE_FACTOR,
        "bgScaleY": SCALE_FACTOR,
        "mapWidth": 10,
        "mapHeight": 10
    }
    
    map_interpreter = interpreter.MapInterpreter()
    result = map_interpreter.interpret_map(args)
    assert result.get("status") == "success", result.get("message")
    
    # We want to check how many lines the layer assembler produced for cliffs.
    # The output format is data["layers"], we find the cliff layer.
    cliff_layer = next((l for l in result["data"]["layers"] if l["type"] == "cliff"), None)
    assert cliff_layer is not None, "Cliff layer not found"
    
    lines = cliff_layer["data"].get("lines", [])
    
    # There should only be 1 main line extracted, the hachures should be ignored.
    assert len(lines) == 1, f"Expected 1 continuous cliff line, found {len(lines)}"

def test_border_snapping():
    # Borders MUST be forcibly snapped to the hex grid. 
    # This means tension == 0 and borderStyle == 'snapped'.
    input_path = os.path.join(SAVES_DIR, "SyntheticBorders")
    
    args = {
        "mode": "multi_layer",
        "imagePath": input_path,
        "bgScaleX": SCALE_FACTOR,
        "bgScaleY": SCALE_FACTOR,
        "mapWidth": 10,
        "mapHeight": 10
    }
    
    map_interpreter = interpreter.MapInterpreter()
    result = map_interpreter.interpret_map(args)
    assert result.get("status") == "success", result.get("message")
    
    border_layer = next((l for l in result["data"]["layers"] if l["type"] == "border"), None)
    assert border_layer is not None, "Border layer not found"
    
    borders = border_layer["data"]
    assert len(borders) > 0, "No borders extracted"
    
    smooth_count = 0
    for b in borders:
        if b.get("borderStyle") == "smooth" or b.get("tension") != 0:
            smooth_count += 1
            
    assert smooth_count == 0, f"Found {smooth_count} smooth borders! All borders must be snapped to grid."

def test_river_snapping():
    # Rivers should snap their endpoints to the nearest coastline if they are close.
    input_path = os.path.join(SAVES_DIR, "SyntheticWater")
    
    args = {
        "mode": "multi_layer",
        "imagePath": input_path,
        "bgScaleX": SCALE_FACTOR,
        "bgScaleY": SCALE_FACTOR,
        "mapWidth": 10,
        "mapHeight": 10
    }
    
    map_interpreter = interpreter.MapInterpreter()
    result = map_interpreter.interpret_map(args)
    assert result.get("status") == "success", result.get("message")
    
    river_layer = next((l for l in result["data"]["layers"] if l["type"] == "river"), None)
    assert river_layer is not None, "River layer not found"
    
    rivers = river_layer["data"]
    assert len(rivers) > 0, "No rivers extracted"
    
    # The river endpoint was drawn at y=230, and the coastline is a rectangle starting at y=250.
    # The math in layer_assembler should have snapped the endpoint to y=250.
    river_points = rivers[0]["points"]
    end_y = river_points[-1]
    
    # We expect the snapped y-coordinate to be approximately 250
    assert abs(end_y - 250) < 5, f"River endpoint did not snap to coastline! Expected ~250, got {end_y}"
