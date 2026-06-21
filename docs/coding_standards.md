# HexMapper Coding Standards & Mandates (LLM Optimized)

This document provides explicit, high-signal instructions for AI models working on the HexMapper project. Adherence to these mandates is non-negotiable.

## 1. Core Architectural Mandates (Hybrid Electron + Python)
*   **Root Directory Cleanliness:** The project root is reserved for entry points, configuration (e.g., `package.json`, `main.js`), and build scripts. 
*   **Dedicated Layout:**
    *   `src/main/`: Electron main process code (Node.js).
    *   `src/renderer/`: React/TypeScript frontend code for the UI and map rendering.
    *   `backend/`: Python backend for AI interpretation, ML segmentation, and heavy file processing (PSD/PDF).
    *   `docs/`: Documentation and specifications.
*   **Inter-Process Communication (IPC):** Use Electron IPC for communication between the React renderer and the Electron main process. The main process manages the lifecycle of the Python backend and proxies requests via stdin/stdout. **MANDATORY:** All IPC handlers must return responses conforming to the `IpcResponse<T>` schema (`{ success: boolean, data?: T, error?: string, code?: string }`). Unhandled promise rejections must be caught and gracefully surfaced to the UI via the global toast notification system (`useMapStore().setToastMessage({ type: 'error', text: ... })`).
*   **Relative Paths:** **MANDATORY.** Never use absolute paths.

## 2. Object-Oriented Programming (OOP) & S.O.L.I.D.
*   **One Class/Component Per File:** Every logical unit must be its own file.
*   **Single Responsibility Principle:** One class/component = One specific purpose. Is it Modular? (e.g. `LayerPalette` should be composed of sub-palettes like `RoadPalette`, `RiverPalette` rather than one monolithic file; similarly, complex hooks like `useMapInteraction` should compose smaller hooks like `useHexPainter`, `useVectorDrawer`).
*   **Encapsulation:** 
    *   **Python:** Prefix internal attributes with `_`. Use `@property` for controlled access.
    *   **JS/TS:** Use `#` for private fields or standard conventions.
*   **Dependency Injection:** Pass dependencies as arguments or React props.

## 3. Python Backend Standards
*   **Purpose:** The Python backend is strictly for computationally heavy tasks: map/image interpretation (OpenCV/PyTorch), and complex file export (PSD, PDF).
*   **Type Hinting:** Use Python type hints (`typing` module) for all function signatures and class attributes.
*   **Virtual Environment:** All Python code must run within an isolated virtual environment (`venv`).
*   **Error Handling:** Use specific exception types. Python endpoints must return standardized dictionary objects conforming to the `IpcResponse` schema (e.g. `{"success": False, "error": "msg", "code": "ERR_CODE"}`). Never allow raw Python stack traces to silently crash the process without returning a structured JSON error response.

## 4. Frontend (React/TypeScript) & Electron Standards
*   **Centralized Types:** Import shared TS interfaces (especially those matching Python data structures) from a central `types/` directory to ensure parity between Python and TS.
*   **Naming:** 
    *   `camelCase` for variables, functions, and methods.
    *   `PascalCase` for Classes, React Components, and TS Types.
    *   `SCREAMING_SNAKE_CASE` for global constants.
    *   `kebab-case` or `PascalCase` for React component filenames (be consistent).
*   **State Management:** Keep local state in components where possible; use a lightweight global store (e.g., Zustand) or React Context for global map state (layers, active tool, hex grid config).
*   **Graphics/Canvas:** Encapsulate all Canvas/WebGL logic (e.g., PixiJS, Konva.js) into dedicated rendering components to separate them from standard UI layout controls.

## 5. File Export & Image Interpretation
*   **Data Serialization:** When passing map data between React and Python, use optimized JSON structures representing the layers and geometry. Base64 encode images only when necessary, otherwise pass local file paths.
*   **Stateless Processing:** Python endpoints/functions should ideally be stateless, taking input data (or file paths) and returning the processed result without relying on hidden global state.

## 6. Implementation Checklist
1.  **Is it Modular?** Is the UI separated from graphics rendering and backend processing?
2.  **Is it Validated?** Are IPC messages and JSON payloads validated before processing?
3.  **Are Paths Relative?** Does it avoid hardcoded machine-specific paths?
4.  **Error Handling?** Does it gracefully handle Python crashes or image processing failures in the UI?
