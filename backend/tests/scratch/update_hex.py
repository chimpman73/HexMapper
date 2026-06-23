import os

filepath = r"c:\John\Code\HexMapper\src\renderer\components\HexGridEngine.tsx"
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

replacements = [
    (
        "  activeBrush: string | null;\n  activeColor: string | null;\n  activeLineWidth: number;\n  layers: MapLayer[];",
        "  activeBrush: string | null;\n  activeColor: string | null;\n  activeLineWidth: number;\n  activeRoadStyle?: RoadStyle;\n  roadConfig?: any;\n  layers: MapLayer[];"
    ),
    (
        "const HexGridEngine = forwardRef<HexGridEngineRef, HexGridEngineProps>(({ \n  orientation, showCoordinates, mapWidth, mapHeight, activeBrush, activeColor, activeLineWidth, layers, setLayers, activeLayerId,",
        "const HexGridEngine = forwardRef<HexGridEngineRef, HexGridEngineProps>(({ \n  orientation, showCoordinates, mapWidth, mapHeight, activeBrush, activeColor, activeLineWidth, activeRoadStyle, roadConfig, layers, setLayers, activeLayerId,"
    ),
    (
        "    const down = (e: KeyboardEvent) => { \n      if (e.key === 'Shift') setIsShiftPressed(true); \n      \n      if (e.key === 'PageUp' || e.key === 'PageDown') {",
        "    const down = (e: KeyboardEvent) => { \n      if (e.key === 'Shift') setIsShiftPressed(true); \n      if (e.key === 'Escape') {\n        setCurrentLine(null);\n      }\n      \n      if (e.key === 'PageUp' || e.key === 'PageDown') {"
    ),
    (
        "  const isVectorMode = activeLayer && (activeLayer.type === 'river' || activeLayer.type === 'cliff' || activeLayer.type === 'label');",
        "  const isVectorMode = activeLayer && (activeLayer.type === 'river' || activeLayer.type === 'cliff' || activeLayer.type === 'label' || activeLayer.type === 'road');"
    ),
    (
        "      if (isVectorMode) {\n        if (activeColor !== null) {\n          const stage = e.target.getStage();",
        "      if (isVectorMode) {\n        if (activeColor !== null || activeLayer?.type === 'road') {\n          const stage = e.target.getStage();"
    ),
    (
        "    if (isVectorMode && currentLine) {\n      setLayers(prev => prev.map(l => {\n        if (l.id === activeLayerId && (l.type === 'river' || l.type === 'cliff' || l.type === 'border' || l.type === 'label')) {\n          return {\n            ...l,\n            data: [...(l.data as any[]), {\n              id: Date.now().toString(),\n              points: currentLine,\n              stroke: activeColor || '#000000',\n              strokeWidth: activeLineWidth,\n              tension: 0.5,\n              invert: isShiftPressed\n            }]\n          } as VectorLayer;\n        }",
        "    if (isVectorMode && currentLine) {\n      setLayers(prev => prev.map(l => {\n        if (l.id === activeLayerId && (l.type === 'river' || l.type === 'cliff' || l.type === 'border' || l.type === 'label' || l.type === 'road')) {\n          const newData = {\n            id: Date.now().toString(),\n            points: currentLine,\n            stroke: activeColor || '#000000',\n            strokeWidth: activeLineWidth,\n            tension: 0.5,\n            invert: isShiftPressed,\n            roadStyle: l.type === 'road' ? activeRoadStyle : undefined\n          };\n          return {\n            ...l,\n            data: [...(l.data as any[]), newData]\n          } as VectorLayer;\n        }"
    ),
    (
        """            const vLayer = layer as VectorLayer;
            return (
              <React.Fragment key={`group-${layer.id}`}>
                {vLayer.data.map((line, i) => (
                  <Group 
                    key={`line-frag-${layer.id}-${line.id}`}
                    onMouseDown={(e) => {
                      if (isVectorMode && activeColor === null && activeLayerId === layer.id) {""",
        """            const vLayer = layer as VectorLayer;
            return (
              <React.Fragment key={`group-${layer.id}`}>
                {vLayer.data.map((line, i) => {
                  let roadDash;
                  let strokeColor = hoveredLineId === line.id ? '#ff5252' : line.stroke;
                  let innerTunnelColor;
                  let isHighlighted = activeLayer?.type === 'road' && activeRoadStyle === 'highlight';
                  
                  if (layer.type === 'road') {
                    const styleConfig = roadConfig?.[line.roadStyle || 'road'];
                    if (styleConfig) {
                      strokeColor = hoveredLineId === line.id ? '#ff5252' : styleConfig.color;
                      roadDash = styleConfig.dash?.length > 0 ? styleConfig.dash : undefined;
                      innerTunnelColor = styleConfig.innerColor;
                    } else {
                      if (line.roadStyle === 'path') {
                        roadDash = [10, 10];
                        strokeColor = hoveredLineId === line.id ? '#ff5252' : '#8B4513';
                      } else if (line.roadStyle === 'tunnel') {
                        strokeColor = hoveredLineId === line.id ? '#ff5252' : '#555555';
                        innerTunnelColor = '#ffffff';
                      } else {
                        strokeColor = hoveredLineId === line.id ? '#ff5252' : '#A0522D';
                      }
                    }
                  }

                  return (
                  <Group 
                    key={`line-frag-${layer.id}-${line.id}`}
                    onMouseDown={(e) => {
                      if (isVectorMode && (activeColor === null || layer.type === 'road') && activeLayerId === layer.id) {"""
    ),
    (
        """                    onMouseEnter={(e) => {
                      if (isVectorMode && activeColor === null && activeLayerId === layer.id) {
                        const stage = e.target.getStage();
                        if (stage) stage.container().style.cursor = 'pointer';
                        setHoveredLineId(line.id);
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (isVectorMode && activeColor === null && activeLayerId === layer.id) {
                        const stage = e.target.getStage();
                        if (stage) stage.container().style.cursor = 'crosshair';
                        if (hoveredLineId === line.id) setHoveredLineId(null);
                      }
                    }}
                  >
                    <Line
                      points={line.points}
                      stroke={hoveredLineId === line.id ? '#ff5252' : line.stroke}
                      strokeWidth={line.strokeWidth}
                      hitStrokeWidth={Math.max(20, line.strokeWidth)}
                      tension={line.tension}
                      lineCap="round"
                      lineJoin="round"
                      opacity={hoveredLineId === line.id ? 0.5 : layer.opacity}
                    />
                    {layer.type === 'cliff' && generateCliffHashes(line.points, line.invert, hoveredLineId === line.id ? '#ff5252' : line.stroke, line.strokeWidth, line.id, hoveredLineId === line.id ? 0.5 : layer.opacity)}
                  </Group>
                ))}""",
        """                    onMouseEnter={(e) => {
                      if (isVectorMode && (activeColor === null || layer.type === 'road') && activeLayerId === layer.id) {
                        const stage = e.target.getStage();
                        if (stage) stage.container().style.cursor = 'pointer';
                        setHoveredLineId(line.id);
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (isVectorMode && (activeColor === null || layer.type === 'road') && activeLayerId === layer.id) {
                        const stage = e.target.getStage();
                        if (stage) stage.container().style.cursor = 'crosshair';
                        if (hoveredLineId === line.id) setHoveredLineId(null);
                      }
                    }}
                  >
                    {isHighlighted && (
                      <Line
                        points={line.points}
                        stroke="#ffff00"
                        strokeWidth={line.strokeWidth + 8}
                        tension={line.tension}
                        lineCap="round"
                        lineJoin="round"
                        opacity={0.6}
                        listening={false}
                        shadowColor="#ffff00"
                        shadowBlur={15}
                      />
                    )}
                    <Line
                      points={line.points}
                      stroke={strokeColor}
                      strokeWidth={line.strokeWidth}
                      hitStrokeWidth={Math.max(20, line.strokeWidth)}
                      tension={line.tension}
                      lineCap="round"
                      lineJoin="round"
                      dash={roadDash}
                      opacity={hoveredLineId === line.id ? 0.5 : layer.opacity}
                    />
                    {layer.type === 'road' && line.roadStyle === 'tunnel' && (
                       <Line
                          points={line.points}
                          stroke={innerTunnelColor}
                          strokeWidth={Math.max(1, line.strokeWidth * (roadConfig?.tunnel?.innerWidthMultiplier ?? 0.6))}
                          tension={line.tension}
                          lineCap="round"
                          lineJoin="round"
                          opacity={hoveredLineId === line.id ? 0.5 : layer.opacity}
                          listening={false}
                       />
                    )}
                    {layer.type === 'cliff' && generateCliffHashes(line.points, line.invert, hoveredLineId === line.id ? '#ff5252' : line.stroke, line.strokeWidth, line.id, hoveredLineId === line.id ? 0.5 : layer.opacity)}
                  </Group>
                );
              })}"""
    ),
    (
        """        {/* Draw the current freehand line in progress */}
        {currentLine && (
          <React.Fragment>
            <Line
              points={currentLine}
              stroke={activeColor || '#000000'}
              strokeWidth={activeLineWidth}
              tension={0.5}
              lineCap="round"
              lineJoin="round"
            />
            {activeLayer?.type === 'cliff' && generateCliffHashes(currentLine, isShiftPressed, activeColor || '#000000', activeLineWidth, 'current')}
          </React.Fragment>
        )}""",
        """        {/* Draw the current freehand line in progress */}
        {currentLine && (
          <React.Fragment>
            {activeLayer?.type === 'road' && activeRoadStyle === 'tunnel' ? (
              <Group>
                <Line
                  points={currentLine}
                  stroke={roadConfig?.tunnel?.color || "#555555"}
                  strokeWidth={activeLineWidth}
                  tension={0.5}
                  lineCap="round"
                  lineJoin="round"
                />
                <Line
                  points={currentLine}
                  stroke={roadConfig?.tunnel?.innerColor || "#ffffff"}
                  strokeWidth={Math.max(1, activeLineWidth * (roadConfig?.tunnel?.innerWidthMultiplier ?? 0.6))}
                  tension={0.5}
                  lineCap="round"
                  lineJoin="round"
                />
              </Group>
            ) : (
              <Line
                points={currentLine}
                stroke={activeLayer?.type === 'road' ? (roadConfig?.[activeRoadStyle || 'road']?.color || (activeRoadStyle === 'path' ? '#8B4513' : '#A0522D')) : (activeColor || '#000000')}
                strokeWidth={activeLineWidth}
                tension={0.5}
                lineCap="round"
                lineJoin="round"
                dash={activeLayer?.type === 'road' ? (roadConfig?.[activeRoadStyle || 'road']?.dash?.length > 0 ? roadConfig[activeRoadStyle || 'road'].dash : (activeRoadStyle === 'path' ? [10, 10] : undefined)) : undefined}
              />
            )}
            {activeLayer?.type === 'cliff' && generateCliffHashes(currentLine, isShiftPressed, activeColor || '#000000', activeLineWidth, 'current')}
          </React.Fragment>
        )}"""
    )
]

for i, (old, new) in enumerate(replacements):
    if old not in content:
        print(f"Error: Chunk {i} not found in content!")
    else:
        content = content.replace(old, new)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("Done!")
