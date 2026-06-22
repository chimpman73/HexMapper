from typing import Dict, Any
from brush_manager import BrushManager
import interpreter

class Router:
    def __init__(self, base_dir: str) -> None:
        self._brush_manager = BrushManager(base_dir)

    def route_request(self, data: Dict[str, Any]) -> Dict[str, Any]:
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

        return {
            "success": True,
            "data": {
                "message": "Python backend successfully received and processed the data.",
                "received_data": data
            }
        }
