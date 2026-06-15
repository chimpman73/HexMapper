import sys
import json

def process_request(data):
    action = data.get("action")
    if action == "interpret":
        import interpreter
        return interpreter.interpret_map(data)

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
