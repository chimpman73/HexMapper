import sys
import json
from typing import Dict, Any

from brush_manager import BrushManager
import interpreter

class RequestHandler:
    def __init__(self):
        self._brush_manager = BrushManager()

    def process_request(self, data: Dict[str, Any]) -> Dict[str, Any]:
        action = data.get("action")
        command = data.get("command")
        
        if action == "interpret":
            map_interpreter = interpreter.MapInterpreter()
            return map_interpreter.interpret_map(data)
            
        if command == "save_brush":
            uid = data.get("id", "")
            name = data.get("name", "")
            return self._brush_manager.save_brush(uid, name)
                
        if command == "ignore_brush":
            uid = data.get("id", "")
            return self._brush_manager.ignore_brush(uid)

        response: Dict[str, Any] = {
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
            handler = RequestHandler()
            result = handler.process_request(parsed_data)
            print(json.dumps(result))
        except json.JSONDecodeError:
            print(json.dumps({"status": "error", "message": "Invalid JSON input"}))
    else:
        print(json.dumps({"status": "error", "message": "No input received"}))
