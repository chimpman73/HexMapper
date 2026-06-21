import React, { useState, useEffect } from 'react';
import { BasePaletteLayout } from './BasePaletteLayout';
import { ToolRow } from './ToolRow';
import { useMapStore } from '../../store/mapStore';
import { generateRiverBrush } from '../../utils/brushGenerators';
import { RiverStyle } from '../../types';
import styles from '../LayerPalette.module.css';

export const RiverPalette: React.FC = () => {
  const { 
    activeAction, setActiveAction,
    activeRiverStyle, setActiveRiverStyle, 
    riverConfig, setRiverConfig,
    activeFeatureBrush, setActiveFeatureBrush,
    currentStyle, assetsBasePath
  } = useMapStore();

  const [riverBrushes, setRiverBrushes] = useState<{type: RiverStyle, url: string}[]>([]);
  const [featureBrushes, setFeatureBrushes] = useState<string[]>([]);
  const [featureDropdownOpen, setFeatureDropdownOpen] = useState(false);

  useEffect(() => {
    setRiverBrushes([
      { type: 'stream', url: generateRiverBrush('stream', riverConfig) },
      { type: 'river', url: generateRiverBrush('river', riverConfig) }
    ]);
  }, [riverConfig]);

  useEffect(() => {
    const loadFeatures = async () => {
      if (window.api?.getDefaultTiles) {
        const res = await window.api.getDefaultTiles(currentStyle || 'Hollow Moon', 'Rivers');
        if (res?.success && res.data) {
          const relPaths = res.data.map((f: string) => {
            const parts = f.split(/[\\/]tiles[\\/]/);
            return parts.length > 1 ? parts[1].replace(/\\/g, '/') : f;
          });
          setFeatureBrushes(relPaths);
        }
      }
    };
    loadFeatures();
  }, [currentStyle]);

  const resolveUrl = (relPath: string | null) => {
    if (!relPath) return '';
    if (relPath.startsWith('local://')) return relPath;
    return `local://file?path=${encodeURIComponent(`${assetsBasePath}/styles/${currentStyle}/tiles/${relPath}`)}`;
  };

  const updateRiverConfig = (type: string, key: string, val: any) => {
    if (!riverConfig) return;
    setRiverConfig({ ...riverConfig, [type]: { ...riverConfig[type], [key]: val } });
  };

  return (
    <BasePaletteLayout title="Rivers">
      <div style={{marginBottom: '15px'}}>
        <label style={{color: '#ccc', fontSize: '14px', display: 'block', marginBottom: '5px'}}>River Types:</label>
        {riverBrushes.map(brush => (
          <ToolRow
            key={brush.type}
            type={brush.type}
            url={brush.url}
            label={brush.type === 'highlight' ? 'Highlight' : brush.type}
            isActive={activeRiverStyle === brush.type && activeAction === 'paint' && !activeFeatureBrush}
            onSelect={() => { setActiveRiverStyle(brush.type); setActiveFeatureBrush(null); }}
            color1={(riverConfig || {})[brush.type]?.color || '#3b82f6'}
            onColor1Change={(c) => updateRiverConfig(brush.type, 'color', c)}
            width={(riverConfig || {})[brush.type]?.width || 5}
            onWidthChange={(w) => updateRiverConfig(brush.type, 'width', w)}
          />
        ))}

        {featureBrushes.length > 0 && (
          <div className={styles.toolRow} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', marginTop: '15px' }}>
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
    </BasePaletteLayout>
  );
};
