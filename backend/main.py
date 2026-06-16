import sys
import json

def process_request(data):
    action = data.get("action")
    command = data.get("command")
    
    if action == "interpret":
        import interpreter
        return interpreter.interpret_map(data)
        
    if command == "save_brush":
        import os
        import shutil
        
        uid = data.get("id")
        name = data.get("name")
        
        src_path = os.path.join("saves", ".temp_unknowns", f"{uid}.png")
        if not name.endswith(".png"):
            name += ".png"
            
        dest_path = os.path.join("assets", "tiles", "Cities", name)
        
        try:
            shutil.copy(src_path, dest_path)
            return {"status": "success"}
        except Exception as e:
            return {"status": "error", "message": str(e)}
            
    if command == "ignore_brush":
        import os
        import cv2
        import numpy as np
        
        uid = data.get("id")
        src_path = os.path.join("saves", ".temp_unknowns", f"{uid}.png")
        
        try:
            # We need to extract the ink and save it as an alpha-masked PNG in Ignored
            img = cv2.imread(src_path)
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            ink_mask = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 15, 6)
            
            # Create a 4-channel image
            b, g, r = cv2.split(img)
            bgra = cv2.merge((b, g, r, ink_mask))
            
            ignore_dir = os.path.join("assets", "tiles", "Ignored")
            os.makedirs(ignore_dir, exist_ok=True)
            
            dest_path = os.path.join(ignore_dir, f"{uid}.png")
            cv2.imwrite(dest_path, bgra)
            
            return {"status": "success"}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    response = {
        "status": "success",
        "message": "Python backend successfully received and processed the data.",
        "received_data": data
    }
    return response

if __name__ == "__main__":
    # Read from stdin
    input_data = sys.stdin.read().strip()
    if input_data:
        try:
            parsed_data = json.loads(input_data)
            result = process_request(parsed_data)
            print(json.dumps(result))
        except json.JSONDecodeError:
            print(json.dumps({"status": "error", "message": "Invalid JSON input"}))
    else:
        print(json.dumps({"status": "error", "message": "No input received"}))
