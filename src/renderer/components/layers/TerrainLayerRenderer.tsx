import React from 'react';
import { Group, Line } from 'react-konva';
import { HexCube, TerrainLayer, CityLayer, CoastlineLayer, BorderLayer, HexOrientation } from '../../types';
import { isHexEqual } from '../../utils/hexMath';
import HexTile from '../HexTile';

import TerrainChunk from './TerrainChunk';

interface TerrainLayerRendererProps {
  layer: TerrainLayer | CityLayer | CoastlineLayer | BorderLayer;
  visibleChunks: { key: string, hexes: HexCube[] }[];
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

const TerrainLayerRenderer: React.FC<TerrainLayerRendererProps> = ({
  layer, visibleChunks, orientation, isVectorMode, activeLayerId, hoveredHex, highlightedHexKey,
  currentStyle, assetsBasePath, hasBgImage, showCoordinates, isPaintingHex,
  setHoveredHex, handlePaintHex, activeAction, activeBrush, isZoomedOut
}) => {
  const chunks = visibleChunks.map((chunk) => {
    return (
      <TerrainChunk
        key={`chunk-${layer.id}-${chunk.key}`}
        chunkKey={chunk.key}
        hexes={chunk.hexes}
        layer={layer}
        orientation={orientation}
        isVectorMode={isVectorMode}
        activeLayerId={activeLayerId}
        hoveredHex={hoveredHex}
        highlightedHexKey={highlightedHexKey}
        currentStyle={currentStyle}
        assetsBasePath={assetsBasePath}
        hasBgImage={hasBgImage}
        showCoordinates={showCoordinates}
        isPaintingHex={isPaintingHex}
        setHoveredHex={setHoveredHex}
        handlePaintHex={handlePaintHex}
        activeAction={activeAction}
        activeBrush={activeBrush}
        isZoomedOut={isZoomedOut}
      />
    );
  });

  return <>{chunks}</>;
};

export default React.memo(TerrainLayerRenderer);
