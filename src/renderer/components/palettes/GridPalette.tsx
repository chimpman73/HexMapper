import React from 'react';
import { BasePaletteLayout } from './BasePaletteLayout';
import { useMapStore } from '../../store/mapStore';
import styles from '../LayerPalette.module.css';

export const GridPalette: React.FC = () => {
  const { 
    layers, activeLayerId,
    orientation, setOrientation,
    showCoordinates, setShowCoordinates
  } = useMapStore();

  const activeLayer = layers.find(l => l.id === activeLayerId);

  return (
    <BasePaletteLayout title="Grid">
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
              value={activeLayer?.data?.color || '#333333'} 
              onChange={(e) => {
                if (!activeLayer) return;
                useMapStore.getState().setLayers(prev => prev.map(l => 
                  l.id === activeLayer.id ? { ...l, data: { ...l.data, color: e.target.value } } : l
                ));
              }} 
              className={styles.colorInput}
            />
          </label>
        </div>
      </div>
    </BasePaletteLayout>
  );
};
