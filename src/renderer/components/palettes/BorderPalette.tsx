import React, { useState, useEffect } from 'react';
import { BasePaletteLayout } from './BasePaletteLayout';
import { ToolRow } from './ToolRow';
import { useMapStore } from '../../store/mapStore';
import { generateBorderBrush } from '../../utils/brushGenerators';
import { BorderStyle } from '../../types';

export const BorderPalette: React.FC = () => {
  const { 
    activeAction,
    activeBorderStyle, setActiveBorderStyle,
    activeBorderColor, setActiveBorderColor,
    activeBorderWidth, setActiveBorderWidth
  } = useMapStore();

  const [borderBrushes, setBorderBrushes] = useState<{type: BorderStyle, url: string}[]>([]);

  useEffect(() => {
    setBorderBrushes([
      { type: 'smooth', url: generateBorderBrush('smooth') },
      { type: 'snapped', url: generateBorderBrush('snapped') }
    ]);
  }, []);

  return (
    <BasePaletteLayout title="Borders">
      <div style={{marginBottom: '15px'}}>
        <label style={{color: '#ccc', fontSize: '14px', display: 'block', marginBottom: '5px'}}>Border Styles:</label>
        {borderBrushes.map(brush => (
          <ToolRow
            key={brush.type}
            type={brush.type}
            url={brush.url}
            label={brush.type === 'highlight' ? 'Highlight' : brush.type}
            isActive={activeBorderStyle === brush.type && activeAction === 'paint'}
            onSelect={() => setActiveBorderStyle(brush.type)}
            color1={activeBorderColor || '#dc2626'}
            onColor1Change={(c) => setActiveBorderColor(c)}
            width={activeBorderWidth || 5}
            onWidthChange={(w) => setActiveBorderWidth(w)}
          />
        ))}
        <button 
          onClick={() => window.dispatchEvent(new CustomEvent('snapSelectedBorder'))}
          style={{marginTop: '10px', padding: '5px 10px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', width: '100%', fontSize: '12px'}}
          title="Select a smooth border, then click this to automatically snap it to the hex edges."
        >
          Snap Selected Border
        </button>
      </div>
    </BasePaletteLayout>
  );
};
