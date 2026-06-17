import React, { useState, useRef, useEffect } from 'react';
import styles from './index.module.css';
import HexGridEngine, { HexGridEngineRef } from './components/HexGridEngine';
import TerrainPalette from './components/TerrainPalette';
import LayerPanel from './components/LayerPanel';
import UnknownsPanel from './components/UnknownsPanel';
import { HexOrientation, MapLayer } from './utils/hexMath';

declare global {
  interface Window {
    api: {
      runPythonScript: (args: any) => Promise<any>;
      openDirectory: () => Promise<string | null>;
      openImage: () => Promise<string | null>;
      readDir: (dirPath: string) => Promise<string[]>;
      readMapDescription: (targetPath: string) => Promise<any | null>;
      saveMap: (dataString: string) => Promise<{ success: boolean; filePath?: string; canceled?: boolean; error?: string }>;
      loadMap: () => Promise<{ success: boolean; data?: string; filePath?: string; canceled?: boolean; error?: string }>;
      exportImage: (dataUrl: string) => Promise<{ success: boolean; filePath?: string; canceled?: boolean; error?: string }>;
    };
    electron: {
      ipcRenderer: {
        invoke: (channel: string, data: any) => Promise<any>;
      }
    };
  }
}

const App: React.FC = () => {
  const [orientation, setOrientation] = useState<HexOrientation>('flat');
  const [showCoordinates, setShowCoordinates] = useState<boolean>(true);
  const [mapWidth, setMapWidth] = useState<number>(50);
  const [mapHeight, setMapHeight] = useState<number>(25);
  
  const [globalCoastlines, setGlobalCoastlines] = useState<any[]>([]);
  const [globalBorders, setGlobalBorders] = useState<any[]>([]);
  const [globalRivers, setGlobalRivers] = useState<any[]>([]);
  const [unknowns, setUnknowns] = useState<any[]>([]);
  const [highlightedHexKey, setHighlightedHexKey] = useState<string | null>(null);

  const [bgScaleX, setBgScaleX] = useState<number>(1);
  const [bgScaleY, setBgScaleY] = useState<number>(1);
  const [bgOffsetX, setBgOffsetX] = useState<number>(0);
  const [bgOffsetY, setBgOffsetY] = useState<number>(0);
  const [importType, setImportType] = useState<'image' | 'directory' | null>(null);
  const [importDirPath, setImportDirPath] = useState<string | null>(null);
  const [showImportModal, setShowImportModal] = useState<boolean>(false);
  
  const [activeBrush, setActiveBrush] = useState<string | null>(null);
  const [activeColor, setActiveColor] = useState<string | null>('#3b82f6');
  const [activeLineWidth, setActiveLineWidth] = useState<number>(4);
  
  const [layers, setLayers] = useState<MapLayer[]>([
    { id: '1', name: 'Terrain', type: 'terrain', visible: true, opacity: 1, data: {} },
    { id: '4', name: 'Coastline', type: 'coastline', visible: true, opacity: 1, data: {} },
    { id: '2', name: 'Cliffs', type: 'cliff', visible: true, opacity: 1, data: [] },
    { id: '3', name: 'Rivers', type: 'river', visible: true, opacity: 1, data: [] },
    { id: '5', name: 'Cities', type: 'city', visible: true, opacity: 1, data: {} },
    { id: '8', name: 'Hex Grid', type: 'grid', visible: true, opacity: 1, data: {} },
    { id: '6', name: 'Borders', type: 'border', visible: true, opacity: 1, data: {} },
    { id: '7', name: 'Labels', type: 'label', visible: true, opacity: 1, data: [] }
  ]);
  const [activeLayerId, setActiveLayerId] = useState<string>('1');
  const [isScanning, setIsScanning] = useState<boolean>(false);

  // Determine the primary background image to use for auto-sizing the map
  const firstBgImagePath = layers.find(l => l.type === 'bg_image')?.data.imagePath;

  useEffect(() => {
    if (firstBgImagePath) {
      const img = new window.Image();
      img.onload = () => {
        const imgW = img.width * bgScaleX;
        const imgH = img.height * bgScaleY;
        
        const hexW = orientation === 'flat' ? 60 : 69.28;
        const hexH = orientation === 'flat' ? 69.28 : 60;
        
        const reqW = (imgW + Math.max(0, bgOffsetX)) / hexW;
        const reqH = (imgH + Math.max(0, bgOffsetY)) / hexH;
        
        setMapWidth(Math.max(10, Math.ceil(reqW) + 2));
        setMapHeight(Math.max(10, Math.ceil(reqH) + 2));
      };
      img.src = `local://file?path=${encodeURIComponent(firstBgImagePath)}`;
    }
  }, [firstBgImagePath, bgScaleX, bgScaleY, bgOffsetX, bgOffsetY, orientation]);
  
  const engineRef = useRef<HexGridEngineRef>(null);

  const moveLayer = (id: string, direction: 'up' | 'down') => {
    setLayers(prev => {
      const idx = prev.findIndex(l => l.id === id);
      if (idx === -1) return prev;
      
      // Index 0 is the bottom, Index length-1 is the top.
      if (direction === 'up' && idx < prev.length - 1) {
        const next = [...prev];
        const temp = next[idx];
        next[idx] = next[idx + 1];
        next[idx + 1] = temp;
        return next;
      } else if (direction === 'down' && idx > 0) {
        const next = [...prev];
        const temp = next[idx];
        next[idx] = next[idx - 1];
        next[idx - 1] = temp;
        return next;
      }
      return prev;
    });
  };

  const handleSaveProject = async () => {
    const projectData = {
      layers,
      mapWidth,
      mapHeight,
      orientation
    };
    const result = await window.api.saveMap(JSON.stringify(projectData, null, 2));
    if (result.success) {
      console.log('Project saved to', result.filePath);
    } else if (result.error) {
      console.error('Save failed:', result.error);
    }
  };

  const handleLoadProject = async () => {
    const result = await window.api.loadMap();
    if (result.success && result.data) {
      try {
        const projectData = JSON.parse(result.data);
        if (projectData.layers) {
          let loadedLayers = projectData.layers as MapLayer[];
          if (!loadedLayers.some(l => l.type === 'grid')) {
            const gridLayer: MapLayer = { id: '8', name: 'Hex Grid', type: 'grid', visible: true, opacity: 1, data: {} };
            const citiesIdx = loadedLayers.findIndex(l => l.type === 'city');
            if (citiesIdx !== -1) {
              loadedLayers.splice(citiesIdx, 0, gridLayer);
            } else {
              loadedLayers.push(gridLayer);
            }
          }
          setLayers(loadedLayers);
        }
        if (projectData.mapWidth) setMapWidth(projectData.mapWidth);
        if (projectData.mapHeight) setMapHeight(projectData.mapHeight);
        if (projectData.orientation) setOrientation(projectData.orientation);
      } catch (err) {
        console.error('Invalid project file:', err);
      }
    }
  };

  const handleExportImage = async () => {
    if (engineRef.current) {
      const dataUrl = engineRef.current.exportToDataURL();
      if (dataUrl) {
        const result = await window.api.exportImage(dataUrl);
        if (result.success) {
          console.log('Exported to', result.filePath);
        } else if (result.error) {
          console.error('Export failed:', result.error);
        }
      }
    }
  };

  const handleImportImageSelect = async () => {
    setShowImportModal(false);
    const imagePath = await window.api.openImage();
    if (!imagePath) return;
    setImportDirPath(null);
    setImportType('image');
    
    const desc = await window.api.readMapDescription(imagePath);
    if (desc) {
      setBgScaleX(desc['Scale x'] !== undefined ? desc['Scale x'] : 1);
      setBgScaleY(desc['Scale y'] !== undefined ? desc['Scale y'] : 1);
      setBgOffsetX(desc['Offset X'] !== undefined ? desc['Offset X'] : 0);
      setBgOffsetY(desc['Offset Y'] !== undefined ? desc['Offset Y'] : 0);
    } else {
      setBgScaleX(1);
      setBgScaleY(1);
      setBgOffsetX(0);
      setBgOffsetY(0);
    }
    
    const filename = imagePath.split(/[/\\]/).pop() || 'Background';
    const basename = filename.split('.').slice(0, -1).join('.') || filename;
    const groupId = `group_${Date.now()}`;
    const groupLayer = {
      id: groupId,
      name: 'Reference Images',
      type: 'group' as const,
      visible: true,
      opacity: 1,
      data: {}
    };

    const newBgLayer = {
      id: `bg_${Date.now()}`,
      name: basename,
      type: 'bg_image' as const,
      visible: true,
      opacity: 1,
      parentId: groupId,
      sourceFilename: basename,
      data: { imagePath }
    };
    
    setLayers(prev => [newBgLayer, groupLayer, ...prev]);
  };

  const handleImportDirectorySelect = async () => {
    setShowImportModal(false);
    const dirPath = await window.api.openDirectory();
    if (!dirPath) return;
    
    setImportDirPath(dirPath);
    setImportType('directory');
    
    const desc = await window.api.readMapDescription(dirPath);
    if (desc) {
      setBgScaleX(desc['Scale x'] !== undefined ? desc['Scale x'] : 1);
      setBgScaleY(desc['Scale y'] !== undefined ? desc['Scale y'] : 1);
      setBgOffsetX(desc['Offset X'] !== undefined ? desc['Offset X'] : 0);
      setBgOffsetY(desc['Offset Y'] !== undefined ? desc['Offset Y'] : 0);
    } else {
      setBgScaleX(1);
      setBgScaleY(1);
      setBgOffsetX(0);
      setBgOffsetY(0);
    }
    
    const files = await window.api.readDir(dirPath);
    const groupId = `group_${Date.now()}`;
    const groupLayer = {
      id: groupId,
      name: 'Reference Images',
      type: 'group' as const,
      visible: true,
      opacity: 1,
      data: {}
    };

    const newBgLayers = files.map((file, i) => {
      const filename = file.split(/[/\\]/).pop() || `Layer ${i}`;
      const basename = filename.split('.').slice(0, -1).join('.') || filename;
      return {
        id: `bg_${Date.now()}_${i}`,
        name: basename,
        type: 'bg_image' as const,
        visible: true,
        opacity: 1,
        parentId: groupId,
        sourceFilename: basename,
        data: { imagePath: file }
      };
    });
    
    setLayers(prev => [...newBgLayers, groupLayer, ...prev]);
  };

  const handleScanAlignedMap = async () => {
    if (importType === 'image' && !firstBgImagePath) return;
    if (importType === 'directory' && !importDirPath) return;
    
    setIsScanning(true);
    try {
      const result = await window.api.runPythonScript({ 
        action: 'interpret', 
        mode: importType === 'directory' ? 'multi_layer' : 'composite',
        imagePath: importType === 'directory' ? importDirPath : firstBgImagePath,
        bgScaleX,
        bgScaleY,
        bgOffsetX,
        bgOffsetY,
        mapWidth,
        mapHeight,
        orientation,
        layers: layers
      });
      console.log('Scanner result:', result);
      if (result.status === 'success' && result.data && result.data.layers) {
        setLayers(result.data.layers);
        if (result.data.globalCoastlines) {
          setGlobalCoastlines(result.data.globalCoastlines);
        }
        if (result.data.globalBorders) {
          setGlobalBorders(result.data.globalBorders);
        }
        if (result.data.globalRivers) {
          setGlobalRivers(result.data.globalRivers);
        }
        if (result.data.unknowns) {
          setUnknowns(result.data.unknowns);
        }
        setImportDirPath(null);
        setImportType(null);
        alert(importType === 'directory' ? 'Directory scanned successfully!' : 'Image scanned successfully!');
      } else {
        alert('Scan failed: ' + (result.message || 'Unknown error'));
      }
    } catch (err) {
      console.error(err);
      alert('Error during scan');
    } finally {
      setIsScanning(false);
    }
  };

  const handleToggleVisibility = (id: string) => {
    setLayers(prev => {
      const targetLayer = prev.find(l => l.id === id);
      if (!targetLayer) return prev;
      const newVisible = !targetLayer.visible;
      
      return prev.map(l => {
        if (l.id === id) return { ...l, visible: newVisible };
        if (l.parentId === id) return { ...l, visible: newVisible };
        return l;
      });
    });
  };

  const handleResolveUnknown = async (unknownId: string, action: 'ignore' | 'map' | 'save', payload?: any) => {
    const unk = unknowns.find(u => u.id === unknownId);
    if (!unk) return;

    if (action === 'ignore') {
      try {
        await window.api.runPythonScript({
          command: 'ignore_brush',
          id: unknownId
        });
      } catch(e) {
        console.error("Failed to ignore brush:", e);
      }
    } else if (action === 'map') {
      setLayers(prev => prev.map(l => {
        if (l.type === 'city') {
          return { ...l, data: { ...l.data, [unk.key]: `local://file?path=${encodeURIComponent('C:/John/Code/HexMapper/assets/tiles/' + payload.tile)}` } };
        }
        return l;
      }));
    } else if (action === 'save') {
      try {
        const result = await window.api.runPythonScript({
          command: 'save_brush',
          id: unknownId, 
          name: payload.name
        });
        if (result.status === 'success') {
          alert('Brush saved and signatures rebuilt!');
          setLayers(prev => prev.map(l => {
            if (l.type === 'city') {
              return { ...l, data: { ...l.data, [unk.key]: `local://file?path=${encodeURIComponent('C:/John/Code/HexMapper/assets/tiles/Cities/' + payload.name)}` } };
            }
            return l;
          }));
        } else {
          alert('Failed to save brush: ' + result.message);
        }
      } catch(e) {
        console.error(e);
      }
    }

    setUnknowns(prev => prev.filter(u => u.id !== unknownId));
  };

  const addLayer = (type: string) => {
    setLayers(prev => {
      const newLayer = {
        id: `layer_${Date.now()}`,
        name: `New ${type.charAt(0).toUpperCase() + type.slice(1)}`,
        type: type as any,
        visible: true,
        opacity: 1,
        data: type === 'cliff' || type === 'river' || type === 'label' ? [] : {}
      };
      return [...prev, newLayer];
    });
  };

  const deleteLayer = (id: string) => {
    if (layers.length <= 1) return; // Prevent deleting last layer
    setLayers(prev => prev.filter(l => l.id !== id));
    if (activeLayerId === id) {
      const nextLayer = layers.find(l => l.id !== id);
      if (nextLayer) setActiveLayerId(nextLayer.id);
    }
  };

  const renameLayer = (id: string, newName: string) => {
    setLayers(prev => prev.map(l => l.id === id ? { ...l, name: newName } : l));
  };

  const activeLayer = layers.find(l => l.id === activeLayerId) || layers[0];

  return (
    <div className={styles.appContainer}>
      <div className={styles.toolbar}>
        <div className={styles.toolbarTitle}>HexMapper Engine</div>
        <div className={styles.projectTools}>
          <button className={styles.projectButton} onClick={handleSaveProject} disabled={isScanning}>Save Project</button>
          <button className={styles.projectButton} onClick={handleLoadProject} disabled={isScanning}>Load Project</button>
          <button className={`${styles.projectButton} ${styles.export}`} onClick={handleExportImage} disabled={isScanning}>Export PNG</button>
          <button className={styles.projectButton} onClick={() => setShowImportModal(true)} disabled={isScanning} style={{background: '#f59e0b'}}>
            {isScanning ? 'Scanning...' : 'Extract Map'}
          </button>
        </div>
        <div className={styles.toolbarControls}>
          <label className={styles.controlLabel}>
            W:
            <input 
              type="number" 
              className={styles.numberInput} 
              value={mapWidth} 
              onChange={(e) => setMapWidth(Number(e.target.value))} 
              min={1} 
              max={500}
            />
          </label>
          <label className={styles.controlLabel}>
            H:
            <input 
              type="number" 
              className={styles.numberInput} 
              value={mapHeight} 
              onChange={(e) => setMapHeight(Number(e.target.value))} 
              min={1} 
              max={500}
            />
          </label>
          <label className={styles.controlLabel}>
            Orientation:
            <select 
              className={styles.select} 
              value={orientation} 
              onChange={(e) => setOrientation(e.target.value as HexOrientation)}
            >
              <option value="flat">Flat-topped</option>
              <option value="pointy">Pointy-topped</option>
            </select>
          </label>
          <label className={styles.controlLabel}>
            <input 
              type="checkbox" 
              checked={showCoordinates} 
              onChange={(e) => setShowCoordinates(e.target.checked)} 
            />
            Show Coordinates
          </label>
        </div>
      </div>
      
      <div className={styles.workspace}>
        <TerrainPalette 
          activeBrush={activeBrush} 
          setActiveBrush={setActiveBrush} 
          activeLayer={activeLayer}
          activeColor={activeColor}
          setActiveColor={setActiveColor}
          activeLineWidth={activeLineWidth}
          setActiveLineWidth={setActiveLineWidth}
        />
        <div className={styles.canvasContainer}>
          <HexGridEngine 
            ref={engineRef}
            orientation={orientation} 
            showCoordinates={showCoordinates} 
            mapWidth={mapWidth} 
            mapHeight={mapHeight}
            activeBrush={activeBrush}
            activeColor={activeColor}
            activeLineWidth={activeLineWidth}
            layers={layers}
            setLayers={setLayers}
            activeLayerId={activeLayerId}
            bgScaleX={bgScaleX}
            bgScaleY={bgScaleY}
            bgOffsetX={bgOffsetX}
            bgOffsetY={bgOffsetY}
            globalCoastlines={globalCoastlines}
            globalBorders={globalBorders}
            globalRivers={globalRivers}
            highlightedHexKey={highlightedHexKey}
          />
        </div>
        <div className={styles.rightPanel}>
          <LayerPanel
            layers={layers}
            activeLayerId={activeLayerId}
            onSelectLayer={setActiveLayerId}
            onToggleVisibility={handleToggleVisibility}
            onMoveLayer={moveLayer}
            onAddLayer={addLayer}
            onDeleteLayer={deleteLayer}
            onRenameLayer={renameLayer}
          />
          {unknowns.length > 0 && (
            <UnknownsPanel 
              unknowns={unknowns} 
              onResolve={handleResolveUnknown} 
              onHover={setHighlightedHexKey} 
            />
          )}
        </div>
        {importType && (
          <div className={styles.sidebar} style={{marginTop: '10px', background: '#1e1e1e', border: '1px solid #333'}}>
            <h3 style={{ color: 'white', marginTop: '0', marginBottom: '15px' }}>
              {importType === 'directory' ? 'Multi-Layer Alignment' : 'Map Alignment'}
            </h3>
            <div style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
              <label className={styles.controlLabel} style={{display: 'flex', justifyContent: 'space-between'}}>
                Scale X: 
                <input type="number" step="0.01" className={styles.numberInput} value={bgScaleX} onChange={e => setBgScaleX(Number(e.target.value))} style={{width: '60px'}}/>
              </label>
              <label className={styles.controlLabel} style={{display: 'flex', justifyContent: 'space-between'}}>
                Scale Y: 
                <input type="number" step="0.01" className={styles.numberInput} value={bgScaleY} onChange={e => setBgScaleY(Number(e.target.value))} style={{width: '60px'}}/>
              </label>
              <label className={styles.controlLabel} style={{display: 'flex', justifyContent: 'space-between'}}>
                Offset X: 
                <input type="number" step="1" className={styles.numberInput} value={bgOffsetX} onChange={e => setBgOffsetX(Number(e.target.value))} style={{width: '60px'}}/>
              </label>
              <label className={styles.controlLabel} style={{display: 'flex', justifyContent: 'space-between'}}>
                Offset Y: 
                <input type="number" step="1" className={styles.numberInput} value={bgOffsetY} onChange={e => setBgOffsetY(Number(e.target.value))} style={{width: '60px'}}/>
              </label>
              
              <div style={{display: 'flex', gap: '5px', marginTop: '10px'}}>
                <button className={`${styles.projectButton} ${styles.export}`} onClick={handleScanAlignedMap} disabled={isScanning} style={{flex: 1}}>
                  {isScanning ? 'Scanning...' : 'Scan Aligned'}
                </button>
                <button className={styles.projectButton} onClick={() => { setImportDirPath(null); setImportType(null); }} style={{background: '#ef4444'}}>Close</button>
              </div>
            </div>
          </div>
        )}

      </div>

      {showImportModal && (
        <div style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
          <div style={{background: '#1e1e1e', padding: '30px', borderRadius: '8px', border: '1px solid #333', textAlign: 'center'}}>
            <h2 style={{color: 'white', marginTop: '0'}}>Select Extraction Source</h2>
            <p style={{color: '#aaa', marginBottom: '25px'}}>Are you extracting a single composite image or a folder of separated map layers?</p>
            <div style={{display: 'flex', gap: '15px', justifyContent: 'center'}}>
              <button className={styles.projectButton} onClick={handleImportImageSelect} style={{background: '#f59e0b', padding: '10px 20px', fontSize: '16px'}}>Single File</button>
              <button className={styles.projectButton} onClick={handleImportDirectorySelect} style={{background: '#f59e0b', padding: '10px 20px', fontSize: '16px'}}>Layer Folder</button>
            </div>
            <button className={styles.projectButton} onClick={() => setShowImportModal(false)} style={{marginTop: '20px', background: '#ef4444'}}>Cancel</button>
          </div>
        </div>
      )}

    </div>
  );
};

export default App;
