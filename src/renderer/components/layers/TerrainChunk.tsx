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
    
    let imageSrc = undefined;
    if (isImageLayer) {
      const cellData = layer.data[key];
      if (typeof cellData === 'string') {
        imageSrc = cellData;
      } else if (cellData && typeof cellData === 'object') {
        imageSrc = (cellData as any).brushUrl;
      }
    }
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
        onHover={(h, e) => {
          if (!isVectorMode && !isZoomedOut) {
            // Use pointer event buttons instead of isPaintingHex to prevent stale closure bugs
            // e.evt.buttons === 1 means left mouse button is held down
            const isDragging = e && e.evt && e.evt.buttons === 1;
            if (isDragging) handlePaintHex(h);
          }
        }}
        onLeave={() => {
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

export default React.memo(TerrainChunk, (prevProps, nextProps) => {
  if (prevProps.chunkKey !== nextProps.chunkKey) return false;
  if (prevProps.orientation !== nextProps.orientation) return false;
  if (prevProps.isVectorMode !== nextProps.isVectorMode) return false;
  if (prevProps.activeLayerId !== nextProps.activeLayerId) return false;
  if (prevProps.highlightedHexKey !== nextProps.highlightedHexKey) return false;
  if (prevProps.currentStyle !== nextProps.currentStyle) return false;
  if (prevProps.assetsBasePath !== nextProps.assetsBasePath) return false;
  if (prevProps.hasBgImage !== nextProps.hasBgImage) return false;
  if (prevProps.showCoordinates !== nextProps.showCoordinates) return false;
  if (prevProps.activeAction !== nextProps.activeAction) return false;
  if (prevProps.activeBrush !== nextProps.activeBrush) return false;
  if (prevProps.isZoomedOut !== nextProps.isZoomedOut) return false;

  if (prevProps.layer.id !== nextProps.layer.id) return false;
  if (prevProps.layer.visible !== nextProps.layer.visible) return false;

  const prevData = prevProps.layer.data as Record<string, any>;
  const nextData = nextProps.layer.data as Record<string, any>;

  if (prevData === nextData) return true;

  for (let i = 0; i < nextProps.hexes.length; i++) {
    const hex = nextProps.hexes[i];
    const key = `${hex.q},${hex.r},${hex.s}`;
    
    const pVal = prevData[key];
    const nVal = nextData[key];
    
    if (typeof pVal === 'object' && typeof nVal === 'object') {
      if (pVal?.brushUrl !== nVal?.brushUrl) return false;
    } else {
      if (pVal !== nVal) return false;
    }
  }
  return true;
});
