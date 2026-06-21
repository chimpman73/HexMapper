import { useState, useCallback } from 'react';
import { HexCube } from '../types';
import { useMapStore } from '../store/mapStore';
import { isHexIntersectedByLine } from '../utils/cliffMath';

export function useHexPainter() {
  const [isPaintingHex, setIsPaintingHex] = useState(false);
  const [hoveredHex, setHoveredHex] = useState<HexCube | null>(null);

  const handlePaintHex = useCallback((hex: HexCube, isVectorMode: boolean, activeLayer: any) => {
    if (isVectorMode && activeLayer?.type !== 'cliff') return;
    const state = useMapStore.getState();
    if (isVectorMode && activeLayer?.type === 'cliff' && (!state.activeBrush || state.activeAction !== 'paint')) return;
    
    const key = `${hex.q},${hex.r},${hex.s}`;

    if (state.activeAction === 'select') {
      const data = activeLayer?.type === 'cliff' ? (activeLayer?.data as any).hexes : activeLayer?.data;
      if (activeLayer && data && data[key]) {
        state.setHighlightedHexKey(key);
        const cell = data[key];
        state.setActiveBrush(typeof cell === 'string' ? cell : cell.brushUrl);
      } else {
        state.setHighlightedHexKey(null);
      }
      return;
    }

    if (state.activeAction !== 'paint' && state.activeAction !== 'erase') return;

    const brushValue = state.activeAction === 'erase' ? null : (activeLayer?.type === 'border' ? state.activeColor : state.activeBrush);
    if (brushValue === undefined && state.activeAction !== 'erase') return;
    
    state.setLayers(prev => prev.map(l => {
      if (l.id === activeLayer.id && (l.type === 'terrain' || l.type === 'city' || l.type === 'coastline' || l.type === 'border' || l.type === 'cliff')) {
        if (l.type === 'cliff') {
           const cl = l as import('../types').CliffLayer;
           let intersects = false;
           for (const line of cl.data.lines) {
             if (isHexIntersectedByLine(hex, useMapStore.getState().orientation, line.points)) {
               intersects = true;
               break;
             }
           }
           if (!intersects && brushValue !== null) return l;

           const newHexes = { ...cl.data.hexes };
           if (brushValue === null) delete newHexes[key];
           else newHexes[key] = brushValue;
           return { ...cl, data: { ...cl.data, hexes: newHexes } };
        }

        const newData = { ...(l.data as Record<string, any>) };
        if (brushValue === null) {
          delete newData[key];
        } else {
          if (newData[key] && typeof newData[key] === 'object') {
            newData[key] = { ...newData[key], brushUrl: brushValue };
          } else {
            newData[key] = brushValue;
          }
        }
        return { ...l, data: newData };
      }
      return l;
    }));
  }, []);

  return {
    isPaintingHex, setIsPaintingHex,
    hoveredHex, setHoveredHex,
    handlePaintHex
  };
}
