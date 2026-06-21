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
    activeLineWidth, setActiveLineWidth
  } = useMapStore();

  const [coastlineBrushes, setCoastlineBrushes] = useState<{type: CoastlineStyle, url: string}[]>([]);

  useEffect(() => {
    setCoastlineBrushes([
      { type: 'smooth', url: generateCoastlineBrush('smooth') },
      { type: 'fractal', url: generateCoastlineBrush('fractal') }
    ]);
  }, []);

  return (
    <BasePaletteLayout title="Coastline">
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
