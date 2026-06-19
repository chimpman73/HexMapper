import React from 'react';
import styles from '../index.module.css';
import { useMapStore } from '../store/mapStore';
import { useMapScanner } from '../hooks/useMapScanner';

const ImportModal: React.FC = () => {
  const showImportModal = useMapStore(s => s.showImportModal);
  const setShowImportModal = useMapStore(s => s.setShowImportModal);
  
  const { handleImportImageSelect, handleImportDirectorySelect } = useMapScanner();

  if (!showImportModal) return null;

  return (
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
  );
};

export default ImportModal;
