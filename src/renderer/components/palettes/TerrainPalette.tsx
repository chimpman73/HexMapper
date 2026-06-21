import React, { useState, useEffect } from 'react';
import { BasePaletteLayout } from './BasePaletteLayout';
import { useMapStore } from '../../store/mapStore';

export const TerrainPalette: React.FC = () => {
  const { 
    activeBrush, setActiveBrush,
    currentStyle, assetsBasePath
  } = useMapStore();

  const [brushes, setBrushes] = useState<string[]>([]);

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
      title="Terrain"
      showBrushes={true}
      brushes={brushes}
      activeBrush={activeBrush}
      onSelectBrush={setActiveBrush}
      resolveUrl={resolveUrl}
    />
  );
};
