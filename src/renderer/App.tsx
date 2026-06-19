import React, { useRef, useEffect } from 'react';
import styles from './index.module.css';
import HexGridEngine, { HexGridEngineRef } from './components/HexGridEngine';
import TerrainPalette from './components/TerrainPalette';
import LayerPanel from './components/LayerPanel';
import UnknownsPanel from './components/UnknownsPanel';
import Toolbar from './components/Toolbar';
import ImportModal from './components/ImportModal';
import AlignmentSidebar from './components/AlignmentSidebar';
import { useMapStore } from './store/mapStore';

const App: React.FC = () => {
  const {
    orientation,
    mapWidth, setMapWidth,
    mapHeight, setMapHeight,
    unknowns, setUnknowns,
    showUnknownsPanel, setShowUnknownsPanel,
    setHighlightedHexKey,
    bgScaleX, bgScaleY, bgOffsetX, bgOffsetY,
    layers, setLayers,
    setStylesList,
    currentStyle,
    assetsBasePath, setAssetsBasePath,
    setRoadConfig,
    setRiverConfig
  } = useMapStore();

  const engineRef = useRef<HexGridEngineRef>(null);

  useEffect(() => {
    if (assetsBasePath && currentStyle) {
      const fetchRoadConfig = async () => {
        try {
          const configPath = `${assetsBasePath}/styles/${currentStyle}/roads.json`;
          const res = await fetch(`local://file?path=${encodeURIComponent(configPath)}`);
          if (res.ok) {
            const data = await res.json();
            setRoadConfig(data);
          } else {
            setRoadConfig(null);
          }
        } catch (e) {
          setRoadConfig(null);
        }
      };
      const fetchRiverConfig = async () => {
        try {
          const configPath = `${assetsBasePath}/styles/${currentStyle}/rivers.json`;
          const res = await fetch(`local://file?path=${encodeURIComponent(configPath)}`);
          if (res.ok) {
            const data = await res.json();
            setRiverConfig(data);
          } else {
            setRiverConfig(null);
          }
        } catch (e) {
          setRiverConfig(null);
        }
      };
      fetchRoadConfig();
      fetchRiverConfig();
    }
  }, [assetsBasePath, currentStyle, setRoadConfig, setRiverConfig]);

  useEffect(() => {
    if (window.api && window.api.getStyles) {
      window.api.getStyles().then(setStylesList);
      window.api.getAssetsBasePath().then(setAssetsBasePath);
    }
  }, [setStylesList, setAssetsBasePath]);

  // Determine the primary background image to use for auto-sizing the map
  const firstBgImagePath = layers.find(l => l.type === 'bg_image')?.data?.imagePath;
  const importType = useMapStore(s => s.importType);

  useEffect(() => {
    if (firstBgImagePath && importType !== null) {
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
  }, [firstBgImagePath, importType, bgScaleX, bgScaleY, bgOffsetX, bgOffsetY, orientation, setMapWidth, setMapHeight]);

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
      setLayers((prev: any) => prev.map((l: any) => {
        if (l.type === 'city') {
          return { ...l, data: { ...l.data, [unk.key]: `local://file?path=${encodeURIComponent(assetsBasePath + '/tiles/' + payload.tile)}` } };
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
          setLayers((prev: any) => prev.map((l: any) => {
            if (l.type === 'city') {
              return { ...l, data: { ...l.data, [unk.key]: `local://file?path=${encodeURIComponent(assetsBasePath + '/tiles/Cities/' + payload.name)}` } };
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

    setUnknowns((prev: any) => prev.filter((u: any) => u.id !== unknownId));
  };

  return (
    <div className={styles.appContainer}>
      <Toolbar engineRef={engineRef} />
      
      <div className={styles.workspace}>
        <TerrainPalette />
        <div className={styles.canvasContainer}>
          <HexGridEngine ref={engineRef} />
        </div>
        <div className={styles.rightPanel}>
          <LayerPanel />
          {unknowns.length > 0 && showUnknownsPanel && (
            <UnknownsPanel 
              unknowns={unknowns} 
              onResolve={handleResolveUnknown} 
              onHover={setHighlightedHexKey} 
              onClose={() => setShowUnknownsPanel(false)}
            />
          )}
        </div>
        <AlignmentSidebar />
      </div>

      <ImportModal />
    </div>
  );
};

export default App;
