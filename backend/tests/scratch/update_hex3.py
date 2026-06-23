import os

filepath = r"c:\John\Code\HexMapper\src\renderer\components\HexGridEngine.tsx"
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

replacements = [
    (
        "const HexGridEngine = forwardRef<HexGridEngineRef, HexGridEngineProps>(({ ",
        """function distToSegment(p: {x: number, y: number}, v: {x: number, y: number}, w: {x: number, y: number}) {
  const l2 = (v.x - w.x) ** 2 + (v.y - w.y) ** 2;
  if (l2 === 0) return Math.sqrt((p.x - v.x) ** 2 + (p.y - v.y) ** 2);
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.sqrt((p.x - (v.x + t * (w.x - v.x))) ** 2 + (p.y - (v.y + t * (w.y - v.y))) ** 2);
}

const HexGridEngine = forwardRef<HexGridEngineRef, HexGridEngineProps>(({ """
    ),
    (
        "  const [isDrawingRoad, setIsDrawingRoad] = useState(false);",
        "  const [isDrawingRoad, setIsDrawingRoad] = useState(false);\n  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);"
    ),
    (
        "      if (e.key === 'Escape') {\n        setCurrentLine(null);\n        setIsDrawingRoad(false);\n      }",
        "      if (e.key === 'Escape') {\n        setCurrentLine(null);\n        setIsDrawingRoad(false);\n        setSelectedLineId(null);\n      }"
    ),
    (
        "    if (e.evt.button === 0 && !e.evt.altKey) {\n      if (isVectorMode) {\n        if (activeColor !== null || activeLayer?.type === 'road') {\n          const stage = e.target.getStage();",
        "    if (e.evt.button === 0 && !e.evt.altKey) {\n      if (isVectorMode) {\n        if (activeColor !== null || activeLayer?.type === 'road') {\n          const stage = e.target.getStage();\n          if (stage && e.target === stage) setSelectedLineId(null);"
    ),
    (
        """                  <Group 
                    key={`line-frag-${layer.id}-${line.id}`}
                    onMouseDown={(e) => {
                      if (isVectorMode && (activeColor === null || layer.type === 'road') && activeLayerId === layer.id) {
                        e.cancelBubble = true;
                        setHoveredLineId(null);
                        setLayers(prev => prev.map(l => {
                          if (l.id === layer.id) {
                            const vl = l as VectorLayer;
                            return { ...vl, data: vl.data.filter(dl => dl.id !== line.id) };
                          }
                          return l;
                        }));
                      }
                    }}""",
        """                  <Group 
                    key={`line-frag-${layer.id}-${line.id}`}
                    onDblClick={(e) => {
                      if (isVectorMode && activeLayerId === layer.id && layer.type === 'road' && selectedLineId === line.id) {
                        e.cancelBubble = true;
                        const stage = e.target.getStage();
                        if (stage) {
                          const pos = getRelativePointerPosition(stage);
                          let bestIndex = 0;
                          let minDist = Infinity;
                          for (let i = 0; i < line.points.length - 2; i += 2) {
                             const p1 = { x: line.points[i], y: line.points[i+1] };
                             const p2 = { x: line.points[i+2], y: line.points[i+3] };
                             const dist = distToSegment(pos, p1, p2);
                             if (dist < minDist) {
                               minDist = dist;
                               bestIndex = i + 2;
                             }
                          }
                          const newPoints = [...line.points];
                          newPoints.splice(bestIndex, 0, pos.x, pos.y);
                          setLayers(prev => prev.map(l => {
                            if (l.id === layer.id) {
                              const vl = l as VectorLayer;
                              return { ...vl, data: vl.data.map(dl => dl.id === line.id ? { ...dl, points: newPoints } : dl) };
                            }
                            return l;
                          }));
                        }
                      }
                    }}
                    onMouseDown={(e) => {
                      if (isVectorMode && activeLayerId === layer.id) {
                        if (activeColor === null) {
                          e.cancelBubble = true;
                          setHoveredLineId(null);
                          setLayers(prev => prev.map(l => {
                            if (l.id === layer.id) {
                              const vl = l as VectorLayer;
                              return { ...vl, data: vl.data.filter(dl => dl.id !== line.id) };
                            }
                            return l;
                          }));
                        } else if (layer.type === 'road') {
                          e.cancelBubble = true;
                          setSelectedLineId(line.id);
                        }
                      }
                    }}"""
    ),
    (
        """                    {layer.type === 'cliff' && generateCliffHashes(line.points, line.invert, hoveredLineId === line.id ? '#ff5252' : line.stroke, line.strokeWidth, line.id, hoveredLineId === line.id ? 0.5 : layer.opacity)}
                  </Group>""",
        """                    {layer.type === 'cliff' && generateCliffHashes(line.points, line.invert, hoveredLineId === line.id ? '#ff5252' : line.stroke, line.strokeWidth, line.id, hoveredLineId === line.id ? 0.5 : layer.opacity)}
                    {selectedLineId === line.id && layer.type === 'road' && (
                      <Group>
                        {Array.from({ length: line.points.length / 2 }).map((_, ptIndex) => (
                          <import_react_konva.Circle
                            key={`anchor-${line.id}-${ptIndex}`}
                            x={line.points[ptIndex * 2]}
                            y={line.points[ptIndex * 2 + 1]}
                            radius={5}
                            fill="#ffffff"
                            stroke="#ff5252"
                            strokeWidth={2}
                            draggable
                            onDragMove={(e) => {
                               const newPoints = [...line.points];
                               newPoints[ptIndex * 2] = e.target.x();
                               newPoints[ptIndex * 2 + 1] = e.target.y();
                               setLayers(prev => prev.map(l => {
                                 if (l.id === layer.id) {
                                   const vl = l as VectorLayer;
                                   return { ...vl, data: vl.data.map(dl => dl.id === line.id ? { ...dl, points: newPoints } : dl) };
                                 }
                                 return l;
                               }));
                            }}
                          />
                        ))}
                      </Group>
                    )}
                  </Group>"""
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
