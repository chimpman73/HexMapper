import React from 'react';
import { BasePaletteLayout } from './BasePaletteLayout';
import { useMapStore } from '../../store/mapStore';
import styles from '../LayerPalette.module.css';
import { LegendLayer, LegendElement } from '../../types';

export const LegendPalette: React.FC = () => {
  const { layers, activeLayerId, setLayers, mapVariables } = useMapStore();
  const activeLayer = layers.find(l => l.id === activeLayerId) as LegendLayer;

  const addElement = (type: LegendElement['type']) => {
    if (!activeLayer) return;

    const newElement: LegendElement = {
      id: `legend_${Date.now()}`,
      type,
      x: 100, // default spawn location
      y: 100,
    };

    setLayers(prev => prev.map(l => {
      if (l.id === activeLayer.id && l.type === 'legend') {
        const currentData = Array.isArray(l.data) ? l.data : [];
        return {
          ...l,
          data: [...currentData, newElement]
        };
      }
      return l;
    }));
  };

  return (
    <BasePaletteLayout title="Legend Elements">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <button 
          onClick={() => addElement('titleBlock')}
          style={{ padding: '8px', background: '#333', color: 'white', border: '1px solid #555', borderRadius: '4px', cursor: 'pointer' }}
        >
          + Add Title Block
        </button>
        <button 
          onClick={() => addElement('distanceShield')}
          style={{ padding: '8px', background: '#333', color: 'white', border: '1px solid #555', borderRadius: '4px', cursor: 'pointer' }}
        >
          + Add Distance Shield
        </button>
        <button 
          onClick={() => {
            if (!mapVariables.compassRoseAsset) {
              alert("Please select a Compass Rose Asset in Map Settings first.");
              return;
            }
            addElement('compassRose');
          }}
          style={{ padding: '8px', background: '#333', color: 'white', border: '1px solid #555', borderRadius: '4px', cursor: 'pointer' }}
        >
          + Add Compass Rose
        </button>
      </div>
    </BasePaletteLayout>
  );
};
