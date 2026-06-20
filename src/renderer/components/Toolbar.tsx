import React from 'react';
import styles from '../index.module.css';
import { HexOrientation } from '../types';
import { useMapStore } from '../store/mapStore';
import { useProjectStorage } from '../hooks/useProjectStorage';

interface ToolbarProps {
  engineRef: React.RefObject<any>;
}

const Toolbar: React.FC<ToolbarProps> = ({ engineRef }) => {
  const {
    mapWidth, setMapWidth,
    mapHeight, setMapHeight,
    unknowns,
    showUnknownsPanel, setShowUnknownsPanel,
    setShowImportModal,
    isScanning,
    stylesList,
    currentStyle, setCurrentStyle
  } = useMapStore();

  const { handleSaveProject, handleLoadProject, handleExportImage } = useProjectStorage(engineRef);

  return (
    <div className={styles.toolbar}>
        <div className={styles.toolbarTitle}>HexMapper Engine</div>
        <div className={styles.projectTools}>
          <button className={styles.projectButton} onClick={handleSaveProject} disabled={isScanning}>Save Project</button>
          <button className={styles.projectButton} onClick={handleLoadProject} disabled={isScanning}>Load Project</button>
          <button className={`${styles.projectButton} ${styles.export}`} onClick={handleExportImage} disabled={isScanning}>Export PNG</button>
          <button className={styles.projectButton} onClick={() => setShowImportModal(true)} disabled={isScanning} style={{background: '#f59e0b'}}>
            {isScanning ? 'Scanning...' : 'Extract Map'}
          </button>
          {unknowns.length > 0 && (
            <button className={styles.projectButton} onClick={() => setShowUnknownsPanel(!showUnknownsPanel)} style={{background: '#ef4444'}} title="Toggle Unknowns Panel">
              ⚠️ {unknowns.length} Unknowns
            </button>
          )}
          <button className={styles.projectButton} onClick={() => useMapStore.getState().setShowMapSettingsModal(true)} title="Map Settings" style={{marginLeft: '10px'}}>
            ⚙️ Settings
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
            Style:
            <select 
              className={styles.select} 
              value={currentStyle} 
              onChange={(e) => setCurrentStyle(e.target.value)}
            >
              {stylesList.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
        </div>
      </div>
  );
};

export default Toolbar;
