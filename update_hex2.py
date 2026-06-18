import os

filepath = r"c:\John\Code\HexMapper\src\renderer\components\HexGridEngine.tsx"
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

replacements = [
    (
        "  const [isShiftPressed, setIsShiftPressed] = useState(false);\n  const [hoveredLineId, setHoveredLineId] = useState<string | null>(null);",
        "  const [isShiftPressed, setIsShiftPressed] = useState(false);\n  const [hoveredLineId, setHoveredLineId] = useState<string | null>(null);\n  const [isDrawingRoad, setIsDrawingRoad] = useState(false);"
    ),
    (
        "      if (e.key === 'Escape') {\n        setCurrentLine(null);\n      }",
        "      if (e.key === 'Escape') {\n        setCurrentLine(null);\n        setIsDrawingRoad(false);\n      }"
    ),
    (
        """    if (e.evt.button === 0 && !e.evt.altKey) {
      if (isVectorMode) {
        if (activeColor !== null || activeLayer?.type === 'road') {
          const stage = e.target.getStage();
          if (stage) {
            const pos = getRelativePointerPosition(stage);
            setCurrentLine([pos.x, pos.y]);
          }
        }
      } else {""",
        """    if (e.evt.button === 0 && !e.evt.altKey) {
      if (isVectorMode) {
        if (activeColor !== null || activeLayer?.type === 'road') {
          const stage = e.target.getStage();
          if (stage) {
            const pos = getRelativePointerPosition(stage);
            if (activeLayer?.type === 'road' && activeRoadStyle !== 'highlight') {
              if (!isDrawingRoad) {
                setIsDrawingRoad(true);
                setCurrentLine([pos.x, pos.y, pos.x, pos.y]);
              } else if (currentLine) {
                setCurrentLine([...currentLine, pos.x, pos.y]);
              }
            } else {
              setCurrentLine([pos.x, pos.y]);
            }
          }
        }
      } else {"""
    ),
    (
        """    if (isVectorMode && currentLine) {
      const stage = e.target.getStage();
      if (stage) {
        const pos = getRelativePointerPosition(stage);
        setCurrentLine([...currentLine, pos.x, pos.y]);
      }
    }""",
        """    if (isVectorMode && currentLine) {
      const stage = e.target.getStage();
      if (stage) {
        const pos = getRelativePointerPosition(stage);
        if (isDrawingRoad) {
           const newPts = [...currentLine];
           newPts[newPts.length - 2] = pos.x;
           newPts[newPts.length - 1] = pos.y;
           setCurrentLine(newPts);
        } else {
           setCurrentLine([...currentLine, pos.x, pos.y]);
        }
      }
    }"""
    ),
    (
        """    if (isVectorMode && currentLine) {
      setLayers(prev => prev.map(l => {
        if (l.id === activeLayerId && (l.type === 'river' || l.type === 'cliff' || l.type === 'border' || l.type === 'label' || l.type === 'road')) {""",
        """    if (isVectorMode && currentLine) {
      if (!isDrawingRoad) {
        setLayers(prev => prev.map(l => {
          if (l.id === activeLayerId && (l.type === 'river' || l.type === 'cliff' || l.type === 'border' || l.type === 'label' || l.type === 'road')) {"""
    ),
    (
        """          } as VectorLayer;
        }
        return l;
      }));
      setCurrentLine(null);
    } else {
      setIsPaintingHex(false);
    }""",
        """            } as VectorLayer;
          }
          return l;
        }));
        setCurrentLine(null);
      }
    } else {
      setIsPaintingHex(false);
    }"""
    ),
    (
        "  return (\n    <Stage",
        """  const handleDblClick = (e: KonvaEventObject<MouseEvent>) => {
    if (isVectorMode && isDrawingRoad && currentLine && currentLine.length >= 4) {
      const finalPoints = currentLine.slice(0, -2);
      setLayers(prev => prev.map(l => {
        if (l.id === activeLayerId && l.type === 'road') {
          const newData = {
            id: Date.now().toString(),
            points: finalPoints,
            stroke: activeColor || '#000000',
            strokeWidth: activeLineWidth,
            tension: 0.5,
            invert: isShiftPressed,
            roadStyle: activeRoadStyle
          };
          return {
            ...l,
            data: [...(l.data as any[]), newData]
          } as VectorLayer;
        }
        return l;
      }));
      setCurrentLine(null);
      setIsDrawingRoad(false);
    }
  };

  return (
    <Stage
      onDblClick={handleDblClick}"""
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
