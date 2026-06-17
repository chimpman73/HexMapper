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

**4. Refactor Remaining Python Utility Scripts**
*Why it's important:* We need to finish paying off the technical debt in the backend before pushing the engine to extract new features (like complex rivers).
- Apply Object-Oriented Programming (OOP) principles to `backend/train_profile.py` and `backend/extract_assets.py`.
- Add strict Python type hinting (`typing` module) to function signatures and complex data structures.
- Implement specific error handling (e.g., catching `FileNotFoundError` or `cv2.error` instead of broad `Exception` blocks).

---

## 🟡 Medium Priority (Feature Enhancements & QoL)

**5. Unknown Objects UI Rework** *(Moved to High Priority)*
*Why it's important:* Resolves immediate user friction regarding screen real estate.
- Allow users to explicitly close the Unknowns panel even if items cannot currently be resolved.
- Add a menu toggle or button to easily reopen the Unknowns panel later.

**6. River Enhancements**
*Why it's important:* Expands the optical mapping capabilities.
- Expand river extraction capabilities to support scanning multiple river types and colors.
- Add tools for explicitly selecting and editing river vectors.

**7. City and Road Tools**
*Why it's important:* Expands the digital drawing capabilities.
- Add new drawing tools within the Cities layer to support creating interconnected roads (e.g., dotted lines, solid lines, and other paths).

**8. Coastline and Border Editing Tools**
*Why it's important:* Gives users finer control over the auto-generated geometric boundaries.
- Create better UI tools to manually manage, create, and edit vector paths for both coastlines and borders.

**9. Label Layer Rework**
*Why it's important:* Links semantic data between layers. This is complex and should only be tackled once the advanced layer management is absolutely stable.
- Tie map labels to specific painted objects (e.g., locking a text label to a specific terrain feature or city object) rather than floating them independently.

**10. PSD File Export**
*Why it's important:* Gives users professional interoperability by letting them pull generated maps back into Photoshop with intact layer structures.
- Implement an export feature to save the resulting digital map as a fully layered `.psd` file.

---

## 🟢 Low Priority (Polish & Stability)

**11. Add Customization UI for the Hex Grid Layer**
*Why it's important:* A simple visual polish task that isn't blocking any other development.
- Expose the newly separated `Hex Grid` layer properties to the React frontend UI.
- Add controls (e.g., in `TerrainPalette` or layer options) to allow users to dynamically change the grid line color and stroke thickness.

**12. Implement Frontend Test Coverage**
*Why it's important:* Vital for long-term stability, but we should write these tests *after* we finish the massive Layer Management UI rework (Priority 1 & 2), otherwise the tests will need to be rewritten immediately.
- Set up a JavaScript/TypeScript testing framework (like Jest or React Testing Library) for the React frontend.
- Write unit tests to ensure UI state (such as layer ordering and visibility toggles) remains robust and prevents accidental regressions during future feature additions.
