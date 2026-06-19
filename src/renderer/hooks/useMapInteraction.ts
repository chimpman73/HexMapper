import { useState, useCallback, useEffect } from 'react';
import { KonvaEventObject } from 'konva/lib/Node';
import Konva from 'konva';
import { HexCube, HexOrientation } from '../types';
import { useMapStore } from '../store/mapStore';
import { VectorLayer, VectorLine } from '../types';
import { pixelToHex, hexToPixel, getHexCorners, generateRectangularGrid, buildHexEdgeGraph, findHexEdgePath, HexEdgeGraph } from '../utils/hexMath';

export function useMapInteraction() {
  const { 
    layers, setLayers, activeLayerId, activeColor, activeLineWidth, activeBrush, activeRoadStyle, activeRiverStyle, activeCoastlineStyle, activeBorderStyle, activeBorderColor, activeBorderWidth
  } = useMapStore();

  const activeLayer = layers.find(l => l.id === activeLayerId);
  const isVectorMode = activeLayer && (activeLayer.type === 'river' || activeLayer.type === 'cliff' || activeLayer.type === 'label' || activeLayer.type === 'road' || activeLayer.type === 'coastline' || activeLayer.type === 'border');

  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isPaintingHex, setIsPaintingHex] = useState(false);
  const [isDrawingPath, setIsDrawingPath] = useState(false);
  const [currentLine, setCurrentLine] = useState<number[] | null>(null);
  const [isShiftPressed, setIsShiftPressed] = useState(false);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [hoveredLineId, setHoveredLineId] = useState<string | null>(null);
  const [isRightClickPan, setIsRightClickPan] = useState(false);
  const [lastPanPos, setLastPanPos] = useState({ x: 0, y: 0 });
  const [hoveredHex, setHoveredHex] = useState<HexCube | null>(null);

  const [hexEdgeGraph, setHexEdgeGraph] = useState<HexEdgeGraph | null>(null);
  const [drawingAnchors, setDrawingAnchors] = useState<number[]>([]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        useMapStore.getState().undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        useMapStore.getState().redo();
        return;
      }
      if (e.key === 'Shift') setIsShiftPressed(true);
      if (e.key === 'Escape') {
        setCurrentLine(null);
        setIsDrawingPath(false);
        setSelectedLineId(null);
        setDrawingAnchors([]);
      }
      if (e.key === 'Delete') {
        if (selectedLineId && activeLayerId) {
          setLayers(prev => prev.map(l => {
            if (l.id === activeLayerId && (l.type === 'river' || l.type === 'cliff' || l.type === 'border' || l.type === 'label' || l.type === 'road' || l.type === 'coastline')) {
              return { ...l, data: (l.data as VectorLine[]).filter(d => d.id !== selectedLineId) } as VectorLayer;
            }
            return l;
          }));
          setSelectedLineId(null);
        }
      }
      if (e.key === 'PageUp' || e.key === 'PageDown') {
        // Zooming logic from HexGridEngine
        // Note: For simplicity and clean separation, we will just use state scale/position,
        // but since we need the stage pointer, we will handle PageUp/PageDown without stage reference using window center
        e.preventDefault();
        setScale(oldScale => {
          const scaleBy = 1.2;
          const newScale = e.key === 'PageDown' ? oldScale * scaleBy : oldScale / scaleBy;
          return Math.max(0.1, Math.min(newScale, 5));
        });
      }
    };
    const up = (e: KeyboardEvent) => { if (e.key === 'Shift') setIsShiftPressed(false); };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [selectedLineId, activeLayerId, setLayers]);

  const getRelativePointerPosition = useCallback((stage: Konva.Stage) => {
    const pointer = stage.getPointerPosition();
    const currentScale = stage.scaleX();
    return {
      x: (pointer.x - stage.x()) / currentScale,
      y: (pointer.y - stage.y()) / currentScale,
    };
  }, []);

  const handlePaintHex = useCallback((hex: HexCube) => {
    if (isVectorMode) return;
    const brushValue = activeLayer?.type === 'border' ? activeColor : activeBrush;
    if (brushValue === undefined) return;
    
    const key = `${hex.q},${hex.r},${hex.s}`;
    setLayers(prev => prev.map(l => {
      if (l.id === activeLayerId && (l.type === 'terrain' || l.type === 'city' || l.type === 'coastline' || l.type === 'border')) {
        const newData = { ...l.data };
        if (brushValue === null) delete newData[key];
        else newData[key] = brushValue;
        return { ...l, data: newData };
      }
      return l;
    }));
  }, [isVectorMode, activeLayer, activeColor, activeBrush, activeLayerId, setLayers]);

  const snapPoint = useCallback((p: {x: number, y: number}, snapToGrid: boolean, layerData: any[]) => {
    let bestPoint = p;
    let minDist = Infinity;

    // Snapping to existing nodes
    layerData.forEach(line => {
      for (let i = 0; i < line.points.length; i += 2) {
        const nx = line.points[i];
        const ny = line.points[i+1];
        const dist = Math.sqrt((nx - p.x)**2 + (ny - p.y)**2);
        if (dist < 15 && dist < minDist) {
          minDist = dist;
          bestPoint = { x: nx, y: ny };
        }
      }
    });

    // Snapping to grid vertices
    if (snapToGrid && minDist > 15) {
      const hex = pixelToHex(p, useMapStore.getState().orientation);
      const center = hexToPixel(hex, useMapStore.getState().orientation);
      const cornersRaw = getHexCorners(center, useMapStore.getState().orientation);
      for (let i = 0; i < 6; i++) {
        const cx = cornersRaw[i*2];
        const cy = cornersRaw[i*2+1];
        const dist = Math.sqrt((cx - p.x)**2 + (cy - p.y)**2);
        if (dist < minDist) {
          minDist = dist;
          bestPoint = { x: cx, y: cy };
        }
      }
    }
    return bestPoint;
  }, []);

  const handleWheel = useCallback((e: KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = e.target.getStage();
    if (!stage) return;

    const scaleBy = 1.1;
    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    const newScale = e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;
    const clampedScale = Math.max(0.1, Math.min(newScale, 5));
    setScale(clampedScale);

    setPosition({
      x: pointer.x - mousePointTo.x * clampedScale,
      y: pointer.y - mousePointTo.y * clampedScale,
    });
  }, []);

  const handleMouseDown = useCallback((e: KonvaEventObject<MouseEvent>) => {
    if (e.evt.button === 2) {
      setIsRightClickPan(true);
      setLastPanPos({ x: e.evt.clientX, y: e.evt.clientY });
      
      if (isDrawingPath) {
        setIsDrawingPath(false);
        setCurrentLine(null);
      }
      if (selectedLineId !== null) {
        setSelectedLineId(null);
      }
      return;
    }
    
    if (e.evt.button === 0 && !e.evt.altKey) {
      if (isVectorMode) {
        if (activeColor !== null || activeLayer?.type === 'road' || activeLayer?.type === 'river' || activeLayer?.type === 'coastline' || activeLayer?.type === 'border') {
          const stage = e.target.getStage();
          if (stage && e.target === stage) setSelectedLineId(null);
          if (stage) {
            const rawPos = getRelativePointerPosition(stage);
            const state = useMapStore.getState();
            const isBorderSnap = activeLayer?.type === 'border' && state.activeBorderStyle === 'snapped';
            const pos = snapPoint(rawPos, isBorderSnap, activeLayer?.data || []);

            if ((activeLayer?.type === 'road' && activeRoadStyle !== 'highlight') || (activeLayer?.type === 'river' && activeRiverStyle !== 'highlight') || (activeLayer?.type === 'border' && state.activeBorderStyle !== 'highlight')) {
              if (!isDrawingPath) {
                setIsDrawingPath(true);
                setCurrentLine([pos.x, pos.y, pos.x, pos.y]);
                setDrawingAnchors([pos.x, pos.y]);
                if (isBorderSnap) {
                   const grid = generateRectangularGrid(state.mapWidth, state.mapHeight, state.orientation);
                   setHexEdgeGraph(buildHexEdgeGraph(state.orientation, grid));
                }
              } else if (currentLine && drawingAnchors.length > 0) {
                // We just anchored. If it's a snapped border, add the newly computed path points to anchors.
                // Otherwise just add the new point.
                if (isBorderSnap && hexEdgeGraph) {
                   const lastAnchor = { x: drawingAnchors[drawingAnchors.length - 2], y: drawingAnchors[drawingAnchors.length - 1] };
                   const path = findHexEdgePath(lastAnchor, pos, hexEdgeGraph);
                   const newAnchors = [...drawingAnchors, ...path.slice(2)];
                   setDrawingAnchors(newAnchors);
                   setCurrentLine([...newAnchors, pos.x, pos.y]);
                } else {
                   const newAnchors = [...drawingAnchors, pos.x, pos.y];
                   setDrawingAnchors(newAnchors);
                   setCurrentLine([...newAnchors, pos.x, pos.y]);
                }
              }
            } else {
              setCurrentLine([pos.x, pos.y]);
            }
          }
        }
      } else {
        setIsPaintingHex(true);
      }
    }
  }, [isDrawingPath, selectedLineId, isVectorMode, activeColor, activeLayer, activeRoadStyle, activeRiverStyle, getRelativePointerPosition, currentLine]);

  const handleMouseMove = useCallback((e: KonvaEventObject<MouseEvent>) => {
    if (isRightClickPan) {
      const dx = e.evt.clientX - lastPanPos.x;
      const dy = e.evt.clientY - lastPanPos.y;
      setPosition(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      setLastPanPos({ x: e.evt.clientX, y: e.evt.clientY });
      return;
    }

    if (isVectorMode && currentLine) {
      const stage = e.target.getStage();
      if (stage) {
        const rawPos = getRelativePointerPosition(stage);
        const state = useMapStore.getState();
        const isBorderSnap = activeLayer?.type === 'border' && state.activeBorderStyle === 'snapped';
        const pos = snapPoint(rawPos, isBorderSnap, activeLayer?.data || []);

        if (isDrawingPath) {
           if (isBorderSnap && hexEdgeGraph && drawingAnchors.length > 0) {
              const lastAnchor = { x: drawingAnchors[drawingAnchors.length - 2], y: drawingAnchors[drawingAnchors.length - 1] };
              const path = findHexEdgePath(lastAnchor, pos, hexEdgeGraph);
              setCurrentLine([...drawingAnchors, ...path.slice(2)]);
           } else {
              const newPts = [...drawingAnchors];
              newPts.push(pos.x, pos.y);
              setCurrentLine(newPts);
           }
        } else {
           setCurrentLine([...currentLine, pos.x, pos.y]);
        }
      }
    }
  }, [isRightClickPan, lastPanPos, isVectorMode, currentLine, getRelativePointerPosition, isDrawingPath]);

  const handleMouseUp = useCallback((e: KonvaEventObject<MouseEvent>) => {
    if (e.evt.button === 2) {
      setIsRightClickPan(false);
      return;
    }

    if (isVectorMode && currentLine) {
      if (!isDrawingPath) {
        setLayers(prev => prev.map(l => {
          if (l.id === activeLayerId && (l.type === 'river' || l.type === 'cliff' || l.type === 'border' || l.type === 'label' || l.type === 'road' || l.type === 'coastline')) {
            const state = useMapStore.getState();
            const newData = {
              id: Date.now().toString(),
              points: currentLine,
              stroke: l.type === 'border' ? activeBorderColor : (activeColor || (l.type === 'coastline' ? '#222222' : '#000000')),
              strokeWidth: l.type === 'border' ? activeBorderWidth : activeLineWidth,
              tension: l.type === 'coastline' && state.activeCoastlineStyle === 'fractal' ? 0 : l.type === 'border' && state.activeBorderStyle === 'snapped' ? 0 : 0.5,
              invert: isShiftPressed,
              roadStyle: l.type === 'road' ? activeRoadStyle : undefined,
              riverStyle: l.type === 'river' ? activeRiverStyle : undefined,
              coastlineStyle: l.type === 'coastline' ? state.activeCoastlineStyle : undefined,
              borderStyle: l.type === 'border' ? state.activeBorderStyle : undefined
            };
            return {
              ...l,
              data: [...(l.data as VectorLine[]), newData]
            } as VectorLayer;
          }
          return l;
        }));
        setCurrentLine(null);
        setDrawingAnchors([]);
        setHexEdgeGraph(null);
      }
    } else {
      setIsPaintingHex(false);
    }
  }, [isVectorMode, currentLine, isDrawingPath, setLayers, activeLayerId, activeColor, activeLineWidth, isShiftPressed, activeRoadStyle, activeRiverStyle]);

  const handleDblClick = useCallback(() => {
    if (isVectorMode && isDrawingPath && currentLine && currentLine.length >= 4) {
      const state = useMapStore.getState();
      const isBorderSnap = activeLayer?.type === 'border' && state.activeBorderStyle === 'snapped';
      const finalPoints = isBorderSnap ? currentLine : drawingAnchors;
      setLayers(prev => prev.map(l => {
        if (l.id === activeLayerId && (l.type === 'road' || l.type === 'river' || l.type === 'coastline' || l.type === 'border')) {
          const state = useMapStore.getState();
          const newData = {
            id: Date.now().toString(),
            points: finalPoints,
            stroke: l.type === 'border' ? activeBorderColor : (activeColor || (l.type === 'coastline' ? '#222222' : '#000000')),
            strokeWidth: l.type === 'border' ? activeBorderWidth : activeLineWidth,
            tension: l.type === 'coastline' && state.activeCoastlineStyle === 'fractal' ? 0 : l.type === 'border' && state.activeBorderStyle === 'snapped' ? 0 : 0.5,
            invert: isShiftPressed,
            roadStyle: l.type === 'road' ? activeRoadStyle : undefined,
            riverStyle: l.type === 'river' ? activeRiverStyle : undefined,
            coastlineStyle: l.type === 'coastline' ? state.activeCoastlineStyle : undefined,
            borderStyle: l.type === 'border' ? state.activeBorderStyle : undefined
          };
          return {
            ...l,
            data: [...(l.data as VectorLine[]), newData]
          } as VectorLayer;
        }
        return l;
      }));
      setCurrentLine(null);
      setDrawingAnchors([]);
      setHexEdgeGraph(null);
      setIsDrawingPath(false);
    }
  }, [isVectorMode, isDrawingPath, currentLine, drawingAnchors, setLayers, activeLayerId, activeColor, activeLineWidth, isShiftPressed, activeRoadStyle, activeRiverStyle]);

  useEffect(() => {
    const handleSnap = () => {
      if (selectedLineId && activeLayerId) {
        setLayers(prev => prev.map(l => {
          if (l.id === activeLayerId && l.type === 'border') {
            const state = useMapStore.getState();
            const grid = generateRectangularGrid(state.mapWidth, state.mapHeight, state.orientation);
            const graph = buildHexEdgeGraph(state.orientation, grid);
            const vl = l as VectorLayer;
            return {
              ...vl,
              data: vl.data.map(line => {
                if (line.id === selectedLineId) {
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
  }, [selectedLineId, activeLayerId, setLayers]);

  return {
    scale, setScale,
    position, setPosition,
    isPaintingHex, setIsPaintingHex,
    isDrawingPath, setIsDrawingPath,
    currentLine, setCurrentLine,
    isShiftPressed, setIsShiftPressed,
    selectedLineId, setSelectedLineId,
    hoveredLineId, setHoveredLineId,
    isRightClickPan, setIsRightClickPan,
    hoveredHex, setHoveredHex,
    isVectorMode,
    handleWheel,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleDblClick,
    handlePaintHex
  };
}
