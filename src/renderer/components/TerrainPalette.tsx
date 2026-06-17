import React, { useState, useEffect } from 'react';
import styles from './TerrainPalette.module.css';

import { MapLayer } from '../utils/hexMath';

interface TerrainPaletteProps {
  activeBrush: string | null;
  setActiveBrush: (url: string | null) => void;
  activeLayer: MapLayer;
  activeColor: string | null;
  setActiveColor: (c: string | null) => void;
  activeLineWidth: number;
  setActiveLineWidth: (w: number) => void;
  currentStyle?: string;
}

const TerrainPalette: React.FC<TerrainPaletteProps> = ({ 
  activeBrush, setActiveBrush, activeLayer, activeColor, setActiveColor, activeLineWidth, setActiveLineWidth, currentStyle
}) => {
  const [brushes, setBrushes] = useState<string[]>([]);


  useEffect(() => {
    const loadDefault = async () => {
      if ((window as any).api?.getDefaultTiles) {
        let folder = 'Terrain';
        if (activeLayer.type === 'city') folder = 'Cities';
        if (activeLayer.type === 'coastline') folder = 'Coastline';
        
        const files = await (window as any).api.getDefaultTiles(currentStyle || 'Hollow Moon', folder);
        const urls = files.map((f: string) => `local://file?path=${encodeURIComponent(f)}`);
        setBrushes(urls);
      }
    };
    if (activeLayer.type === 'terrain' || activeLayer.type === 'city' || activeLayer.type === 'coastline') {
      loadDefault();
    }
  }, [activeLayer.type, currentStyle]);

  if (activeLayer.type !== 'terrain' && activeLayer.type !== 'city' && activeLayer.type !== 'coastline') {
    return (
      <div className={styles.paletteContainer}>
        <div className={styles.vectorTools}>
          <h3 style={{color: 'white', marginTop: 0}}>{activeLayer.name} Tools</h3>
          
          {(activeLayer.type === 'border' || activeLayer.type === 'river' || activeLayer.type === 'cliff') && (
            <div className={styles.brushGrid} style={{ marginBottom: '15px' }}>
              <div 
                className={`${styles.brushItem} ${activeColor !== null ? styles.active : ''}`}
                onClick={() => setActiveColor(activeColor || '#3b82f6')}
              >
                <div className={styles.eraser} style={{ background: activeColor || '#3b82f6' }}>Paint</div>
              </div>
              <div 
                className={`${styles.brushItem} ${activeColor === null ? styles.active : ''}`}
                onClick={() => setActiveColor(null)}
              >
                <div className={styles.eraser}>Eraser</div>
              </div>
            </div>
          )}

          <label style={{display: 'flex', flexDirection: 'column', gap: '5px', color: '#ccc', marginBottom: '15px'}}>
            {activeLayer.type === 'coastline' ? 'Water Fill Color:' : activeLayer.type === 'border' ? 'Border Color:' : 'Line Color:'}
            <input 
              type="color" 
              value={activeColor || '#3b82f6'} 
              onChange={e => setActiveColor(e.target.value)} 
              style={{width: '100%', height: '40px', opacity: activeColor === null ? 0.5 : 1}}
              disabled={activeColor === null}
            />
          </label>

          {(activeLayer.type === 'river' || activeLayer.type === 'cliff' || activeLayer.type === 'border' || activeLayer.type === 'label') && (
            <label style={{display: 'flex', flexDirection: 'column', gap: '5px', color: '#ccc'}}>
              Line Width: {activeLineWidth}px
              <input 
                type="range" 
                min="1" 
                max="15" 
                value={activeLineWidth} 
                onChange={e => setActiveLineWidth(Number(e.target.value))} 
                style={{width: '100%'}}
              />
            </label>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.paletteContainer}>
      <div className={styles.brushGrid}>
        <div 
          className={`${styles.brushItem} ${activeBrush === null ? styles.active : ''}`}
          onClick={() => setActiveBrush(null)}
        >
          <div className={styles.eraser}>Eraser</div>
        </div>
        {brushes.map((url, i) => (
          <div 
            key={i} 
            className={`${styles.brushItem} ${activeBrush === url ? styles.active : ''}`}
            onClick={() => setActiveBrush(url)}
          >
            <img src={url} alt="brush" className={styles.brushImg} />
          </div>
        ))}
      </div>
    </div>
  );
};

export default TerrainPalette;
