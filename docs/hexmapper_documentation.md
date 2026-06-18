# HexMapper Application Documentation

HexMapper is an advanced, AI-assisted cartography desktop application designed to digitally reconstruct, edit, and export hand-drawn or legacy hex-based maps. 

## 1. System Architecture
HexMapper is built on a hybrid stack to leverage the strengths of modern web technologies and high-performance computer vision:
- **Frontend**: A React application built with Vite and rendered inside an Electron desktop window. The frontend adheres strictly to the Single Responsibility Principle:
  - **State Management**: Uses `Zustand` with atomic state selectors to ensure robust, fine-grained reactivity and eliminate unnecessary UI re-renders.
  - **Interaction Logic**: User interactions (panning, zooming, vector drawing, hex painting) are decoupled from the rendering components via custom hooks like `useMapInteraction`.
  - **Rendering Engine**: Utilizes `react-konva` for a highly performant HTML5 canvas. The map drawing logic is decomposed into dedicated, type-safe semantic layer components (`GridLayerRenderer`, `TerrainLayerRenderer`, `VectorLayerRenderer`).
- **Backend**: A headless Python computer-vision engine driven by `OpenCV` (cv2) and `numpy`.
- **Communication Bridge**: The React frontend communicates with the Python backend via Electron IPC channels. Python operates as a stateless CLI process (`backend/main.py`) that accepts JSON arguments via standard input, executes the heavy image processing, and returns a structured JSON payload via standard output. A custom `local://` protocol handler in Electron bypasses browser security restrictions to serve dynamically generated images and assets directly from the local filesystem to the React UI.

## 2. Core Features & UI
- **Interactive Hex Grid**: A fully interactive canvas that supports zooming, panning, and rendering hex tiles natively. It supports both Flat-top and Pointy-top hex orientations.
- **Map Alignment Engine**: Users can import an image of a physical map and visually align a digital hex overlay to perfectly match the scale and offset of the scanned image. Importing a directory of layers will spawn synchronized `BgImageLayer` items for each source file to allow easy cross-referencing.
- **Layer System & Management**: The app separates map data into 8 semantic layers with a strict top-to-bottom visual hierarchy (Z-index): Labels, Borders, Hex Grid, Cities/Structures, Rivers, Cliffs, Coastline, and Terrain. 
  - The dynamic **Layer Panel UI** allows users to visually reorder layers via Up/Down buttons, create new layers, delete unneeded layers, and toggle visibility. 
  - Users can double-click any layer name in the panel to instantly rename it directly on the canvas.
- **Unknowns Resolution Panel**: When the engine detects a symbol it does not recognize, it prompts the user in the UI. The user can choose to add the symbol to the application's permanent asset library, map it to an existing known asset, or explicitly ignore it.
- **Project Serialization**: Maps can be saved to and loaded from local `.json` files.
- **Exporting**: The canvas can be exported directly to a high-resolution PNG file.

## 3. Optical Map Reconstruction Engine
The crown jewel of HexMapper is its multi-pass computer vision pipeline. The engine operates using a modular, object-oriented architecture with strict type-safety to enforce the Single Responsibility Principle:
- **`template_manager.py`**: Loads, caches, and pre-processes template tiles, isolating alpha channels and computing inherent ink masks.
- **`image_processor.py`**: Handles the heavyweight OpenCV operations, masking out regions, contour analysis for vectors, and image inpainting.
- **`hex_grid.py`**: Encapsulates all mathematical conversions between axial hex coordinates and pixel space for various orientations.
- **`hex_scanner.py`**: Performs the sliding-window template matching algorithm over the mapped hex grid to classify terrain, coastlines, and cities.
- **`interpreter.py`**: A lightweight orchestrator that initializes the pipeline, connects the components, and specifically catches internal errors (like `cv2.error` or `FileNotFoundError`).

These components work together to deconstruct a flat image into fully editable digital vector and raster layers.
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

### Multi-File Sub-Layer Extraction
The extraction engine dynamically processes an unlimited number of isolated files belonging to the same layer type. For example, a user can provide `Terrain_Forest.png` and `Terrain_Desert.png` or `Coastline_1.png` and `Coastline_2.png`. 
- The engine optically extracts data from each file sequentially.
- It seamlessly merges the result back into the frontend UI, preserving them as distinct layers with names mapped directly to the original file names (e.g. `Terrain_Forest`).
- An intelligent `sourceFilename` anchor guarantees that even if a user manually renames a layer in the UI (e.g. to "Whispering Woods"), subsequent rescan operations will successfully locate and `.update()` that exact layer instead of improperly overriding data.
- **Precision Masking & Clipping**: When multiple layers of the same type (like Coastlines) overlap, they are processed with rigorous mathematical boundaries. The optical scanner utilizes exact geometric polygon tracing rather than rectangular bounding boxes to completely eliminate neighboring-hex "ghost" artifacts. Furthermore, the React renderer processes overlapping coastline vectors by calculating their signed area via the Shoelace Formula to enforce a uniform clockwise winding direction. This guarantees that when clipped with the default `nonzero` Canvas winding rule, intersecting landmasses correctly merge into solid, unified shapes instead of slicing holes through each other, avoiding severe performance degradation and visual artifacts.

### Alpha-Aware Compositing & Ink Detection
For the `Terrain.png` layer, the engine leverages the alpha transparency channel (via `cv2.IMREAD_UNCHANGED`):
- **Ink Isolation**: It uses the alpha channel to accurately determine where ink has been painted, ensuring blank map tiles cannot accidentally match if a user painted something in that hex.
- **Parchment Compositing**: Because the internal asset templates are drawn on a specific parchment-colored background (`[200, 240, 253]`), the engine mathematically composites the user's transparent terrain strokes over this exact background color before running `TM_SQDIFF` template matching. This completely eliminates massive background errors and restores 90%+ accuracy for sparse templates (like Forests and Mountains).

### Machine Learning Terrain Classification (k-NN Profile Engine)
A common issue in digital map painting is representing terrain (like Glaciers or Forests) as solid blocks of color or custom brush strokes that lack internal line art. OpenCV Template matching inherently fails on these hexes because the templates are precise line drawings. 

To solve this, HexMapper employs a **Machine Learning Terrain Profile Engine**:
1. **Offline Training (`backend/train_profile.py`)**: Users can supply a manually corrected `.json` map alongside their `Terrain.png` layer. The trainer script parses the map using the specific scale factor (`bgScaleX/Y`) to perfectly isolate the pixels of every painted hex. It extracts the **mean BGR color** and the **Laplacian variance** (texture roughness) for every terrain type and saves it to a style-specific `assets/styles/<style>/user_terrain_profile.json` knowledge base.
2. **Runtime Classification**: During the scan, HexMapper extracts the color and variance of each unknown painted hex. It uses a **K-Nearest Neighbors (k-NN)** distance algorithm to compare the hex's features against the trained profile.
3. **Template Bypass**: If the distance to a trained label is extremely small (highly confident), the engine forcibly maps the hex to that terrain type, bypassing OpenCV shape-matching entirely. This guarantees near-perfect accuracy for custom brush strokes and flat colors.

## 5. Map Styles Architecture
To support dynamic aesthetic themes across the entire mapping platform, HexMapper implements a scalable Map Styles engine:
- **Dynamic Asset Resolution:** Hardcoded tile paths are replaced with relative internal templates (e.g. `"Terrain/hex_101.png"`). At render-time, these are intelligently intercepted and encoded by the `HexGridEngine` and UI Palette into absolute `local://` URLs pointing to the active style's directory (e.g. `assets/styles/Hollow Moon/tiles/`).
- **Real-Time Swapping:** Users can change the active Map Style via a central UI dropdown. Because the extracted map JSON strictly saves the *template keys* rather than absolute file references, swapping the style instantly recalculates all asset sources across the grid, allowing seamless visual overhauls of massive maps with zero re-scanning.
- **Extensibility:** New styles can be added simply by dropping a new folder containing the appropriately categorized tile subfolders into `assets/styles/`. 

## 6. Advanced Vector Drawing (Roads & Rivers)
HexMapper includes a robust, vector-based drawing system for Roads and Rivers that integrates cleanly into the map styles.
- **Dynamic Styling Configuration**: Roads, paths, tunnels, streams, and rivers are defined and stylized globally via `roads.json` and `rivers.json` configuration files located in the active style's directory. This allows different Map Styles to define their own specific colors, dash arrays, and stroke widths without modifying application code.
- **Hex Brush UI**: The vector toolset automatically parses the configuration files and generates dynamic `<canvas>` thumbnails of hex tiles painted with the appropriate path styles over a configurable background color, providing an intuitive, visually unified palette.
- **Highlight Mode**: The road and river palettes include a specialized Highlight tool. When active, it renders all vectors on the canvas with a bright, glowing yellow halo using shadow blur. This allows users to easily locate tiny paths or complex networks hidden underneath dense terrain.
- **Spline Anchor Editing**: The vector drawing system has been built for precise manipulation:
  - **Point-by-Point Drawing**: Users can click to drop anchor vertices, rubber-banding the line segment by segment. Double-clicking commits the vector to the canvas. Pressing `ESC` or right-clicking at any time cancels the drawing.
  - **Node Editing**: Selecting an existing road or river enters "Edit Mode". White circular anchor nodes appear at every vertex. Users can drag these nodes in real-time to reshape the path.
  - **Node Insertion**: Double-clicking on the line dynamically inserts a new anchor node at that specific position for finer control.

## 7. Extracted Vector Injection
When the Optical Map Reconstruction Engine scans an image (such as the Global Shoreline or Rivers pass), the resulting raw coordinate data is seamlessly converted into standard, editable `VectorLine` objects.
- **River Extraction**: During the final compilation stage of the scanner, the raw array of river paths is intercepted and formatted into vector lines. These lines are injected directly into the active `river` layer. This allows the user to immediately utilize the **Spline Anchor Editing** tools to refine or correct the automatically extracted rivers as if they had drawn them by hand.
