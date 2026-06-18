import React, { useState } from 'react';
import styles from './TerrainPalette.module.css';

import { MapLayer, RoadStyle } from '../utils/hexMath';

interface TerrainPaletteProps {
  activeBrush: string | null;
  setActiveBrush: (url: string | null) => void;
  activeLayer: MapLayer;
  activeColor: string | null;
  setActiveColor: (c: string | null) => void;
  activeLineWidth: number;
  setActiveLineWidth: (w: number) => void;
  activeRoadStyle?: RoadStyle;
  setActiveRoadStyle?: (style: RoadStyle) => void;
  currentStyle?: string;
  roadConfig?: any;
}

function generateRoadBrush(type: 'path' | 'road' | 'tunnel' | 'highlight', config: any): string {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const cx = 32;
  const cy = 32;
  const r = 30;

  // Draw hex background
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = config?.brushBackground || '#7cb342';
  ctx.fill();
  
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Draw road
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  
  if (type === 'highlight') {
     ctx.shadowColor = '#ffff00';
     ctx.shadowBlur = 10;
     ctx.strokeStyle = '#ffff00';
     ctx.lineWidth = 6;
     ctx.beginPath();
     ctx.moveTo(12, 32);
     ctx.lineTo(52, 32);
     ctx.stroke();
  } else {
     const style = config?.[type] || {};
     ctx.shadowBlur = 0;
     const width = 8;
     
     if (type === 'tunnel') {
       ctx.strokeStyle = style.color || '#555555';
       ctx.lineWidth = width;
       ctx.beginPath(); ctx.moveTo(12, 32); ctx.lineTo(52, 32); ctx.stroke();
       
       ctx.strokeStyle = style.innerColor || '#ffffff';
       ctx.lineWidth = Math.max(1, width * (style.innerWidthMultiplier ?? 0.6));
       ctx.beginPath(); ctx.moveTo(12, 32); ctx.lineTo(52, 32); ctx.stroke();
     } else {
       ctx.strokeStyle = style.color || '#404040';
       ctx.lineWidth = width;
       if (style.dash && style.dash.length > 0) {
          ctx.setLineDash(style.dash);
       }
       ctx.beginPath(); ctx.moveTo(12, 32); ctx.lineTo(52, 32); ctx.stroke();
       ctx.setLineDash([]);
     }
  }

  return canvas.toDataURL();
}

const TerrainPalette: React.FC<TerrainPaletteProps> = ({ 
  activeBrush, setActiveBrush, activeLayer, activeColor, setActiveColor, activeLineWidth, setActiveLineWidth, activeRoadStyle, setActiveRoadStyle, currentStyle, roadConfig
}) => {
  const [brushes, setBrushes] = useState<string[]>([]);
  const [roadBrushes, setRoadBrushes] = useState<{type: RoadStyle, url: string}[]>([]);

  React.useEffect(() => {
    if (activeLayer.type === 'road') {
      setRoadBrushes([
        { type: 'path', url: generateRoadBrush('path', roadConfig) },
        { type: 'road', url: generateRoadBrush('road', roadConfig) },
        { type: 'tunnel', url: generateRoadBrush('tunnel', roadConfig) },
        { type: 'highlight', url: generateRoadBrush('highlight', roadConfig) },
      ]);
    }
  }, [activeLayer.type, roadConfig]);

  React.useEffect(() => {
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
          
          {activeLayer.type === 'road' && setActiveRoadStyle && (
            <div style={{marginBottom: '15px'}}>
              <label style={{color: '#ccc', fontSize: '14px', display: 'block', marginBottom: '5px'}}>Road Type:</label>
              <div className={styles.brushGrid}>
                {roadBrushes.map((brush) => (
                  <div 
                    key={brush.type} 
                    className={`${styles.brushItem} ${activeRoadStyle === brush.type ? styles.active : ''}`}
                    onClick={() => setActiveRoadStyle(brush.type)}
                    title={brush.type === 'highlight' ? 'Highlight Roads' : brush.type.charAt(0).toUpperCase() + brush.type.slice(1)}
                  >
                    <img src={brush.url} alt={brush.type} className={styles.brushImg} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {(activeLayer.type === 'border' || activeLayer.type === 'river' || activeLayer.type === 'cliff' || activeLayer.type === 'road') && (
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
            {(activeLayer as any).type === 'coastline' ? 'Water Fill Color:' : activeLayer.type === 'border' ? 'Border Color:' : 'Line Color:'}
            <input 
              type="color" 
              value={activeLayer.type === 'road' ? (roadConfig?.[activeRoadStyle || 'road']?.color || (activeRoadStyle === 'path' ? '#8b4513' : activeRoadStyle === 'tunnel' ? '#555555' : '#a0522d')) : (activeColor || '#3b82f6')} 
              onChange={e => setActiveColor(e.target.value)} 
              style={{width: '100%', height: '40px', opacity: activeColor === null ? 0.5 : 1}}
              disabled={activeColor === null || activeLayer.type === 'road'}
            />
          </label>

          {(activeLayer.type === 'river' || activeLayer.type === 'cliff' || activeLayer.type === 'border' || activeLayer.type === 'label' || activeLayer.type === 'road') && (
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
