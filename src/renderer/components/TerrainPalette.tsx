import React, { useState, useEffect } from 'react';
import styles from './TerrainPalette.module.css';

import { MapLayer } from '../utils/hexMath';

interface TerrainPaletteProps {
  activeBrush: string | null;
  setActiveBrush: (url: string | null) => void;
  activeLayer: MapLayer;
  activeColor: string | null;
  setActiveColor: (c: string | null) => void;
}

const TerrainPalette: React.FC<TerrainPaletteProps> = ({ 
  activeBrush, setActiveBrush, activeLayer, activeColor, setActiveColor 
}) => {
  const [brushes, setBrushes] = useState<string[]>([]);

  const loadFolder = async () => {
    if (!window.api?.openDirectory) return;
    const dirPath = await window.api.openDirectory();
    if (dirPath) {
      const files = await window.api.readDir(dirPath);
      const urls = files.map((f: string) => `local://file?path=${encodeURIComponent(f)}`);
      setBrushes(urls);
    }
  };

  useEffect(() => {
    const loadDefault = async () => {
      if ((window as any).api?.getDefaultTiles) {
        const folder = activeLayer.type === 'city' ? 'Cities' : 'Terrain';
        const files = await (window as any).api.getDefaultTiles(folder);
        const urls = files.map((f: string) => `local://file?path=${encodeURIComponent(f)}`);
        setBrushes(urls);
      }
    };
    if (activeLayer.type === 'terrain' || activeLayer.type === 'city') {
      loadDefault();
    }
  }, [activeLayer.type]);

  if (activeLayer.type !== 'terrain' && activeLayer.type !== 'city') {
    return (
      <div className={styles.paletteContainer}>
        <div className={styles.vectorTools}>
          <h3 style={{color: 'white', marginTop: 0}}>{activeLayer.name} Tools</h3>
          
          {activeLayer.type === 'coastline' && (
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

          <label style={{display: 'flex', flexDirection: 'column', gap: '5px', color: '#ccc'}}>
            {activeLayer.type === 'coastline' ? 'Water Fill Color:' : 'Line Color:'}
            <input 
              type="color" 
              value={activeColor || '#3b82f6'} 
              onChange={e => setActiveColor(e.target.value)} 
              style={{width: '100%', height: '40px'}}
            />
          </label>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.paletteContainer}>
      <button className={styles.loadButton} onClick={loadFolder}>
        Load Tileset Folder
      </button>
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
