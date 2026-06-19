import React from 'react';
import styles from '../index.module.css';
import { useMapStore } from '../store/mapStore';
import { useMapScanner } from '../hooks/useMapScanner';

const AlignmentSidebar: React.FC = () => {
  const {
    importType, setImportType,
    setImportDirPath,
    bgScaleX, setBgScaleX,
    bgScaleY, setBgScaleY,
    bgOffsetX, setBgOffsetX,
    bgOffsetY, setBgOffsetY,
    isScanning
  } = useMapStore();
  
  const { handleScanAlignedMap } = useMapScanner();

  if (!importType) return null;

  return (
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
  );
};

export default AlignmentSidebar;
