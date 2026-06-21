import React, { useLayoutEffect, useRef } from 'react';
import { Group } from 'react-konva';
import Konva from 'konva';
import { HexCube, TerrainLayer, CityLayer, CoastlineLayer, BorderLayer, HexOrientation } from '../../types';
import { isHexEqual } from '../../utils/hexMath';
import HexTile from '../HexTile';

interface TerrainChunkProps {
  chunkKey: string;
  hexes: HexCube[];
  layer: TerrainLayer | CityLayer | CoastlineLayer | BorderLayer;
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
  isZoomedOut: boolean;
}

const TerrainChunk: React.FC<TerrainChunkProps> = ({
  chunkKey, hexes, layer, orientation, isVectorMode, activeLayerId, hoveredHex, highlightedHexKey,
  currentStyle, assetsBasePath, hasBgImage, showCoordinates, isPaintingHex,
  setHoveredHex, handlePaintHex, activeAction, activeBrush, isZoomedOut
}) => {
  const groupRef = useRef<Konva.Group>(null);

  useLayoutEffect(() => {
    if (groupRef.current) {
      if (isZoomedOut) {
        // Clear old cache before recaching to prevent memory leaks or graphical glitches
        groupRef.current.clearCache();
        // pixelRatio: 1 is fine since this is only cached when zoomed far out
        groupRef.current.cache({ pixelRatio: 1 });
      } else {
        groupRef.current.clearCache();
      }
    }
  }, [isZoomedOut, hexes, layer.data, activeLayerId, hoveredHex, highlightedHexKey, showCoordinates, hasBgImage, activeBrush, activeAction]);

  const tiles = hexes.map((hex) => {
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
          if (!isVectorMode && !isZoomedOut) {
            setHoveredHex(h);
            if (isPaintingHex) handlePaintHex(h);
          }
        }}
        onLeave={() => {
          if (!isVectorMode && !isZoomedOut) setHoveredHex(null);
        }}
        onPointerDown={(e) => {
          if (!isVectorMode && !isZoomedOut && e && e.evt && e.evt.button === 0 && !e.evt.altKey) {
            handlePaintHex(hex);
          }
        }}
        showCoordinates={showCoordinates}
      />
    );
  });

  return (
    <Group ref={groupRef} listening={!isZoomedOut}>
      {tiles}
    </Group>
  );
};

export default React.memo(TerrainChunk);
