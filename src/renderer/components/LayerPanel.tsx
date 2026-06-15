import React from 'react';
import { MapLayer } from '../utils/hexMath';
import styles from './LayerPanel.module.css';

interface LayerPanelProps {
  layers: MapLayer[];
  activeLayerId: string;
  onSelectLayer: (id: string) => void;
  onToggleVisibility: (id: string) => void;
}

const LayerPanel: React.FC<LayerPanelProps> = ({
  layers,
  activeLayerId,
  onSelectLayer,
  onToggleVisibility
}) => {
  return (
    <div className={styles.layerPanel}>
      <h3 className={styles.title}>Layers</h3>
      <div className={styles.layerList}>
        {[...layers].reverse().map((layer) => (
          <div 
            key={layer.id} 
            className={`${styles.layerItem} ${layer.id === activeLayerId ? styles.active : ''}`}
            onClick={() => onSelectLayer(layer.id)}
          >
            <div className={styles.layerInfo}>
              <span className={styles.layerTypeIcon}>
                {layer.type === 'terrain' ? '⬡' : layer.type === 'river' ? '〰' : layer.type === 'coastline' ? '🌊' : '📄'}
              </span>
              <span className={styles.layerName}>{layer.name}</span>
            </div>
            <div className={styles.layerActions}>
              <button 
                className={styles.iconBtn} 
                onClick={(e) => { e.stopPropagation(); onToggleVisibility(layer.id); }}
                title={layer.visible ? "Hide layer" : "Show layer"}
              >
                {layer.visible ? '👁️' : '🚫'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LayerPanel;
