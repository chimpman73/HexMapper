import React from 'react';
import styles from '../LayerPalette.module.css';
import { useMapStore } from '../../store/mapStore';

interface BasePaletteLayoutProps {
  title: string;
  children?: React.ReactNode;
  showBrushes?: boolean;
  brushes?: string[];
  activeBrush?: string | null;
  onSelectBrush?: (url: string) => void;
  resolveUrl?: (url: string) => string;
}

export const BasePaletteLayout: React.FC<BasePaletteLayoutProps> = ({ 
  title, children, showBrushes, brushes, activeBrush, onSelectBrush, resolveUrl 
}) => {
  const { activeAction, setActiveAction } = useMapStore();
  
  return (
    <div className={styles.paletteContainer}>
      <h3 style={{color: 'white', marginTop: 0, marginBottom: '10px'}}>{title} Tools</h3>
      
      <div className={styles.actionsSection} style={{ display: 'flex', gap: '5px', marginBottom: '15px' }}>
        <button className={`${styles.actionBtn} ${activeAction === 'select' ? styles.active : ''}`} onClick={() => setActiveAction('select')} title="Select Object">👆</button>
        <button className={`${styles.actionBtn} ${activeAction === 'move' ? styles.active : ''}`} onClick={() => setActiveAction('move')} title="Pan Map">🖐️</button>
        <button className={`${styles.actionBtn} ${activeAction === 'highlight' ? styles.active : ''}`} onClick={() => setActiveAction('highlight')} title="Highlight Mode">🔦</button>
        <button className={`${styles.actionBtn} ${activeAction === 'erase' ? styles.active : ''}`} onClick={() => setActiveAction('erase')} title="Eraser">🧼</button>
      </div>

      <div className={styles.toolsSection}>
        {children}
      </div>

      {showBrushes && brushes && onSelectBrush && resolveUrl && brushes.length > 0 && (
        <div className={styles.brushesSection}>
          <div style={{marginBottom: '15px'}}>
            <label style={{color: '#ccc', fontSize: '14px', display: 'block', marginBottom: '5px'}}>
              {title === 'Cliffs' ? 'Terrain Brushes (Downslope):' : 'Brushes:'}
            </label>
            <div className={styles.brushGrid}>
              {brushes.map((url, i) => (
                <div 
                  key={i} 
                  className={`${styles.brushItem} ${activeBrush === url && activeAction === 'paint' ? styles.active : ''}`}
                  onClick={() => { setActiveAction('paint'); onSelectBrush(url); }}
                >
                  <div className={styles.hexBackground} />
                  <img src={resolveUrl(url)} alt="brush" className={styles.brushImg} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
