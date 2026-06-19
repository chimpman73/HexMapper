import React, { useState } from 'react';
import styles from './TerrainPalette.module.css';

import { RoadStyle, RiverStyle, CoastlineStyle } from '../types';
import { useMapStore } from '../store/mapStore';

interface TerrainPaletteProps {}

import { generateRoadBrush, generateRiverBrush, generateCoastlineBrush, generateBorderBrush } from '../utils/brushGenerators';

const TerrainPalette: React.FC<TerrainPaletteProps> = () => {
  const [roadBrushes, setRoadBrushes] = useState<{type: RoadStyle, url: string}[]>([]);
  const [riverBrushes, setRiverBrushes] = useState<{type: RiverStyle, url: string}[]>([]);
  const [coastlineBrushes, setCoastlineBrushes] = useState<{type: CoastlineStyle, url: string}[]>([]);
  const [borderBrushes, setBorderBrushes] = useState<{type: BorderStyle, url: string}[]>([]);
  const [selectedBorderLine, setSelectedBorderLine] = useState<any>(null);
  
  const { 
    activeBrush, setActiveBrush, activeFeatureBrush, setActiveFeatureBrush, layers, activeLayerId, activeColor, setActiveColor, activeLineWidth, setActiveLineWidth, activeRoadStyle, setActiveRoadStyle, activeRiverStyle, setActiveRiverStyle, activeCoastlineStyle, setActiveCoastlineStyle, activeBorderStyle, setActiveBorderStyle, activeBorderColor, setActiveBorderColor, activeBorderWidth, setActiveBorderWidth, currentStyle, roadConfig, riverConfig, setLayers, mapWidth, mapHeight, orientation
  } = useMapStore();

  const activeLayer = layers.find(l => l.id === activeLayerId) || layers[0];
  const [brushes, setBrushes] = useState<string[]>([]);
  const [featureBrushes, setFeatureBrushes] = useState<string[]>([]);

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
    if (activeLayer.type === 'river') {
      setRiverBrushes([
        { type: 'stream', url: generateRiverBrush('stream', riverConfig) },
        { type: 'river', url: generateRiverBrush('river', riverConfig) },
        { type: 'highlight', url: generateRiverBrush('highlight', riverConfig) },
      ]);
    }
  }, [activeLayer.type, riverConfig]);

  React.useEffect(() => {
    if (activeLayer.type === 'coastline') {
      setCoastlineBrushes([
        { type: 'smooth', url: generateCoastlineBrush('smooth') },
        { type: 'fractal', url: generateCoastlineBrush('fractal') },
        { type: 'highlight', url: generateCoastlineBrush('highlight') },
      ]);
    }
  }, [activeLayer.type]);

  React.useEffect(() => {
    if (activeLayer.type === 'border') {
      setBorderBrushes([
        { type: 'smooth', url: generateBorderBrush('smooth') },
        { type: 'snapped', url: generateBorderBrush('snapped') },
        { type: 'highlight', url: generateBorderBrush('highlight') },
      ]);
    }
  }, [activeLayer.type]);

  React.useEffect(() => {
    // We don't have selectedLineId in store, but we can access it through window.api if needed or we can just pass it?
    // Wait, selectedLineId is not in store. TerrainPalette doesn't know which line is selected!
    // To snap the selected line, we can just snap ALL borders on the layer, OR we must move selectedLineId to store.
  }, []);

  React.useEffect(() => {
    const loadDefault = async () => {
      if (window.api?.getDefaultTiles) {
        let folder = 'Terrain';
        if (activeLayer.type === 'city') folder = 'Cities';
        if (activeLayer.type === 'coastline') folder = 'Coastline';
        
        const files = await window.api.getDefaultTiles(currentStyle || 'Hollow Moon', folder);
        const urls = files.map((f: string) => `local://file?path=${encodeURIComponent(f)}`);
        setBrushes(urls);
      }
    };
    if (activeLayer.type === 'terrain' || activeLayer.type === 'city') {
      loadDefault();
    }
  }, [activeLayer.type, currentStyle]);

  React.useEffect(() => {
    const loadFeatures = async () => {
      if (window.api?.getDefaultTiles) {
        const files = await window.api.getDefaultTiles(currentStyle || 'Hollow Moon', 'Rivers');
        const urls = files.map((f: string) => `local://file?path=${encodeURIComponent(f)}`);
        setFeatureBrushes(urls);
      }
    };
    if (activeLayer.type === 'river') {
      loadFeatures();
    }
  }, [activeLayer.type, currentStyle]);

  if (activeLayer.type !== 'terrain' && activeLayer.type !== 'city') {
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

          {activeLayer.type === 'river' && setActiveRiverStyle && (
            <div style={{marginBottom: '15px'}}>
              <label style={{color: '#ccc', fontSize: '14px', display: 'block', marginBottom: '5px'}}>River Type:</label>
              <div className={styles.brushGrid}>
                {riverBrushes.map((brush) => (
                  <div 
                    key={brush.type} 
                    className={`${styles.brushItem} ${activeRiverStyle === brush.type ? styles.active : ''}`}
                    onClick={() => setActiveRiverStyle(brush.type)}
                    title={brush.type === 'highlight' ? 'Highlight Rivers' : brush.type.charAt(0).toUpperCase() + brush.type.slice(1)}
                  >
                    <img src={brush.url} alt={brush.type} className={styles.brushImg} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeLayer.type === 'coastline' && setActiveCoastlineStyle && (
            <div style={{marginBottom: '15px'}}>
              <label style={{color: '#ccc', fontSize: '14px', display: 'block', marginBottom: '5px'}}>Coastline Style:</label>
              <div className={styles.brushGrid}>
                {coastlineBrushes.map((brush) => (
                  <div 
                    key={brush.type} 
                    className={`${styles.brushItem} ${activeCoastlineStyle === brush.type ? styles.active : ''}`}
                    onClick={() => setActiveCoastlineStyle(brush.type)}
                    title={brush.type === 'highlight' ? 'Highlight Coastlines' : brush.type.charAt(0).toUpperCase() + brush.type.slice(1)}
                  >
                    <img src={brush.url} alt={brush.type} className={styles.brushImg} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeLayer.type === 'border' && setActiveBorderStyle && (
            <div style={{marginBottom: '15px'}}>
              <label style={{color: '#ccc', fontSize: '14px', display: 'block', marginBottom: '5px'}}>Border Style:</label>
              <div className={styles.brushGrid}>
                {borderBrushes.map((brush) => (
                  <div 
                    key={brush.type} 
                    className={`${styles.brushItem} ${activeBorderStyle === brush.type ? styles.active : ''}`}
                    onClick={() => setActiveBorderStyle(brush.type)}
                    title={brush.type === 'highlight' ? 'Highlight Borders' : brush.type.charAt(0).toUpperCase() + brush.type.slice(1)}
                  >
                    <img src={brush.url} alt={brush.type} className={styles.brushImg} />
                  </div>
                ))}
              </div>
              <button 
                onClick={() => window.dispatchEvent(new CustomEvent('snapSelectedBorder'))}
                style={{marginTop: '10px', padding: '5px 10px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', width: '100%', fontSize: '12px'}}
                title="Select a smooth border, then click this to automatically snap it to the hex edges."
              >
                Snap Selected Border
              </button>
            </div>
          )}

          {(activeLayer.type === 'border' || activeLayer.type === 'river' || activeLayer.type === 'cliff' || activeLayer.type === 'road' || activeLayer.type === 'coastline') && (
            <div className={styles.brushGrid} style={{ marginBottom: '15px' }}>
              <div 
                className={`${styles.brushItem} ${activeLayer.type === 'border' ? (activeBorderColor !== null ? styles.active : '') : (activeColor !== null ? styles.active : '')}`}
                onClick={() => activeLayer.type === 'border' ? setActiveBorderColor(activeBorderColor || '#dc2626') : setActiveColor(activeColor || (activeLayer.type === 'coastline' ? '#222222' : '#3b82f6'))}
              >
                <div className={styles.eraser} style={{ background: activeLayer.type === 'border' ? (activeBorderColor || '#dc2626') : (activeColor || (activeLayer.type === 'coastline' ? '#222222' : '#3b82f6')) }}>Paint</div>
              </div>
              <div 
                className={`${styles.brushItem} ${activeLayer.type === 'border' ? (activeBorderColor === null ? styles.active : '') : (activeColor === null ? styles.active : '')}`}
                onClick={() => activeLayer.type === 'border' ? setActiveBorderColor(null as any) : setActiveColor(null)}
              >
                <div className={styles.eraser}>Eraser</div>
              </div>
            </div>
          )}

          <label style={{display: 'flex', flexDirection: 'column', gap: '5px', color: '#ccc', marginBottom: '15px'}}>
            {(activeLayer as any).type === 'coastline' ? 'Line Color:' : activeLayer.type === 'border' ? 'Border Color:' : 'Line Color:'}
            <input 
              type="color" 
              value={activeLayer.type === 'border' ? (activeBorderColor || '#dc2626') : (activeColor || (activeLayer.type === 'coastline' ? '#222222' : '#3b82f6'))}
              onChange={(e) => activeLayer.type === 'border' ? setActiveBorderColor(e.target.value) : setActiveColor(e.target.value)}
              style={{width: '100%', height: '40px', opacity: (activeLayer.type === 'border' ? activeBorderColor : activeColor) === null ? 0.5 : 1}}
              disabled={(activeLayer.type === 'border' ? activeBorderColor : activeColor) === null || activeLayer.type === 'road' || activeLayer.type === 'river'}
            />
          </label>

          {(activeLayer.type === 'river' || activeLayer.type === 'cliff' || activeLayer.type === 'border' || activeLayer.type === 'label' || activeLayer.type === 'road' || activeLayer.type === 'coastline') && (
            <div style={{marginBottom: '15px'}}>
              <label style={{color: '#ccc', fontSize: '14px', display: 'block', marginBottom: '5px'}}>Line Width: {activeLayer.type === 'border' ? activeBorderWidth : activeLineWidth}px</label>
              <input 
                type="range" 
                min="1" max="50" 
                value={activeLayer.type === 'border' ? activeBorderWidth : activeLineWidth} 
                onChange={(e) => activeLayer.type === 'border' ? setActiveBorderWidth(parseInt(e.target.value)) : setActiveLineWidth(parseInt(e.target.value))}
                style={{width: '100%'}}
              />
            </div>
          )}

          {activeLayer.type === 'river' && featureBrushes.length > 0 && (
            <div style={{marginBottom: '15px'}}>
              <label style={{color: '#ccc', fontSize: '14px', display: 'block', marginBottom: '5px'}}>River Features:</label>
              <div className={styles.brushGrid}>
                <div 
                  className={`${styles.brushItem} ${activeFeatureBrush === null ? styles.active : ''}`}
                  onClick={() => setActiveFeatureBrush(null)}
                >
                  <div className={styles.eraser}>None</div>
                </div>
                {featureBrushes.map((url, i) => (
                  <div 
                    key={i} 
                    className={`${styles.brushItem} ${activeFeatureBrush === url ? styles.active : ''}`}
                    onClick={() => setActiveFeatureBrush(url)}
                    style={{ position: 'relative', overflow: 'hidden' }}
                  >
                    <div style={{
                       position: 'absolute',
                       top: 4, bottom: 4, left: 4, right: 4,
                       backgroundColor: '#7cb342',
                       clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
                       zIndex: 0
                    }}>
                       <div style={{
                          position: 'absolute',
                          top: 0, bottom: 0, left: '50%', transform: 'translateX(-50%)',
                          width: '6px',
                          backgroundColor: '#3b82f6',
                       }} />
                    </div>
                    <img src={url} alt="feature brush" className={styles.brushImg} style={{ position: 'relative', zIndex: 1, objectFit: 'contain', width: '100%', height: '100%' }} />
                  </div>
                ))}
              </div>
            </div>
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
