import React, { useState, useEffect } from 'react';
import { BasePaletteLayout } from './BasePaletteLayout';
import { ToolRow } from './ToolRow';
import { useMapStore } from '../../store/mapStore';
import { generateCoastlineBrush } from '../../utils/brushGenerators';
import { CoastlineStyle } from '../../types';

export const CoastlinePalette: React.FC = () => {
  const { 
    activeAction, 
    activeCoastlineStyle, setActiveCoastlineStyle,
    activeColor, setActiveColor,
    activeLineWidth, setActiveLineWidth,
    activeCoastlineFillUrl, setActiveCoastlineFillUrl,
    currentStyle, assetsBasePath
  } = useMapStore();

  const [coastlineBrushes, setCoastlineBrushes] = useState<{type: CoastlineStyle, url: string}[]>([]);
  const [fillBrushes, setFillBrushes] = useState<string[]>([]);

  useEffect(() => {
    const loadDefault = async () => {
      if (window.api?.getDefaultTiles) {
        const res = await window.api.getDefaultTiles(currentStyle || 'Hollow Moon', 'Coastline');
        if (res?.success && res.data) {
          const relPaths = res.data.map((f: string) => {
            const parts = f.split(/[\\/]tiles[\\/]/);
            return parts.length > 1 ? parts[1].replace(/\\/g, '/') : f;
          });
          setFillBrushes(relPaths);
        }
      }
    };
    loadDefault();
  }, [currentStyle]);

  useEffect(() => {
    setCoastlineBrushes([
      { type: 'smooth', url: generateCoastlineBrush('smooth') },
      { type: 'fractal', url: generateCoastlineBrush('fractal') }
    ]);
  }, []);

  const resolveUrl = (relPath: string | null) => {
    if (!relPath) return '';
    if (relPath.startsWith('local://')) return relPath;
    return `local://file?path=${encodeURIComponent(`${assetsBasePath}/styles/${currentStyle}/textures/${relPath}`)}`;
  };

  return (
    <BasePaletteLayout 
      title="Coastline"
      showBrushes={true}
      brushes={fillBrushes}
      activeBrush={activeCoastlineFillUrl}
      onSelectBrush={setActiveCoastlineFillUrl}
      resolveUrl={resolveUrl}
    >
      <div style={{marginBottom: '15px'}}>
        <label style={{color: '#ccc', fontSize: '14px', display: 'block', marginBottom: '5px'}}>Coastline Styles:</label>
        {coastlineBrushes.map(brush => (
          <ToolRow
            key={brush.type}
            type={brush.type}
            url={brush.url}
            label={brush.type === 'highlight' ? 'Highlight' : brush.type}
            isActive={activeCoastlineStyle === brush.type && activeAction === 'paint'}
            onSelect={() => setActiveCoastlineStyle(brush.type)}
            color1={activeColor || '#222222'}
            onColor1Change={(c) => setActiveColor(c)}
            width={activeLineWidth || 3}
            onWidthChange={(w) => setActiveLineWidth(w)}
          />
        ))}
      </div>
    </BasePaletteLayout>
  );
};
