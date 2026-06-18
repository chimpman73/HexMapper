import React, { useState, useMemo, useRef, useImperativeHandle, forwardRef } from 'react';
import { Stage, Layer, Line, Group } from 'react-konva';
import * as import_react_konva from 'react-konva';
import { KonvaEventObject } from 'konva/lib/Node';
import HexTile from './HexTile';
import { generateRectangularGrid, hexToPixel, getHexCorners, isHexEqual, HEX_NEIGHBORS } from '../utils/hexMath';
import { HexCube, HexOrientation, MapLayer, TerrainLayer, VectorLayer, CityLayer, CoastlineLayer, BorderLayer, LayerType, RoadStyle, RiverStyle } from '../types';
import { useMapStore } from '../store/mapStore';
import BgImageRenderer from './BgImageRenderer';

interface HexGridEngineProps {}

export interface HexGridEngineRef {
  exportToDataURL: () => string | null;
}

import { generateCliffHashes, distToSegment } from '../utils/vectorMath';
import { useMapInteraction } from '../hooks/useMapInteraction';

const HexGridEngine = forwardRef<HexGridEngineRef, HexGridEngineProps>((props, ref) => {
  const {
    orientation, showCoordinates, mapWidth, mapHeight, activeBrush, activeColor, activeLineWidth, activeRoadStyle, activeRiverStyle, roadConfig, riverConfig, layers, setLayers, activeLayerId, bgScaleX, bgScaleY, bgOffsetX, bgOffsetY, globalCoastlines, globalBorders, highlightedHexKey, currentStyle, assetsBasePath
  } = useMapStore();
  const stageRef = useRef<any>(null);

  useImperativeHandle(ref, () => ({
    exportToDataURL: () => {
      if (stageRef.current) {
        return stageRef.current.toDataURL({ pixelRatio: 3 });
      }
      return null;
    }
  }));

  const {
    scale, position, isPaintingHex, isDrawingPath, currentLine, isShiftPressed,
    selectedLineId, setSelectedLineId, hoveredLineId, setHoveredLineId,
    isRightClickPan, hoveredHex, setHoveredHex, isVectorMode,
    handleWheel, handleMouseDown, handleMouseMove, handleMouseUp, handleDblClick, handlePaintHex
  } = useMapInteraction();

  const hasBgImage = layers.some(l => l.type === 'bg_image');
  const activeLayer = layers.find(l => l.id === activeLayerId);

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
          const cPts: {x: number, y: number}[] = [];
          for (let i = 0; i < 12; i += 2) cPts.push({ x: cornersRaw[i], y: cornersRaw[i + 1] });

          HEX_NEIGHBORS.forEach((offset, idx) => {
            const nKey = `${q + offset.q},${r + offset.r},${s + offset.s}`;
            if (!layer.data[nKey]) {
              const nCenter = hexToPixel({ q: q + offset.q, r: r + offset.r, s: s + offset.s }, orientation);
              const nCornersRaw = getHexCorners(nCenter, orientation);
              const nPts: {x: number, y: number}[] = [];
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



  return (
    <Stage
      onDblClick={handleDblClick}
      ref={stageRef}
      width={window.innerWidth - 250 - 250} 
      height={window.innerHeight - 50}
      draggable={false} 
      onWheel={handleWheel}
      x={position.x}
      y={position.y}
      scaleX={scale}
      scaleY={scale}
      style={{ cursor: isRightClickPan ? 'grabbing' : ((isPaintingHex || isVectorMode) ? 'crosshair' : 'default') }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onContextMenu={(e) => { e.evt.preventDefault(); }}
    >
      <Layer>
        {layers.map(layer => {
          if (!layer.visible) return null;

          if (layer.type === 'bg_image') {
            return (
              <BgImageRenderer 
                key={`bg-${layer.id}`}
                layer={layer}
                bgScaleX={bgScaleX}
                bgScaleY={bgScaleY}
                bgOffsetX={bgOffsetX}
                bgOffsetY={bgOffsetY}
              />
            );
          }

          if (layer.type === 'group') {
            return null;
          }

          if (layer.type === 'grid') {
            return (
              <Group key={`group-${layer.id}`} opacity={layer.opacity} listening={false}>
                {grid.map((hex) => {
                  const key = `${hex.q},${hex.r},${hex.s}`;
                  return (
                    <Line
                      key={`grid-${key}`}
                      points={getHexCorners(hexToPixel(hex, orientation), orientation)}
                      stroke="#333333"
                      strokeWidth={2}
                      closed
                      listening={false}
                    />
                  );
                })}
              </Group>
            );
          }

          if (layer.type === 'terrain' || layer.type === 'city' || layer.type === 'coastline' || layer.type === 'border') {
            const hLayer = layer as TerrainLayer | CityLayer | CoastlineLayer | BorderLayer;
            const tiles = grid.map((hex) => {
              const key = `${hex.q},${hex.r},${hex.s}`;
              const isMouseHovered = (!isVectorMode && activeLayerId === layer.id && hoveredHex) ? isHexEqual(hex, hoveredHex) : false;
              const isHovered = isMouseHovered || highlightedHexKey === key;
              
              const isColorLayer = layer.type === 'border';
              const isImageLayer = layer.type === 'terrain' || layer.type === 'city' || layer.type === 'coastline';
              
              let imageSrc = isImageLayer ? hLayer.data[key] : undefined;
              
              if (imageSrc && !imageSrc.startsWith('local://') && assetsBasePath && currentStyle) {
                imageSrc = `local://file?path=${encodeURIComponent(`${assetsBasePath}/styles/${currentStyle}/tiles/${imageSrc}`)}`;
              }
              
              let fillColor = undefined;
              if (isColorLayer && hLayer.data[key]) {
                fillColor = layer.type === 'border' ? hLayer.data[key] + '33' : hLayer.data[key];
              } else if ((layer.type === 'terrain' || layer.type === 'coastline') && hasBgImage && !hLayer.data[key]) {
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
              if (layer.type === 'coastline') {
                const layerVectors = layer.vectors;
                if (layerVectors && layerVectors.length > 0) {
                  renderedTiles = (
                    <Group 
                      clipFunc={(ctx) => {
                        ctx.beginPath();
                        layerVectors.forEach((pathPoints: any[]) => {
                          const n = pathPoints.length;
                          if (n > 0) {
                            ctx.moveTo(pathPoints[0].x, pathPoints[0].y);
                            for (let j = 1; j < n; j++) {
                               ctx.lineTo(pathPoints[j].x, pathPoints[j].y);
                            }
                            ctx.closePath();
                          }
                        });
                        ctx.clip("evenodd");
                      }}
                    >
                      {tiles}
                    </Group>
                  );
                }
              }
              if (layer.type === 'border' && globalBorders && globalBorders.length > 0) {
                return (
                  <Group key={layer.id} opacity={layer.opacity}>
                    {globalBorders.map((pathPoints, i) => {
                      if (pathPoints.length > 0) {
                        const flattenedPoints = pathPoints.flatMap((p: any) => [p.x, p.y]);
                        return (
                          <Line
                            key={`global-border-${i}`}
                            points={flattenedPoints}
                            fill="#dc2626" 
                            closed={true}
                            opacity={layer.opacity}
                            tension={0}
                          />
                        );
                      }
                      return null;
                    })}
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
                {vLayer.data.map((line) => {
                  let roadDash;
                  let strokeColor = hoveredLineId === line.id ? '#ff5252' : line.stroke;
                  let innerTunnelColor;
                  let isHighlighted = (activeLayer?.type === 'road' && activeRoadStyle === 'highlight') || (activeLayer?.type === 'river' && activeRiverStyle === 'highlight');
                  
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
                  } else if (layer.type === 'river') {
                    const styleConfig = riverConfig?.[line.riverStyle || 'river'];
                    if (styleConfig) {
                      strokeColor = hoveredLineId === line.id ? '#ff5252' : styleConfig.color;
                      roadDash = styleConfig.dash?.length > 0 ? styleConfig.dash : undefined;
                    } else {
                      if (line.riverStyle === 'stream') {
                        roadDash = [5, 5];
                        strokeColor = hoveredLineId === line.id ? '#ff5252' : '#60a5fa';
                      } else {
                        strokeColor = hoveredLineId === line.id ? '#ff5252' : '#3b82f6';
                      }
                    }
                  }

                  return (
                  <Group 
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
                        } else if (layer.type === 'road' || layer.type === 'river') {
                          e.cancelBubble = true;
                          setSelectedLineId(line.id);
                        }
                      }
                    }}
                    onMouseEnter={(e) => {
                      if (isVectorMode && (activeColor === null || layer.type === 'road' || layer.type === 'river') && activeLayerId === layer.id) {
                        const stage = e.target.getStage();
                        if (stage) stage.container().style.cursor = 'pointer';
                        setHoveredLineId(line.id);
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (isVectorMode && (activeColor === null || layer.type === 'road' || layer.type === 'river') && activeLayerId === layer.id) {
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
                    {selectedLineId === line.id && (layer.type === 'road' || layer.type === 'river') && (
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
                  </Group>
                );
              })}
              </React.Fragment>
            );
          }
        })}

        {/* Draw the current freehand line in progress */}
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
                stroke={
                  activeLayer?.type === 'road' 
                    ? (roadConfig?.[activeRoadStyle || 'road']?.color || (activeRoadStyle === 'path' ? '#8B4513' : '#A0522D')) 
                    : activeLayer?.type === 'river'
                    ? (riverConfig?.[activeRiverStyle || 'river']?.color || (activeRiverStyle === 'stream' ? '#60a5fa' : '#3b82f6'))
                    : (activeColor || '#000000')
                }
                strokeWidth={activeLineWidth}
                tension={0.5}
                lineCap="round"
                lineJoin="round"
                dash={
                  activeLayer?.type === 'road' 
                    ? (roadConfig?.[activeRoadStyle || 'road']?.dash?.length > 0 ? roadConfig[activeRoadStyle || 'road'].dash : (activeRoadStyle === 'path' ? [10, 10] : undefined)) 
                    : activeLayer?.type === 'river'
                    ? (riverConfig?.[activeRiverStyle || 'river']?.dash?.length > 0 ? riverConfig[activeRiverStyle || 'river'].dash : (activeRiverStyle === 'stream' ? [5, 5] : undefined))
                    : undefined
                }
              />
            )}
            {activeLayer?.type === 'cliff' && generateCliffHashes(currentLine, isShiftPressed, activeColor || '#000000', activeLineWidth, 'current')}
          </React.Fragment>
        )}
      </Layer>
    </Stage>
  );
});


export default HexGridEngine;
