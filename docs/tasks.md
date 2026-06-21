# HexMapper Task Backlog

This backlog is prioritized based on structural dependencies. Foundational infrastructure and architectural changes are ranked highest to ensure a stable base for the subsequent feature additions.

## 🔴 High Priority (Core Infrastructure & Architecture)

**1. ~~Advanced Layer Management UI~~ [COMPLETED]**
*Why it's important:* This is the foundational prerequisite for almost everything else. Currently, layers are hardcoded. To support dynamic background images or flexible mapping, we must first build the engine to handle adding, removing, grouping, and z-index sorting of arbitrary layers.
- ~~Create a new UI to manage layers dynamically.~~
- ~~Support adding and removing specific types of layers.~~
- ~~Support moving layers up and down the rendering ladder (z-index sorting).~~
- ~~Implement layer groups, allowing users to move or hide entire groups of layers at once.~~

**2. ~~Source Image Background Layers~~ [COMPLETED]**
*Why it's important:* Once dynamic layers exist, we can migrate the static background image logic into proper layers at the bottom of the stack.
- ~~Create a background layer (placed at the absolute bottom) that displays the original image used during an import.~~
- ~~Support a variable number of background image layers if multiple image imports occur.~~

**3. ~~Brush Categories and Map Styles~~ [COMPLETED]**
*Why it's important:* Structuring the asset libraries (brushes, templates) into logical categories must happen before we build new drawing tools that rely on those assets.
- ~~Give hex brushes specific names and categories to make them easier to manage and resource.~~
- ~~Organize brushes and map utilities into "style categories" (themes).~~
- ~~Implement the ability for a map to swap between different style categories to dynamically change its aesthetic.~~

**4. ~~Refactor Remaining Python Utility Scripts~~ [COMPLETED]**
*Why it's important:* We need to finish paying off the technical debt in the backend before pushing the engine to extract new features (like complex rivers).
- ~~Apply Object-Oriented Programming (OOP) principles to `backend/train_profile.py` and `backend/extract_assets.py`.~~
- ~~Add strict Python type hinting (`typing` module) to function signatures and complex data structures.~~
- ~~Implement specific error handling (e.g., catching `FileNotFoundError` or `cv2.error` instead of broad `Exception` blocks).~~

**5. ~~Codebase SRP Refactoring (Frontend & Backend)~~ [COMPLETED]**
*Why it's important:* Ensures the application remains scalable and maintainable by breaking down "God Classes" into strict, single-responsibility modules.
- ~~Refactor the massive React `App.tsx` into distinct UI components (`Toolbar`, `Sidebar`, etc.) and Hooks.~~
- ~~Decompose the massive Python `HexScanner` into modular map data parsers (`TerrainScanner`, `CityScanner`, `LayerAssembler`).~~
- ~~Extract CV2 vector geometry out of `ImageProcessor` into a dedicated math script.~~

**6. Large-Map Rendering Performance & Memory Optimization**
*Why it's important:* As map size grows (hundreds of hexes wide/tall), rendering becomes unacceptably laggy. The app should comfortably handle very large maps with no degradation in interactivity. This is a scalability ceiling that must be addressed before large-map workflows are practical.
- **Viewport Culling:** Audit and enforce that only hexes and objects within the current visible viewport are rendered. Nothing off-screen should be drawn or processed each frame.
- **Spatial Indexing:** Implement a spatial data structure (e.g., quadtree or spatial hash grid) so hit-testing, hover, and selection queries skip off-screen hexes entirely rather than iterating the full map.
- **Layer Dirty-Flagging:** Only re-render layers that have actually changed since the last frame. Avoid full-canvas redraws on unrelated interactions.
- **Object Pooling / Canvas Tiling:** Investigate tiling the canvas into chunks so only dirty tiles are repainted, rather than invalidating the full canvas on every edit.
- **Memory Audit:** Profile memory usage on a large map and identify the biggest consumers. Explore lazy-loading of brush assets and off-screen layer data.
- **Benchmarking Target:** Define a concrete performance goal (e.g., smooth 60fps pan/zoom on a map 300+ hexes wide) and add a lightweight benchmark or stress-test map to validate it.
- **[Optional] Semantic Zooming:** Hide minor details (labels, small streams, city icons) completely when zoomed very far out to further reduce object counts.
- **[Optional] WebGL Migration:** If extreme scale (>100k interactive hexes) is strictly required, rewrite the core renderer from Canvas2D/Konva to WebGL (PixiJS) to support Sprite Batching.

**7. ~~Backend Python Test Coverage~~ [COMPLETED]**
*Why it's important:* The CV pipeline (`hex_scanner.py`, `interpreter.py`, `image_processor.py`, etc.) is complex and fragile. Without a regression suite, modifications to the pipeline can silently break scan accuracy on existing maps. Tests against known map fixtures are essential for confident refactoring and feature additions.
- Set up a Python test framework (e.g., `pytest`) in the backend with a `tests/` directory.
- Create a small set of known-good "fixture" maps — scanned inputs paired with expected JSON outputs — to validate end-to-end pipeline accuracy.
- Write unit tests for the core math modules (`hex_grid.py`, `hex_math.ts`-equivalent) covering axial↔pixel conversions, distance formulas, and grid orientation logic.
- Write integration tests for each scanner pass (border extraction, shoreline, template matching, ink pass) asserting correct output structure and key values.
- Add a CI-compatible test runner script so tests can be run as a single command (e.g., `pytest backend/tests/`).
- Establish a minimum accuracy threshold test: given the fixture map, the scanner must correctly classify at least N% of hexes to pass.

**8. ~~IPC Message Validation & Error Surfacing~~ [COMPLETED]**
*Why it's important:* The coding standards explicitly require IPC messages and JSON payloads to be validated before processing, and Python crashes to be gracefully surfaced to the user. Currently a backend crash or malformed payload may produce silent failures or uncaught exceptions with no user feedback.
- Audit all Electron IPC channels and validate incoming message payloads (type-check required fields, reject malformed requests with a structured error response).
- Wrap all Python backend invocations in the Electron main process with robust error handling — catch non-zero exit codes, `stderr` output, and timeout failures.
- Surface backend errors to the React UI in a consistent, user-friendly way (e.g., a toast notification or error panel) rather than silently failing or logging only to the console.
- Define a shared error response schema (e.g., `{ success: false, error: string, code: string }`) used by all Python responses and IPC replies.
- Add input validation on the Python side as well — reject malformed JSON input with a structured error before any processing begins.
- ~~Write a developer runbook documenting how to diagnose IPC and backend failures during development.~~
- ~~Implement streaming IPC progress updates during long Python backend extractions, displaying real-time feedback in the React UI.~~

---

## 🟡 Medium Priority (Feature Enhancements & QoL)

**5. ~~Unknown Objects UI Rework~~ [COMPLETED]** *(Moved to High Priority)*
*Why it's important:* Resolves immediate user friction regarding screen real estate.
- ~~Allow users to explicitly close the Unknowns panel even if items cannot currently be resolved.~~
- ~~Add a menu toggle or button to easily reopen the Unknowns panel later.~~

**6. ~~River Enhancements~~ [COMPLETED]**
*Why it's important:* Expands the optical mapping capabilities.
- ~~Expand river extraction capabilities to support scanning multiple river types and colors.~~
- ~~Add tools for explicitly selecting and editing river vectors.~~

**7. ~~City and Road Tools~~ [COMPLETED]**
*Why it's important:* Expands the digital drawing capabilities.
- ~~Add new drawing tools within the Cities layer to support creating interconnected roads (e.g., dotted lines, solid lines, and other paths).~~

**8. ~~Coastline Editing Tools~~ [COMPLETED]**
*Why it's important:* Gives users finer control over the auto-generated geometric boundaries.
- ~~Create better UI tools to manually manage, create, and edit vector paths for coastlines.~~
- ~~To draw coastline we use multiple brush types. These are lines again, with smooth lines versus fractal lines. These are generated upon map import.~~
- For Borders we may want multiple line types. Smooth lines (like rivers or roads), fractal lines, lines that "snap" to the hex grid. This also needs to get imported when we create a map.

**9. ~~LayerPalette UI Standardization~~ [COMPLETED]**
*Why it's important:* The left-hand brush/tool panel currently lacks a consistent layout convention across layer types. Establishing a shared structure now will make future layer-specific tools predictable and maintainable, and give users a coherent experience regardless of which layer they are editing.
- ~~Re-label the left-hand hex brush panel as the **LayerPalette**.~~
- ~~**Section 1 — "Actions":** A compact row of hex-shaped icon buttons present on every layer type.~~
- ~~**Section 2 — "Tools":** Layer-specific non-hex-brush tools (e.g., coastline editors, river drawing tools, road path tools). Define a consistent button shape, icon style, and active/hover state for all tool buttons across all layers.~~
- ~~**Section 3 — "Brushes":** Standard hex-stamp brushes for the current layer. Consistent grid layout, preview thumbnail size, and selection highlight across all layers.~~
- ~~Document the layout convention (spacing, section headers, icon sizes) so all future layers implement it the same way.~~
- ~~Not all layers will expose every section (e.g., a Labels layer may have no Brushes), but the ordering and styling of whichever sections appear must remain consistent.~~

**10. ~~LayerStack UI Standardization~~ [COMPLETED]**
*Why it's important:* The right-hand layer panel needs a proper name and a consistent visual identity. Clear, recognizable icons for each layer type will make the stack easier to scan at a glance and set the standard for any new layers added in the future.
- ~~Re-label the right-hand layer panel as the **LayerStack**.~~
- ~~Audit all existing layer types and assign each a distinct, meaningful icon (e.g., Terrain, Rivers, Roads, Cities, Coastlines, Labels, Hex Grid, Background Image, etc.).~~
- ~~Review and rework any current icons that are poor representations of their layer — prioritize clarity and recognizability at small sizes.~~
- ~~Establish a consistent icon style guide (line weight, fill vs. outline, size, color treatment) so all layer icons feel like a cohesive set.~~
- ~~Ensure icons remain legible in both active and inactive/hidden states (e.g., dimmed when a layer is hidden).~~
- ~~Document the icon convention so future layer types can follow the same standard.~~

**11. LayerStack Drag-and-Drop Reordering**
*Why it's important:* Currently layers can only be reordered via up/down buttons. Drag-and-drop is the natural, expected interaction for a layer stack and will make reorganizing complex maps with many layers significantly faster and more intuitive.
- Implement drag-and-drop reordering of layers within the LayerStack panel.
- Show a clear drop-target indicator (e.g., a highlighted insertion line) between layers as the user drags.
- Support dragging individual layers as well as layer groups as a single unit.
- Preserve correct z-index rendering order immediately on drop — no refresh required.
- Dragging should work correctly across layer group boundaries (moving a layer out of a group or into one).
- Ensure undo/redo support for drag-and-drop reorder operations.

**12. Terrain Brush Categories**
*Why it's important:* As the brush library grows, scrolling through a flat list of terrain brushes becomes unwieldy. Collapsible categories will keep the Brushes section of the LayerPalette organized and make it fast to find specific terrain types, especially as new map styles and themes add more brushes over time.
- Group terrain brushes into named, collapsible categories (e.g., *Forests*, *Mountains*, *Water*, *Plains*, *Desert*, *Snow/Ice*, *Urban*, etc.).
- Categories should be expand/collapse toggleable, with their state persisted between sessions.
- Support a brush appearing in more than one category if appropriate (e.g., a "Marsh" brush might fit under both *Water* and *Plains*).
- Add a search/filter input at the top of the Brushes section so users can quickly locate a brush by name without manually expanding categories.
- Allow categories to be reordered or toggled visible/hidden in a settings panel.
- Ensure the category structure is data-driven (defined in config, not hardcoded) so new categories and brushes can be added without code changes.

**13. Object Annotation**
*Why it's important:* Map objects (cities, rivers, roads, etc.) need to carry semantic metadata — at minimum a name — that travels with them in the save file. This is the foundational data layer that the Label Layer will read from to display names on the map, and it opens the door to richer per-object metadata in the future (e.g., population, notes, lore tags).
- Define a consistent annotation schema attached to each object in the JSON save format. At minimum: `name` (string). Design the schema to be extensible for future fields without breaking existing saves.
- Implement an annotation editor UI — a small popover or sidebar panel triggered by selecting/right-clicking an annotatable object, allowing the user to view and edit its annotations.
- Support annotation on objects across all applicable layers: Cities, Rivers, Roads, Contours, and any future annotatable layer type.
- Annotations must be stored *with* the object in the layer's JSON data, not in a separate lookup — so moving, copying, or deleting an object always carries its annotations with it.
- The `name` annotation should be surfaced on the **Label Layer** automatically (see task 15), but annotation data must exist independently of whether a label is currently displayed.
- Consider future annotation types beyond name: description/notes field, numeric attributes (e.g., population for cities, length for rivers), tags/categories for filtering.

**14. ~~Map Global Variables~~ [COMPLETED]**
*Why it's important:* Many features (Label Layer, Legend, scale tools) need shared map-level settings to behave consistently. Centralizing these in the save file ensures they are always available and easy to extend without scattering config across individual layers.
- ~~Add a `mapVariables` (or equivalent) top-level section to the JSON save format to hold map-wide settings.~~
- ~~Implement the following initial variables:~~
  - ~~`fontName` (string) — the font used for Labels and the Legend~~
  - ~~`hexSize` (number) — the real-world size of a single hex~~
  - ~~`hexUnit` (string) — the unit of measurement for `hexSize` (e.g., `"miles"`, `"km"`, `"leagues"`)~~
- ~~Build a **Map Settings UI panel** (e.g., accessible from a top menu or map properties dialog) where the user can view and edit all global variables.~~
- ~~The `fontName` setting should drive font rendering in the Label Layer (task 15) and any future Legend feature.~~
- ~~The `hexSize` + `hexUnit` pair should be used anywhere a real-world distance or scale is displayed (e.g., a scale bar, tooltip distances, export metadata).~~
- ~~Design the schema to be easily extensible — new global variables should require only a schema addition and a UI field, not structural changes.~~
- ~~Ensure backward compatibility: maps saved without a `mapVariables` section load correctly with sensible defaults.~~

**15. Label Layer Rework**
*Why it's important:* Links semantic data between layers. Depends on Object Annotation (task 13) and Map Global Variables (task 14) being in place first — labels read display text from object annotations and use the global font setting.
- Replace free-floating text labels with object-linked labels that read their name from the annotated object.
- Tie map labels to specific painted objects (e.g., locking a text label to a specific terrain feature or city object) rather than floating them independently.
- When an object's `name` annotation is edited, its label on the Label Layer should update automatically.
- Labels should render using the `fontName` defined in Map Global Variables.

**16. PSD File Export**
*Why it's important:* Gives users professional interoperability by letting them pull generated maps back into Photoshop with intact layer structures.
- Implement an export feature to save the resulting digital map as a fully layered `.psd` file.

**17. Rename "Coastlines" Layer to "Contours"**
*Why it's important:* "Coastlines" is too narrow a description — it implies the layer is only useful for water boundaries. Renaming it to "Contours" better reflects its true purpose as a general vector-line layer, opening the door to non-coastal uses (elevation contours, region boundaries, terrain edges, etc.) without confusing new users.
- Rename all user-facing references from "Coastlines" to "Contours" (UI labels, tooltips, menu items, panel headers).
- Update all internal code identifiers, type names, and constants to reflect the new name (e.g., `CoastlineLayer` → `ContourLayer`).
- Update save/load serialization — ensure backward compatibility so existing maps with the old "Coastlines" layer key still load correctly.
- Update any documentation, comments, and the task backlog that reference "Coastlines" by name.
- Revisit the layer's icon in the LayerStack to ensure it communicates the broader "Contours" concept rather than just coastlines.

**18. Map Stitching** *(Needs Investigation)*
*Why it's important:* Large worlds may span multiple map files. The ability to stitch two or more maps together — aligning hex grids, merging layers, and maintaining consistent metadata — would unlock continent- or world-scale mapping workflows that a single file cannot support.
- **Investigation required before implementation.** The following open questions need to be resolved first:
  - *Alignment model:* Should stitching work by snapping hex grids edge-to-edge, or by an arbitrary pixel/hex offset? How do we handle maps with different hex sizes?
  - *Data model:* Is a stitched map a new composite file that references the originals, or are the source maps merged destructively into one?
  - *Layer merging:* How are conflicting layers handled (e.g., both maps have a Terrain layer)? Merge, keep separate, or prompt the user?
  - *Annotation & variable merging:* What happens when two maps have different `fontName`, `hexUnit`, or `hexSize` global variables?
  - *Scale:* Should there be a viewport/world map mode for navigating between stitched tiles, or is the result always flattened into a single canvas?
  - *Edge blending:* Do Contour lines, Rivers, and Roads that cross a stitch boundary need to be connected manually or automatically?
- Once investigation is complete, break this task into concrete sub-tasks and re-prioritize accordingly.

**19. Sub-Map Regions**
*Why it's important:* Working on a small area of a very large map is cumbersome when the full canvas is always in view. Named, bookmarked sub-map regions let users zoom into a defined rectangular area, work there in a focused context, and export just that region — dramatically improving ergonomics on large-scale maps.
- **Region Definition:** Allow users to draw and save named rectangular regions on the map. Regions are stored as metadata in the JSON save file (top-level `regions` array), each with a name, bounding box (hex coordinates), and optional description.
- **Region Navigation:** Add a region picker UI (e.g., a dropdown or panel) that lets users jump instantly to a saved region, constraining the scrollable viewport to that region's bounds until they exit.
- **Focused Editing:** While inside a region, all editing tools work normally — the region simply acts as a scroll boundary so the user isn't distracted by the rest of the map.
- **Region Export:** Provide an export action for the current region that renders only the hexes and objects within its bounds to an image file (PNG, JPG, or other desired formats). The export should respect the current layer visibility settings.
- **Exit / Return:** A clear "Exit Region" action returns the user to the full map view, restoring the previous scroll position and zoom level.
- **Region Management UI:** Allow users to create, rename, delete, and reorder regions. Regions should be visually indicated on the full map view (e.g., a faint labeled rectangle overlay).
- **Interaction with Map Stitching (task 18):** Consider whether sub-map regions and stitched map tiles serve overlapping use cases, and how they should coexist if both features are implemented.

**20. Legend Layer**
*Why it's important:* A finished map needs a legend — compass rose, scale bar, map title, and any key explaining terrain symbols. This is called out in the original Specs but has never been formally tasked. The Legend Layer is distinct from the Label Layer: it holds static map-level graphic elements, not object-linked annotations.
- Create a dedicated **Legend Layer** that sits at the top of the LayerStack (above Labels).
- **Compass Rose:** Allow users to place and style a compass rose graphic on the map. Support choosing from a set of built-in compass rose styles, or importing a custom PNG.
- **Scale Bar:** Generate a dynamic scale bar using the `hexSize` and `hexUnit` values from Map Global Variables (task 14). The scale bar should update automatically if those values change.
- **Map Title Block:** A text element (using the global `fontName`) for the map's name/title, separately positionable from object labels.
- **Custom Legend Elements:** Allow users to add arbitrary text or image elements to the Legend Layer (e.g., a terrain key with icons and descriptions).
- Legend elements should be draggable and positionable freely on the canvas, independent of the hex grid.

**21. ~~Cliff / Plateau Layer~~ [COMPLETED]**
*Why it's important:* The Cliff layer is defined in the original Specs but has never been implemented. Cliffs and plateaus are a core terrain feature for D&D and fantasy maps, and the hex-splitting mechanic (showing a cliff hex on one side and a normal hex on the other) requires dedicated rendering logic not present in any current layer.
- Create a **Cliff Layer** sitting between the Terrain and River layers in the default LayerStack order.
- **Cliff Line Drawing:** Allow users to draw freehand or fractal cliff lines across the map. These lines can cross hex boundaries.
- **Perpendicular Tick Marks:** Automatically render shorter perpendicular tick marks along the cliff line to represent cliff height/direction (the "hachure" style used in cartography).
- **Hex Splitting:** Where a cliff line passes through a hex, render a "cliff hex" variant on the downslope side while the normal terrain hex renders on the upslope side.
- **Cliff Brushes:** Add cliff-specific brushes to the LayerPalette (consistent with the LayerPalette standardization in task 9).
- **Fractal Line Option:** Provide a fractal/rough-edge drawing mode for the cliff line, similar to the coastline fractal option.

**22. Border Layer Tools**
*Why it's important:* The Coastline Editing task (8) captured a partial note about borders needing multiple line types. Borders that snap to the hex grid are architecturally different from free-vector lines and require dedicated tooling. This task formally captures the full border tool implementation.
- **Hex-Snapping Borders:** Implement a border drawing mode where the line snaps to hex edges rather than being a free vector. The result should follow the grid geometry exactly.
- **Line Type Options:** Support multiple border styles — smooth (free vector), fractal, and hex-snapping — selectable per border object.
- **Border Import from Scan:** Ensure the optical scanner's border extraction (Pass 0 — currently extracts red borders) feeds correctly into the new Border Layer tool format.
- **Border Styling:** Allow per-border color, stroke width, and dash pattern, consistent with the `roads.json`/`rivers.json` configuration pattern used by Roads and Rivers.
- Add border-specific tools to the LayerPalette Actions/Tools sections consistent with task 9.

**23. Multi-Format Export**
*Why it's important:* The Specs require SVG, PSD, PNG, and PDF export. Currently only PNG export is implemented, with PSD tracked separately (task 16). SVG and PDF are entirely uncaptured and are important for print-ready and vector-editable output.
- **SVG Export:** Export the full map (or active Sub-Map Region) as an SVG file, preserving vector elements (rivers, roads, borders, contours) as true SVG paths rather than rasterizing them.
- **PDF Export:** Render the map to a print-ready PDF. Support standard paper sizes and custom DPI settings. Route this through the Python backend (which already handles heavy file processing per the coding standards).
- Ensure the existing PNG export supports custom DPI / resolution settings for high-resolution print output.
- All export formats should respect current layer visibility and optionally allow the user to choose which layers to include.
- Export UI should be accessible from the header menu and support exporting either the full map or the current Sub-Map Region (task 19).

**24. Keyboard Shortcuts System**
*Why it's important:* As the tool count grows (Actions row, Tools, layer switching, undo/redo, export), discoverability and speed of access via keyboard become essential. An ad-hoc approach leads to conflicts and gaps. A centralized shortcut system is the right infrastructure.
- Audit and document all existing keyboard shortcuts (currently just `CTRL+Z` / `CTRL+Y`).
- Design a comprehensive shortcut map covering: tool switching (select, move, erase, draw), layer navigation, zoom/pan, undo/redo, save, and export.
- Implement a centralized shortcut registry so shortcuts are defined in one place and cannot conflict.
- Add a **Keyboard Shortcut Reference overlay** (e.g., triggered by `?` key) that displays all active shortcuts in a clean modal — standard in professional creative tools.
- Allow users to view (and optionally remap) shortcuts via the Map Settings or Header Menu.

**25. Custom Brush / Asset Creation Tool**
*Why it's important:* The Specs explicitly call for the ability to create customized terrain brush sets. Currently brushes are pre-made PNGs dropped manually into `assets/styles/`. An in-app workflow for creating, registering, and categorizing new brushes would make the tool far more extensible for custom campaigns and map styles.
- Design an **Asset Creation workflow** — either an in-app tool or a guided import wizard — for adding new terrain brush PNGs to a style.
- When importing a new brush PNG, prompt the user for: name, category, which style(s) it belongs to, and any multi-category tags.
- Automatically register the brush in the style's data-driven config (consistent with task 12 — Terrain Brush Categories) so it appears in the LayerPalette without a code change.
- Provide a simple in-app **hex preview renderer** so the user can see how the brush looks at grid scale before committing it.
- Support bulk import of a directory of PNGs with a batch-naming and categorization step.
- Ensure new brushes are compatible with the k-NN training pipeline (task: Map Import Accuracy Tuning) so they can also be used as scan targets.

**26. Map Import Accuracy Tuning UI**
*Why it's important:* The k-NN trainer (`train_profile.py`) and template matching pipeline are powerful but currently developer-only tools. The Specs anticipate users correcting misidentified hexes and supplying reference materials. A guided in-app accuracy tuning workflow makes the optical reconstruction usable by non-technical users.
- Build a **Scan Review Mode** that displays the scan result hex-by-hex, showing what the engine classified each hex as alongside the confidence score.
- Allow users to click any misclassified hex and manually assign the correct terrain type — these corrections are stored as ground-truth training data.
- Add a **"Re-train Profile"** action that feeds the corrected hex assignments back into the k-NN trainer (`train_profile.py`) and regenerates `user_terrain_profile.json` for the active map style.
- Provide a **"Re-scan Region"** action that re-runs the optical pipeline over a user-selected area of the map using the updated profile, without rescanning the whole map.
- Surface confidence scores visually (e.g., low-confidence hexes shown with a warning indicator) so users know where to focus their corrections.
- Document the tuning workflow in an in-app help panel or tooltip so users understand the train→correct→retrain loop.

**11. ~~Advanced River Enhancements~~ [COMPLETED]**
*Why it's important:* Adds dynamic scaling and attachments to vector lines.
- ~~**River Details:** Add new River tools (adding fords, waterfalls, etc.). These brushes can only be painted along a river, perpendicular to a river. We might want some way to attach them to a river (in case the river is moved) and to slide them up or down the river if edited.~~ [COMPLETED]
- ~~**Coastal Snapping:** Create a river to coastal snapping tool that snaps the end of a river to coastline.~~ [COMPLETED]
- ~~**Dynamic Widths:** Revisit rivers. Have rivers grow and shrink based on how many tributaries either come in or go out. For example, a river by itself is the standard width, but for each tributary added it grows by a pixel wide. Branch points (something that attaches to the coastline) would make the river width shrink.~~ [COMPLETED]

---

## 🟢 Low Priority (Polish & Stability)

**11. ~~Add Customization UI for the Hex Grid Layer~~ [COMPLETED]**
*Why it's important:* A simple visual polish task that isn't blocking any other development.
- ~~Expose the newly separated `Hex Grid` layer properties to the React frontend UI.~~
- ~~Add controls (e.g., in `TerrainPalette` or layer options) to allow users to dynamically change the grid line color and stroke thickness.~~

**12. Implement Frontend Test Coverage**
*Why it's important:* Vital for long-term stability, but we should write these tests *after* we finish the massive Layer Management UI rework (Priority 1 & 2), otherwise the tests will need to be rewritten immediately.
- Set up a JavaScript/TypeScript testing framework (like Jest or React Testing Library) for the React frontend.
- Write unit tests to ensure UI state (such as layer ordering and visibility toggles) remains robust and prevents accidental regressions during future feature additions.

**13. Header Menu Rework** *(Needs Design)*
*Why it's important:* The current header menus are functional but not well thought-out from a UX perspective. As the feature set grows, a more intentional and organized menu structure will make the application easier to learn and navigate — especially for new users.
- **No concrete plan yet.** This task is a placeholder to ensure the header menus are revisited before the product is considered mature.
- Before implementation, conduct a design pass to answer: What top-level menu categories make sense? What actions belong in menus vs. toolbars vs. the LayerPalette/LayerStack? Are there any missing actions that have no current home?
- Consider UX best practices: logical groupings, keyboard shortcuts, consistent naming, and discoverability of less-obvious features.
- This task should be broken into specific sub-tasks once a design direction is established.

**14. Accessibility (a11y) Pass**
*Why it's important:* As HexMapper matures and potentially gets shared beyond personal use, keyboard navigability, screen reader support, and proper focus management become important for inclusivity and general software quality. Building in accessibility debt is much harder to fix retroactively.
- **Keyboard Navigation:** Ensure all interactive UI elements (layer panel, tool buttons, dialogs, menus) are reachable and operable by keyboard alone — no mouse required.
- **Focus Management:** Ensure focus is correctly trapped within modals/panels when open, and restored to the correct element when closed.
- **ARIA Labels:** Audit all icon-only buttons (especially the hex-shaped Actions row and LayerStack icons) and add descriptive `aria-label` attributes so screen readers can identify them.
- **Color Contrast:** Audit UI text and icon contrast ratios against WCAG AA standards. Pay particular attention to the low-priority dimmed states (e.g., hidden layer icons) and the canvas tool hover states.
- **Reduced Motion:** Respect the `prefers-reduced-motion` media query — any CSS transitions or canvas animations should be suppressable.
- This pass should be done after the LayerPalette (task 9) and LayerStack (task 10) UI standardization tasks are complete, since those will finalize the component structure being audited.

**15. Onboarding / New User Experience**
*Why it's important:* HexMapper has no welcome screen, no first-run guidance, and no sample content. A new user opening the app for the first time has no starting point. A lightweight onboarding experience dramatically lowers the barrier to entry and reduces early frustration.
- **Welcome Screen:** On first launch (or when no recent maps exist), show a welcome screen with options: *New Map*, *Open Map*, *Import Existing Map Image*, and *Open Sample Map*.
- **Sample Map:** Bundle a pre-built sample `.json` map file with the application so users can immediately explore a working map and understand the layer structure and tooling.
- **First-Run Tooltips:** On first use of each major panel (LayerPalette, LayerStack, canvas), show a brief dismissible tooltip or highlight overlay explaining what the panel does.
- **Contextual Help:** Add a `?` help icon to major UI areas that links to relevant documentation or displays a short inline explanation of that panel's purpose and controls.
- Onboarding state (which tooltips have been dismissed, whether first-run has completed) should be persisted in user preferences so it does not re-trigger after being dismissed.
- This task should be revisited after the Header Menu Rework (task 13) and LayerPalette/LayerStack standardization (tasks 9–10) are complete, since those will finalize the UI layout being introduced to new users.
