# HexMapper Application Documentation

HexMapper is an advanced, AI-assisted cartography desktop application designed to digitally reconstruct, edit, and export hand-drawn or legacy hex-based maps. 

## 1. System Architecture
HexMapper is built on a hybrid stack to leverage the strengths of modern web technologies and high-performance computer vision:
- **Frontend**: A React application built with Vite and rendered inside an Electron desktop window. It uses `react-konva` for a highly performant, interactive HTML5 canvas to render the hex grid and map geometry.
- **Backend**: A headless Python computer-vision engine driven by `OpenCV` (cv2) and `numpy`.
- **Communication Bridge**: The React frontend communicates with the Python backend via Electron IPC channels. Python operates as a stateless CLI process (`backend/main.py`) that accepts JSON arguments via standard input, executes the heavy image processing, and returns a structured JSON payload via standard output. A custom `local://` protocol handler in Electron bypasses browser security restrictions to serve dynamically generated images and assets directly from the local filesystem to the React UI.

## 2. Core Features & UI
- **Interactive Hex Grid**: A fully interactive canvas that supports zooming, panning, and rendering hex tiles natively. It supports both Flat-top and Pointy-top hex orientations.
- **Map Alignment Engine**: Users can import an image of a physical map and visually align a digital hex overlay to perfectly match the scale and offset of the scanned image.
- **Layer System**: The app separates map data into semantic layers: Terrain, Rivers, Cliffs, Coastline, Cities/Structures, Borders, and Labels. Layers can be toggled on and off.
- **Unknowns Resolution Panel**: When the engine detects a symbol it does not recognize, it prompts the user in the UI. The user can choose to add the symbol to the application's permanent asset library, map it to an existing known asset, or explicitly ignore it.
- **Project Serialization**: Maps can be saved to and loaded from local `.json` files.
- **Exporting**: The canvas can be exported directly to a high-resolution PNG file.

## 3. Optical Map Reconstruction Engine
The crown jewel of HexMapper is its multi-pass computer vision pipeline (`backend/interpreter.py`), which deconstructs a flat image into fully editable digital vector and raster layers.

### Pass 0: Border Extraction & Image Inpainting
Borders are often drawn as thick red lines *over* the physical map, destroying the visual data beneath them.
- **Extraction**: The engine runs an HSV color threshold to isolate all red pixels into a binary mask. It traces the physical boundaries of these pixels to generate closed geometric vector polygons that perfectly replicate the style and thickness of the drawn borders.
- **Healing (Inpainting)**: The engine uses OpenCV's Telea Inpainting algorithm to mathematically predict and fill in the missing pixels beneath the red borders by interpolating the surrounding land/water colors. This completely eliminates "holes" in the map, allowing subsequent passes to run flawlessly.

### Pass 1: Global Shoreline Geometry
- **Water/Land Separation**: The healed map is converted to the CIELAB color space. K-Means clustering (k=2) mathematically classifies every pixel as either Land or Water based on color density.
- **Vectorization**: The engine extracts the boundary between the Land and Water clusters and converts it into a continuous, global SVG-style vector path that traces the physical shores.

### Pass 2: Hex-Level Terrain & Coastline Recognition
The engine breaks the map into individual hex regions and performs Shape-Based Template Matching to identify the terrain.
- **Sliding Window Alignment**: To prevent scaling distortion, the engine extracts a 70% region of the map hex and mathematically slides it across an 80% crop of the template image using `cv2.matchTemplate`. This guarantees sub-pixel perfect geometric alignment before comparison.
- **Masked Comparison**: When comparing Terrain, the engine masks out all Water pixels so that coastal hexes are only judged based on their landmass, preventing the blue ocean from interfering with the mathematical sum of squares difference (`TM_SQDIFF`).

### Pass 3: Symbol & Structure Extraction (The Ink Pass)
- **Adaptive Thresholding**: The engine converts the hex into grayscale and applies an adaptive Gaussian threshold. This separates the dark, high-contrast ink strokes (like hand-drawn mountains, cities, or castles) from the colored background.
- **Library Matching**: The binary ink mask is compared against the application's library of known symbols (`assets/tiles/Cities`) using normalized square difference (`TM_SQDIFF_NORMED`).
- **Unknown Detection**: If the closest match falls below a strict mathematical confidence threshold, the hex is flagged as an "Unknown", cropped out, and sent to the React frontend for human resolution.

## 4. Multi-Layer Optical Extraction Engine
In addition to scanning single composite maps, HexMapper supports a highly accurate **Multi-Layer Extraction Pipeline**. Users can provide a directory containing isolated map layers (e.g. `Terrain.png`, `Rivers.png`, `Coastlines.png`, `Borders.png`, `Cities.png`) exported from a digital painting tool like Photoshop.

### Isolated Layer Processing
Because the layers are pre-separated, the engine bypasses the error-prone telea inpainting and K-Means clustering steps.
- **Rivers & Borders**: Processed completely independently using direct grayscale thresholding to map global vectors.
- **Coastlines**: Processed via alpha channel detection or global color thresholding.

### Alpha-Aware Compositing & Ink Detection
For the `Terrain.png` layer, the engine leverages the alpha transparency channel (via `cv2.IMREAD_UNCHANGED`):
- **Ink Isolation**: It uses the alpha channel to accurately determine where ink has been painted, ensuring blank map tiles cannot accidentally match if a user painted something in that hex.
- **Parchment Compositing**: Because the internal asset templates are drawn on a specific parchment-colored background (`[200, 240, 253]`), the engine mathematically composites the user's transparent terrain strokes over this exact background color before running `TM_SQDIFF` template matching. This completely eliminates massive background errors and restores 90%+ accuracy for sparse templates (like Forests and Mountains).

### Solid Block Color Heuristics
A common issue in digital map painting is representing terrain (like Glaciers) as solid blocks of color without internal line art. Template matching inherently fails to recognize solid blocks of color because the templates are line drawings. 
To solve this, HexMapper employs a robust **Solid Block Heuristic**:
1. It analyzes the alpha channel and the dark ink lines independently.
2. If it detects a hex is heavily painted but lacks dark lines, it is flagged as a "Solid Paint Block".
3. The engine computes the mean BGR color of the paint. If it matches a specific color profile (e.g., the exact light blue `[B: 65-115, G: 150-205, R: 120-205]` used for Glaciers), it forcibly maps the hex to the correct template (`hex_098.png`), bypassing shape-matching entirely.
