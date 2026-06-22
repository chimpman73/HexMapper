import React, { useState, useMemo, useRef, useImperativeHandle, forwardRef } from 'react';
import { Stage, Layer, Line, Group } from 'react-konva';
import * as import_react_konva from 'react-konva';
import { KonvaEventObject } from 'konva/lib/Node';
import HexTile from './HexTile';
import { generateRectangularGrid, hexToPixel, getHexCorners, isHexEqual, HEX_NEIGHBORS, isHexInBounds } from '../utils/hexMath';
import { HexCube, HexOrientation, MapLayer, TerrainLayer, VectorLayer, CityLayer, CoastlineLayer, BorderLayer, LayerType, RoadStyle, RiverStyle } from '../types';
import { useMapStore } from '../store/mapStore';
import BgImageRenderer from './BgImageRenderer';
import BrushCursorOverlay from './BrushCursorOverlay';

interface HexGridEngineProps {}

export interface HexGridEngineRef {
  exportToDataURL: () => string | null;
}

import { generateCliffHashes } from '../utils/vectorMath';
import { useMapInteraction } from '../hooks/useMapInteraction';
import GridLayerRenderer from './layers/GridLayerRenderer';
import TerrainLayerRenderer from './layers/TerrainLayerRenderer';
import VectorLayerRenderer from './layers/VectorLayerRenderer';
import CliffHexRenderer from './layers/CliffHexRenderer';
import CityLabelOverlay from './layers/CityLabelOverlay';
import { LegendOverlay } from './layers/LegendOverlay';

import Konva from 'konva';
import { Image as KonvaImage } from 'react-konva';


const HexGridEngine = forwardRef<HexGridEngineRef, HexGridEngineProps>((props, ref) => {
  const {
    orientation, showCoordinates, mapWidth, mapHeight, activeBrush, activeFeatureBrush, activeColor, activeBorderColor, activeLineWidth, activeBorderWidth, activeRoadStyle, activeRiverStyle, activeCoastlineStyle, roadConfig, riverConfig, layers, setLayers, activeLayerId, bgScaleX, bgScaleY, bgOffsetX, bgOffsetY, globalCoastlines, globalBorders, highlightedHexKey, currentStyle, assetsBasePath, activeAction, mapVariables
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

  const visibleBounds = useMemo(() => {
    const stageWidth = window.innerWidth - 500;
    const stageHeight = window.innerHeight - 50;
    return {
      minX: -position.x / scale,
      minY: -position.y / scale,
      maxX: (-position.x + stageWidth) / scale,
      maxY: (-position.y + stageHeight) / scale,
    };
  }, [position.x, position.y, scale]);

  const visibleGrid = useMemo(() => {
    return grid.filter(h => isHexInBounds(h, orientation, visibleBounds));
  }, [grid, orientation, visibleBounds]);

  const gridChunks = useMemo(() => {
    const CHUNK_SIZE = 20;
    const map = new Map<string, HexCube[]>();
    grid.forEach(hex => {
      const chunkQ = Math.floor(hex.q / CHUNK_SIZE);
      const chunkR = Math.floor(hex.r / CHUNK_SIZE);
      const chunkKey = `${chunkQ},${chunkR}`;
      if (!map.has(chunkKey)) map.set(chunkKey, []);
      map.get(chunkKey)!.push(hex);
    });
    
    return Array.from(map.entries()).map(([key, hexes]) => {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      hexes.forEach(h => {
         const center = hexToPixel(h, orientation);
         const r = 35; // approx hex size padding
         if (center.x - r < minX) minX = center.x - r;
         if (center.x + r > maxX) maxX = center.x + r;
         if (center.y - r < minY) minY = center.y - r;
         if (center.y + r > maxY) maxY = center.y + r;
      });
      return { key, hexes, bounds: { minX, minY, maxX, maxY } };
    });
  }, [grid, orientation]);

  const visibleGridChunks = useMemo(() => {
     return gridChunks.filter(chunk => {
        const b1 = chunk.bounds;
        const b2 = visibleBounds;
        return !(b1.maxX < b2.minX || b1.minX > b2.maxX || b1.maxY < b2.minY || b1.minY > b2.maxY);
     });
  }, [gridChunks, visibleBounds]);

  const isZoomedOut = scale < 0.3;
  const effectiveShowCoordinates = showCoordinates && scale >= 0.5;

  const [rawPointerPos, setRawPointerPos] = useState<{x: number, y: number} | null>(null);

  const isTerrainOrCity = activeLayer?.type === 'terrain' || activeLayer?.type === 'city';
  const isRiverFeature = activeLayer?.type === 'river' && activeFeatureBrush !== null;
  const showBrushOverlay = activeAction === 'paint' && ((isTerrainOrCity && activeBrush) || isRiverFeature);

  const getCursor = () => {
    if (activeAction === 'move' || isRightClickPan) return 'grab';
    if (activeAction === 'select') return 'pointer';
    if (activeAction === 'highlight') return 'crosshair';
    if (activeAction === 'erase') return 'crosshair';
    if (showBrushOverlay) return 'none';
    if (isPaintingHex || isVectorMode) return 'crosshair';
    return 'default';
  };

  const handleStageMouseMove = (e: KonvaEventObject<MouseEvent>) => {
    handleMouseMove(e);
    const stage = stageRef.current;
    if (stage) {
      const pos = stage.getPointerPosition();
      if (pos) {
        const logicalX = (pos.x - stage.x()) / stage.scaleX();
        const logicalY = (pos.y - stage.y()) / stage.scaleY();
        setRawPointerPos({x: logicalX, y: logicalY});
      }
    }
  };

  const handleStageMouseLeave = (e: KonvaEventObject<MouseEvent>) => {
    handleMouseUp(e);
    setRawPointerPos(null);
  };

  return (
    <React.Fragment>
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
      style={{ cursor: getCursor() }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleStageMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleStageMouseLeave}
      onContextMenu={(e) => { e.evt.preventDefault(); }}
    >
      <Layer listening={!isZoomedOut}>
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
            if (scale < 0.3) return null;
            return <GridLayerRenderer key={`group-${layer.id}`} layer={layer} grid={visibleGrid} orientation={orientation} />;
          }

          if (layer.type === 'terrain' || layer.type === 'city') {
            return (
              <TerrainLayerRenderer
                key={`group-${layer.id}`}
                layer={layer as any}
                visibleChunks={visibleGridChunks}
                orientation={orientation}
                isVectorMode={isVectorMode || false}
                activeLayerId={activeLayerId}
                hoveredHex={hoveredHex}
                highlightedHexKey={highlightedHexKey}
                currentStyle={currentStyle}
                assetsBasePath={assetsBasePath}
                hasBgImage={hasBgImage}
                showCoordinates={effectiveShowCoordinates}
                isPaintingHex={isPaintingHex}
                setHoveredHex={setHoveredHex}
                handlePaintHex={handlePaintHex}
                activeAction={activeAction}
                activeBrush={activeBrush}
                isZoomedOut={isZoomedOut}
              />
            );
          }

          const coastlines = layers.filter(l => l.type === 'coastline').flatMap(l => l.data as import('../types').VectorLine[]);
          
          if (layer.type === 'cliff') {
            const cliffLayer = layer as import('../types').CliffLayer;
            return (
              <Group key={`group-${layer.id}`}>
                <CliffHexRenderer
                  layer={cliffLayer}
                  grid={visibleGrid}
                  orientation={orientation}
                  isVectorMode={isVectorMode || false}
                  activeLayerId={activeLayerId}
                  hoveredHex={hoveredHex}
                  highlightedHexKey={highlightedHexKey}
                  currentStyle={currentStyle}
                  assetsBasePath={assetsBasePath}
                  showCoordinates={effectiveShowCoordinates}
                  isPaintingHex={isPaintingHex}
                  setHoveredHex={setHoveredHex}
                  handlePaintHex={handlePaintHex}
                  activeAction={activeAction}
                  activeBrush={activeBrush}
                />
                <VectorLayerRenderer
                  layer={cliffLayer}
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
                  coastlines={coastlines}
                  setLayers={setLayers}
                  setSelectedLineId={setSelectedLineId}
                  setHoveredLineId={setHoveredLineId}
                  visibleBounds={visibleBounds}
                />
              </Group>
            );
          }

          if (layer.type === 'legend') {
            return (
              <Group key={`group-${layer.id}`}>
                <LegendOverlay layers={[layer]} mapVariables={mapVariables} />
              </Group>
            );
          }

          const vLayer = layer as import('../types').VectorLayer;
          return (
            <Group key={`group-${layer.id}`}>
              <VectorLayerRenderer
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
                coastlines={coastlines}
                setLayers={setLayers}
                setSelectedLineId={setSelectedLineId}
                setHoveredLineId={setHoveredLineId}
                visibleBounds={visibleBounds}
              />
              {layer.type === 'label' && (
                <CityLabelOverlay
                  layers={layers}
                  orientation={orientation}
                  mapVariables={mapVariables}
                  visibleBounds={visibleBounds}
                />
              )}
            </Group>
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
                    : activeLayer?.type === 'cliff'
                    ? (activeColor || '#555555')
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
            {activeLayer?.type === 'cliff' && generateCliffHashes(currentLine, isShiftPressed, activeColor || '#555555', activeLineWidth, 'current')}
          </React.Fragment>
        )}
      </Layer>
      <Layer listening={false}>
        {showBrushOverlay && rawPointerPos && (
           <BrushCursorOverlay 
             url={(activeLayer?.type === 'river' ? activeFeatureBrush : activeBrush) || ''} 
             x={rawPointerPos.x} 
             y={rawPointerPos.y} 
           />
        )}
      </Layer>
    </Stage>
    </React.Fragment>
  );
});


export default HexGridEngine;
