import { useState, useCallback, useEffect } from 'react';
import { KonvaEventObject } from 'konva/lib/Node';
import Konva from 'konva';
import { HexCube } from '../types';
import { useMapStore } from '../store/mapStore';
import { VectorLayer, VectorLine } from '../types';

export function useMapInteraction() {
  const { 
    layers, setLayers, activeLayerId, activeColor, activeLineWidth, activeBrush, activeRoadStyle, activeRiverStyle 
  } = useMapStore();

  const activeLayer = layers.find(l => l.id === activeLayerId);
  const isVectorMode = activeLayer && (activeLayer.type === 'river' || activeLayer.type === 'cliff' || activeLayer.type === 'label' || activeLayer.type === 'road' || activeLayer.type === 'coastline');

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
        if (activeColor !== null || activeLayer?.type === 'road' || activeLayer?.type === 'river' || activeLayer?.type === 'coastline') {
          const stage = e.target.getStage();
          if (stage && e.target === stage) setSelectedLineId(null);
          if (stage) {
            const pos = getRelativePointerPosition(stage);
            if ((activeLayer?.type === 'road' && activeRoadStyle !== 'highlight') || (activeLayer?.type === 'river' && activeRiverStyle !== 'highlight')) {
              if (!isDrawingPath) {
                setIsDrawingPath(true);
                setCurrentLine([pos.x, pos.y, pos.x, pos.y]);
              } else if (currentLine) {
                setCurrentLine([...currentLine, pos.x, pos.y]);
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
        const pos = getRelativePointerPosition(stage);
        if (isDrawingPath) {
           const newPts = [...currentLine];
           newPts[newPts.length - 2] = pos.x;
           newPts[newPts.length - 1] = pos.y;
           setCurrentLine(newPts);
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
            const newData = {
              id: Date.now().toString(),
              points: currentLine,
              stroke: activeColor || (l.type === 'coastline' ? '#222222' : '#000000'),
              strokeWidth: activeLineWidth,
              tension: l.type === 'coastline' && useMapStore.getState().activeCoastlineStyle === 'fractal' ? 0 : 0.5,
              invert: isShiftPressed,
              roadStyle: l.type === 'road' ? activeRoadStyle : undefined,
              riverStyle: l.type === 'river' ? activeRiverStyle : undefined,
              coastlineStyle: l.type === 'coastline' ? useMapStore.getState().activeCoastlineStyle : undefined
            };
            return {
              ...l,
              data: [...(l.data as VectorLine[]), newData]
            } as VectorLayer;
          }
          return l;
        }));
        setCurrentLine(null);
      }
    } else {
      setIsPaintingHex(false);
    }
  }, [isVectorMode, currentLine, isDrawingPath, setLayers, activeLayerId, activeColor, activeLineWidth, isShiftPressed, activeRoadStyle, activeRiverStyle]);

  const handleDblClick = useCallback(() => {
    if (isVectorMode && isDrawingPath && currentLine && currentLine.length >= 4) {
      const finalPoints = currentLine.slice(0, -2);
      setLayers(prev => prev.map(l => {
        if (l.id === activeLayerId && (l.type === 'road' || l.type === 'river' || l.type === 'coastline')) {
          const newData = {
            id: Date.now().toString(),
            points: finalPoints,
            stroke: activeColor || (l.type === 'coastline' ? '#222222' : '#000000'),
            strokeWidth: activeLineWidth,
            tension: l.type === 'coastline' && useMapStore.getState().activeCoastlineStyle === 'fractal' ? 0 : 0.5,
            invert: isShiftPressed,
            roadStyle: l.type === 'road' ? activeRoadStyle : undefined,
            riverStyle: l.type === 'river' ? activeRiverStyle : undefined,
            coastlineStyle: l.type === 'coastline' ? useMapStore.getState().activeCoastlineStyle : undefined
          };
          return {
            ...l,
            data: [...(l.data as VectorLine[]), newData]
          } as VectorLayer;
        }
        return l;
      }));
      setCurrentLine(null);
      setIsDrawingPath(false);
    }
  }, [isVectorMode, isDrawingPath, currentLine, setLayers, activeLayerId, activeColor, activeLineWidth, isShiftPressed, activeRoadStyle, activeRiverStyle]);

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
