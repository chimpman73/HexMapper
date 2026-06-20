import React, { useState, useEffect } from 'react';
import styles from './LayerPalette.module.css';

import { RoadStyle, RiverStyle, CoastlineStyle, BorderStyle } from '../types';
import { useMapStore } from '../store/mapStore';
import { generateRoadBrush, generateRiverBrush, generateCoastlineBrush, generateBorderBrush } from '../utils/brushGenerators';

const LayerPalette: React.FC = () => {
  const [roadBrushes, setRoadBrushes] = useState<{type: RoadStyle, url: string}[]>([]);
  const [riverBrushes, setRiverBrushes] = useState<{type: RiverStyle, url: string}[]>([]);
  const [coastlineBrushes, setCoastlineBrushes] = useState<{type: CoastlineStyle, url: string}[]>([]);
  const [borderBrushes, setBorderBrushes] = useState<{type: BorderStyle, url: string}[]>([]);
  
  const { 
    activeAction, setActiveAction,
    activeBrush, setActiveBrush, 
    activeFeatureBrush, setActiveFeatureBrush, 
    layers, activeLayerId, 
    orientation, setOrientation,
    showCoordinates, setShowCoordinates, 
    activeColor, setActiveColor, 
    activeLineWidth, setActiveLineWidth, 
    activeRoadStyle, setActiveRoadStyle, 
    activeRiverStyle, setActiveRiverStyle, 
    activeCoastlineStyle, setActiveCoastlineStyle, 
    activeBorderStyle, setActiveBorderStyle, 
    activeBorderColor, setActiveBorderColor, 
    activeBorderWidth, setActiveBorderWidth, 
    currentStyle, roadConfig, riverConfig, setRoadConfig, setRiverConfig, assetsBasePath
  } = useMapStore();

  const activeLayer = layers.find(l => l.id === activeLayerId) || layers[0];
  const [brushes, setBrushes] = useState<string[]>([]);
  const [featureBrushes, setFeatureBrushes] = useState<string[]>([]);
  const [featureDropdownOpen, setFeatureDropdownOpen] = useState(false);

  useEffect(() => {
    if (activeLayer.type === 'road') {
      setRoadBrushes([
        { type: 'path', url: generateRoadBrush('path', roadConfig) },
        { type: 'road', url: generateRoadBrush('road', roadConfig) },
        { type: 'tunnel', url: generateRoadBrush('tunnel', roadConfig) }
      ]);
    }
  }, [activeLayer.type, roadConfig]);

  useEffect(() => {
    if (activeLayer.type === 'river') {
      setRiverBrushes([
        { type: 'stream', url: generateRiverBrush('stream', riverConfig) },
        { type: 'river', url: generateRiverBrush('river', riverConfig) }
      ]);
    }
  }, [activeLayer.type, riverConfig]);

  useEffect(() => {
    if (activeLayer.type === 'coastline') {
      setCoastlineBrushes([
        { type: 'smooth', url: generateCoastlineBrush('smooth') },
        { type: 'fractal', url: generateCoastlineBrush('fractal') }
      ]);
    }
  }, [activeLayer.type]);

  useEffect(() => {
    if (activeLayer.type === 'border') {
      setBorderBrushes([
        { type: 'smooth', url: generateBorderBrush('smooth') },
        { type: 'snapped', url: generateBorderBrush('snapped') }
      ]);
    }
  }, [activeLayer.type]);

  useEffect(() => {
    const loadDefault = async () => {
      if (window.api?.getDefaultTiles) {
        let folder = 'Terrain';
        if (activeLayer.type === 'city') folder = 'Cities';
        if (activeLayer.type === 'coastline') folder = 'Coastline';
        
        const files = await window.api.getDefaultTiles(currentStyle || 'Hollow Moon', folder);
        const relPaths = files.map((f: string) => {
          const parts = f.split(/[\\/]tiles[\\/]/);
          return parts.length > 1 ? parts[1].replace(/\\/g, '/') : f;
        });
        setBrushes(relPaths);
      }
    };
    if (activeLayer.type === 'terrain' || activeLayer.type === 'city') {
      loadDefault();
    }
  }, [activeLayer.type, currentStyle]);

  useEffect(() => {
    const loadFeatures = async () => {
      if (window.api?.getDefaultTiles) {
        const files = await window.api.getDefaultTiles(currentStyle || 'Hollow Moon', 'Rivers');
        const relPaths = files.map((f: string) => {
          const parts = f.split(/[\\/]tiles[\\/]/);
          return parts.length > 1 ? parts[1].replace(/\\/g, '/') : f;
        });
        setFeatureBrushes(relPaths);
      }
    };
    if (activeLayer.type === 'river') {
      loadFeatures();
    }
  }, [activeLayer.type, currentStyle]);

  const updateRoadConfig = (type: string, key: string, val: any) => {
    if (!roadConfig) return;
    setRoadConfig({ ...roadConfig, [type]: { ...roadConfig[type], [key]: val } });
  };

  const updateRiverConfig = (type: string, key: string, val: any) => {
    if (!riverConfig) return;
    setRiverConfig({ ...riverConfig, [type]: { ...riverConfig[type], [key]: val } });
  };

  const renderToolRow = (
    type: string, url: string, label: string, 
    isActive: boolean, onSelect: () => void,
    color1: string, onColor1Change: (c: string) => void,
    width: number, onWidthChange: (w: number) => void,
    color2?: string, onColor2Change?: (c: string) => void
  ) => (
    <div key={type} className={styles.toolRow} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
      <div 
        className={`${styles.brushItem} ${isActive ? styles.active : ''}`}
        onClick={() => { setActiveAction('paint'); onSelect(); }}
        title={label}
        style={{ flexShrink: 0, width: '40px', height: '40px' }}
      >
        <div className={styles.hexBackground} />
        <img src={url} alt={type} className={styles.brushImg} />
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div style={{ color: '#ccc', fontSize: '12px', textTransform: 'capitalize' }}>{label}</div>
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          {type !== 'highlight' && (
            <>
              <input type="color" value={color1 || '#000000'} onChange={(e) => onColor1Change(e.target.value)} className={styles.colorInput} title="Color 1" />
              {color2 !== undefined && onColor2Change && (
                <input type="color" value={color2 || '#ffffff'} onChange={(e) => onColor2Change(e.target.value)} className={styles.colorInput} title="Color 2" />
              )}
              <input type="number" min="1" max="50" value={width || 1} onChange={(e) => onWidthChange(parseInt(e.target.value))} style={{ width: '40px', padding: '2px', background: '#333', color: '#fff', border: '1px solid #555' }} title="Width" />
            </>
          )}
        </div>
      </div>
    </div>
  );

  const resolveUrl = (relPath: string | null) => {
    if (!relPath) return '';
    if (relPath.startsWith('local://')) return relPath;
    return `local://file?path=${encodeURIComponent(`${assetsBasePath}/styles/${currentStyle}/tiles/${relPath}`)}`;
  };

  return (
    <div className={styles.paletteContainer}>
      <h3 style={{color: 'white', marginTop: 0, marginBottom: '10px'}}>{activeLayer.name} Tools</h3>
      
      <div className={styles.actionsSection} style={{ display: 'flex', gap: '5px', marginBottom: '15px' }}>
        <button className={`${styles.actionBtn} ${activeAction === 'select' ? styles.active : ''}`} onClick={() => setActiveAction('select')} title="Select Object">👆</button>
        <button className={`${styles.actionBtn} ${activeAction === 'move' ? styles.active : ''}`} onClick={() => setActiveAction('move')} title="Pan Map">🖐️</button>
        <button className={`${styles.actionBtn} ${activeAction === 'highlight' ? styles.active : ''}`} onClick={() => setActiveAction('highlight')} title="Highlight Mode">🔦</button>
        <button className={`${styles.actionBtn} ${activeAction === 'erase' ? styles.active : ''}`} onClick={() => setActiveAction('erase')} title="Eraser">🧼</button>
      </div>

      <div className={styles.toolsSection}>
        {activeLayer.type === 'road' && setActiveRoadStyle && (
          <div style={{marginBottom: '15px'}}>
            <label style={{color: '#ccc', fontSize: '14px', display: 'block', marginBottom: '5px'}}>Road Types:</label>
            {roadBrushes.map(brush => renderToolRow(
              brush.type, brush.url, brush.type === 'highlight' ? 'Highlight' : brush.type,
              activeRoadStyle === brush.type && activeAction === 'paint',
              () => setActiveRoadStyle(brush.type),
              (roadConfig || {})[brush.type]?.color || '#000000',
              (c) => updateRoadConfig(brush.type, 'color', c),
              (roadConfig || {})[brush.type]?.width || 5,
              (w) => updateRoadConfig(brush.type, 'width', w),
              brush.type === 'tunnel' ? ((roadConfig || {})[brush.type]?.dashColor || '#ffffff') : undefined,
              brush.type === 'tunnel' ? (c) => updateRoadConfig(brush.type, 'dashColor', c) : undefined
            ))}
          </div>
        )}

        {activeLayer.type === 'river' && setActiveRiverStyle && (
          <div style={{marginBottom: '15px'}}>
            <label style={{color: '#ccc', fontSize: '14px', display: 'block', marginBottom: '5px'}}>River Types:</label>
            {riverBrushes.map(brush => renderToolRow(
              brush.type, brush.url, brush.type === 'highlight' ? 'Highlight' : brush.type,
              activeRiverStyle === brush.type && activeAction === 'paint' && !activeFeatureBrush,
              () => { setActiveRiverStyle(brush.type); setActiveFeatureBrush(null); },
              (riverConfig || {})[brush.type]?.color || '#3b82f6',
              (c) => updateRiverConfig(brush.type, 'color', c),
              (riverConfig || {})[brush.type]?.width || 5,
              (w) => updateRiverConfig(brush.type, 'width', w)
            ))}

            {featureBrushes.length > 0 && (
              <div className={styles.toolRow} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <div 
                  className={`${styles.brushItem} ${activeFeatureBrush !== null && activeAction === 'paint' ? styles.active : ''}`}
                  onClick={() => { setActiveAction('paint'); if (!activeFeatureBrush) setActiveFeatureBrush(featureBrushes[0]); }}
                  title="River Feature"
                  style={{ flexShrink: 0, width: '40px', height: '40px' }}
                >
                  <div className={styles.hexBackground} />
                  <img src={resolveUrl(activeFeatureBrush || featureBrushes[0])} alt="Feature" className={styles.brushImg} />
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ color: '#ccc', fontSize: '12px', textTransform: 'capitalize' }}>River Feature</div>
                  <div style={{ position: 'relative' }}>
                    <div 
                      onClick={() => setFeatureDropdownOpen(!featureDropdownOpen)}
                      style={{ background: '#333', color: '#fff', border: '1px solid #555', padding: '2px 5px', display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', userSelect: 'none' }}
                    >
                       <img src={resolveUrl(activeFeatureBrush || featureBrushes[0])} style={{width: 20, height: 20, objectFit: 'contain'}} />
                       <span style={{flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '12px'}}>
                         {(activeFeatureBrush || featureBrushes[0]).split('/').pop()?.replace('.png', '').replace(/_/g, ' ') || 'Feature'}
                       </span>
                       <span style={{fontSize: '10px'}}>▼</span>
                    </div>
                    {featureDropdownOpen && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#222', border: '1px solid #555', zIndex: 100, maxHeight: '200px', overflowY: 'auto' }}>
                        {featureBrushes.map(url => (
                          <div 
                            key={url}
                            onClick={() => { setActiveFeatureBrush(url); setActiveAction('paint'); setFeatureDropdownOpen(false); }}
                            style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px', cursor: 'pointer', background: url === activeFeatureBrush ? '#3b82f6' : 'transparent' }}
                          >
                            <img src={resolveUrl(url)} style={{width: 24, height: 24, objectFit: 'contain'}} />
                            <span style={{fontSize: '12px', color: '#fff'}}>{url.split('/').pop()?.replace('.png', '').replace(/_/g, ' ')}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeLayer.type === 'coastline' && setActiveCoastlineStyle && (
          <div style={{marginBottom: '15px'}}>
            <label style={{color: '#ccc', fontSize: '14px', display: 'block', marginBottom: '5px'}}>Coastline Styles:</label>
            {coastlineBrushes.map(brush => renderToolRow(
              brush.type, brush.url, brush.type === 'highlight' ? 'Highlight' : brush.type,
              activeCoastlineStyle === brush.type && activeAction === 'paint',
              () => setActiveCoastlineStyle(brush.type),
              activeColor || '#222222',
              (c) => setActiveColor(c),
              activeLineWidth || 3,
              (w) => setActiveLineWidth(w)
            ))}
          </div>
        )}

        {activeLayer.type === 'border' && setActiveBorderStyle && (
          <div style={{marginBottom: '15px'}}>
            <label style={{color: '#ccc', fontSize: '14px', display: 'block', marginBottom: '5px'}}>Border Styles:</label>
            {borderBrushes.map(brush => renderToolRow(
              brush.type, brush.url, brush.type === 'highlight' ? 'Highlight' : brush.type,
              activeBorderStyle === brush.type && activeAction === 'paint',
              () => setActiveBorderStyle(brush.type),
              activeBorderColor || '#dc2626',
              (c) => setActiveBorderColor(c),
              activeBorderWidth || 5,
              (w) => setActiveBorderWidth(w)
            ))}
            <button 
              onClick={() => window.dispatchEvent(new CustomEvent('snapSelectedBorder'))}
              style={{marginTop: '10px', padding: '5px 10px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', width: '100%', fontSize: '12px'}}
              title="Select a smooth border, then click this to automatically snap it to the hex edges."
            >
              Snap Selected Border
            </button>
          </div>
        )}

        {activeLayer.type === 'grid' && (
          <div style={{marginBottom: '15px'}}>
            <label style={{color: '#ccc', fontSize: '14px', display: 'block', marginBottom: '10px'}}>Grid Properties:</label>
            <div style={{display: 'flex', flexDirection: 'column', gap: '15px'}}>
              <label style={{display: 'flex', flexDirection: 'column', color: 'white', gap: '5px', fontSize: '12px'}}>
                Hex Orientation
                <select 
                  style={{padding: '6px', background: '#333', color: 'white', border: '1px solid #555', borderRadius: '4px'}}
                  value={orientation} 
                  onChange={(e) => setOrientation(e.target.value as any)}
                >
                  <option value="flat">Flat-topped</option>
                  <option value="pointy">Pointy-topped</option>
                </select>
              </label>
              <label style={{display: 'flex', alignItems: 'center', color: 'white', gap: '8px', fontSize: '12px', cursor: 'pointer'}}>
                <input 
                  type="checkbox" 
                  checked={showCoordinates} 
                  onChange={(e) => setShowCoordinates(e.target.checked)} 
                  style={{cursor: 'pointer'}}
                />
                Show Coordinates Overlay
              </label>
              <label style={{display: 'flex', alignItems: 'center', color: 'white', gap: '8px', fontSize: '12px'}}>
                Grid Color
                <input 
                  type="color" 
                  value={(activeLayer as import('../types').GridLayer).data.color || '#333333'} 
                  onChange={(e) => {
                    useMapStore.getState().setLayers(prev => prev.map(l => 
                      l.id === activeLayer.id ? { ...l, data: { ...l.data, color: e.target.value } } : l
                    ));
                  }} 
                  className={styles.colorInput}
                />
              </label>
            </div>
          </div>
        )}
      </div>

      <div className={styles.brushesSection}>
        {(activeLayer.type === 'terrain' || activeLayer.type === 'city') && (
          <div style={{marginBottom: '15px'}}>
            <label style={{color: '#ccc', fontSize: '14px', display: 'block', marginBottom: '5px'}}>Brushes:</label>
            <div className={styles.brushGrid}>
              {brushes.map((url, i) => (
                <div 
                  key={i} 
                  className={`${styles.brushItem} ${activeBrush === url && activeAction === 'paint' ? styles.active : ''}`}
                  onClick={() => { setActiveAction('paint'); setActiveBrush(url); }}
                >
                  <div className={styles.hexBackground} />
                  <img src={resolveUrl(url)} alt="brush" className={styles.brushImg} />
                </div>
              ))}
            </div>
          </div>
        )}


      </div>
    </div>
  );
};

export default LayerPalette;
