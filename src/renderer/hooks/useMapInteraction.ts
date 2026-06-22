import { useCallback, useEffect } from 'react';
import { KonvaEventObject } from 'konva/lib/Node';
import Konva from 'konva';
import { useMapStore } from '../store/mapStore';
import { useMapViewport } from './useMapViewport';
import { useHexPainter } from './useHexPainter';
import { useVectorDrawer } from './useVectorDrawer';
import { generateRectangularGrid, buildHexEdgeGraph, findHexEdgePath } from '../utils/hexMath';
import { VectorLayer, VectorLine } from '../types';

export function useMapInteraction() {
  const { 
    layers, setLayers, activeLayerId, activeColor, activeLineWidth, activeBrush, activeRoadStyle, activeRiverStyle, activeCoastlineStyle, activeBorderStyle, activeBorderColor, activeBorderWidth
  } = useMapStore();

  const activeLayer = layers.find(l => l.id === activeLayerId);
  const isVectorMode = activeLayer && (activeLayer.type === 'river' || activeLayer.type === 'cliff' || activeLayer.type === 'label' || activeLayer.type === 'road' || activeLayer.type === 'coastline' || activeLayer.type === 'border');

  const viewport = useMapViewport();
  const hexPainter = useHexPainter();
  const vectorDrawer = useVectorDrawer();

  // Handle undo/redo and viewport keybindings
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      // Ignore keybinds if the user is typing in an input field
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        useMapStore.getState().undo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        useMapStore.getState().redo();
      }
      if (e.key === 'PageUp' || e.key === 'PageDown') {
        e.preventDefault();
        viewport.handlePageZoom(e.key === 'PageUp');
      }

      // Arrow key panning
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        const PAN_SPEED = 50;
        let dx = 0;
        let dy = 0;
        if (e.key === 'ArrowUp') dy = PAN_SPEED;
        if (e.key === 'ArrowDown') dy = -PAN_SPEED;
        if (e.key === 'ArrowLeft') dx = PAN_SPEED;
        if (e.key === 'ArrowRight') dx = -PAN_SPEED;
        
        viewport.setPosition(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      }
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, [viewport]);

  const getRelativePointerPosition = useCallback((stage: Konva.Stage) => {
    const pointer = stage.getPointerPosition();
    const currentScale = stage.scaleX();
    return {
      x: (pointer.x - stage.x()) / currentScale,
      y: (pointer.y - stage.y()) / currentScale,
    };
  }, []);

  const handlePaintHexFacade = useCallback((hex: any) => {
    hexPainter.handlePaintHex(hex, !!isVectorMode, activeLayer);
  }, [hexPainter, isVectorMode, activeLayer]);

  const handleMouseDown = useCallback((e: KonvaEventObject<MouseEvent>) => {
    const state = useMapStore.getState();
    if (e.evt.button === 2 || (e.evt.button === 0 && state.activeAction === 'move')) {
      viewport.setIsRightClickPan(true);
      viewport.setLastPanPos({ x: e.evt.clientX, y: e.evt.clientY });
      
      if (vectorDrawer.isDrawingPath) {
        vectorDrawer.setIsDrawingPath(false);
        vectorDrawer.setCurrentLine(null);
      }
      if (vectorDrawer.selectedLineId !== null) {
        vectorDrawer.setSelectedLineId(null);
      }
      return;
    }
    
    if (e.evt.button === 0 && !e.evt.altKey) {
      if (isVectorMode) {
        const stage = e.target.getStage();
        if (stage && e.target === stage) vectorDrawer.setSelectedLineId(null);
        if (stage) {
          const rawPos = getRelativePointerPosition(stage);
          vectorDrawer.startVectorInteraction(rawPos);
        }
      } else {
        hexPainter.setIsPaintingHex(true);
      }
    }
  }, [
    isVectorMode, getRelativePointerPosition, viewport, vectorDrawer, hexPainter
  ]);

  const handleMouseMove = useCallback((e: KonvaEventObject<MouseEvent>) => {
    if (viewport.isRightClickPan) {
      const dx = e.evt.clientX - viewport.lastPanPos.x;
      const dy = e.evt.clientY - viewport.lastPanPos.y;
      viewport.setPosition(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      viewport.setLastPanPos({ x: e.evt.clientX, y: e.evt.clientY });
      return;
    }

    if (isVectorMode) {
      const stage = e.target.getStage();
      if (stage) {
        const rawPos = getRelativePointerPosition(stage);
        vectorDrawer.updateVectorInteraction(rawPos);
      }
    }
  }, [viewport.isRightClickPan, viewport.lastPanPos, isVectorMode, getRelativePointerPosition, viewport, vectorDrawer]);

  const handleMouseUp = useCallback((e: KonvaEventObject<MouseEvent>) => {
    const state = useMapStore.getState();
    if (e.evt.button === 2 || (e.evt.button === 0 && state.activeAction === 'move')) {
      viewport.setIsRightClickPan(false);
      return;
    }

    if (isVectorMode) {
      vectorDrawer.endVectorInteraction();
    } else {
      hexPainter.setIsPaintingHex(false);
    }
  }, [isVectorMode, viewport, vectorDrawer, hexPainter]);

  const handleDblClick = useCallback(() => {
    if (isVectorMode) {
      vectorDrawer.commitVectorPath();
    }
  }, [isVectorMode, vectorDrawer]);

  useEffect(() => {
    const handleSnap = () => {
      if (vectorDrawer.selectedLineId && activeLayerId) {
        setLayers(prev => prev.map(l => {
          if (l.id === activeLayerId && l.type === 'border') {
            const state = useMapStore.getState();
            const grid = generateRectangularGrid(state.mapWidth, state.mapHeight, state.orientation);
            const graph = buildHexEdgeGraph(state.orientation, grid);
            const vl = l as VectorLayer;
            return {
              ...vl,
              data: vl.data.map((line: any) => {
                if (line.id === vectorDrawer.selectedLineId) {
                  let newPoints: number[] = [];
                  for (let i = 0; i < line.points.length - 2; i += 2) {
                     const p1 = {x: line.points[i], y: line.points[i+1]};
                     const p2 = {x: line.points[i+2], y: line.points[i+3]};
                     const path = findHexEdgePath(p1, p2, graph);
                     if (i === 0) newPoints.push(path[0], path[1]);
                     newPoints.push(...path.slice(2));
                  }
                  return { ...line, points: newPoints, tension: 0, borderStyle: 'snapped' };
                }
                return line;
              })
            };
          }
          return l;
        }));
      }
    };
    window.addEventListener('snapSelectedBorder', handleSnap);
    return () => window.removeEventListener('snapSelectedBorder', handleSnap);
  }, [vectorDrawer.selectedLineId, activeLayerId, setLayers]);

  return {
    scale: viewport.scale, setScale: viewport.setScale,
    position: viewport.position, setPosition: viewport.setPosition,
    isPaintingHex: hexPainter.isPaintingHex, setIsPaintingHex: hexPainter.setIsPaintingHex,
    isDrawingPath: vectorDrawer.isDrawingPath, setIsDrawingPath: vectorDrawer.setIsDrawingPath,
    currentLine: vectorDrawer.currentLine, setCurrentLine: vectorDrawer.setCurrentLine,
    isShiftPressed: vectorDrawer.isShiftPressed, setIsShiftPressed: vectorDrawer.setIsShiftPressed,
    selectedLineId: vectorDrawer.selectedLineId, setSelectedLineId: vectorDrawer.setSelectedLineId,
    hoveredLineId: vectorDrawer.hoveredLineId, setHoveredLineId: vectorDrawer.setHoveredLineId,
    isRightClickPan: viewport.isRightClickPan, setIsRightClickPan: viewport.setIsRightClickPan,
    hoveredHex: hexPainter.hoveredHex, setHoveredHex: hexPainter.setHoveredHex,
    isVectorMode: !!isVectorMode,
    handleWheel: viewport.handleWheel,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleDblClick,
    handlePaintHex: handlePaintHexFacade
  };
}
