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

  // Handle undo/redo keybindings
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
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
      const isDrawingCliffVector = activeLayer?.type === 'cliff' && !state.activeBrush;
      const isOtherVector = activeLayer?.type === 'road' || activeLayer?.type === 'river' || activeLayer?.type === 'coastline' || activeLayer?.type === 'border';
      
      if (isVectorMode && (isDrawingCliffVector || isOtherVector)) {
        if (activeColor !== null || isDrawingCliffVector || isOtherVector) {
          const stage = e.target.getStage();
          if (stage && e.target === stage) vectorDrawer.setSelectedLineId(null);
          if (stage) {
            const rawPos = getRelativePointerPosition(stage);
            const state = useMapStore.getState();

            if (state.activeAction !== 'paint') return;

            // Handle placing river features
            if (activeLayer?.type === 'river' && state.activeFeatureBrush) {
              let bestLineId: string | null = null;
              let bestSegment = -1;
              let bestT = 0;
              let minDist = Infinity;
              
              (activeLayer.data as import('../types').VectorLine[]).forEach(dl => {
                 for(let i=0; i<dl.points.length-2; i+=2) {
                   const p1 = {x: dl.points[i], y: dl.points[i+1]};
                   const p2 = {x: dl.points[i+2], y: dl.points[i+3]};
                   const l2 = (p2.x - p1.x)*(p2.x - p1.x) + (p2.y - p1.y)*(p2.y - p1.y);
                   let t = 0;
                   if (l2 > 0) t = Math.max(0, Math.min(1, ((rawPos.x - p1.x) * (p2.x - p1.x) + (rawPos.y - p1.y) * (p2.y - p1.y)) / l2));
                   const projX = p1.x + t * (p2.x - p1.x);
                   const projY = p1.y + t * (p2.y - p1.y);
                   const dist = Math.sqrt((rawPos.x - projX)*(rawPos.x - projX) + (rawPos.y - projY)*(rawPos.y - projY));
                   
                   if (dist < 30 && dist < minDist) {
                      minDist = dist;
                      bestLineId = dl.id;
                      bestSegment = i / 2;
                      bestT = t;
                   }
                 }
              });
              
              if (bestLineId) {
                 setLayers(prev => prev.map(l => {
                   if (l.id === activeLayerId) {
                      return {
                        ...l,
                        data: (l.data as import('../types').VectorLine[]).map(dl => {
                           if (dl.id === bestLineId) {
                              return {
                                 ...dl,
                                 features: [...(dl.features || []), {
                                    id: `feat_${Date.now()}`,
                                    brushUrl: state.activeFeatureBrush!,
                                    segmentIndex: bestSegment,
                                    t: bestT
                                 }]
                              };
                           }
                           return dl;
                        })
                      } as import('../types').VectorLayer;
                   }
                   return l;
                 }));
              }
              return; 
            }

            const isBorderSnap = activeLayer?.type === 'border' && state.activeBorderStyle === 'snapped';
            const layerLines = activeLayer?.type === 'cliff' ? (activeLayer?.data as any)?.lines || [] : (Array.isArray(activeLayer?.data) ? activeLayer?.data : []);
            const pos = vectorDrawer.snapPoint(rawPos, isBorderSnap, layerLines);

            if ((activeLayer?.type === 'road' && activeRoadStyle !== 'highlight') || (activeLayer?.type === 'river' && activeRiverStyle !== 'highlight') || (activeLayer?.type === 'border' && state.activeBorderStyle !== 'highlight') || (activeLayer?.type === 'cliff' && state.activeCliffStyle !== 'highlight' && !state.activeBrush)) {
              if (!vectorDrawer.isDrawingPath) {
                vectorDrawer.setIsDrawingPath(true);
                vectorDrawer.setCurrentLine([pos.x, pos.y, pos.x, pos.y]);
                vectorDrawer.setDrawingAnchors([pos.x, pos.y]);
                if (isBorderSnap) {
                   const grid = generateRectangularGrid(state.mapWidth, state.mapHeight, state.orientation);
                   vectorDrawer.setHexEdgeGraph(buildHexEdgeGraph(state.orientation, grid));
                }
              } else if (vectorDrawer.currentLine && vectorDrawer.drawingAnchors.length > 0) {
                if (isBorderSnap && vectorDrawer.hexEdgeGraph) {
                   const lastAnchor = { x: vectorDrawer.drawingAnchors[vectorDrawer.drawingAnchors.length - 2], y: vectorDrawer.drawingAnchors[vectorDrawer.drawingAnchors.length - 1] };
                   const path = findHexEdgePath(lastAnchor, pos, vectorDrawer.hexEdgeGraph);
                   const newAnchors = [...vectorDrawer.drawingAnchors, ...path.slice(2)];
                   vectorDrawer.setDrawingAnchors(newAnchors);
                   vectorDrawer.setCurrentLine([...newAnchors, pos.x, pos.y]);
                } else {
                   const newAnchors = [...vectorDrawer.drawingAnchors, pos.x, pos.y];
                   vectorDrawer.setDrawingAnchors(newAnchors);
                   vectorDrawer.setCurrentLine([...newAnchors, pos.x, pos.y]);
                }
              }
            } else {
              vectorDrawer.setCurrentLine([pos.x, pos.y]);
            }
          }
        }
      } else {
        hexPainter.setIsPaintingHex(true);
      }
    }
  }, [
    vectorDrawer.isDrawingPath, vectorDrawer.selectedLineId, isVectorMode, activeColor, activeLayer, activeRoadStyle, activeRiverStyle, getRelativePointerPosition, vectorDrawer.currentLine,
    viewport, vectorDrawer, hexPainter, setLayers, activeLayerId
  ]);

  const handleMouseMove = useCallback((e: KonvaEventObject<MouseEvent>) => {
    if (viewport.isRightClickPan) {
      const dx = e.evt.clientX - viewport.lastPanPos.x;
      const dy = e.evt.clientY - viewport.lastPanPos.y;
      viewport.setPosition(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      viewport.setLastPanPos({ x: e.evt.clientX, y: e.evt.clientY });
      return;
    }

    if (isVectorMode && vectorDrawer.currentLine) {
      const stage = e.target.getStage();
      if (stage) {
        const rawPos = getRelativePointerPosition(stage);
        const state = useMapStore.getState();
        const isBorderSnap = activeLayer?.type === 'border' && state.activeBorderStyle === 'snapped';
        const layerLines = activeLayer?.type === 'cliff' ? (activeLayer?.data as any)?.lines || [] : (Array.isArray(activeLayer?.data) ? activeLayer?.data : []);
        const pos = vectorDrawer.snapPoint(rawPos, isBorderSnap, layerLines);

        if (vectorDrawer.isDrawingPath) {
           if (isBorderSnap && vectorDrawer.hexEdgeGraph && vectorDrawer.drawingAnchors.length > 0) {
              const lastAnchor = { x: vectorDrawer.drawingAnchors[vectorDrawer.drawingAnchors.length - 2], y: vectorDrawer.drawingAnchors[vectorDrawer.drawingAnchors.length - 1] };
              const path = findHexEdgePath(lastAnchor, pos, vectorDrawer.hexEdgeGraph);
              vectorDrawer.setCurrentLine([...vectorDrawer.drawingAnchors, ...path.slice(2)]);
           } else {
              const newPts = [...vectorDrawer.drawingAnchors];
              newPts.push(pos.x, pos.y);
              vectorDrawer.setCurrentLine(newPts);
           }
        } else {
           vectorDrawer.setCurrentLine([...vectorDrawer.currentLine, pos.x, pos.y]);
        }
      }
    }
  }, [viewport.isRightClickPan, viewport.lastPanPos, isVectorMode, vectorDrawer.currentLine, getRelativePointerPosition, vectorDrawer.isDrawingPath, viewport, vectorDrawer, activeLayer]);

  const handleMouseUp = useCallback((e: KonvaEventObject<MouseEvent>) => {
    const state = useMapStore.getState();
    if (e.evt.button === 2 || (e.evt.button === 0 && state.activeAction === 'move')) {
      viewport.setIsRightClickPan(false);
      return;
    }

    if (isVectorMode && vectorDrawer.currentLine) {
      if (!vectorDrawer.isDrawingPath) {
        setLayers(prev => prev.map(l => {
          if (l.id === activeLayerId && (l.type === 'river' || l.type === 'cliff' || l.type === 'border' || l.type === 'label' || l.type === 'road' || l.type === 'coastline')) {
            const state = useMapStore.getState();
            const newData = {
              id: Date.now().toString(),
              points: vectorDrawer.currentLine!,
              stroke: l.type === 'border' ? activeBorderColor : (l.type === 'river' || l.type === 'road' ? undefined : (activeColor || (l.type === 'coastline' ? '#222222' : (l.type === 'cliff' ? '#555555' : '#000000')))),
              strokeWidth: l.type === 'border' ? activeBorderWidth : activeLineWidth,
              tension: l.type === 'coastline' && state.activeCoastlineStyle === 'fractal' ? 0 : l.type === 'border' && state.activeBorderStyle === 'snapped' ? 0 : 0.5,
              invert: vectorDrawer.isShiftPressed,
              roadStyle: l.type === 'road' ? activeRoadStyle : undefined,
              riverStyle: l.type === 'river' ? activeRiverStyle : undefined,
              coastlineStyle: l.type === 'coastline' ? state.activeCoastlineStyle : undefined,
              borderStyle: l.type === 'border' ? state.activeBorderStyle : undefined,
              cliffStyle: l.type === 'cliff' ? state.activeCliffStyle : undefined,
              fillPatternUrl: l.type === 'coastline' && state.activeCoastlineFillUrl ? state.activeCoastlineFillUrl : undefined
            };
            if (l.type === 'cliff') {
               const cl = l as import('../types').CliffLayer;
               const isLegacy = Array.isArray(cl.data);
               const existingLines = isLegacy ? cl.data : (cl.data.lines || []);
               const existingHexes = isLegacy ? {} : (cl.data.hexes || {});
               return { ...cl, data: { lines: [...existingLines, newData], hexes: existingHexes } };
            }
            return {
              ...l,
              data: [...(l.data as VectorLine[]), newData]
            } as VectorLayer;
          }
          return l;
        }));
        vectorDrawer.setCurrentLine(null);
        vectorDrawer.setDrawingAnchors([]);
        vectorDrawer.setHexEdgeGraph(null);
      }
    } else {
      hexPainter.setIsPaintingHex(false);
    }
  }, [isVectorMode, vectorDrawer.currentLine, vectorDrawer.isDrawingPath, setLayers, activeLayerId, activeColor, activeLineWidth, vectorDrawer.isShiftPressed, activeRoadStyle, activeRiverStyle, viewport, vectorDrawer, hexPainter, activeBorderColor, activeBorderWidth]);

  const handleDblClick = useCallback(() => {
    if (isVectorMode && vectorDrawer.isDrawingPath && vectorDrawer.currentLine && vectorDrawer.currentLine.length >= 4) {
      const state = useMapStore.getState();
      const isBorderSnap = activeLayer?.type === 'border' && state.activeBorderStyle === 'snapped';
      let finalPoints = isBorderSnap ? vectorDrawer.currentLine : vectorDrawer.drawingAnchors;
      
      if (finalPoints.length >= 4) {
        const len = finalPoints.length;
        if (finalPoints[len - 4] === finalPoints[len - 2] && finalPoints[len - 3] === finalPoints[len - 1]) {
          finalPoints = finalPoints.slice(0, -2);
        }
      }
      
      setLayers(prev => prev.map(l => {
        if (l.id === activeLayerId && (l.type === 'road' || l.type === 'river' || l.type === 'coastline' || l.type === 'border' || l.type === 'cliff')) {
          const state = useMapStore.getState();
          const newData = {
            id: Date.now().toString(),
            points: finalPoints,
            stroke: l.type === 'border' ? activeBorderColor : (l.type === 'river' || l.type === 'road' ? undefined : (activeColor || (l.type === 'coastline' ? '#222222' : (l.type === 'cliff' ? '#555555' : '#000000')))),
            strokeWidth: l.type === 'border' ? activeBorderWidth : activeLineWidth,
            tension: l.type === 'coastline' && state.activeCoastlineStyle === 'fractal' ? 0 : l.type === 'border' && state.activeBorderStyle === 'snapped' ? 0 : 0.5,
            invert: vectorDrawer.isShiftPressed,
            roadStyle: l.type === 'road' ? activeRoadStyle : undefined,
            riverStyle: l.type === 'river' ? activeRiverStyle : undefined,
            coastlineStyle: l.type === 'coastline' ? state.activeCoastlineStyle : undefined,
            borderStyle: l.type === 'border' ? state.activeBorderStyle : undefined,
            cliffStyle: l.type === 'cliff' ? state.activeCliffStyle : undefined,
            fillPatternUrl: l.type === 'coastline' && state.activeCoastlineFillUrl ? state.activeCoastlineFillUrl : undefined
          };
          if (l.type === 'cliff') {
             const cl = l as import('../types').CliffLayer;
             const isLegacy = Array.isArray(cl.data);
             const existingLines = isLegacy ? cl.data : (cl.data.lines || []);
             const existingHexes = isLegacy ? {} : (cl.data.hexes || {});
             return { ...cl, data: { lines: [...existingLines, newData], hexes: existingHexes } };
          }
          return {
            ...l,
            data: [...(l.data as VectorLine[]), newData]
          } as VectorLayer;
        }
        return l;
      }));
      vectorDrawer.setCurrentLine(null);
      vectorDrawer.setDrawingAnchors([]);
      vectorDrawer.setHexEdgeGraph(null);
      vectorDrawer.setIsDrawingPath(false);
    }
  }, [isVectorMode, vectorDrawer.isDrawingPath, vectorDrawer.currentLine, vectorDrawer.drawingAnchors, setLayers, activeLayerId, activeColor, activeLineWidth, vectorDrawer.isShiftPressed, activeRoadStyle, activeRiverStyle, vectorDrawer, activeLayer, activeBorderColor, activeBorderWidth]);

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
