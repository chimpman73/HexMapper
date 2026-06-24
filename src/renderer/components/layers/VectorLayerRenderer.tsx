import React from 'react';
import { Group, Line, Shape } from 'react-konva';
import { Circle } from 'react-konva';
import { VectorLayer, Layer, VectorLine, CliffLayer } from '../../types';
import { distToSegment, getRelativePointerPosition } from '../../utils/vectorMath';
import { CliffHashes } from './CliffHashes';
import { pixelToHex, hexToPixel, getHexCorners } from '../../utils/hexMath';
import { generateFractalLine } from '../../utils/fractalMath';
import { useMapStore } from '../../store/mapStore';
import { computeRiverFlows, FlowResult } from '../../utils/riverFlowMath';
import Konva from 'konva';
import { Image as KonvaImage } from 'react-konva';

const RiverFeatureImage: React.FC<{ feature: import('../../types').VectorFeature, x: number, y: number, rotation: number, opacity: number }> = React.memo(({ feature, x, y, rotation, opacity }) => {
  const [image, setImage] = React.useState<HTMLImageElement | null>(null);
  const assetsBasePath = useMapStore(state => state.assetsBasePath);
  const currentStyle = useMapStore(state => state.currentStyle);

  React.useEffect(() => {
    const img = new window.Image();
    let src = feature.brushUrl;
    if (src && !src.startsWith('local://') && assetsBasePath && currentStyle) {
      src = `local://file?path=${encodeURIComponent(`${assetsBasePath}/styles/${currentStyle}/tiles/${src}`)}`;
    }
    img.src = src;
    img.onload = () => setImage(img);
  }, [feature.brushUrl, assetsBasePath, currentStyle]);

  if (!image) return null;

  // Render at half the size of a standard hex tile
  return (
    <KonvaImage
      id={feature.id}
      image={image}
      x={x}
      y={y}
      scaleX={0.5}
      scaleY={0.5}
      offsetX={image.width / 2}
      offsetY={image.height / 2}
      rotation={rotation}
      opacity={opacity}
    />
  );
});

const PatternFilledShape: React.FC<{ line: import('../../types').VectorLine & { displayPoints: number[] }, assetsBasePath: string, currentStyle: string }> = React.memo(({ line, assetsBasePath, currentStyle }) => {
  const [image, setImage] = React.useState<HTMLImageElement | null>(null);
  React.useEffect(() => {
    if (!line.fillPatternUrl) return;
    const img = new window.Image();
    let src = line.fillPatternUrl;
    if (!src.startsWith('local://')) {
       src = `local://file?path=${encodeURIComponent(`${assetsBasePath}/styles/${currentStyle}/textures/${src}`)}`;
    }
    img.src = src;
    img.onload = () => setImage(img);
  }, [line.fillPatternUrl, assetsBasePath, currentStyle]);

  return (
    <Shape
      fill={!image ? (line.fill || '#3b82f6') : undefined}
      fillPatternImage={image || undefined}
      fillPatternRepeat="repeat"
      sceneFunc={(context, shape) => {
        context.beginPath();
        const pts = line.displayPoints;
        if (pts.length >= 4) {
          context.moveTo(pts[0], pts[1]);
          for (let i = 2; i < pts.length; i += 2) {
            context.lineTo(pts[i], pts[i+1]);
          }
          context.closePath();
        }
        if (line.holes) {
          for (const hole of line.holes) {
            if (hole.length >= 4) {
              context.moveTo(hole[0], hole[1]);
              for (let i = 2; i < hole.length; i += 2) {
                context.lineTo(hole[i], hole[i+1]);
              }
              context.closePath();
            }
          }
        }
        context.fillStrokeShape(shape);
      }}
      listening={false}
    />
  );
}, (prev, next) => 
  prev.line.id === next.line.id && 
  prev.line.displayPoints === next.line.displayPoints && 
  prev.line.fill === next.line.fill && 
  prev.line.fillPatternUrl === next.line.fillPatternUrl && 
  prev.assetsBasePath === next.assetsBasePath && 
  prev.currentStyle === next.currentStyle
);

interface VectorLayerRendererProps {
  layer: VectorLayer | CliffLayer;
  activeLayer: Layer | undefined;
  activeLayerId: string | null;
  hoveredLineId: string | null;
  selectedLineId: string | null;
  isVectorMode: boolean;
  activeRoadStyle: string;
  activeRiverStyle: string;
  activeCoastlineStyle: string;
  roadConfig: any;
  riverConfig: any;
  activeColor: string | null;
  coastlines: VectorLine[];
  setLayers: React.Dispatch<React.SetStateAction<Layer[]>>;
  setSelectedLineId: (id: string | null) => void;
  setHoveredLineId: (id: string | null) => void;
}

import { BoundingBox } from '../../utils/hexMath';

const VectorLayerRenderer: React.FC<VectorLayerRendererProps & { visibleBounds?: BoundingBox }> = ({
  layer, activeLayer, activeLayerId, hoveredLineId, selectedLineId, isVectorMode,
  activeRoadStyle, activeRiverStyle, activeCoastlineStyle, roadConfig, riverConfig, activeColor,
  coastlines, setLayers, setSelectedLineId, setHoveredLineId, visibleBounds
}) => {
  const selectedVertex = useMapStore(state => state.selectedVertex);
  const setSelectedVertex = useMapStore(state => state.setSelectedVertex);
  const activeAction = useMapStore(state => state.activeAction);

  const updateLines = React.useCallback((updater: (lines: VectorLine[]) => VectorLine[]) => {
    setLayers(prev => prev.map(l => {
      if (l.id === layer.id) {
        if (l.type === 'cliff') {
           const cl = l as CliffLayer;
           return { ...cl, data: { ...cl.data, lines: updater(cl.data.lines) } };
        } else {
           const vl = l as VectorLayer;
           return { ...vl, data: updater(vl.data) };
        }
      }
      return l;
    }));
  }, [layer.id, setLayers]);

  const processedLines = React.useMemo(() => {
    const lines = layer.type === 'cliff' ? (layer.data as any).lines : layer.data;
    if (!Array.isArray(lines)) return [];
    
    return lines.filter((line: VectorLine) => {
      if (!visibleBounds) return true;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (let i = 0; i < line.points.length; i += 2) {
        if (line.points[i] < minX) minX = line.points[i];
        if (line.points[i] > maxX) maxX = line.points[i];
        if (line.points[i+1] < minY) minY = line.points[i+1];
        if (line.points[i+1] > maxY) maxY = line.points[i+1];
      }
      return !(maxX < visibleBounds.minX || minX > visibleBounds.maxX || maxY < visibleBounds.minY || minY > visibleBounds.maxY);
    }).map((line: VectorLine) => {
      let displayPoints = line.points;
      if (layer.type === 'coastline' && line.coastlineStyle === 'fractal') {
         displayPoints = generateFractalLine(line.points, 3, 10);
      }
      return { ...line, displayPoints };
    });
  }, [layer.data, layer.type, visibleBounds]);

  const riverFlows = React.useMemo(() => {
    if (layer.type !== 'river') return null;
    return computeRiverFlows(layer.data as VectorLine[], 5);
  }, [layer.data, layer.type]);

  return (
    <React.Fragment key={`group-${layer.id}`}>
      {layer.type === 'coastline' && processedLines.length > 0 && (
        <Group opacity={layer.opacity}>
          {processedLines.map((line) => (
            <PatternFilledShape 
              key={`fill-${line.id}`} 
              line={line as any} 
              assetsBasePath={useMapStore.getState().assetsBasePath} 
              currentStyle={useMapStore.getState().currentStyle} 
            />
          ))}
        </Group>
      )}
      {processedLines.map((line) => {
        let roadDash;
        let strokeColor = hoveredLineId === line.id ? '#ff5252' : line.stroke;
        if (layer.type === 'coastline' && hoveredLineId !== line.id) {
          strokeColor = '#222222';
        }
        let isHighlighted = false;
        let innerTunnelColor;
        if (activeLayerId === layer.id && activeAction === 'highlight') {
          isHighlighted = true;
        }
        
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
            strokeColor = hoveredLineId === line.id ? '#ff5252' : (styleConfig.color || line.stroke || '#3b82f6');
            roadDash = styleConfig.dash?.length > 0 ? styleConfig.dash : undefined;
          } else {
            if (line.riverStyle === 'stream') {
              roadDash = [5, 5];
              strokeColor = hoveredLineId === line.id ? '#ff5252' : (line.stroke || '#60a5fa');
            } else if (line.riverStyle === 'lava') {
              strokeColor = hoveredLineId === line.id ? '#ff5252' : (line.stroke || '#eba030');
            } else {
              strokeColor = hoveredLineId === line.id ? '#ff5252' : (line.stroke || '#3b82f6');
            }
          }
        }
        
        const displayPoints = line.displayPoints;

        return (
        <Group 
          key={`line-frag-${layer.id}-${line.id}`}
          onDblClick={(e) => {
            if (isVectorMode && activeLayerId === layer.id && selectedLineId === line.id) {
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
                updateLines(lines => lines.map(dl => dl.id === line.id ? { ...dl, points: newPoints } : dl));
              }
            }
          }}
          onMouseDown={(e) => {
            if (isVectorMode && activeLayerId === layer.id) {
              const state = useMapStore.getState();
              const isEraser = state.activeAction === 'erase';
              if (isEraser) {
                e.cancelBubble = true;
                const clickedNode = e.target;
                if (clickedNode.attrs.id && clickedNode.attrs.id.startsWith('feat_')) {
                  const featId = clickedNode.attrs.id;
                  updateLines(lines => lines.map(dl => {
                    if (dl.id === line.id) {
                      return { ...dl, features: dl.features?.filter(f => f.id !== featId) };
                    }
                    return dl;
                  }));
                  return;
                }
                
                setHoveredLineId(null);
                updateLines(lines => lines.filter(dl => dl.id !== line.id));
              } else if (layer.type === 'road' || layer.type === 'river' || layer.type === 'coastline' || layer.type === 'border' || layer.type === 'cliff') {
                e.cancelBubble = true;
                setSelectedLineId(line.id);
              }
            }
          }}
          onMouseEnter={(e) => {
            if (isVectorMode && (activeColor === null || layer.type === 'road' || layer.type === 'river' || layer.type === 'coastline' || layer.type === 'border' || layer.type === 'cliff') && activeLayerId === layer.id) {
              const stage = e.target.getStage();
              if (stage) stage.container().style.cursor = 'pointer';
              setHoveredLineId(line.id);
            }
          }}
          onMouseLeave={(e) => {
            if (isVectorMode && (activeColor === null || layer.type === 'road' || layer.type === 'river' || layer.type === 'coastline' || layer.type === 'border' || layer.type === 'cliff') && activeLayerId === layer.id) {
              const stage = e.target.getStage();
              if (stage) stage.container().style.cursor = 'crosshair';
              if (hoveredLineId === line.id) setHoveredLineId(null);
            }
          }}
        >
          {isHighlighted && (
            <Line
              points={displayPoints}
              stroke="#ffff00"
              strokeWidth={line.strokeWidth + 8}
              tension={line.tension}
              lineCap="round"
              lineJoin="round"
              closed={layer.type === 'coastline'}
              opacity={0.6}
              listening={false}
              shadowColor="#ffff00"
              shadowBlur={15}
            />
          )}
          {layer.type === 'river' && riverFlows ? (
            <Group>
              {riverFlows[line.id]?.map((segment, idx) => {
                if (segment.isTaper && segment.points.length >= 4) {
                  const x1 = segment.points[0], y1 = segment.points[1];
                  const x2 = segment.points[2], y2 = segment.points[3];
                  const dx = x2 - x1, dy = y2 - y1;
                  const len = Math.sqrt(dx*dx + dy*dy);
                  const nx = len === 0 ? 0 : -dy / len;
                  const ny = len === 0 ? 0 : dx / len;
                  const endW = segment.width / 2;
                  
                  const mx = x1 + dx / 2;
                  const my = y1 + dy / 2;
                  
                  const restPoints = [mx, my];
                  for (let i = 2; i < segment.points.length; i++) {
                     restPoints.push(segment.points[i]);
                  }
                  
                  return (
                    <Group key={`river-seg-${line.id}-${idx}`}>
                      <Line
                        points={[
                          x1, y1,
                          mx + nx * endW, my + ny * endW,
                          mx - nx * endW, my - ny * endW
                        ]}
                        fill={strokeColor}
                        closed={true}
                        opacity={hoveredLineId === line.id ? 0.5 : layer.opacity}
                      />
                      <Line
                        points={restPoints}
                        stroke={strokeColor}
                        strokeWidth={segment.width}
                        hitStrokeWidth={Math.max(20, segment.width)}
                        tension={line.tension}
                        lineCap="round"
                        lineJoin="round"
                        dash={roadDash}
                        opacity={hoveredLineId === line.id ? 0.5 : layer.opacity}
                      />
                    </Group>
                  );
                }
                
                return (
                  <Line
                    key={`river-seg-${line.id}-${idx}`}
                    points={segment.points}
                    stroke={strokeColor}
                    strokeWidth={segment.width}
                    hitStrokeWidth={Math.max(20, segment.width)}
                    tension={line.tension}
                    lineCap="round"
                    lineJoin="round"
                    dash={roadDash}
                    opacity={hoveredLineId === line.id ? 0.5 : layer.opacity}
                  />
                );
              })}
            </Group>
          ) : (
            <React.Fragment>
              <Line
                points={displayPoints}
                stroke={strokeColor}
                strokeWidth={line.strokeWidth}
                hitStrokeWidth={Math.max(20, line.strokeWidth)}
                tension={line.tension}
                lineCap="round"
                lineJoin="round"
                closed={layer.type === 'coastline'}
                dash={roadDash}
                opacity={hoveredLineId === line.id ? 0.5 : layer.opacity}
                hitFunc={(ctx, shape) => {
                  ctx.beginPath();
                  const pts = shape.points();
                  if (pts.length >= 4) {
                    ctx.moveTo(pts[0], pts[1]);
                    for(let i=2; i<pts.length; i+=2) {
                      ctx.lineTo(pts[i], pts[i+1]);
                    }
                    if (shape.closed()) ctx.closePath();
                  }
                  ctx.strokeShape(shape);
                }}
              />
              {line.holes && line.holes.map((holePts, idx) => (
                <Line
                  key={`hole-${line.id}-${idx}`}
                  points={holePts}
                  stroke={strokeColor}
                  strokeWidth={line.strokeWidth}
                  hitStrokeWidth={Math.max(20, line.strokeWidth)}
                  tension={line.tension}
                  lineCap="round"
                  lineJoin="round"
                  closed={true}
                  dash={roadDash}
                  opacity={hoveredLineId === line.id ? 0.5 : layer.opacity}
                  listening={false}
                />
              ))}
            </React.Fragment>
          )}

          {line.features?.map(feat => {
             const x1 = line.points[feat.segmentIndex * 2];
             const y1 = line.points[feat.segmentIndex * 2 + 1];
             const x2 = line.points[feat.segmentIndex * 2 + 2];
             const y2 = line.points[feat.segmentIndex * 2 + 3];
             
             if (x1 === undefined || x2 === undefined) return null;

             const x = x1 + (x2 - x1) * feat.t;
             const y = y1 + (y2 - y1) * feat.t;
             
             const dx = x2 - x1;
             const dy = y2 - y1;
             const angle = Math.atan2(dy, dx) * 180 / Math.PI + 90;
             
             return <RiverFeatureImage key={feat.id} feature={feat} x={x} y={y} rotation={angle} opacity={layer.opacity} />;
          })}

          {layer.type === 'road' && line.roadStyle === 'tunnel' && (
             <Line
                points={displayPoints}
                stroke={innerTunnelColor}
                strokeWidth={Math.max(1, line.strokeWidth * (roadConfig?.tunnel?.innerWidthMultiplier ?? 0.6))}
                tension={line.tension}
                lineCap="round"
                lineJoin="round"
                opacity={hoveredLineId === line.id ? 0.5 : layer.opacity}
                listening={false}
             />
          )}
          {layer.type === 'cliff' && (
            <CliffHashes 
              points={displayPoints} 
              invert={line.invert} 
              color={hoveredLineId === line.id ? '#ff5252' : line.stroke || '#000'} 
              width={line.strokeWidth} 
              id={line.id} 
              opacity={hoveredLineId === line.id ? 0.5 : layer.opacity} 
            />
          )}
          {selectedLineId === line.id && (layer.type === 'road' || layer.type === 'river' || layer.type === 'coastline' || layer.type === 'border' || layer.type === 'cliff') && (
            <Group>
              {Array.from({ length: line.points.length / 2 }).map((_, ptIndex) => (
                <Circle
                  key={`anchor-${line.id}-${ptIndex}`}
                  x={line.points[ptIndex * 2]}
                  y={line.points[ptIndex * 2 + 1]}
                  radius={5}
                  hitStrokeWidth={15}
                  fill={selectedVertex?.lineId === line.id && selectedVertex?.index === ptIndex ? "#ffff00" : "#ffffff"}
                  stroke="#ff5252"
                  strokeWidth={2}
                  draggable
                  onDragMove={(e) => {
                     const newPoints = [...line.points];
                     let px = e.target.x();
                     let py = e.target.y();
                     
                     // Snapping logic for rivers
                     if (layer.type === 'river' && (ptIndex === 0 || ptIndex === (line.points.length / 2) - 1)) {
                       let bestSnapDist = 20;
                       let snappedPoint = null;
                       
                       setLayers(prev => {
                         prev.forEach(l => {
                           if (l.type === 'coastline') {
                             (l.data as import('../types').VectorLine[]).forEach(cLine => {
                               for (let i = 0; i < cLine.points.length - 2; i += 2) {
                                 const p1 = { x: cLine.points[i], y: cLine.points[i+1] };
                                 const p2 = { x: cLine.points[i+2], y: cLine.points[i+3] };
                                 // Simple point to segment distance
                                 const l2 = (p2.x - p1.x)*(p2.x - p1.x) + (p2.y - p1.y)*(p2.y - p1.y);
                                 let t = 0;
                                 if (l2 > 0) t = Math.max(0, Math.min(1, ((px - p1.x) * (p2.x - p1.x) + (py - p1.y) * (p2.y - p1.y)) / l2));
                                 const projX = p1.x + t * (p2.x - p1.x);
                                 const projY = p1.y + t * (p2.y - p1.y);
                                 const dist = Math.sqrt((px - projX)*(px - projX) + (py - projY)*(py - projY));
                                 
                                 if (dist < bestSnapDist) {
                                   bestSnapDist = dist;
                                   snappedPoint = { x: projX, y: projY };
                                 }
                               }
                             });
                           }
                         });
                         return prev;
                       });
                       
                       if (snappedPoint) {
                         px = snappedPoint.x;
                         py = snappedPoint.y;
                         e.target.x(px);
                         e.target.y(py);
                       }
                     }
                     
                     // Snapping logic for borders
                     if (layer.type === 'border' && useMapStore.getState().activeBorderStyle === 'snapped') {
                       const state = useMapStore.getState();
                       const hex = pixelToHex({x: px, y: py}, state.orientation);
                       const center = hexToPixel(hex, state.orientation);
                       const cornersRaw = getHexCorners(center, state.orientation);
                       let minDist = Infinity;
                       let snappedPoint = null;
                       for (let i = 0; i < 6; i++) {
                         const cx = cornersRaw[i*2];
                         const cy = cornersRaw[i*2+1];
                         const dist = Math.sqrt((cx - px)**2 + (cy - py)**2);
                         if (dist < minDist) {
                           minDist = dist;
                           snappedPoint = { x: cx, y: cy };
                         }
                       }
                       if (snappedPoint) {
                         px = snappedPoint.x;
                         py = snappedPoint.y;
                         e.target.x(px);
                         e.target.y(py);
                       }
                     }
                     
                     newPoints[ptIndex * 2] = px;
                     newPoints[ptIndex * 2 + 1] = py;
                     updateLines(lines => lines.map(dl => dl.id === line.id ? { ...dl, points: newPoints } : dl));
                  }}
                  onMouseEnter={(e) => {
                     const stage = e.target.getStage();
                     if (stage) stage.container().style.cursor = 'grab';
                  }}
                  onMouseLeave={(e) => {
                     const stage = e.target.getStage();
                     if (stage) stage.container().style.cursor = 'pointer';
                  }}
                  onMouseDown={(e) => {
                     e.cancelBubble = true;
                     setSelectedVertex({ lineId: line.id, index: ptIndex });
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
};

export default React.memo(VectorLayerRenderer);
