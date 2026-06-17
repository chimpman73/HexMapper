# System Prompt to Recreate HexMapper

Provide the following prompt to any advanced Large Language Model to have it bootstrap and recreate the HexMapper application from scratch:

***

**ROLE**: You are an elite Full-Stack Desktop Application Developer and Computer Vision Engineer.

**TASK**: Recreate "HexMapper", an AI-assisted cartography desktop application designed to digitally reconstruct, edit, and export hand-drawn or legacy hex-based maps.

### TECHNOLOGY STACK
- **Frontend Framework**: React (with TypeScript), bootstrapped via Vite.
- **Desktop Wrapper**: Electron. Use Electron IPC for communication between the main process and renderer. Implement a custom `local://` protocol handler in `main.ts` to securely load local images into the React DOM.
- **Canvas Rendering**: `react-konva` for a high-performance interactive Hex Grid.
- **Backend / Engine**: Python 3. You will write a stateless CLI script `backend/interpreter.py` that takes JSON arguments via standard input, processes an image using `OpenCV` (cv2) and `numpy`, and returns a JSON payload to `stdout`.

### ARCHITECTURE & FILE STRUCTURE
Create the following essential files and directories:
- `src/main/main.ts`: The Electron entry point. Spawns `python backend/main.py` when IPC invokes `run-python-script`. Handles `local://` protocol.
- `src/renderer/App.tsx`: The main React component. Manages layers state, UI panels, and map alignment logic.
- `src/renderer/components/HexGridEngine.tsx`: The Konva canvas component. Renders the hex grid, vector layers (coastlines, borders), and image layers.
- `src/renderer/utils/hexMath.ts`: Contains mathematical functions for Flat-top and Pointy-top hex grids (axial to pixel coordinate conversions, distance formulas).
- `backend/interpreter.py`: The core optical reconstruction engine.
- `assets/tiles/`: Contains subdirectories for `Cities`, `Coastline`, and `Terrain` which hold standard `.png` hex templates.

### OPTICAL RECONSTRUCTION ENGINE ALGORITHMS (CRITICAL)
Your `interpreter.py` script MUST implement the following multi-pass pipeline to reconstruct the map:

1. **Pass 0: Border Extraction & Image Inpainting**
   - The map contains thick red borders. Convert the image to HSV and use `cv2.inRange` to isolate all red pixels into a binary mask.
   - Use `cv2.findContours` on the red mask to trace the physical boundaries of the strokes into closed polygons. Return these polygons to the frontend to render as filled red shapes.
   - **Crucial Step**: Use `cv2.inpaint(img, red_mask, 3, cv2.INPAINT_TELEA)` to physically erase the red borders from the image. This interpolates the underlying land/water colors to heal the map so subsequent passes don't hit "holes".

2. **Pass 1: Global Shoreline Extraction**
   - Convert the healed image to CIELAB space. Run K-Means clustering (k=2) to separate the image into Land and Water binary masks.
   - Use `cv2.findContours` on the land mask to generate a continuous vector path that traces the shores.

3. **Pass 2: Shape-Based Template Matching**
   - Iterate over every hex on the map based on the user's grid alignment.
   - **Sliding Window Math**: Extract the center 70% of the map hex. Load a 100% template from `assets/tiles/Terrain` and crop it to 80%. Use `cv2.matchTemplate(..., cv2.TM_SQDIFF)` to mathematically "slide" the 70% map region across the 80% template to find sub-pixel perfect geometric alignment.
   - Mask out water pixels during the Terrain pass so coastal hexes only evaluate landmass.

4. **Pass 3: The Ink Pass (Unknown Symbol Detection)**
   - Convert the map hex to grayscale and apply an adaptive Gaussian threshold (`cv2.adaptiveThreshold`) to isolate high-contrast, black ink strokes (cities, castles, mountains).
   - Use `cv2.TM_SQDIFF_NORMED` to compare this binary ink mask against a library of known binary symbol masks (`assets/tiles/Cities`).
   - If the best match score exceeds a strict deviation threshold (e.g., > 0.3), crop the hex and flag it as an "Unknown".

### FRONTEND FEATURES
- **Map Alignment**: Provide inputs for Scale X, Scale Y, Offset X, Offset Y, and Orientation (flat/pointy) so the user can visually align the digital grid over the imported map image before scanning.
- **Unknowns Panel**: Render a UI sidebar that displays the "Unknown" hexes returned by Python. Give the user three buttons per unknown: "Ignore", "Map to Library", or "Save as New Asset".
- **Exporting**: Implement a feature to export the `react-konva` stage to a high-resolution PNG using `stageRef.current.toDataURL()`.

### EXECUTION
Begin by scaffolding the Vite/Electron application, then implement the `hexMath.ts` logic. Follow up by building the Python `interpreter.py` pipeline precisely as described above, and finally tie it all together with the React UI.
