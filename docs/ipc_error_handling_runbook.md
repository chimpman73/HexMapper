# IPC Error Handling Runbook

This document explains the standard process for debugging Inter-Process Communication (IPC) and Python backend errors in HexMapper.

## The `IpcResponse` Standard

All Electron IPC handlers now return a standardized `IpcResponse<T>` object defined in `src/renderer/types/index.ts`:

```typescript
export interface IpcResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  canceled?: boolean;
}
```

Whenever the frontend invokes `window.api.*`, you **must** check `res.success` before using `res.data`. If it fails, `res.error` will contain a descriptive string, and `res.code` will indicate the failure type.

## Surfacing Errors in the UI

Instead of using `console.error` or letting unhandled Promise rejections crash the frontend, dispatch errors to the new global Toast notification system:

```typescript
import { useMapStore } from './store/mapStore';

const MyComponent = () => {
  const { setLastError } = useMapStore();

  const handleAction = async () => {
    const res = await window.api.runPythonScript({ command: 'my_cmd' });
    if (!res.success) {
      setLastError(res.error || 'Unknown IPC Error');
      return;
    }
    // Proceed with res.data
  };
}
```

## Common Error Codes

- **`PYTHON_EXIT_ERROR`**: The Python script returned a non-zero exit code. Check `res.error` for the `stderr` stack trace.
- **`PYTHON_TIMEOUT`**: The Python process took longer than 60 seconds. Usually indicates an infinite loop in the CV pipeline or waiting on un-sent stdin.
- **`INVALID_JSON`**: The Python script output printed something that wasn't valid JSON. Often happens if Python prints a generic `print()` debug statement before the final JSON payload. **Rule of thumb: Never use `print()` in the Python backend unless it's the final JSON string.**
- **`OPENCV_ERROR`**: Caught internally by `interpreter.py` when an image matrix operation fails.
- **`INVALID_ARGS`**: The Electron IPC handler blocked the request because the arguments were malformed.

## Diagnosing Backend Crashes

1. **Check the UI Toast**: The toast usually contains the raw Python traceback if it was an internal exception.
2. **Reproduce via CLI**: If the UI error is insufficient, you can reproduce the error by bypassing Electron entirely:
   ```bash
   # Run the backend manually and pass a JSON payload
   echo '{"action": "interpret", "imagePath": "..."}' | python backend/main.py
   ```
3. **No Output / Hanging**: If Python hangs, check if your script is waiting on stdin and you failed to send the newline character or `stdin.end()` in `main.ts`.

## Legacy Integration
The Python `main.py` entrypoint still supports returning old `{ status: "success" }` dicts from legacy scripts (like `brush_manager.py`), but automatically wraps them in the `IpcResponse` format before sending them to `stdout`. When writing new backend Python features, try to return `{"success": True, "data": ...}` natively.
