import React from 'react';
import { MapLayer } from '../types';
import styles from './LayerStack.module.css';

import { useMapStore } from '../store/mapStore';

interface LayerStackProps {}

import { LayerIcon } from './LayerIcon';

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
  const [reimportingIds, setReimportingIds] = React.useState<string[]>([]);

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
                {layer.type === 'bg_image' && (
                  <button className={styles.iconBtn} disabled={reimportingIds.includes(layer.id)} onClick={async (e) => {
                    e.stopPropagation();
                    const state = useMapStore.getState();
                    if(window.api?.runPythonScript) {
                       try {
                         setReimportingIds(prev => [...prev, layer.id]);
                         state.setScanProgress(0, `Re-importing ${layer.name}...`);
                         const res = await window.api.runPythonScript({
                           action: 'interpret',
                           mode: 'reimport_layer',
                           imagePath: (layer.data as any).imagePath,
                           bgScaleX: state.bgScaleX,
                           bgScaleY: state.bgScaleY,
                           bgOffsetX: state.bgOffsetX,
                           bgOffsetY: state.bgOffsetY,
                           mapWidth: state.mapWidth,
                           mapHeight: state.mapHeight,
                           orientation: state.orientation,
                           style: state.currentStyle,
                           layers: []
                         });
                         state.setScanProgress(null, '');
                         if (res.success && res.data?.status === 'success') {
                           const newLayers = res.data.data.layers || [];
                           const updatedExistingLayers = state.layers.map(l => 
                             l.id === layer.id ? { ...l, data: { ...l.data, lastUpdated: Date.now() } } : l
                           );
                           state.setLayers([...updatedExistingLayers, ...newLayers]);
                           state.setToastMessage({ type: 'success', text: `Re-import of ${layer.name} complete! Added ${newLayers.length} new layer(s).` });
                         } else {
                           state.setToastMessage({ type: 'error', text: 'Re-import failed: ' + (res.error || res.data?.message || 'Unknown error') });
                         }
                       } catch (err: any) {
                         state.setScanProgress(null, '');
                         state.setToastMessage({ type: 'error', text: 'Re-import failed due to an exception: ' + (err.message || err) });
                       } finally {
                         setReimportingIds(prev => prev.filter(id => id !== layer.id));
                       }
                    }
                  }} title="Re-import layer">
                    {reimportingIds.includes(layer.id) ? '⏳' : '🔄'}
                  </button>
                )}
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
