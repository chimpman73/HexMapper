import sys, os, time, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from main import handle_interpret

def run():
    args = {
        "action": "interpret",
        "mode": "reimport_layer",
        "imagePath": os.path.join(os.path.dirname(os.path.abspath(__file__)), "tests/goldenfiles/inputs/Albheldri_MultiLayer.png"),
        "bgScaleX": 1.0,
        "bgScaleY": 1.0,
        "bgOffsetX": 0.0,
        "bgOffsetY": 0.0,
        "mapWidth": 50,
        "mapHeight": 25,
        "orientation": "flat",
        "layers": []
    }
    
    t0 = time.time()
    res = handle_interpret(args, os.path.dirname(os.path.abspath(__file__)))
    t1 = time.time()
    
    print('Scan took', t1-t0, 'seconds')

run()
