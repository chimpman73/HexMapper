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
    orientation, showCoordinates, mapWidth, mapHeight, activeBrush, activeColor, activeLineWidth, activeRoadStyle, activeRiverStyle, roadConfig, riverConfig, layers, setLayers, activeLayerId, bgScaleX, bgScaleY, bgOffsetX, bgOffsetY, globalCoastlines, globalBorders, highlightedHexKey, currentStyle, assetsBasePath
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

  const proceduralEdges = useMemo(() => {
    const edges: Array<{ id: string; points: number[]; color: string; type: LayerType }> = [];
    
    layers.forEach(layer => {
      if ((layer.type === 'coastline' || layer.type === 'border') && layer.visible) {
        for (const key in layer.data) {
          const rawVal = layer.data[key] as string;
          if (!rawVal) continue;
          
          const color = layer.type === 'coastline' ? '#3b82f6' : rawVal;

          const [q, r, s] = key.split(',').map(Number);
          const center = hexToPixel({ q, r, s }, orientation);
          const cornersRaw = getHexCorners(center, orientation);
          const cPts: {x: number, y: number}[] = [];
          for (let i = 0; i < 12; i += 2) cPts.push({ x: cornersRaw[i], y: cornersRaw[i + 1] });

          HEX_NEIGHBORS.forEach((offset, idx) => {
            const nKey = `${q + offset.q},${r + offset.r},${s + offset.s}`;
            if (!layer.data[nKey]) {
              const nCenter = hexToPixel({ q: q + offset.q, r: r + offset.r, s: s + offset.s }, orientation);
              const nCornersRaw = getHexCorners(nCenter, orientation);
              const nPts: {x: number, y: number}[] = [];
              for (let i = 0; i < 12; i += 2) nPts.push({ x: nCornersRaw[i], y: nCornersRaw[i + 1] });

              const shared = cPts.filter(c => nPts.some(nc => Math.abs(c.x - nc.x) < 1 && Math.abs(c.y - nc.y) < 1));

              if (shared.length === 2) {
                const c1 = shared[0];
                const c2 = shared[1];
                const midX = (c1.x + c2.x) / 2;
                const midY = (c1.y + c2.y) / 2;
                const dx = c2.x - c1.x;
                const dy = c2.y - c1.y;
                const len = Math.sqrt(dx * dx + dy * dy);
                
                const hash = Math.sin(c1.x * 12.9898 + c1.y * 78.233) * 43758.5453;
                const rand = hash - Math.floor(hash);
                
                const nx = -dy / len;
                const ny = dx / len;
                const offsetAmount = layer.type === 'coastline' ? (rand - 0.5) * 5 : 0; 
                
                edges.push({
                  id: `${layer.id}-${key}-${idx}`,
                  points: [c1.x, c1.y, midX + nx * offsetAmount, midY + ny * offsetAmount, c2.x, c2.y],
                  color: layer.type === 'coastline' ? '#222222' : color,
                  type: layer.type
                });
              }
            }
          });
        }
      }
    });
    return edges;
  }, [layers, orientation]);



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

          if (layer.type === 'terrain' || layer.type === 'city' || layer.type === 'coastline' || layer.type === 'border') {
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
                globalBorders={globalBorders}
                proceduralEdges={proceduralEdges}
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
                    : (activeColor || '#000000')
                }
                strokeWidth={activeLineWidth}
                tension={0.5}
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
