import React, { useEffect, useState } from 'react';
import styles from '../index.module.css';
import { useMapStore } from '../store/mapStore';

const MapSettingsModal: React.FC = () => {
  const { mapVariables, setMapVariables, setShowMapSettingsModal, showMapSettingsModal, bgScaleX: storeBgScaleX, bgScaleY: storeBgScaleY, bgOffsetX: storeBgOffsetX, bgOffsetY: storeBgOffsetY, setBgScaleX, setBgScaleY, setBgOffsetX, setBgOffsetY } = useMapStore();
  
  const [hexSize, setHexSize] = useState(mapVariables.hexSize?.toString() || '1');
  const [hexUnit, setHexUnit] = useState(mapVariables.hexUnit || 'miles');
  const [fontName, setFontName] = useState(mapVariables.fontName || 'Arial');
  const [secondaryFontName, setSecondaryFontName] = useState(mapVariables.secondaryFontName || 'Arial');
  const [systemFonts, setSystemFonts] = useState<string[]>([]);

  const [bgScaleXInput, setBgScaleXInput] = useState(storeBgScaleX.toString());
  const [bgScaleYInput, setBgScaleYInput] = useState(storeBgScaleY.toString());
  const [bgOffsetXInput, setBgOffsetXInput] = useState(storeBgOffsetX.toString());
  const [bgOffsetYInput, setBgOffsetYInput] = useState(storeBgOffsetY.toString());

  const [mapTitle, setMapTitle] = useState(mapVariables.mapTitle || '');
  const [mapSubtitle, setMapSubtitle] = useState(mapVariables.mapSubtitle || '');
  const [mapAuthor, setMapAuthor] = useState(mapVariables.mapAuthor || '');
  const [compassRoseAsset, setCompassRoseAsset] = useState(mapVariables.compassRoseAsset || '');

  useEffect(() => {
    if (showMapSettingsModal) {
      setHexSize(mapVariables.hexSize.toString());
      setHexUnit(mapVariables.hexUnit || 'miles');
      setFontName(mapVariables.fontName || 'Arial');
      setSecondaryFontName(mapVariables.secondaryFontName || 'Arial');
      setBgScaleXInput(storeBgScaleX.toString());
      setBgScaleYInput(storeBgScaleY.toString());
      setBgOffsetXInput(storeBgOffsetX.toString());
      setBgOffsetYInput(storeBgOffsetY.toString());
      setMapTitle(mapVariables.mapTitle || '');
      setMapSubtitle(mapVariables.mapSubtitle || '');
      setMapAuthor(mapVariables.mapAuthor || '');
      setCompassRoseAsset(mapVariables.compassRoseAsset || '');
    }
  }, [showMapSettingsModal, mapVariables, storeBgScaleX, storeBgScaleY, storeBgOffsetX, storeBgOffsetY]);

  useEffect(() => {
    if (!showMapSettingsModal || systemFonts.length > 0) return;
    
    // Load system fonts via IPC
    const loadFonts = async () => {
      try {
        const res = await window.api.getSystemFonts();
        const fonts = res?.success && res.data ? res.data : ['Arial', 'Times New Roman', 'Courier New'];
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
    const bsX = parseFloat(bgScaleXInput);
    const bsY = parseFloat(bgScaleYInput);
    const boX = parseFloat(bgOffsetXInput);
    const boY = parseFloat(bgOffsetYInput);
    
    if (!isNaN(bsX) && bsX > 0) setBgScaleX(bsX);
    if (!isNaN(bsY) && bsY > 0) setBgScaleY(bsY);
    if (!isNaN(boX)) setBgOffsetX(boX);
    if (!isNaN(boY)) setBgOffsetY(boY);
    
    setMapVariables({ fontName, secondaryFontName, hexSize: size, hexUnit, mapTitle, mapSubtitle, mapAuthor, compassRoseAsset });
    setShowMapSettingsModal(false);
  };

  if (!showMapSettingsModal) return null;

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent} style={{ maxWidth: '400px', maxHeight: '80vh', overflowY: 'auto' }}>
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
          <label style={{ display: 'block', marginBottom: '5px', color: '#ccc' }}>Secondary Font (Fallback)</label>
          <select 
            value={secondaryFontName} 
            onChange={e => setSecondaryFontName(e.target.value)}
            style={{ width: '100%', padding: '8px', background: '#333', color: 'white', border: '1px solid #555', borderRadius: '4px', marginBottom: '8px' }}
          >
            {systemFonts.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', color: '#ccc' }}>Map Title</label>
          <input 
            type="text" 
            value={mapTitle} 
            onChange={e => setMapTitle(e.target.value)}
            style={{ width: '100%', padding: '8px', background: '#333', color: 'white', border: '1px solid #555', borderRadius: '4px' }}
          />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', color: '#ccc' }}>Map Subtitle</label>
          <input 
            type="text" 
            value={mapSubtitle} 
            onChange={e => setMapSubtitle(e.target.value)}
            style={{ width: '100%', padding: '8px', background: '#333', color: 'white', border: '1px solid #555', borderRadius: '4px' }}
          />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', color: '#ccc' }}>Author</label>
          <input 
            type="text" 
            value={mapAuthor} 
            onChange={e => setMapAuthor(e.target.value)}
            style={{ width: '100%', padding: '8px', background: '#333', color: 'white', border: '1px solid #555', borderRadius: '4px' }}
          />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', color: '#ccc' }}>Compass Rose Asset</label>
          <div style={{ display: 'flex', gap: '5px' }}>
            <input 
              type="text" 
              value={compassRoseAsset} 
              readOnly
              style={{ flex: 1, padding: '8px', background: '#333', color: '#aaa', border: '1px solid #555', borderRadius: '4px' }}
            />
            <button 
              onClick={async () => {
                const res = await window.api.openImage();
                if (res.success && res.data) {
                  setCompassRoseAsset(`local://file?path=${encodeURIComponent(res.data.replace(/\\/g, '/'))}`);
                }
              }}
              style={{ padding: '8px 12px', background: '#555', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              Browse
            </button>
            <button 
              onClick={() => setCompassRoseAsset('')}
              style={{ padding: '8px 12px', background: '#d32f2f', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              Clear
            </button>
          </div>
        </div>

        {mapVariables.dateLastSaved && (
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', color: '#ccc' }}>Date Last Saved</label>
            <div style={{ color: '#888' }}>{mapVariables.dateLastSaved}</div>
          </div>
        )}

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

        <div style={{ marginBottom: '15px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', color: '#ccc' }}>Bg Scale X</label>
            <input 
              type="number" 
              value={bgScaleXInput} 
              onChange={e => setBgScaleXInput(e.target.value)}
              step="0.01"
              style={{ width: '100%', padding: '8px', background: '#333', color: 'white', border: '1px solid #555', borderRadius: '4px' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', color: '#ccc' }}>Bg Scale Y</label>
            <input 
              type="number" 
              value={bgScaleYInput} 
              onChange={e => setBgScaleYInput(e.target.value)}
              step="0.01"
              style={{ width: '100%', padding: '8px', background: '#333', color: 'white', border: '1px solid #555', borderRadius: '4px' }}
            />
          </div>
        </div>

        <div style={{ marginBottom: '25px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', color: '#ccc' }}>Bg Offset X</label>
            <input 
              type="number" 
              value={bgOffsetXInput} 
              onChange={e => setBgOffsetXInput(e.target.value)}
              step="1"
              style={{ width: '100%', padding: '8px', background: '#333', color: 'white', border: '1px solid #555', borderRadius: '4px' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', color: '#ccc' }}>Bg Offset Y</label>
            <input 
              type="number" 
              value={bgOffsetYInput} 
              onChange={e => setBgOffsetYInput(e.target.value)}
              step="1"
              style={{ width: '100%', padding: '8px', background: '#333', color: 'white', border: '1px solid #555', borderRadius: '4px' }}
            />
          </div>
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
