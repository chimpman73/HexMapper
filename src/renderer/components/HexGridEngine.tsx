import React, { useState, useMemo, useRef, useImperativeHandle, forwardRef } from 'react';
import { Stage, Layer, Line, Group, Image as KonvaImage } from 'react-konva';
import * as import_react_konva from 'react-konva';
import { KonvaEventObject } from 'konva/lib/Node';
import HexTile from './HexTile';
import { generateRectangularGrid, HexCube, HexOrientation, isHexEqual, MapLayer, TerrainLayer, VectorLayer, CityLayer, CoastlineLayer, BorderLayer, LayerType, hexToPixel, getHexCorners, HEX_NEIGHBORS } from '../utils/hexMath';

interface HexGridEngineProps {
  orientation: HexOrientation;
  showCoordinates: boolean;
  mapWidth: number;
  mapHeight: number;
  activeBrush: string | null;
  activeColor: string | null;
  activeLineWidth: number;
  layers: MapLayer[];
  setLayers: React.Dispatch<React.SetStateAction<MapLayer[]>>;
  activeLayerId: string;
  bgImagePath: string | null;
  bgScaleX: number;
  bgScaleY: number;
  bgOffsetX: number;
  bgOffsetY: number;
  globalCoastlines?: any[];
  highlightedHexKey?: string | null;
}

export interface HexGridEngineRef {
  exportToDataURL: () => string | null;
}

const generateCliffHashes = (points: number[], invert: boolean | undefined, color: string, width: number, id: string, opacity: number = 1) => {
  const hashes = [];
  const hashLength = width * 3; 
  const hashSpacing = Math.max(10, width * 2); 
  let distSinceLastHash = 0;
  
  for (let i = 0; i < points.length - 2; i += 2) {
    const x1 = points[i];
    const y1 = points[i+1];
    const x2 = points[i+2];
    const y2 = points[i+3];
    
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if (dist === 0) continue;
    
    distSinceLastHash += dist;
    
    if (distSinceLastHash >= hashSpacing) {
      const nx = -dy / dist;
      const ny = dx / dist;
      
      const dirX = invert ? -nx : nx;
      const dirY = invert ? -ny : ny;
      
      hashes.push(
        <Line 
          key={`hash-${id}-${i}`}
          points={[x1, y1, x1 + dirX * hashLength, y1 + dirY * hashLength]}
          stroke={color}
          strokeWidth={Math.max(1, width / 2)}
          lineCap="round"
          opacity={opacity}
        />
      );
      distSinceLastHash = 0;
    }
  }
  return hashes;
};

const HexGridEngine = forwardRef<HexGridEngineRef, HexGridEngineProps>(({ 
  orientation, showCoordinates, mapWidth, mapHeight, activeBrush, activeColor, activeLineWidth, layers, setLayers, activeLayerId,
  bgImagePath, bgScaleX, bgScaleY, bgOffsetX, bgOffsetY, globalCoastlines = [], highlightedHexKey
}, ref) => {
  const stageRef = useRef<any>(null);

  useImperativeHandle(ref, () => ({
    exportToDataURL: () => {
      if (stageRef.current) {
        return stageRef.current.toDataURL({ pixelRatio: 3 });
      }
      return null;
    }
  }));

  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 50, y: 50 });
  const [hoveredHex, setHoveredHex] = useState<HexCube | null>(null);
  
  // Interaction states
  const [isPaintingHex, setIsPaintingHex] = useState(false);
  const [currentLine, setCurrentLine] = useState<number[] | null>(null);
  const [isShiftPressed, setIsShiftPressed] = useState(false);
  const [hoveredLineId, setHoveredLineId] = useState<string | null>(null);
  
  // Right-click panning state
  const [isRightClickPan, setIsRightClickPan] = useState(false);
  const [lastPanPos, setLastPanPos] = useState({ x: 0, y: 0 });

  const [bgImageObj, setBgImageObj] = useState<HTMLImageElement | null>(null);

  React.useEffect(() => {
    if (bgImagePath) {
      const img = new window.Image();
      img.onload = () => {
        console.log("Background image loaded successfully");
        setBgImageObj(img);
      };
      img.onerror = (e) => {
        console.error("Failed to load background image", e);
      };
      img.src = `local://file?path=${encodeURIComponent(bgImagePath)}`;
    } else {
      setBgImageObj(null);
    }
  }, [bgImagePath]);

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.key === 'Shift') setIsShiftPressed(true); };
    const up = (e: KeyboardEvent) => { if (e.key === 'Shift') setIsShiftPressed(false); };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  const grid = useMemo(() => generateRectangularGrid(mapWidth, mapHeight, orientation), [mapWidth, mapHeight, orientation]);

  const proceduralEdges = useMemo(() => {
    const edges: Array<{ id: string; points: number[]; color: string; type: LayerType }> = [];
    
    layers.forEach(layer => {
      if ((layer.type === 'coastline' || layer.type === 'border') && layer.visible) {
        for (const key in layer.data) {
          const rawVal = layer.data[key] as string;
          if (!rawVal) continue;
          
          const color = layer.type === 'coastline' ? '#3b82f6' : rawVal;

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
                const offsetAmount = layer.type === 'coastline' ? (rand - 0.5) * 5 : 0; 
                
                edges.push({
                  id: `${layer.id}-${key}-${idx}`,
                  points: [c1.x, c1.y, midX + nx * offsetAmount, midY + ny * offsetAmount, c2.x, c2.y],
                  color: layer.type === 'coastline' ? '#222222' : color,
                  type: layer.type
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
  const isVectorMode = activeLayer && (activeLayer.type === 'river' || activeLayer.type === 'cliff' || activeLayer.type === 'label');

  const handlePaintHex = (hex: HexCube) => {
    if (isVectorMode) return;
    
    // For border we use activeColor, for coastline we now use activeBrush
    const brushValue = activeLayer?.type === 'border' ? activeColor : activeBrush;
    if (brushValue === undefined) return;
    
    const key = `${hex.q},${hex.r},${hex.s}`;
    setLayers(prev => prev.map(l => {
      if (l.id === activeLayerId && (l.type === 'terrain' || l.type === 'city' || l.type === 'coastline' || l.type === 'border')) {
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

    const newScale = e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;
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
      setIsRightClickPan(true);
      setLastPanPos({ x: e.evt.clientX, y: e.evt.clientY });
      return;
    }
    
    if (e.evt.button === 0 && !e.evt.altKey) {
      if (isVectorMode) {
        if (activeColor !== null) {
          const stage = e.target.getStage();
          if (stage) {
            const pos = getRelativePointerPosition(stage);
            setCurrentLine([pos.x, pos.y]);
          }
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
              stroke: activeColor || '#000000',
              strokeWidth: activeLineWidth,
              tension: 0.5,
              invert: isShiftPressed
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
      ref={stageRef}
      width={window.innerWidth - 250 - 250} 
      height={window.innerHeight - 50}
      draggable={false} 
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
        {/* Background Image Layer */}
        {bgImageObj && (
          <Layer>
            <Group x={bgOffsetX} y={bgOffsetY} scaleX={bgScaleX} scaleY={bgScaleY}>
              <import_react_konva.Image image={bgImageObj} />
            </Group>
          </Layer>
        )}

      <Layer>
        {layers.map(layer => {
          if (!layer.visible) return null;

          if (layer.type === 'terrain' || layer.type === 'city' || layer.type === 'coastline' || layer.type === 'border') {
            const hLayer = layer as TerrainLayer | CityLayer | CoastlineLayer | BorderLayer;
            const tiles = grid.map((hex) => {
              const key = `${hex.q},${hex.r},${hex.s}`;
              const isMouseHovered = (!isVectorMode && activeLayerId === layer.id && hoveredHex) ? isHexEqual(hex, hoveredHex) : false;
              const isHovered = isMouseHovered || highlightedHexKey === key;
              
              const isColorLayer = layer.type === 'border';
              const isImageLayer = layer.type === 'terrain' || layer.type === 'city' || layer.type === 'coastline';
              const imageSrc = isImageLayer ? hLayer.data[key] : undefined;
              
              let fillColor = undefined;
              if (isColorLayer && hLayer.data[key]) {
                fillColor = layer.type === 'border' ? hLayer.data[key] + '33' : hLayer.data[key];
              } else if ((layer.type === 'terrain' || layer.type === 'coastline') && bgImagePath && !hLayer.data[key]) {
                fillColor = 'transparent';
              }

              return (
                <HexTile
                  key={`hex-${layer.id}-${key}`}
                  hex={hex}
                  orientation={orientation}
                  isHovered={isHovered}
                  imageSrc={imageSrc}
                  fillColor={fillColor}
                  isBaseLayer={layer.type === 'terrain'}
                  isActiveLayer={activeLayerId === layer.id}
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

            if (layer.type === 'coastline' || layer.type === 'border') {
              const edgesToDraw = proceduralEdges.filter(e => e.id.startsWith(layer.id + '-'));
              
              // Apply clipping mask ONLY to the coastline image tiles, NOT the procedural edges
              let renderedTiles = <>{tiles}</>;
              if (layer.type === 'coastline' && globalCoastlines && globalCoastlines.length > 0) {
                renderedTiles = (
                  <Group 
                    clipFunc={(ctx) => {
                      ctx.beginPath();
                      globalCoastlines.forEach((pathPoints: any[]) => {
                        if (pathPoints.length > 0) {
                          ctx.moveTo(pathPoints[0].x, pathPoints[0].y);
                          for (let i = 1; i < pathPoints.length; i++) {
                            ctx.lineTo(pathPoints[i].x, pathPoints[i].y);
                          }
                          ctx.closePath();
                        }
                      });
                      ctx.clip('evenodd');
                    }}
                  >
                    {tiles}
                  </Group>
                );
              }

              return (
                <React.Fragment key={`group-${layer.id}`}>
                  {renderedTiles}
                  {edgesToDraw.map(edge => (
                    <Line
                      key={edge.id}
                      points={edge.points}
                      stroke={edge.color}
                      strokeWidth={edge.type === 'coastline' ? 3 : 5}
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
            return (
              <React.Fragment key={`group-${layer.id}`}>
                {vLayer.data.map((line, i) => (
                  <Group 
                    key={`line-frag-${layer.id}-${line.id}`}
                    onMouseDown={(e) => {
                      if (isVectorMode && activeColor === null && activeLayerId === layer.id) {
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
                    }}
                    onMouseEnter={(e) => {
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
                ))}
              </React.Fragment>
            );
          }
        })}

        {/* Draw the current freehand line in progress */}
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
        )}
      </Layer>
    </Stage>
  );
});

export default HexGridEngine;
