import sys
import os
import json
from typing import Dict, Any

from router import Router

if __name__ == "__main__":
    # Read from stdin
    input_data = sys.stdin.read().strip()
    if input_data:
        try:
            parsed_data = json.loads(input_data)
            if not isinstance(parsed_data, dict):
                print(json.dumps({"success": False, "error": "Input JSON must be an object", "code": "INVALID_JSON"}))
                sys.exit(0)
                
            if len(sys.argv) > 1:
                base_dir = sys.argv[1]
            else:
                print(json.dumps({"success": False, "error": "App path not provided", "code": "MISSING_ARG"}))
                sys.exit(0)
                
            router = Router(base_dir)
            result = router.route_request(parsed_data)
            
            print(json.dumps(result))
        except json.JSONDecodeError:
            print(json.dumps({"success": False, "error": "Invalid JSON input", "code": "INVALID_JSON"}))
        except Exception as e:
            import traceback
            print(json.dumps({"success": False, "error": str(e), "code": "INTERNAL_ERROR", "trace": traceback.format_exc()}))
    else:
        print(json.dumps({"success": False, "error": "No input received", "code": "NO_INPUT"}))
