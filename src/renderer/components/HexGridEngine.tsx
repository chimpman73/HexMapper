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

import { generateCliffHashes } from '../utils/vectorMath';
import { useMapInteraction } from '../hooks/useMapInteraction';
import GridLayerRenderer from './layers/GridLayerRenderer';
import TerrainLayerRenderer from './layers/TerrainLayerRenderer';
import VectorLayerRenderer from './layers/VectorLayerRenderer';

import Konva from 'konva';

const HexGridEngine = forwardRef<HexGridEngineRef, HexGridEngineProps>((props, ref) => {
  const {
    orientation, showCoordinates, mapWidth, mapHeight, activeBrush, activeColor, activeBorderColor, activeLineWidth, activeBorderWidth, activeRoadStyle, activeRiverStyle, activeCoastlineStyle, roadConfig, riverConfig, layers, setLayers, activeLayerId, bgScaleX, bgScaleY, bgOffsetX, bgOffsetY, globalCoastlines, globalBorders, highlightedHexKey, currentStyle, assetsBasePath
  } = useMapStore();
  const stageRef = useRef<Konva.Stage>(null);

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

  const proceduralEdges: Array<{ id: string; points: number[]; color: string; type: LayerType }> = [];



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
            return <GridLayerRenderer key={`group-${layer.id}`} layer={layer} grid={grid} orientation={orientation} />;
          }

          if (layer.type === 'terrain' || layer.type === 'city') {
            return (
              <TerrainLayerRenderer
                key={`group-${layer.id}`}
                layer={layer as any}
                grid={grid}
                orientation={orientation}
                isVectorMode={isVectorMode || false}
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
              />
            );
          }

          const vLayer = layer as import('../types').VectorLayer;
          return (
            <VectorLayerRenderer
              key={`group-${layer.id}`}
              layer={vLayer}
              activeLayer={activeLayer}
              activeLayerId={activeLayerId}
              hoveredLineId={hoveredLineId}
              selectedLineId={selectedLineId}
              isVectorMode={isVectorMode || false}
              activeRoadStyle={activeRoadStyle || 'road'}
              activeRiverStyle={activeRiverStyle || 'river'}
              activeCoastlineStyle={activeCoastlineStyle || 'smooth'}
              roadConfig={roadConfig}
              riverConfig={riverConfig}
              activeColor={activeColor}
              setLayers={setLayers}
              setSelectedLineId={setSelectedLineId}
              setHoveredLineId={setHoveredLineId}
            />
          );
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
                    : activeLayer?.type === 'coastline'
                    ? '#222222'
                    : activeLayer?.type === 'border'
                    ? activeBorderColor
                    : (activeColor || '#000000')
                }
                strokeWidth={activeLayer?.type === 'border' ? activeBorderWidth : activeLineWidth}
                tension={activeLayer?.type === 'coastline' && useMapStore.getState().activeCoastlineStyle === 'fractal' ? 0 : activeLayer?.type === 'border' && useMapStore.getState().activeBorderStyle === 'snapped' ? 0 : 0.5}
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
