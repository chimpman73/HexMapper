import React from 'react';
import { BasePaletteLayout } from './BasePaletteLayout';
import { useMapStore } from '../../store/mapStore';
import styles from '../LayerPalette.module.css';

export const LabelPalette: React.FC = () => {
  const { 
    mapVariables, setMapVariables
  } = useMapStore();

  return (
    <BasePaletteLayout title="Labels">
      <div style={{marginBottom: '15px'}}>
        <label style={{color: '#ccc', fontSize: '14px', display: 'block', marginBottom: '5px'}}>City Labels:</label>
        <div className={styles.toolRow} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <div 
            className={`${styles.brushItem}`}
            style={{ flexShrink: 0, width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '20px', background: '#333', border: '1px solid #555' }}
            title="City Label Style"
          >
            Aa
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ color: '#ccc', fontSize: '12px', textTransform: 'capitalize' }}>Text Style</div>
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              <input 
                type="color" 
                value={mapVariables?.cityLabelColor || '#000000'} 
                onChange={(e) => setMapVariables({ ...mapVariables, cityLabelColor: e.target.value } as any)} 
                className={styles.colorInput} 
                title="Fill Color"
              />
              <input 
                type="color" 
                value={mapVariables?.cityLabelOutline || '#ffffff'} 
                onChange={(e) => setMapVariables({ ...mapVariables, cityLabelOutline: e.target.value } as any)} 
                className={styles.colorInput} 
                title="Outline Color"
              />
              <input 
                type="number" 
                min="8" max="72"
                value={mapVariables?.cityLabelSize || 32} 
                onChange={(e) => setMapVariables({ ...mapVariables, cityLabelSize: parseInt(e.target.value) || 32 } as any)} 
                style={{ width: '40px', padding: '2px', background: '#333', color: '#fff', border: '1px solid #555' }} 
                title="Font Size"
              />
            </div>
          </div>
        </div>
      </div>
    </BasePaletteLayout>
  );
};
