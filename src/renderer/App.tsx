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
  const [unknowns, setUnknowns] = useState<any[]>([]);
  const [highlightedHexKey, setHighlightedHexKey] = useState<string | null>(null);

  const [bgImagePath, setBgImagePath] = useState<string | null>(null);
  const [bgScaleX, setBgScaleX] = useState<number>(1);
  const [bgScaleY, setBgScaleY] = useState<number>(1);
  const [bgOffsetX, setBgOffsetX] = useState<number>(0);
  const [bgOffsetY, setBgOffsetY] = useState<number>(0);
  
  useEffect(() => {
    if (bgImagePath) {
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
      img.src = `local://file?path=${encodeURIComponent(bgImagePath)}`;
    }
  }, [bgImagePath, bgScaleX, bgScaleY, bgOffsetX, bgOffsetY, orientation]);
  
  const [activeBrush, setActiveBrush] = useState<string | null>(null);
  const [activeColor, setActiveColor] = useState<string | null>('#3b82f6');
  const [activeLineWidth, setActiveLineWidth] = useState<number>(4);
  
  const [layers, setLayers] = useState<MapLayer[]>([
    { id: '1', name: 'Terrain', type: 'terrain', visible: true, opacity: 1, data: {} },
    { id: '2', name: 'Cliffs', type: 'cliff', visible: true, opacity: 1, data: [] },
    { id: '3', name: 'Rivers', type: 'river', visible: true, opacity: 1, data: [] },
    { id: '4', name: 'Coastline', type: 'coastline', visible: true, opacity: 1, data: {} },
    { id: '5', name: 'Cities', type: 'city', visible: true, opacity: 1, data: {} },
    { id: '6', name: 'Borders', type: 'border', visible: true, opacity: 1, data: {} },
    { id: '7', name: 'Labels', type: 'label', visible: true, opacity: 1, data: [] }
  ]);
  const [activeLayerId, setActiveLayerId] = useState<string>('1');
  const [isScanning, setIsScanning] = useState<boolean>(false);

  const engineRef = useRef<HexGridEngineRef>(null);

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
        if (projectData.layers) setLayers(projectData.layers);
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

  const handleImportImage = async () => {
    const imagePath = await window.api.openImage();
    if (!imagePath) return;
    setBgImagePath(imagePath);
    setBgScaleX(1);
    setBgScaleY(1);
    setBgOffsetX(0);
    setBgOffsetY(0);
    
    setLayers([
      { id: '1', name: 'Terrain', type: 'terrain', visible: true, opacity: 1, data: {} },
      { id: '2', name: 'Cliffs', type: 'cliff', visible: true, opacity: 1, data: [] },
      { id: '3', name: 'Rivers', type: 'river', visible: true, opacity: 1, data: [] },
      { id: '4', name: 'Coastline', type: 'coastline', visible: true, opacity: 1, data: {} },
      { id: '5', name: 'Cities', type: 'city', visible: true, opacity: 1, data: {} },
      { id: '6', name: 'Borders', type: 'border', visible: true, opacity: 1, data: {} },
      { id: '7', name: 'Labels', type: 'label', visible: true, opacity: 1, data: [] }
    ]);
  };

  const handleScanAlignedMap = async () => {
    if (!bgImagePath) return;
    setIsScanning(true);
    try {
      const result = await window.api.runPythonScript({ 
        action: 'interpret', 
        imagePath: bgImagePath,
        bgScaleX,
        bgScaleY,
        bgOffsetX,
        bgOffsetY,
        mapWidth,
        mapHeight,
        orientation
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
        if (result.data.unknowns) {
          setUnknowns(result.data.unknowns);
        }
        setBgImagePath(null);
        alert('Image scanned successfully!');
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
    setLayers(prev => prev.map(l => l.id === id ? { ...l, visible: !l.visible } : l));
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

  const activeLayer = layers.find(l => l.id === activeLayerId) || layers[0];

  return (
    <div className={styles.appContainer}>
      <div className={styles.toolbar}>
        <div className={styles.toolbarTitle}>HexMapper Engine</div>
        <div className={styles.projectTools}>
          <button className={styles.projectButton} onClick={handleSaveProject} disabled={isScanning}>Save Project</button>
          <button className={styles.projectButton} onClick={handleLoadProject} disabled={isScanning}>Load Project</button>
          <button className={`${styles.projectButton} ${styles.export}`} onClick={handleExportImage} disabled={isScanning}>Export PNG</button>
          <button className={styles.projectButton} onClick={handleImportImage} disabled={isScanning} style={{background: '#f59e0b'}}>
            {isScanning ? 'Scanning...' : 'Import from Image'}
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
            bgImagePath={bgImagePath}
            bgScaleX={bgScaleX}
            bgScaleY={bgScaleY}
            bgOffsetX={bgOffsetX}
            bgOffsetY={bgOffsetY}
            globalCoastlines={globalCoastlines}
            globalBorders={globalBorders}
            highlightedHexKey={highlightedHexKey}
          />
        </div>
        <div className={styles.rightPanel}>
          <LayerPanel
            layers={layers}
            activeLayerId={activeLayerId}
            onSelectLayer={setActiveLayerId}
            onToggleVisibility={handleToggleVisibility}
          />
          {unknowns.length > 0 && (
            <UnknownsPanel 
              unknowns={unknowns} 
              onResolve={handleResolveUnknown} 
              onHover={setHighlightedHexKey} 
            />
          )}
        </div>
        {bgImagePath && (
          <div className={styles.sidebar} style={{marginTop: '10px', background: '#1e1e1e', border: '1px solid #333'}}>
            <h3 style={{ color: 'white', marginTop: '0', marginBottom: '15px' }}>Map Alignment</h3>
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
                <button className={styles.projectButton} onClick={() => setBgImagePath(null)} style={{background: '#ef4444'}}>Close</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
