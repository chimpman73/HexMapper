import React from 'react';
import { Group, Line, Shape } from 'react-konva';
import { Circle } from 'react-konva';
import { VectorLayer, Layer, VectorLine } from '../../types';
import { generateCliffHashes, distToSegment, getRelativePointerPosition } from '../../utils/vectorMath';
import { generateFractalLine } from '../../utils/fractalMath';
import Konva from 'konva';

interface VectorLayerRendererProps {
  layer: VectorLayer;
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
  setLayers: React.Dispatch<React.SetStateAction<Layer[]>>;
  setSelectedLineId: (id: string | null) => void;
  setHoveredLineId: (id: string | null) => void;
}

const VectorLayerRenderer: React.FC<VectorLayerRendererProps> = ({
  layer, activeLayer, activeLayerId, hoveredLineId, selectedLineId, isVectorMode,
  activeRoadStyle, activeRiverStyle, activeCoastlineStyle, roadConfig, riverConfig, activeColor,
  setLayers, setSelectedLineId, setHoveredLineId
}) => {
  const processedLines = React.useMemo(() => {
    return layer.data.map((line) => {
      let displayPoints = line.points;
      if (layer.type === 'coastline' && line.coastlineStyle === 'fractal') {
         displayPoints = generateFractalLine(line.points, 3, 10);
      }
      return { ...line, displayPoints };
    });
  }, [layer.data, layer.type]);

  return (
    <React.Fragment key={`group-${layer.id}`}>
      {layer.type === 'coastline' && processedLines.length > 0 && (
        <Shape
          fill={processedLines[0].fill || '#3b82f6'}
          fillRule="evenodd"
          sceneFunc={(context, shape) => {
            context.beginPath();
            processedLines.forEach(line => {
               const pts = line.displayPoints;
               if (pts.length >= 4) {
                 context.moveTo(pts[0], pts[1]);
                 for (let i = 2; i < pts.length; i += 2) {
                   context.lineTo(pts[i], pts[i+1]);
                 }
                 context.closePath();
               }
            });
            context.fillStrokeShape(shape);
          }}
          listening={false}
          opacity={layer.opacity}
        />
      )}
      {processedLines.map((line) => {
        let roadDash;
        let strokeColor = hoveredLineId === line.id ? '#ff5252' : line.stroke;
        if (layer.type === 'coastline' && hoveredLineId !== line.id) {
          strokeColor = '#222222';
        }
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
        
        const displayPoints = line.displayPoints;

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
              } else if (layer.type === 'road' || layer.type === 'river' || layer.type === 'coastline') {
                e.cancelBubble = true;
                setSelectedLineId(line.id);
              }
            }
          }}
          onMouseEnter={(e) => {
            if (isVectorMode && (activeColor === null || layer.type === 'road' || layer.type === 'river' || layer.type === 'coastline') && activeLayerId === layer.id) {
              const stage = e.target.getStage();
              if (stage) stage.container().style.cursor = 'pointer';
              setHoveredLineId(line.id);
            }
          }}
          onMouseLeave={(e) => {
            if (isVectorMode && (activeColor === null || layer.type === 'road' || layer.type === 'river' || layer.type === 'coastline') && activeLayerId === layer.id) {
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
          />
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
          {layer.type === 'cliff' && generateCliffHashes(displayPoints, line.invert, hoveredLineId === line.id ? '#ff5252' : line.stroke, line.strokeWidth, line.id, hoveredLineId === line.id ? 0.5 : layer.opacity)}
          {selectedLineId === line.id && (layer.type === 'road' || layer.type === 'river' || layer.type === 'coastline') && (
            <Group>
              {Array.from({ length: line.points.length / 2 }).map((_, ptIndex) => (
                <Circle
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
                     let px = e.target.x();
                     let py = e.target.y();
                     
                     // Snapping logic for rivers
                     if (layer.type === 'river' && (ptIndex === 0 || ptIndex === (line.points.length / 2) - 1)) {
                       let bestSnapDist = 20;
                       let snappedPoint = null;
                       
                       setLayers(prev => {
                         prev.forEach(l => {
                           if (l.type === 'coastline') {
                             (l.data as VectorLine[]).forEach(cLine => {
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
                     
                     newPoints[ptIndex * 2] = px;
                     newPoints[ptIndex * 2 + 1] = py;
                     setLayers(prev => prev.map(l => {
                       if (l.id === layer.id) {
                         const vl = l as VectorLayer;
                         return { ...vl, data: vl.data.map(dl => dl.id === line.id ? { ...dl, points: newPoints } : dl) };
                       }
                       return l;
                     }));
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

export default VectorLayerRenderer;
