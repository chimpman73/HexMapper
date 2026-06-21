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

  return {
    isDrawingPath, setIsDrawingPath,
    currentLine, setCurrentLine,
    isShiftPressed, setIsShiftPressed,
    selectedLineId, setSelectedLineId,
    hoveredLineId, setHoveredLineId,
    hexEdgeGraph, setHexEdgeGraph,
    drawingAnchors, setDrawingAnchors,
    snapPoint
  };
}
