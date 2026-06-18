import React from 'react';
import { MapLayer } from '../utils/hexMath';
import styles from './LayerPanel.module.css';

interface LayerPanelProps {
  layers: MapLayer[];
  activeLayerId: string;
  onSelectLayer: (id: string) => void;
  onToggleVisibility: (id: string) => void;
  onMoveLayer: (id: string, direction: 'up' | 'down') => void;
  onDeleteLayer?: (id: string) => void;
  onAddLayer?: (type: string) => void;
  onRenameLayer?: (id: string, newName: string) => void;
}

const LayerPanel: React.FC<LayerPanelProps> = ({
  layers,
  activeLayerId,
  onSelectLayer,
  onToggleVisibility,
  onMoveLayer,
  onDeleteLayer,
  onAddLayer,
  onRenameLayer
}) => {
  const [showAddMenu, setShowAddMenu] = React.useState(false);
  const [editingLayerId, setEditingLayerId] = React.useState<string | null>(null);
  const [editingName, setEditingName] = React.useState<string>('');
  const [collapsedGroups, setCollapsedGroups] = React.useState<Record<string, boolean>>({});

  const toggleGroup = (id: string) => {
    setCollapsedGroups(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleDoubleClick = (e: React.MouseEvent, layer: any) => {
    if (onRenameLayer) {
      e.stopPropagation();
      setEditingLayerId(layer.id);
      setEditingName(layer.name);
    }
  };

  const handleRenameSubmit = () => {
    if (editingLayerId && onRenameLayer) {
      onRenameLayer(editingLayerId, editingName);
    }
    setEditingLayerId(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleRenameSubmit();
    if (e.key === 'Escape') setEditingLayerId(null);
  };
  return (
    <div className={styles.layerPanel}>
      <div className={styles.titleRow} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
        <h3 className={styles.title} style={{margin: 0}}>Layers</h3>
        <div style={{position: 'relative'}}>
          <button className={styles.iconBtn} onClick={() => setShowAddMenu(!showAddMenu)} title="Add Layer">➕</button>
          {showAddMenu && onAddLayer && (
            <div style={{position: 'absolute', right: 0, top: '100%', background: '#222', border: '1px solid #444', zIndex: 10, display: 'flex', flexDirection: 'column'}}>
              <button onClick={() => { onAddLayer('terrain'); setShowAddMenu(false); }} style={{background: 'none', color: 'white', border: 'none', padding: '5px', cursor: 'pointer', textAlign: 'left'}}>Terrain</button>
              <button onClick={() => { onAddLayer('river'); setShowAddMenu(false); }} style={{background: 'none', color: 'white', border: 'none', padding: '5px', cursor: 'pointer', textAlign: 'left'}}>River</button>
              <button onClick={() => { onAddLayer('road'); setShowAddMenu(false); }} style={{background: 'none', color: 'white', border: 'none', padding: '5px', cursor: 'pointer', textAlign: 'left'}}>Road</button>
              <button onClick={() => { onAddLayer('city'); setShowAddMenu(false); }} style={{background: 'none', color: 'white', border: 'none', padding: '5px', cursor: 'pointer', textAlign: 'left'}}>City</button>
              <button onClick={() => { onAddLayer('coastline'); setShowAddMenu(false); }} style={{background: 'none', color: 'white', border: 'none', padding: '5px', cursor: 'pointer', textAlign: 'left'}}>Coastline</button>
            </div>
          )}
        </div>
      </div>
      <div className={styles.layerList} style={{marginTop: '10px'}}>
        {[...layers].reverse().map((layer) => {
          // If layer is a child and its parent is collapsed, don't render it
          if (layer.parentId && collapsedGroups[layer.parentId]) {
            return null;
          }

          if (layer.type === 'group') {
            return (
              <div 
                key={layer.id} 
                className={`${styles.layerItem} ${layer.id === activeLayerId ? styles.active : ''}`}
                onClick={() => onSelectLayer(layer.id)}
                style={{ fontWeight: 'bold', background: '#2a2a2a' }}
              >
                <div className={styles.layerInfo} style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); toggleGroup(layer.id); }}>
                  <button className={styles.iconBtn} style={{ marginRight: '5px' }}>
                    {collapsedGroups[layer.id] ? '▶' : '▼'}
                  </button>
                  <span className={styles.layerTypeIcon}>📁</span>
                  <span className={styles.layerName}>{layer.name}</span>
                </div>
                <div className={styles.layerActions} style={{display: 'flex', gap: '2px'}}>
                  <button 
                    className={styles.iconBtn} 
                    onClick={(e) => { e.stopPropagation(); onToggleVisibility(layer.id); }}
                    title={layer.visible ? "Hide group" : "Show group"}
                  >
                    {layer.visible ? '👁️' : '🚫'}
                  </button>
                  <button className={styles.iconBtn} onClick={(e) => { e.stopPropagation(); onMoveLayer(layer.id, 'up'); }} title="Move Up">↑</button>
                  <button className={styles.iconBtn} onClick={(e) => { e.stopPropagation(); onMoveLayer(layer.id, 'down'); }} title="Move Down">↓</button>
                  {onDeleteLayer && (
                    <button className={styles.iconBtn} onClick={(e) => { e.stopPropagation(); if(window.confirm(`Are you sure you want to delete the group "${layer.name}"?`)) onDeleteLayer(layer.id); }} title="Delete" style={{color: '#ef4444'}}>✖</button>
                  )}
                </div>
              </div>
            );
          }

          return (
            <div 
              key={layer.id} 
              className={`${styles.layerItem} ${layer.id === activeLayerId ? styles.active : ''}`}
              onClick={() => onSelectLayer(layer.id)}
              style={{ marginLeft: layer.parentId ? '20px' : '0px' }}
            >
              <div className={styles.layerInfo} onDoubleClick={(e) => handleDoubleClick(e, layer)}>
                <span className={styles.layerTypeIcon}>
                  {layer.type === 'terrain' ? '⬡' : layer.type === 'river' ? '〰' : layer.type === 'road' ? '🛣️' : layer.type === 'coastline' ? '🌊' : layer.type === 'bg_image' ? '🖼️' : '📄'}
                </span>
                {editingLayerId === layer.id ? (
                  <input
                    autoFocus
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onBlur={handleRenameSubmit}
                    onKeyDown={handleKeyDown}
                    className={styles.nameInput}
                    style={{background: '#333', color: 'white', border: '1px solid #555', padding: '2px 5px', width: '120px'}}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span className={styles.layerName} style={{cursor: 'text'}} title={`Double-click to rename (${layer.name})`}>
                    {layer.name}
                  </span>
                )}
              </div>
              <div className={styles.layerActions} style={{display: 'flex', gap: '2px'}}>
                <button 
                  className={styles.iconBtn} 
                  onClick={(e) => { e.stopPropagation(); onToggleVisibility(layer.id); }}
                  title={layer.visible ? "Hide layer" : "Show layer"}
                >
                  {layer.visible ? '👁️' : '🚫'}
                </button>
                <button className={styles.iconBtn} onClick={(e) => { e.stopPropagation(); onMoveLayer(layer.id, 'up'); }} title="Move Up">↑</button>
                <button className={styles.iconBtn} onClick={(e) => { e.stopPropagation(); onMoveLayer(layer.id, 'down'); }} title="Move Down">↓</button>
                {onDeleteLayer && (
                  <button className={styles.iconBtn} onClick={(e) => { e.stopPropagation(); if(window.confirm(`Are you sure you want to delete the layer "${layer.name}"?`)) onDeleteLayer(layer.id); }} title="Delete" style={{color: '#ef4444'}}>✖</button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default LayerPanel;
