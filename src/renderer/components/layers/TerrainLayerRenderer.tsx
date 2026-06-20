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
  setHoveredHex: (h: HexCube | null) => void;
  handlePaintHex: (h: HexCube) => void;
  activeAction?: string;
  activeBrush?: string | null;
}

const TerrainLayerRenderer: React.FC<TerrainLayerRendererProps> = ({
  layer, grid, orientation, isVectorMode, activeLayerId, hoveredHex, highlightedHexKey,
  currentStyle, assetsBasePath, hasBgImage, showCoordinates, isPaintingHex,
  setHoveredHex, handlePaintHex, activeAction, activeBrush
}) => {
  const tiles = grid.map((hex) => {
    const key = `${hex.q},${hex.r},${hex.s}`;
    const isMouseHovered = (!isVectorMode && activeLayerId === layer.id && hoveredHex) ? isHexEqual(hex, hoveredHex) : false;
    let isHovered = isMouseHovered || highlightedHexKey === key;
    
    const isColorLayer = layer.type === 'border';
    const isImageLayer = layer.type === 'terrain' || layer.type === 'city';
    
    let imageSrc = isImageLayer ? layer.data[key] : undefined;
    
    if (activeAction === 'highlight' && activeLayerId === layer.id && isImageLayer && activeBrush && imageSrc === activeBrush) {
      isHovered = true;
    }
    
    if (imageSrc && !imageSrc.startsWith('local://') && assetsBasePath && currentStyle) {
      imageSrc = `local://file?path=${encodeURIComponent(`${assetsBasePath}/styles/${currentStyle}/tiles/${imageSrc}`)}`;
    }
    
    let fillColor = undefined;
    if (isColorLayer && layer.data[key]) {
      fillColor = layer.type === 'border' ? layer.data[key] + '33' : layer.data[key];
    } else if (layer.type === 'terrain' && hasBgImage && !layer.data[key]) {
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



  return <>{tiles}</>;
};

export default TerrainLayerRenderer;
