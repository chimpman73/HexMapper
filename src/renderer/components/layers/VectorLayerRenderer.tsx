import React from 'react';
import { Group, Line } from 'react-konva';
import { Circle } from 'react-konva';
import { VectorLayer, Layer, VectorLine } from '../../types';
import { generateCliffHashes, distToSegment, getRelativePointerPosition } from '../../utils/vectorMath';
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
  roadConfig: any;
  riverConfig: any;
  activeColor: string | null;
  setLayers: React.Dispatch<React.SetStateAction<Layer[]>>;
  setSelectedLineId: (id: string | null) => void;
  setHoveredLineId: (id: string | null) => void;
}

const VectorLayerRenderer: React.FC<VectorLayerRendererProps> = ({
  layer, activeLayer, activeLayerId, hoveredLineId, selectedLineId, isVectorMode,
  activeRoadStyle, activeRiverStyle, roadConfig, riverConfig, activeColor,
  setLayers, setSelectedLineId, setHoveredLineId
}) => {
  return (
    <React.Fragment key={`group-${layer.id}`}>
      {layer.data.map((line) => {
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
