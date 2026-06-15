import React, { useState, useMemo } from 'react';
import { Stage, Layer, Line } from 'react-konva';
import { KonvaEventObject } from 'konva/lib/Node';
import HexTile from './HexTile';
import { generateRectangularGrid, HexCube, HexOrientation, isHexEqual, MapLayer, TerrainLayer, VectorLayer, CityLayer, CoastlineLayer, hexToPixel, getHexCorners, HEX_NEIGHBORS } from '../utils/hexMath';

interface HexGridEngineProps {
  orientation: HexOrientation;
  showCoordinates: boolean;
  mapWidth: number;
  mapHeight: number;
  activeBrush: string | null;
  activeColor: string | null;
  layers: MapLayer[];
  setLayers: React.Dispatch<React.SetStateAction<MapLayer[]>>;
  activeLayerId: string;
}

const HexGridEngine: React.FC<HexGridEngineProps> = ({ 
  orientation, showCoordinates, mapWidth, mapHeight, activeBrush, activeColor, layers, setLayers, activeLayerId 
}) => {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 50, y: 50 });
  const [hoveredHex, setHoveredHex] = useState<HexCube | null>(null);
  
  // Interaction states
  const [isPaintingHex, setIsPaintingHex] = useState(false);
  const [currentLine, setCurrentLine] = useState<number[] | null>(null);
  
  // Right-click panning state
  const [isRightClickPan, setIsRightClickPan] = useState(false);
  const [lastPanPos, setLastPanPos] = useState({ x: 0, y: 0 });

  const grid = useMemo(() => generateRectangularGrid(mapWidth, mapHeight, orientation), [mapWidth, mapHeight, orientation]);

  const coastlineEdges = useMemo(() => {
    const edges: Array<{ id: string; points: number[]; color: string }> = [];
    
    layers.forEach(layer => {
      if (layer.type === 'coastline' && layer.visible) {
        for (const key in layer.data) {
          const color = layer.data[key] as string;
          if (!color) continue;

          const [q, r, s] = key.split(',').map(Number);
          const center = hexToPixel({ q, r, s }, orientation);
          const cornersRaw = getHexCorners(center, orientation);
          const cPts = [];
          for (let i = 0; i < 12; i += 2) cPts.push({ x: cornersRaw[i], y: cornersRaw[i + 1] });

          HEX_NEIGHBORS.forEach((offset, idx) => {
            const nKey = `${q + offset.q},${r + offset.r},${s + offset.s}`;
            if (!layer.data[nKey]) {
              const nCenter = hexToPixel({ q: q + offset.q, r: r + offset.r, s: s + offset.s }, orientation);
              const nCornersRaw = getHexCorners(nCenter, orientation);
              const nPts = [];
              for (let i = 0; i < 12; i += 2) nPts.push({ x: nCornersRaw[i], y: nCornersRaw[i + 1] });

              const shared = cPts.filter(c => nPts.some(nc => Math.abs(c.x - nc.x) < 1 && Math.abs(c.y - nc.y) < 1));

              if (shared.length === 2) {
                const c1 = shared[0];
                const c2 = shared[1];
                const midX = (c1.x + c2.x) / 2;
                const midY = (c1.y + c2.y) / 2;
                const dx = c2.x - c1.x;
                const dy = c2.y - c1.y;
                const len = Math.sqrt(dx * dx + dy * dy);
                
                const hash = Math.sin(c1.x * 12.9898 + c1.y * 78.233) * 43758.5453;
                const rand = hash - Math.floor(hash);
                
                const nx = -dy / len;
                const ny = dx / len;
                const offsetAmount = (rand - 0.5) * 5; 
                
                edges.push({
                  id: `${layer.id}-${key}-${idx}`,
                  points: [c1.x, c1.y, midX + nx * offsetAmount, midY + ny * offsetAmount, c2.x, c2.y],
                  color: '#222222' // Use a distinct dark color for the coastline edge, not the water fill color!
                });
              }
            }
          });
        }
      }
    });
    return edges;
  }, [layers, orientation]);

  const activeLayer = layers.find(l => l.id === activeLayerId);
  const isVectorMode = activeLayer && (activeLayer.type === 'river' || activeLayer.type === 'cliff' || activeLayer.type === 'border' || activeLayer.type === 'label');

  const handlePaintHex = (hex: HexCube) => {
    if (isVectorMode) return;
    
    // For terrain/city we use activeBrush (image), for coastline we use activeColor
    const brushValue = activeLayer?.type === 'coastline' ? activeColor : activeBrush;
    if (brushValue === undefined) return;
    
    const key = `${hex.q},${hex.r},${hex.s}`;
    setLayers(prev => prev.map(l => {
      if (l.id === activeLayerId && (l.type === 'terrain' || l.type === 'city' || l.type === 'coastline')) {
        const newData = { ...l.data };
        if (brushValue === null) {
          delete newData[key];
        } else {
          newData[key] = brushValue;
        }
        return { ...l, data: newData };
      }
      return l;
    }));
  };

  const getRelativePointerPosition = (stage: any) => {
    const pointer = stage.getPointerPosition();
    const currentScale = stage.scaleX();
    return {
      x: (pointer.x - stage.x()) / currentScale,
      y: (pointer.y - stage.y()) / currentScale,
    };
  };

  const handleWheel = (e: KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = e.target.getStage();
    if (!stage) return;

    const scaleBy = 1.1;
    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    const newScale = e.evt.deltaY < 0 ? oldScale / scaleBy : oldScale * scaleBy;
    setScale(Math.max(0.1, Math.min(newScale, 5)));

    setPosition({
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    });
  };

  const handleDragEnd = (e: KonvaEventObject<DragEvent>) => {
    setPosition({ x: e.target.x(), y: e.target.y() });
  };

  const handleMouseDown = (e: KonvaEventObject<MouseEvent>) => {
    if (e.evt.button === 2) {
      // Right click -> start pan
      setIsRightClickPan(true);
      setLastPanPos({ x: e.evt.clientX, y: e.evt.clientY });
      return;
    }
    
    if (e.evt.button === 0 && !e.evt.altKey) {
      if (isVectorMode) {
        const stage = e.target.getStage();
        if (stage) {
          const pos = getRelativePointerPosition(stage);
          setCurrentLine([pos.x, pos.y]);
        }
      } else {
        setIsPaintingHex(true);
      }
    }
  };

  const handleMouseMove = (e: KonvaEventObject<MouseEvent>) => {
    if (isRightClickPan) {
      const dx = e.evt.clientX - lastPanPos.x;
      const dy = e.evt.clientY - lastPanPos.y;
      setPosition(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      setLastPanPos({ x: e.evt.clientX, y: e.evt.clientY });
      return;
    }

    if (isVectorMode && currentLine) {
      const stage = e.target.getStage();
      if (stage) {
        const pos = getRelativePointerPosition(stage);
        setCurrentLine([...currentLine, pos.x, pos.y]);
      }
    }
  };

  const handleMouseUp = (e: KonvaEventObject<MouseEvent>) => {
    if (e.evt.button === 2) {
      setIsRightClickPan(false);
      return;
    }

    if (isVectorMode && currentLine) {
      setLayers(prev => prev.map(l => {
        if (l.id === activeLayerId && (l.type === 'river' || l.type === 'cliff' || l.type === 'border' || l.type === 'label')) {
          return {
            ...l,
            data: [...(l.data as any[]), {
              id: Date.now().toString(),
              points: currentLine,
              stroke: activeColor,
              strokeWidth: 4,
              tension: 0.5
            }]
          } as VectorLayer;
        }
        return l;
      }));
      setCurrentLine(null);
    } else {
      setIsPaintingHex(false);
    }
  };

  return (
    <Stage
      width={window.innerWidth - 250 - 250} // Subtract palette width AND layer panel width
      height={window.innerHeight - 50}
      draggable={false} // Custom right-click drag implementation
      onWheel={handleWheel}
      x={position.x}
      y={position.y}
      scaleX={scale}
      scaleY={scale}
      onDragEnd={handleDragEnd}
      style={{ cursor: isRightClickPan ? 'grabbing' : ((isPaintingHex || isVectorMode) ? 'crosshair' : 'default') }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onContextMenu={(e) => { e.evt.preventDefault(); }}
    >
      {/* We use a single Layer for all elements so z-indexing works via rendering order */}
      <Layer>
        {layers.map(layer => {
          if (!layer.visible) return null;

          if (layer.type === 'terrain' || layer.type === 'city' || layer.type === 'coastline') {
            const hLayer = layer as TerrainLayer | CityLayer | CoastlineLayer;
            const tiles = grid.map((hex) => {
              const key = `${hex.q},${hex.r},${hex.s}`;
              // Only highlight hovered hex if we are on THIS active layer and it's terrain mode
              const isHovered = (!isVectorMode && activeLayerId === layer.id && hoveredHex) ? isHexEqual(hex, hoveredHex) : false;
              
              const isCoastline = layer.type === 'coastline';
              const imageSrc = isCoastline ? undefined : hLayer.data[key];
              const fillColor = isCoastline ? hLayer.data[key] : undefined;

              return (
                <HexTile
                  key={`hex-${layer.id}-${key}`}
                  hex={hex}
                  orientation={orientation}
                  isHovered={isHovered}
                  imageSrc={imageSrc}
                  fillColor={fillColor}
                  isBaseLayer={layer.type === 'terrain'}
                  onHover={(h) => {
                    if (!isVectorMode) {
                      setHoveredHex(h);
                      if (isPaintingHex) handlePaintHex(h);
                    }
                  }}
                  onLeave={() => {
                    if (!isVectorMode) setHoveredHex(null);
                  }}
                  onPointerDown={(e) => {
                    if (!isVectorMode && e && e.evt && e.evt.button === 0 && !e.evt.altKey) {
                      handlePaintHex(hex);
                    }
                  }}
                  showCoordinates={showCoordinates}
                />
              );
            });

            if (layer.type === 'coastline') {
              const edgesToDraw = coastlineEdges.filter(e => e.id.startsWith(layer.id + '-'));
              return (
                <React.Fragment key={`group-${layer.id}`}>
                  {tiles}
                  {edgesToDraw.map(edge => (
                    <Line
                      key={edge.id}
                      points={edge.points}
                      stroke={edge.color}
                      strokeWidth={3}
                      tension={0}
                      lineCap="round"
                      lineJoin="round"
                      opacity={layer.opacity}
                    />
                  ))}
                </React.Fragment>
              );
            }
            return tiles;
          } else {
            const vLayer = layer as VectorLayer;
            return vLayer.data.map((line, i) => (
              <Line
                key={`line-${layer.id}-${line.id}`}
                points={line.points}
                stroke={line.stroke}
                strokeWidth={line.strokeWidth}
                tension={line.tension}
                lineCap="round"
                lineJoin="round"
                opacity={layer.opacity}
              />
            ));
          }
        })}

        {/* Draw the current freehand line in progress */}
        {currentLine && (
          <Line
            points={currentLine}
            stroke={activeColor}
            strokeWidth={4}
            tension={0.5}
            lineCap="round"
            lineJoin="round"
          />
        )}
      </Layer>
    </Stage>
  );
};

export default HexGridEngine;
