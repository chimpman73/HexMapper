import React from 'react';
import { MapLayer } from '../utils/hexMath';
import styles from './LayerStack.module.css';

import { useMapStore } from '../store/mapStore';

interface LayerStackProps {}

const LayerIcon: React.FC<{ type: string, assetsBasePath: string }> = ({ type, assetsBasePath }) => {
  const hexPoints = "100,50 75,93.3 25,93.3 0,50 25,6.7 75,6.7";
  const green = "#7cb342";
  
  if (type === 'terrain') {
    return <img src={`local://file?path=${encodeURIComponent(assetsBasePath + '/styles/Hollow Moon/tiles/Terrain/hex_mountains.png')}`} style={{width: 20, height: 20, objectFit: 'contain'}} alt="Terrain" />;
  }
  
  if (type === 'river') {
    return (
      <svg width="20" height="20" viewBox="0 0 100 100">
        <polygon points={hexPoints} fill={green} />
        <path d="M 0,50 Q 50,30 100,50" fill="none" stroke="#3b82f6" strokeWidth="15" />
      </svg>
    );
  }
  
  if (type === 'road') {
    return (
      <svg width="20" height="20" viewBox="0 0 100 100">
        <polygon points={hexPoints} fill={green} />
        <path d="M 0,70 L 100,30" fill="none" stroke="#222" strokeWidth="12" />
      </svg>
    );
  }
  
  if (type === 'coastline') {
    return (
      <svg width="20" height="20" viewBox="0 0 100 100">
        <defs>
          <clipPath id="coastlineClip">
            <polygon points={hexPoints} />
          </clipPath>
        </defs>
        <polygon points={hexPoints} fill="#3b82f6" />
        <polygon points="0,0 50,0 50,100 0,100" fill={green} clipPath="url(#coastlineClip)" />
      </svg>
    );
  }
  
  if (type === 'border') {
    return (
      <svg width="20" height="20" viewBox="0 0 100 100">
        <polygon points={hexPoints} fill={green} />
        <polyline points="25,6.7 0,50 25,93.3 75,93.3" fill="none" stroke="#dc2626" strokeWidth="10" strokeLinejoin="round" />
      </svg>
    );
  }
  
  if (type === 'label') {
    return (
      <svg width="20" height="20" viewBox="0 0 100 100">
        <polygon points={hexPoints} fill={green} />
        <text x="50" y="65" fontSize="55" fontWeight="bold" fill="#222" textAnchor="middle">T</text>
      </svg>
    );
  }
  
  if (type === 'grid') {
    return (
      <svg width="20" height="20" viewBox="0 0 100 100">
        <polygon points={hexPoints} fill="none" stroke="#ffffff" strokeWidth="8" />
      </svg>
    );
  }
  
  if (type === 'cliff') {
    return (
      <svg width="20" height="20" viewBox="0 0 100 100">
        <polygon points={hexPoints} fill={green} />
        <path d="M 0,50 L 100,50" stroke="#555" strokeWidth="6" />
        <path d="M 20,50 L 20,30 M 40,50 L 40,30 M 60,50 L 60,30 M 80,50 L 80,30" stroke="#555" strokeWidth="4" />
      </svg>
    );
  }
  
  if (type === 'bg_image') {
    return <span style={{fontSize: '16px', lineHeight: '20px'}}>🖼️</span>;
  }
  
  if (type === 'city') {
    return (
      <svg width="20" height="20" viewBox="0 0 100 100">
        <polygon points={hexPoints} fill={green} />
        <path d="M 20,70 L 20,40 L 50,15 L 80,40 L 80,70 Z" fill="#444" />
        <rect x="40" y="50" width="20" height="20" fill="#222" />
      </svg>
    );
  }

  if (type === 'group') {
    return <span style={{fontSize: '16px', lineHeight: '20px'}}>📁</span>;
  }

  return <span style={{fontSize: '16px', lineHeight: '20px'}}>📄</span>;
};

const LayerStack: React.FC<LayerStackProps> = () => {
  const {
    layers,
    activeLayerId,
    setActiveLayerId: onSelectLayer,
    toggleLayerVisibility: onToggleVisibility,
    moveLayer: onMoveLayer,
    deleteLayer: onDeleteLayer,
    addLayer: onAddLayer,
    renameLayer: onRenameLayer,
    assetsBasePath
  } = useMapStore();
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
          if (layer.parentId && collapsedGroups[layer.parentId]) {
            return null;
          }

          if (layer.type === 'group') {
            return (
              <div 
                key={layer.id} 
                className={`${styles.layerItem} ${layer.id === activeLayerId ? styles.active : ''}`}
                onClick={() => onSelectLayer(layer.id)}
                style={{ fontWeight: 'bold', background: '#2a2a2a', opacity: layer.visible ? 1 : 0.5 }}
              >
                <div className={styles.layerInfo} style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); toggleGroup(layer.id); }}>
                  <button className={styles.iconBtn} style={{ marginRight: '5px' }}>
                    {collapsedGroups[layer.id] ? '▶' : '▼'}
                  </button>
                  <span className={styles.layerTypeIcon} style={{ display: 'flex' }}><LayerIcon type={layer.type} assetsBasePath={assetsBasePath} /></span>
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
              style={{ marginLeft: layer.parentId ? '20px' : '0px', opacity: layer.visible ? 1 : 0.5 }}
            >
              <div className={styles.layerInfo} onDoubleClick={(e) => handleDoubleClick(e, layer)}>
                <span className={styles.layerTypeIcon} style={{ display: 'flex' }}>
                  <LayerIcon type={layer.type} assetsBasePath={assetsBasePath} />
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

export default LayerStack;
