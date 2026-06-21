import React, { useState, useEffect } from 'react';
import { BasePaletteLayout } from './BasePaletteLayout';
import { ToolRow } from './ToolRow';
import { useMapStore } from '../../store/mapStore';
import { generateCliffBrush } from '../../utils/brushGenerators';
import { CliffStyle } from '../../types';

export const CliffPalette: React.FC = () => {
  const { 
    activeAction, setActiveAction,
    activeBrush, setActiveBrush,
    activeCliffStyle, setActiveCliffStyle,
    activeColor, setActiveColor,
    activeLineWidth, setActiveLineWidth,
    currentStyle, assetsBasePath
  } = useMapStore();

  const [cliffBrushes, setCliffBrushes] = useState<{type: CliffStyle, url: string}[]>([]);
  const [brushes, setBrushes] = useState<string[]>([]);

  useEffect(() => {
    setCliffBrushes([
      { type: 'smooth', url: generateCliffBrush('smooth') },
      { type: 'fractal', url: generateCliffBrush('fractal') }
    ]);
  }, []);

  useEffect(() => {
    const loadDefault = async () => {
      if (window.api?.getDefaultTiles) {
        const res = await window.api.getDefaultTiles(currentStyle || 'Hollow Moon', 'Terrain');
        if (res?.success && res.data) {
          const relPaths = res.data.map((f: string) => {
            const parts = f.split(/[\\/]tiles[\\/]/);
            return parts.length > 1 ? parts[1].replace(/\\/g, '/') : f;
          });
          setBrushes(relPaths);
        }
      }
    };
    loadDefault();
  }, [currentStyle]);

  const resolveUrl = (relPath: string | null) => {
    if (!relPath) return '';
    if (relPath.startsWith('local://')) return relPath;
    return `local://file?path=${encodeURIComponent(`${assetsBasePath}/styles/${currentStyle}/tiles/${relPath}`)}`;
  };

  return (
    <BasePaletteLayout 
      title="Cliffs"
      showBrushes={true}
      brushes={brushes}
      activeBrush={activeBrush}
      onSelectBrush={setActiveBrush}
      resolveUrl={resolveUrl}
    >
      <div style={{marginBottom: '15px'}}>
        <label style={{color: '#ccc', fontSize: '14px', display: 'block', marginBottom: '5px'}}>Cliff Styles:</label>
        {cliffBrushes.map(brush => (
          <ToolRow
            key={brush.type}
            type={brush.type}
            url={brush.url}
            label={brush.type === 'highlight' ? 'Highlight' : brush.type}
            isActive={activeCliffStyle === brush.type && activeAction === 'paint' && !activeBrush}
            onSelect={() => { setActiveCliffStyle(brush.type); setActiveBrush(null); }}
            color1={activeColor || '#000000'}
            onColor1Change={(c) => setActiveColor(c)}
            width={activeLineWidth || 3}
            onWidthChange={(w) => setActiveLineWidth(w)}
          />
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', padding: '5px', background: '#333', borderRadius: '4px' }}>
          <span style={{color: 'white', fontSize: '12px'}}>Note: Hold Shift while drawing to invert cliff downslope direction.</span>
        </div>
      </div>
    </BasePaletteLayout>
  );
};
