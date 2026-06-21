import React, { useState, useEffect } from 'react';
import { BasePaletteLayout } from './BasePaletteLayout';
import { ToolRow } from './ToolRow';
import { useMapStore } from '../../store/mapStore';
import { generateRoadBrush } from '../../utils/brushGenerators';
import { RoadStyle } from '../../types';

export const RoadPalette: React.FC = () => {
  const { activeAction, activeRoadStyle, setActiveRoadStyle, roadConfig, setRoadConfig } = useMapStore();
  const [roadBrushes, setRoadBrushes] = useState<{type: RoadStyle, url: string}[]>([]);

  useEffect(() => {
    setRoadBrushes([
      { type: 'path', url: generateRoadBrush('path', roadConfig) },
      { type: 'road', url: generateRoadBrush('road', roadConfig) },
      { type: 'tunnel', url: generateRoadBrush('tunnel', roadConfig) }
    ]);
  }, [roadConfig]);

  const updateRoadConfig = (type: string, key: string, val: any) => {
    if (!roadConfig) return;
    setRoadConfig({ ...roadConfig, [type]: { ...roadConfig[type], [key]: val } });
  };

  return (
    <BasePaletteLayout title="Roads">
      <div style={{marginBottom: '15px'}}>
        <label style={{color: '#ccc', fontSize: '14px', display: 'block', marginBottom: '5px'}}>Road Types:</label>
        {roadBrushes.map(brush => (
          <ToolRow
            key={brush.type}
            type={brush.type}
            url={brush.url}
            label={brush.type === 'highlight' ? 'Highlight' : brush.type}
            isActive={activeRoadStyle === brush.type && activeAction === 'paint'}
            onSelect={() => setActiveRoadStyle(brush.type)}
            color1={(roadConfig || {})[brush.type]?.color || '#000000'}
            onColor1Change={(c) => updateRoadConfig(brush.type, 'color', c)}
            width={(roadConfig || {})[brush.type]?.width || 5}
            onWidthChange={(w) => updateRoadConfig(brush.type, 'width', w)}
            color2={brush.type === 'tunnel' ? ((roadConfig || {})[brush.type]?.dashColor || '#ffffff') : undefined}
            onColor2Change={brush.type === 'tunnel' ? (c) => updateRoadConfig(brush.type, 'dashColor', c) : undefined}
          />
        ))}
      </div>
    </BasePaletteLayout>
  );
};
