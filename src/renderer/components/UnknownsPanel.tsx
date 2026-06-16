import React, { useState } from 'react';
import styles from '../index.module.css';

interface UnknownsPanelProps {
  unknowns: any[];
  onResolve: (unknownId: string, action: 'ignore' | 'map' | 'save', payload?: any) => void;
  onHover: (hexKey: string | null) => void;
}

export default function UnknownsPanel({ unknowns, onResolve, onHover }: UnknownsPanelProps) {
  const [selectedUnknown, setSelectedUnknown] = useState<any>(null);

  if (unknowns.length === 0) return null;

  return (
    <div style={{
      position: 'absolute', top: 50, right: 260, width: 300, bottom: 0,
      backgroundColor: '#1e293b', borderLeft: '1px solid #334155', color: '#f8fafc',
      display: 'flex', flexDirection: 'column', zIndex: 100, overflowY: 'auto'
    }}>
      <div style={{ padding: '15px', borderBottom: '1px solid #334155', backgroundColor: '#0f172a' }}>
        <h3 style={{ margin: 0, fontSize: '16px', color: '#fbbf24' }}>⚠️ Unknown Symbols Detected</h3>
        <p style={{ margin: '5px 0 0 0', fontSize: '12px', color: '#94a3b8' }}>
          We found {unknowns.length} structures we couldn't recognize.
        </p>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', padding: '15px' }}>
        {unknowns.map((unk) => (
          <div 
            key={unk.id}
            onMouseEnter={() => onHover(unk.key)}
            onMouseLeave={() => onHover(null)}
            onClick={() => setSelectedUnknown(unk)}
            style={{
              width: '80px', height: '80px', border: selectedUnknown?.id === unk.id ? '2px solid #3b82f6' : '1px solid #334155',
              borderRadius: '8px', overflow: 'hidden', cursor: 'pointer', backgroundColor: '#0f172a'
            }}
          >
            <img src={unk.image} alt="unknown" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        ))}
      </div>

      {selectedUnknown && (
        <div style={{ padding: '15px', borderTop: '1px solid #334155', marginTop: 'auto', backgroundColor: '#0f172a' }}>
          <h4 style={{ margin: '0 0 10px 0' }}>Resolve Symbol</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button 
              onClick={() => {
                onResolve(selectedUnknown.id, 'ignore');
                setSelectedUnknown(null);
              }}
              style={{ padding: '8px', backgroundColor: '#334155', border: 'none', color: 'white', borderRadius: '4px', cursor: 'pointer' }}
            >
              Ignore (Leave Blank)
            </button>
            <button 
              onClick={() => {
                // Here we'd map it. For now, we'll prompt for a brush ID (later a real UI picker)
                const brushId = prompt("Enter existing Brush ID (e.g., hex_022.png):");
                if (brushId) {
                  onResolve(selectedUnknown.id, 'map', { tile: `Cities/${brushId}` });
                  setSelectedUnknown(null);
                }
              }}
              style={{ padding: '8px', backgroundColor: '#3b82f6', border: 'none', color: 'white', borderRadius: '4px', cursor: 'pointer' }}
            >
              Map to Existing City
            </button>
            <button 
              onClick={() => {
                const name = prompt("Enter a name to save this new Brush (e.g., my_castle.png):");
                if (name) {
                  onResolve(selectedUnknown.id, 'save', { name });
                  setSelectedUnknown(null);
                }
              }}
              style={{ padding: '8px', backgroundColor: '#10b981', border: 'none', color: 'white', borderRadius: '4px', cursor: 'pointer' }}
            >
              Save as New City Brush
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
