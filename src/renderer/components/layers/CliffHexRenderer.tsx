import React from 'react';
import { CliffLayer, HexCube, HexOrientation } from '../../types';
import HexTile from '../HexTile';
import { getDownslopePolygon, isHexIntersectedByLine } from '../../utils/cliffMath';
import { isHexEqual } from '../../utils/hexMath';

interface CliffHexRendererProps {
  layer: CliffLayer;
  grid: HexCube[];
  orientation: HexOrientation;
  isVectorMode: boolean;
  activeLayerId: string | null;
  hoveredHex: HexCube | null;
  highlightedHexKey: string | null;
  currentStyle: string | null;
  assetsBasePath: string | null;
  showCoordinates: boolean;
  isPaintingHex: boolean;
  setHoveredHex: (h: HexCube | null) => void;
  handlePaintHex: (h: HexCube) => void;
  activeAction?: string;
  activeBrush?: string | null;
}

const CliffHexRenderer: React.FC<CliffHexRendererProps> = ({
  layer, grid, orientation, isVectorMode, activeLayerId, hoveredHex, highlightedHexKey,
  currentStyle, assetsBasePath, showCoordinates, isPaintingHex, setHoveredHex, handlePaintHex,
  activeAction, activeBrush
}) => {
  // Handle legacy saved maps where layer.data might be an array
  let hexes: Record<string, string> = {};
  let lines: any[] = [];
  
  if (Array.isArray(layer.data)) {
    lines = layer.data;
  } else if (layer.data) {
    hexes = layer.data.hexes || {};
    lines = layer.data.lines || [];
  }

  const tiles = grid.map(hex => {
    const key = `${hex.q},${hex.r},${hex.s}`;
    let imageSrc = hexes[key];
    
    // Calculate if it's hovered
    // Note: for cliff layers, we can paint when activeAction === 'paint' (which is technically not vector mode, but it's a vector layer palette)
    // Actually, when a brush is selected, activeAction='paint'.
    const isMouseHovered = (activeLayerId === layer.id && hoveredHex) ? isHexEqual(hex, hoveredHex) : false;
    let isHovered = isMouseHovered || highlightedHexKey === key;
    
    if (activeAction === 'highlight' && activeLayerId === layer.id && activeBrush && imageSrc === activeBrush) {
      isHovered = true;
    }

    let isPaintable = false;
    if (activeAction === 'paint' && activeBrush && activeLayerId === layer.id) {
       for (const line of lines) {
         if (isHexIntersectedByLine(hex, orientation, line.points)) {
           isPaintable = true;
           break;
         }
       }
       if (isPaintable) {
         isHovered = true;
       }
    }

    if (!imageSrc && !isHovered && !isPaintable) return null; // optimize, we don't need to show empty transparent hexes if not hovered

    if (imageSrc && !imageSrc.startsWith('local://') && assetsBasePath && currentStyle) {
      imageSrc = `local://file?path=${encodeURIComponent(`${assetsBasePath}/styles/${currentStyle}/tiles/${imageSrc}`)}`;
    }
    
    let clipPolygon: number[] | undefined;
    if (imageSrc) {
       let intersectPolygon = null;
       for (const line of lines) {
          const poly = getDownslopePolygon(hex, orientation, line.points, !line.invert);
          if (poly) {
            intersectPolygon = poly;
            break;
          }
       }
       clipPolygon = intersectPolygon || undefined;
    }

    return (
      <HexTile
        key={`cliffhex-${layer.id}-${key}`}
        hex={hex}
        orientation={orientation}
        isHovered={isHovered}
        imageSrc={imageSrc}
        isBaseLayer={false}
        isActiveLayer={activeLayerId === layer.id}
        clipPolygon={clipPolygon}
        onHover={(h, e) => {
          const isDragging = e && e.evt && e.evt.buttons === 1;
          if (isDragging) handlePaintHex(h);
        }}
        onLeave={() => {
        }}
        onPointerDown={(e) => {
          if (e && e.evt && e.evt.button === 0 && !e.evt.altKey) {
            handlePaintHex(hex);
          }
        }}
        showCoordinates={showCoordinates}
      />
    );
  });
  
  return <>{tiles}</>;
};

export default React.memo(CliffHexRenderer, (prevProps, nextProps) => {
  if (prevProps.orientation !== nextProps.orientation) return false;
  if (prevProps.isVectorMode !== nextProps.isVectorMode) return false;
  if (prevProps.activeLayerId !== nextProps.activeLayerId) return false;
  if (prevProps.highlightedHexKey !== nextProps.highlightedHexKey) return false;
  if (prevProps.currentStyle !== nextProps.currentStyle) return false;
  if (prevProps.assetsBasePath !== nextProps.assetsBasePath) return false;
  if (prevProps.showCoordinates !== nextProps.showCoordinates) return false;
  if (prevProps.activeAction !== nextProps.activeAction) return false;
  if (prevProps.activeBrush !== nextProps.activeBrush) return false;

  if (prevProps.layer.id !== nextProps.layer.id) return false;
  if (prevProps.layer.visible !== nextProps.layer.visible) return false;
  
  if (prevProps.layer.data !== nextProps.layer.data) return false;
  if (prevProps.grid !== nextProps.grid) return false;
  
  return true;
});
