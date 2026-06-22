# HexMapper Application Documentation

HexMapper is an advanced, AI-assisted cartography desktop application designed to digitally reconstruct, edit, and export hand-drawn or legacy hex-based maps. 

## 1. System Architecture
HexMapper is built on a hybrid stack to leverage the strengths of modern web technologies and high-performance computer vision:
- **Frontend**: A React application built with Vite and rendered inside an Electron desktop window. The frontend adheres strictly to the Single Responsibility Principle:
  - **State Management**: Uses `Zustand` with atomic state selectors to ensure robust, fine-grained reactivity and eliminate unnecessary UI re-renders.
  - **Interaction Logic**: User interactions (panning, zooming, vector drawing, hex painting) are decoupled from the rendering components via custom hooks. `useMapInteraction` acts as a facade that orchestrates sub-hooks: `useMapViewport` (zoom/pan), `useHexPainter` (hex placement), and `useVectorDrawer` (vector paths and snapping).
  - **Rendering Engine**: Utilizes `react-konva` for a highly performant HTML5 canvas. The map drawing logic is decomposed into dedicated, type-safe semantic layer components (`GridLayerRenderer`, `TerrainLayerRenderer`, `VectorLayerRenderer`).
- **Backend**: A headless Python computer-vision engine driven by `OpenCV` (cv2) and `numpy`.
- **Communication Bridge**: The React frontend communicates with the Python backend via Electron IPC channels. Python operates as a stateless CLI process (`backend/main.py`) that accepts JSON arguments via standard input, executes the heavy image processing, and returns a structured JSON payload via standard output. The frontend adheres to a strict `IpcResponse` schema, gracefully capturing backend Python crashes, timeouts, and validation errors without crashing the renderer process. A custom `local://` protocol handler in Electron bypasses browser security restrictions to serve dynamically generated images and assets directly from the local filesystem to the React UI.

## 2. Core Features & UI
- **Interactive Hex Grid**: A fully interactive canvas that supports zooming, panning, and rendering hex tiles natively. It supports both Flat-top and Pointy-top hex orientations.
- **Map Alignment Engine**: Users can import an image of a physical map and visually align a digital hex overlay to perfectly match the scale and offset of the scanned image. Importing a directory of layers will spawn synchronized `BgImageLayer` items for each source file to allow easy cross-referencing. The digital hex map bounds will automatically clip or expand dynamically to perfectly match the dimensions of the imported image.
- **Layer System & Management**: The app separates map data into 8 semantic layers with a strict top-to-bottom visual hierarchy (Z-index): Labels, Borders, Hex Grid, Cities/Structures, Rivers, Cliffs, Coastline, and Terrain. 
  - The dynamic **LayerStack UI** allows users to visually reorder layers via Up/Down buttons, create new layers, delete unneeded layers, and toggle visibility. Each layer is represented by a distinct, recognizable icon (e.g. Hex Grid, Terrain, River, Border).
  - Users can double-click any layer name in the panel to instantly rename it directly on the canvas.
- **LayerPalette Toolset**: The left-hand panel provides a unified interface for all drawing actions. It includes a consistent "Actions" row (Select, Move, Highlight, Erase). The palette is modularized into discrete sub-components (e.g., `RoadPalette`, `TerrainPalette`, `RiverPalette`) connected through `BasePaletteLayout`, which manages specialized layer tools (e.g. Coastline editor, River brush dropdowns, Grid Properties) and the primary "Brushes" section for selecting hex stamps.
- **Unknowns Resolution Panel**: When the engine detects a symbol it does not recognize, it prompts the user in the UI. The user can choose to add the symbol to the application's permanent asset library, map it to an existing known asset, or explicitly ignore it.
- **Undo / Redo System**: A robust layer-state history tracker allows users to safely undo or redo the last 30 map editing actions (drawing, erasing, moving nodes, changing layers) simply by pressing `CTRL+Z` and `CTRL+Y` respectively.
- **Map Settings**: A centralized configuration menu allows users to set global variables—such as the default map font, real-world hex size, and distance units—which are embedded directly into the project save file.
- **Global Error Notifications**: A dynamic Toast UI component cleanly surfaces deep backend Python crashes, IPC failures, timeouts, and missing files directly to the user in the bottom right corner, preventing silent failures during map rendering.
- **Smart Font Fallback & Typography**: To support ornate fantasy fonts (which frequently lack number glyphs), HexMapper implements an algorithmic typography engine. It automatically detects if a user's chosen Primary Font lacks visible numbers by mathematically scanning raw pixels on an invisible off-screen canvas. If numbers are missing, the rendering engine automatically parses all strings and dynamically swaps any word containing digits to use the configured Secondary Font. This completely preserves the strict kerning and spacing of punctuation (like slashes in dates) within the fallback font, ensuring map legends and grid coordinates are always legible without requiring manual fallback toggles.
- **Project Serialization**: Maps can be saved to and loaded from local `.json` files.
- **Exporting**: The canvas can be exported directly to a high-resolution PNG file.

## 3. Optical Map Reconstruction Engine
The crown jewel of HexMapper is its multi-pass computer vision pipeline. The engine operates using a modular, object-oriented architecture with strict type-safety to enforce the Single Responsibility Principle:
- **`template_manager.py`**: Loads, caches, and pre-processes template tiles, isolating alpha channels and computing inherent ink masks.
- **`mask_generator.py`**: Responsible purely for thresholding and topological separation of images into binary masks. Knows nothing about geometry or colors.
- **`vector_extractor.py`**: A pure geometric parsing class that converts raw binary masks into geometric paths and polygons. Knows nothing about colors.
- **`color_matcher.py`**: Responsible purely for matching exact extracted colors against approved templates, isolating color logic from geometry.
- **`image_processor.py`**: Orchestrates the heavyweight OpenCV pipeline, connecting the mask generator, vector extractor, and color matcher.
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
- **Live Image Updating & Re-Importing**: Users can overwrite their base image files externally (e.g., in Photoshop) and click the "Re-import" button on that specific `BgImageLayer`. The application uses cache-busting timestamps to instantly update the visual canvas with the new image data without restarting.
- **Non-Destructive Re-Scanning**: When a specific image layer is re-imported, the engine intentionally extracts the results into a brand new, distinct layer. It does not blindly overwrite existing vector/terrain data. This guarantees that any manual edits the user made to the original layer are preserved, and leaves the user in full control to compare, merge, or delete the old layer as they see fit.
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
- **Highlight Mode**: The road, river, and coastline palettes include a specialized Highlight tool. When active, it renders vectors residing on the *currently active layer* with a bright, glowing yellow halo using shadow blur. This allows users to easily locate tiny paths, complex networks, or fragmented island coastlines hidden underneath dense terrain without accidentally highlighting vectors on other layers.
- **Spline Anchor Editing**: The vector drawing system has been built for precise manipulation:
  - **Point-by-Point Drawing**: Users can click to drop anchor vertices, rubber-banding the line segment by segment. Double-clicking commits the vector to the canvas. Pressing `ESC` or right-clicking at any time cancels the drawing.
  - **Node Editing**: Selecting an existing road, river, or coastline enters "Edit Mode". White circular anchor nodes appear at every vertex. Users can drag these nodes in real-time to reshape the path. For closed polygons like islands, strict hit detection ensures the interior remains hollow and clickable.
  - **Node Insertion**: Double-clicking on the line dynamically inserts a new anchor node at that specific position for finer control.
  - **River Features**: Users can select custom River Feature brushes (e.g., waterfalls, bridges, cataracts) directly from the River layer palette. These tools dynamically populate by loading images from the active style's `Rivers` directory that are specifically prefixed with `feature_`. This intelligently separates visual features from internal optical color templates (prefixed with `hex_`). These features mathematically compute the tangent of the local river segment and automatically snap into place, rotating perfectly perpendicular to the water flow. Because they are structurally tied to the river's vector geometry, dragging river anchor nodes will dynamically update the positions and rotation of all attached features in real-time. Features can be selectively erased independently of the underlying river line.

## 7. Extracted Vector Injection
When the Optical Map Reconstruction Engine scans an image (such as the Global Shoreline or Rivers pass), the resulting raw coordinate data is seamlessly converted into standard, editable `VectorLine` objects.
- **Coastline Extraction & Processing**: 
  - Multiple imported coastline files are injected into separate, reorderable Vector Layers in the stack (e.g. `Coastline_Base`, `Coastline_Islands`).
  - **Multi-Depth / Multi-Color Extraction**: The engine quantizes the RGB colors of the image to isolate all distinct solid colors representing varying depths or regions (e.g., Shallow, Medium, and Deep water). It extracts the outermost boundary (`RETR_EXTERNAL`) for each distinct color region independently, completely ignoring inner holes.
  - **Area-Sorted Rendering**: The extracted coastline polygons inherit their original hex fill colors. To perfectly replicate nested depths without complex SVG `evenodd` path intersections, all extracted polygons are sorted by their calculated Area in descending order. The React UI sequentially renders them as solid shapes, ensuring large background oceans are drawn first, and smaller interior lakes or deep pockets naturally draw on top.
- **River Extraction & Coastal Snapping**: 
  - During the final compilation stage of the scanner, the raw array of river paths is intercepted and formatted into vector lines.
  - **Multi-Color River Extraction**: The engine extracts the true median color from the unsimplified pixels along each extracted river path. It compares this extracted color mathematically against the `mean_color` of the palette template hexes (like `hex_Water.png` and `hex_Lava.png`) located in the active style's `Rivers` folder. This dynamically assigns both the `riverStyle` and `stroke` properties per individual river based on their optical color, allowing maps to natively support multiple fluid types simultaneously without breaking continuous vector extraction.
  - The backend engine performs a geometric distance check against all generated coastlines. If a river's start or end node is within `0.8 * hex_size` of a shoreline, that specific node is snapped dynamically to the closest point on the coastline segment.
  - These lines are injected directly into the active `river` layer, allowing the user to immediately utilize the **Spline Anchor Editing** tools to refine or correct the automatically extracted rivers. Moving a river anchor in the UI will mathematically project and snap the node to any nearby coastline.

## 8. Testing Infrastructure
HexMapper employs a dual-strategy testing framework to ensure the integrity of the Optical Map Reconstruction Engine. All tests are located in `backend/tests/` and are executed via `pytest`.

### Test Architecture
- **Synthetic Vector Tests (`test_vector_extraction.py`)**: Tests fundamental algorithmic logic (e.g., mathematical hex snapping, hachure pruning, coastline polygon intersection). This relies on `generate_synthetic_vectors.py`, a script that systematically draws perfect, noise-free testing assets (like exact length hachures or grid-aligned borders).
- **End-to-End Regression Tests (`test_map_regression.py`)**: Validates the overall health of the extraction pipeline by running the `MapInterpreter` against massive real-world user maps (`Albheldri` and `Apennines`). It parses the native `map_description.json` (to inject exact X/Y offsets and scales) and compares the generated output payload against known "Gold Standard" JSON map saves to assert identical layer parsing, terrain counts, and city counts.

### Running Tests
Execute tests from the `backend/` directory using the virtual environment:
- **Run all tests**: `pytest .\backend\tests\ -v`
- **Run regression tests**: `pytest .\backend\tests\test_map_regression.py -v`
- **Run synthetic vector tests**: `pytest .\backend\tests\test_vector_extraction.py -v`

### Managing Expected Results (Updating Gold Standards)
When algorithmic improvements are intentionally deployed (such as drastically reducing redundant cliff vectors, or training a new Terrain Profile):
1. The `test_map_regression.py` suite will purposely fail, catching the exact discrepancy between the new logic and the legacy "Gold Standard" save.
2. To resolve this, load the physical map into the HexMapper UI, execute a full scan, and visually verify the new enhancements.
3. Save the resulting map via the UI, and overwrite the outdated legacy JSON in `backend/tests/saves/` (e.g., `Albheldri_MultiLayer.json`). The test suite will now pass against the updated algorithmic baseline.
