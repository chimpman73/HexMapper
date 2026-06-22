import { useState, useCallback, useEffect } from 'react';
import { useMapStore } from '../store/mapStore';
import { pixelToHex, hexToPixel, getHexCorners, HexEdgeGraph } from '../utils/hexMath';
import { isHexIntersectedByLine } from '../utils/cliffMath';
import { VectorLayer, VectorLine } from '../types';

export function useVectorDrawer() {
  const [isDrawingPath, setIsDrawingPath] = useState(false);
  const [currentLine, setCurrentLine] = useState<number[] | null>(null);
  const [isShiftPressed, setIsShiftPressed] = useState(false);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [hoveredLineId, setHoveredLineId] = useState<string | null>(null);
  const [hexEdgeGraph, setHexEdgeGraph] = useState<HexEdgeGraph | null>(null);
  const [drawingAnchors, setDrawingAnchors] = useState<number[]>([]);

  // Keybindings for drawing (Escape, Delete, Shift)
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setIsShiftPressed(true);
      if (e.key === 'Escape') {
        setCurrentLine(null);
        setIsDrawingPath(false);
        setSelectedLineId(null);
        setDrawingAnchors([]);
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const state = useMapStore.getState();
        const { activeLayerId, setLayers } = state;
        
        if (state.selectedVertex) {
           setLayers(prev => prev.map(l => {
            if (l.id === activeLayerId && (l.type === 'river' || l.type === 'cliff' || l.type === 'border' || l.type === 'label' || l.type === 'road' || l.type === 'coastline')) {
               const lines = l.type === 'cliff' ? (l.data as any).lines : l.data as VectorLine[];
               const newData = lines.map((dl: any) => {
                 if (dl.id === state.selectedVertex!.lineId) {
                   const newPoints = [...dl.points];
                   const vIndex = state.selectedVertex!.index;

                   newPoints.splice(vIndex * 2, 2);
                   if (newPoints.length < 4) return null;
                   
                   let newFeatures = dl.features;
                   if (newFeatures) {
                     newFeatures = newFeatures.map((f: any) => {
                       if (f.segmentIndex >= vIndex && f.segmentIndex > 0) {
                         return { ...f, segmentIndex: f.segmentIndex - 1 };
                       }
                       return f;
                     }).filter((f: any) => f.segmentIndex < (newPoints.length / 2) - 1);
                   }
                   
                   return { ...dl, points: newPoints, features: newFeatures };
                 }
                 return dl;
               }).filter(Boolean) as VectorLine[];
               
               if (l.type === 'cliff') {
                 const newHexes = { ...(l.data as any).hexes };
                 const orientation = useMapStore.getState().orientation;
                 
                 for (const key in newHexes) {
                   const [q, r, s] = key.split(',').map(Number);
                   const hex = { q, r, s };
                   let intersects = false;
                   for (const line of newData) {
                     if (isHexIntersectedByLine(hex, orientation, line.points)) {
                       intersects = true;
                       break;
                     }
                   }
                   if (!intersects) {
                     delete newHexes[key];
                   }
                 }
                 
                 return { ...l, data: { ...(l as any).data, lines: newData, hexes: newHexes } };
               }
               return { ...l, data: newData } as VectorLayer;
            }
            return l;
          }));
          state.setSelectedVertex(null);
        } else if (selectedLineId && activeLayerId) {
          setLayers(prev => prev.map(l => {
            if (l.id === activeLayerId && (l.type === 'river' || l.type === 'cliff' || l.type === 'border' || l.type === 'label' || l.type === 'road' || l.type === 'coastline')) {
              if (l.type === 'cliff') {
                 const cl = l as import('../types').CliffLayer;
                 const newLines = cl.data.lines.filter(d => d.id !== selectedLineId);
                 
                 const newHexes = { ...cl.data.hexes };
                 const orientation = useMapStore.getState().orientation;
                 
                 for (const key in newHexes) {
                   const [q, r, s] = key.split(',').map(Number);
                   const hex = { q, r, s };
                   let intersects = false;
                   for (const line of newLines) {
                     if (isHexIntersectedByLine(hex, orientation, line.points)) {
                       intersects = true;
                       break;
                     }
                   }
                   if (!intersects) {
                     delete newHexes[key];
                   }
                 }
                 
                 return { ...cl, data: { ...cl.data, lines: newLines, hexes: newHexes } };
              }
              return { ...l, data: (l.data as VectorLine[]).filter(d => d.id !== selectedLineId) } as VectorLayer;
            }
            return l;
          }));
          setSelectedLineId(null);
        }
      }
    };
    const up = (e: KeyboardEvent) => { if (e.key === 'Shift') setIsShiftPressed(false); };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [selectedLineId]);

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

  const startVectorInteraction = useCallback((rawPos: {x: number, y: number}) => {
    const state = useMapStore.getState();
    const activeLayer = state.layers.find(l => l.id === state.activeLayerId);
    if (!activeLayer || state.activeAction !== 'paint') return;

    if (activeLayer.type === 'river' && state.activeFeatureBrush) {
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
         state.setLayers(prev => prev.map(l => {
           if (l.id === state.activeLayerId) {
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

    const isBorderSnap = activeLayer.type === 'border' && state.activeBorderStyle === 'snapped';
    const layerLines = activeLayer.type === 'cliff' ? (activeLayer.data as any).lines || [] : (Array.isArray(activeLayer.data) ? activeLayer.data : []);
    const pos = snapPoint(rawPos, isBorderSnap, layerLines);

    if ((activeLayer.type === 'road' && state.activeRoadStyle !== 'highlight') || 
        (activeLayer.type === 'river' && state.activeRiverStyle !== 'highlight') || 
        (activeLayer.type === 'border' && state.activeBorderStyle !== 'highlight') || 
        (activeLayer.type === 'cliff' && state.activeCliffStyle !== 'highlight' && !state.activeBrush)) {
      if (!isDrawingPath) {
        setIsDrawingPath(true);
        setCurrentLine([pos.x, pos.y, pos.x, pos.y]);
        setDrawingAnchors([pos.x, pos.y]);
        if (isBorderSnap) {
           const grid = generateRectangularGrid(state.mapWidth, state.mapHeight, state.orientation);
           setHexEdgeGraph(buildHexEdgeGraph(state.orientation, grid));
        }
      } else if (currentLine && drawingAnchors.length > 0) {
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
  }, [isDrawingPath, currentLine, drawingAnchors, hexEdgeGraph, snapPoint]);

  const updateVectorInteraction = useCallback((rawPos: {x: number, y: number}) => {
    if (!currentLine) return;
    const state = useMapStore.getState();
    const activeLayer = state.layers.find(l => l.id === state.activeLayerId);
    if (!activeLayer) return;

    const isBorderSnap = activeLayer.type === 'border' && state.activeBorderStyle === 'snapped';
    const layerLines = activeLayer.type === 'cliff' ? (activeLayer.data as any).lines || [] : (Array.isArray(activeLayer.data) ? activeLayer.data : []);
    const pos = snapPoint(rawPos, isBorderSnap, layerLines);

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
  }, [currentLine, isDrawingPath, drawingAnchors, hexEdgeGraph, snapPoint]);

  const endVectorInteraction = useCallback(() => {
    if (!currentLine) return;
    if (!isDrawingPath) {
      const state = useMapStore.getState();
      state.setLayers(prev => prev.map(l => {
        if (l.id === state.activeLayerId && (l.type === 'river' || l.type === 'cliff' || l.type === 'border' || l.type === 'label' || l.type === 'road' || l.type === 'coastline')) {
          const newData = {
            id: Date.now().toString(),
            points: currentLine!,
            stroke: l.type === 'border' ? state.activeBorderColor : (l.type === 'river' || l.type === 'road' ? undefined : (state.activeColor || (l.type === 'coastline' ? '#222222' : (l.type === 'cliff' ? '#555555' : '#000000')))),
            strokeWidth: l.type === 'border' ? state.activeBorderWidth : state.activeLineWidth,
            tension: l.type === 'coastline' && state.activeCoastlineStyle === 'fractal' ? 0 : l.type === 'border' && state.activeBorderStyle === 'snapped' ? 0 : 0.5,
            invert: isShiftPressed,
            roadStyle: l.type === 'road' ? state.activeRoadStyle : undefined,
            riverStyle: l.type === 'river' ? state.activeRiverStyle : undefined,
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
      setCurrentLine(null);
      setDrawingAnchors([]);
      setHexEdgeGraph(null);
    }
  }, [currentLine, isDrawingPath, isShiftPressed]);

  const commitVectorPath = useCallback(() => {
    if (isDrawingPath && currentLine && currentLine.length >= 4) {
      const state = useMapStore.getState();
      const activeLayer = state.layers.find(l => l.id === state.activeLayerId);
      const isBorderSnap = activeLayer?.type === 'border' && state.activeBorderStyle === 'snapped';
      let finalPoints = isBorderSnap ? currentLine : drawingAnchors;
      
      if (finalPoints.length >= 4) {
        const len = finalPoints.length;
        if (finalPoints[len - 4] === finalPoints[len - 2] && finalPoints[len - 3] === finalPoints[len - 1]) {
          finalPoints = finalPoints.slice(0, -2);
        }
      }
      
      state.setLayers(prev => prev.map(l => {
        if (l.id === state.activeLayerId && (l.type === 'road' || l.type === 'river' || l.type === 'coastline' || l.type === 'border' || l.type === 'cliff')) {
          const newData = {
            id: Date.now().toString(),
            points: finalPoints,
            stroke: l.type === 'border' ? state.activeBorderColor : (l.type === 'river' || l.type === 'road' ? undefined : (state.activeColor || (l.type === 'coastline' ? '#222222' : (l.type === 'cliff' ? '#555555' : '#000000')))),
            strokeWidth: l.type === 'border' ? state.activeBorderWidth : state.activeLineWidth,
            tension: l.type === 'coastline' && state.activeCoastlineStyle === 'fractal' ? 0 : l.type === 'border' && state.activeBorderStyle === 'snapped' ? 0 : 0.5,
            invert: isShiftPressed,
            roadStyle: l.type === 'road' ? state.activeRoadStyle : undefined,
            riverStyle: l.type === 'river' ? state.activeRiverStyle : undefined,
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
      setCurrentLine(null);
      setDrawingAnchors([]);
      setHexEdgeGraph(null);
      setIsDrawingPath(false);
    }
  }, [isDrawingPath, currentLine, drawingAnchors, isShiftPressed]);

  return {
    isDrawingPath, setIsDrawingPath,
    currentLine, setCurrentLine,
    isShiftPressed, setIsShiftPressed,
    selectedLineId, setSelectedLineId,
    hoveredLineId, setHoveredLineId,
    hexEdgeGraph, setHexEdgeGraph,
    drawingAnchors, setDrawingAnchors,
    snapPoint,
    startVectorInteraction,
    updateVectorInteraction,
    endVectorInteraction,
    commitVectorPath
  };
}
