import sys
import os
import json
from typing import Dict, Any

from brush_manager import BrushManager
import interpreter

class RequestHandler:
    def __init__(self, base_dir: str) -> None:
        self._brush_manager = BrushManager(base_dir)

    def process_request(self, data: Dict[str, Any]) -> Dict[str, Any]:
        action = data.get("action")
        command = data.get("command")
        
        if action == "interpret":
            map_interpreter = interpreter.MapInterpreter()
            return map_interpreter.interpret_map(data)
            
        if command == "save_brush":
            uid = data.get("id", "")
            name = data.get("name", "")
            result = self._brush_manager.save_brush(uid, name)
            if result.get("status") == "success":
                return {"success": True, "data": result}
            else:
                return {"success": False, "error": result.get("message", "Unknown error"), "code": "BRUSH_ERROR"}
                
        if command == "ignore_brush":
            uid = data.get("id", "")
            result = self._brush_manager.ignore_brush(uid)
            if result.get("status") == "success":
                return {"success": True, "data": result}
            else:
                return {"success": False, "error": result.get("message", "Unknown error"), "code": "BRUSH_ERROR"}

        response: Dict[str, Any] = {
            "success": True,
            "data": {
                "message": "Python backend successfully received and processed the data.",
                "received_data": data
            }
        }
        return response

if __name__ == "__main__":
    # Read from stdin
    input_data = sys.stdin.read().strip()
    if input_data:
        try:
            parsed_data = json.loads(input_data)
            if not isinstance(parsed_data, dict):
                print(json.dumps({"success": False, "error": "Input JSON must be an object", "code": "INVALID_JSON"}))
                sys.exit(0)
                
            base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            handler = RequestHandler(base_dir)
            result = handler.process_request(parsed_data)
            
            # Legacy conversion for interpreter/brush_manager if they didn't return success explicitly
            if "success" not in result:
                if result.get("status") == "error":
                    result = {"success": False, "error": result.get("message", "Unknown error"), "code": "BACKEND_ERROR", "data": {"trace": result.get("trace")}}
                else:
                    result = {"success": True, "data": result}
                    
            print(json.dumps(result))
        except json.JSONDecodeError:
            print(json.dumps({"success": False, "error": "Invalid JSON input", "code": "INVALID_JSON"}))
    else:
        print(json.dumps({"success": False, "error": "No input received", "code": "NO_INPUT"}))
