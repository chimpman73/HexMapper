import React, { useEffect, useState } from 'react';
import styles from '../index.module.css';
import { useMapStore } from '../store/mapStore';

const MapSettingsModal: React.FC = () => {
  const { mapVariables, setMapVariables, setShowMapSettingsModal, showMapSettingsModal } = useMapStore();
  
  const [fontName, setFontName] = useState(mapVariables.fontName);
  const [hexSize, setHexSize] = useState(mapVariables.hexSize.toString());
  const [hexUnit, setHexUnit] = useState(mapVariables.hexUnit);
  const [systemFonts, setSystemFonts] = useState<string[]>([]);

  useEffect(() => {
    if (showMapSettingsModal) {
      setFontName(mapVariables.fontName);
      setHexSize(mapVariables.hexSize.toString());
      setHexUnit(mapVariables.hexUnit);
    }
  }, [showMapSettingsModal, mapVariables]);

  useEffect(() => {
    if (!showMapSettingsModal || systemFonts.length > 0) return;
    
    // Load system fonts via IPC
    const loadFonts = async () => {
      try {
        const fonts = await window.api.getSystemFonts();
        setSystemFonts(fonts);
        // Fallback check against the actual store value
        const currentFont = useMapStore.getState().mapVariables.fontName;
        if (!fonts.includes(currentFont)) {
          const fallback = fonts.includes('Arial') ? 'Arial' : fonts[0];
          if (fallback) {
            setFontName(fallback);
          }
        }
      } catch (err) {
        console.error('Failed to load system fonts:', err);
        setSystemFonts(['Arial', 'Times New Roman', 'Courier New']);
      }
    };
    loadFonts();
  }, [showMapSettingsModal]);

  const handleSave = () => {
    const size = parseFloat(hexSize);
    if (isNaN(size) || size <= 0) {
      alert("Please enter a valid positive number for Hex Size.");
      return;
    }
    setMapVariables({ fontName, hexSize: size, hexUnit });
    setShowMapSettingsModal(false);
  };

  if (!showMapSettingsModal) return null;

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent} style={{ maxWidth: '400px' }}>
        <h2 className={styles.modalTitle}>Map Settings</h2>
        
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', color: '#ccc' }}>Map Font</label>
          <select 
            value={fontName} 
            onChange={e => setFontName(e.target.value)}
            style={{ width: '100%', padding: '8px', background: '#333', color: 'white', border: '1px solid #555', borderRadius: '4px' }}
          >
            {systemFonts.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', color: '#ccc' }}>Hex Size</label>
          <input 
            type="number" 
            value={hexSize} 
            onChange={e => setHexSize(e.target.value)}
            min="0.1"
            step="0.1"
            style={{ width: '100%', padding: '8px', background: '#333', color: 'white', border: '1px solid #555', borderRadius: '4px' }}
          />
        </div>

        <div style={{ marginBottom: '25px' }}>
          <label style={{ display: 'block', marginBottom: '5px', color: '#ccc' }}>Hex Unit</label>
          <select 
            value={hexUnit} 
            onChange={e => setHexUnit(e.target.value)}
            style={{ width: '100%', padding: '8px', background: '#333', color: 'white', border: '1px solid #555', borderRadius: '4px' }}
          >
            <option value="miles">Miles</option>
            <option value="km">Kilometers</option>
            <option value="leagues">Leagues</option>
            <option value="feet">Feet</option>
            <option value="meters">Meters</option>
          </select>
        </div>

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button 
            onClick={() => setShowMapSettingsModal(false)}
            style={{ padding: '8px 16px', background: '#444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            style={{ padding: '8px 16px', background: '#7cb342', color: 'black', fontWeight: 'bold', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
};

export default MapSettingsModal;
