import React from 'react';
import styles from '../LayerPalette.module.css';
import { useMapStore } from '../../store/mapStore';

interface ToolRowProps {
  type: string;
  url?: string;
  label: string;
  isActive: boolean;
  onSelect: () => void;
  color1: string;
  onColor1Change: (c: string) => void;
  width: number;
  onWidthChange: (w: number) => void;
  color2?: string;
  onColor2Change?: (c: string) => void;
}

export const ToolRow: React.FC<ToolRowProps> = ({
  type, url, label, isActive, onSelect, color1, onColor1Change, width, onWidthChange, color2, onColor2Change
}) => {
  const { setActiveAction } = useMapStore();
  
  return (
    <div className={styles.toolRow} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
      <div 
        className={`${styles.brushItem} ${isActive ? styles.active : ''}`}
        onClick={() => { setActiveAction('paint'); onSelect(); }}
        title={label}
        style={{ flexShrink: 0, width: '40px', height: '40px' }}
      >
        <div className={styles.hexBackground} />
        {url && <img src={url} alt={type} className={styles.brushImg} />}
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
};
