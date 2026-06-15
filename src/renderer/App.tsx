import React, { useState } from 'react';
import styles from './index.module.css';
import HexGridEngine from './components/HexGridEngine';
import TerrainPalette from './components/TerrainPalette';
import LayerPanel from './components/LayerPanel';
import { HexOrientation, MapLayer } from './utils/hexMath';

declare global {
  interface Window {
    api: {
      runPythonScript: (args: any) => Promise<any>;
      openDirectory: () => Promise<string | null>;
      readDir: (dirPath: string) => Promise<string[]>;
    };
  }
}

const App: React.FC = () => {
  const [orientation, setOrientation] = useState<HexOrientation>('flat');
  const [showCoordinates, setShowCoordinates] = useState<boolean>(true);
  const [mapWidth, setMapWidth] = useState<number>(50);
  const [mapHeight, setMapHeight] = useState<number>(25);
  
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

  const handleToggleVisibility = (id: string) => {
    setLayers(prev => prev.map(l => l.id === id ? { ...l, visible: !l.visible } : l));
  };

  const activeLayer = layers.find(l => l.id === activeLayerId) || layers[0];

  return (
    <div className={styles.appContainer}>
      <div className={styles.toolbar}>
        <div className={styles.toolbarTitle}>HexMapper Engine</div>
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
          />
        </div>
        <LayerPanel
          layers={layers}
          activeLayerId={activeLayerId}
          onSelectLayer={setActiveLayerId}
          onToggleVisibility={handleToggleVisibility}
        />
      </div>
    </div>
  );
};

export default App;
