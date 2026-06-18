import React from 'react';
import { Group, Line } from 'react-konva';
import { HexCube, TerrainLayer, CityLayer, CoastlineLayer, BorderLayer, HexOrientation } from '../../types';
import { isHexEqual } from '../../utils/hexMath';
import HexTile from '../HexTile';

interface TerrainLayerRendererProps {
  layer: TerrainLayer | CityLayer | CoastlineLayer | BorderLayer;
  grid: HexCube[];
  orientation: HexOrientation;
  isVectorMode: boolean;
  activeLayerId: string | null;
  hoveredHex: HexCube | null;
  highlightedHexKey: string | null;
  currentStyle: string | null;
  assetsBasePath: string | null;
  hasBgImage: boolean;
  showCoordinates: boolean;
  isPaintingHex: boolean;
  globalBorders: { x: number, y: number }[][] | null;
  proceduralEdges: Array<{ id: string, points: number[], color: string, type: string }>;
  setHoveredHex: (h: HexCube | null) => void;
  handlePaintHex: (h: HexCube) => void;
}

const TerrainLayerRenderer: React.FC<TerrainLayerRendererProps> = ({
  layer, grid, orientation, isVectorMode, activeLayerId, hoveredHex, highlightedHexKey,
  currentStyle, assetsBasePath, hasBgImage, showCoordinates, isPaintingHex, globalBorders,
  proceduralEdges, setHoveredHex, handlePaintHex
}) => {
  const tiles = grid.map((hex) => {
    const key = `${hex.q},${hex.r},${hex.s}`;
    const isMouseHovered = (!isVectorMode && activeLayerId === layer.id && hoveredHex) ? isHexEqual(hex, hoveredHex) : false;
    const isHovered = isMouseHovered || highlightedHexKey === key;
    
    const isColorLayer = layer.type === 'border';
    const isImageLayer = layer.type === 'terrain' || layer.type === 'city' || layer.type === 'coastline';
    
    let imageSrc = isImageLayer ? layer.data[key] : undefined;
    
    if (imageSrc && !imageSrc.startsWith('local://') && assetsBasePath && currentStyle) {
      imageSrc = `local://file?path=${encodeURIComponent(`${assetsBasePath}/styles/${currentStyle}/tiles/${imageSrc}`)}`;
    }
    
    let fillColor = undefined;
    if (isColorLayer && layer.data[key]) {
      fillColor = layer.type === 'border' ? layer.data[key] + '33' : layer.data[key];
    } else if ((layer.type === 'terrain' || layer.type === 'coastline') && hasBgImage && !layer.data[key]) {
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
    
    let renderedTiles = <>{tiles}</>;
    if (layer.type === 'coastline') {
      const layerVectors = layer.vectors;
      if (layerVectors && layerVectors.length > 0) {
        renderedTiles = (
          <Group 
            clipFunc={(ctx) => {
              ctx.beginPath();
              layerVectors.forEach((pathPoints: {x: number, y: number}[]) => {
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
              const flattenedPoints = pathPoints.flatMap((p: {x: number, y: number}) => [p.x, p.y]);
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

  return <>{tiles}</>;
};

export default TerrainLayerRenderer;
