HexMapper Program

I want to create a program that can be used for hex mapping (for maps - particularly for D&D but possibly for other reasons as well.)  The program needs to do the following:

- Create image layers.  I want to be able to create any number of image layers, however we may have specific layers with specific purposes or properties.  These will include the following (and need to be in the following order (from bottom to top):
* Terrain Hex - hexes can be pulled from a list of terrain types.  Clicking in a hex grid will place the appropriate hex terrain.
* Cliff layer - cliff layer represents a cliff or plateau that is drawn by hand.  The cliff consists of a line (drawn by hand or some fractile method) and smaller perpendicular lines extending from it which reprensents the cliff height.  Cliffs may split hexes.  In this case we should show the cliff hex on one side of the line and the normal hex on the other.
* River layer - rivers need to be hand drawn (or drawn using some fractile method.
* Hex grid terrain - the hex should be a uniform size (we should be able to determine in pixels)  We should be able to shift between horizontal and vertical hexes (possibly with a switch).
* Hex grid cliff - if there is a cliff line drawn through a hex, then we can also place a cliff hex (which is drawn only on one side of the cliff.
* Coastline - the coastline is freform (either hand drawn or through some fractile method).  Everything on one side is water, and everything on the other side is the hex grids (below).
* City - these may represent any community, structure, ruin,  or special location.
* Borders - these should be borderlines that follow the hex grid
* Label - Labels are names or descriptions that should be drawn on top of the hex grid lines and all other objects.  We may want to specify font type, as well as a method for stroking the text (for better visibility).
* Legends - legends may include other describing text or required images (compass rose, etc).

The probram needs to have the following modes:
- Draw a new map, or edit an existing map.
* Maps need to be saved as either SVG, PSD, PNG, or PDF files.
* PSD files should save and maintain the layer structure.

- Interprest existing maps.  This will require an input image or PDF.  The program should take the raw image and convert it into the layers required for a map as listed above.

Other Considerations:
- I want to be able to scale to create small maps, medium maps, and very large maps.  Because our hex methodology can tile pre-existing images, then perhaps we can reclaim memory/file size using that.
- Are there ways to interpret an existing image that do not use AI?  Think outside the box.  We may be able to provide reference materials such as the terrain brush images (as png files).
- We should be able to create customized terrain brushes/sets of terrain hex files (as pngs).
- I would like the option to use AI interpretation if we need to, but this should not be the default.  I would alos like the option to provide a set of current terrain hexes (which may not be suitable for the tool)  
- I want the tool (either AI or standard tools) to take each hex and create a respurce that is actually usable for us.