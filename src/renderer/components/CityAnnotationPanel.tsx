import React, { useState, useEffect } from 'react';
import styles from './CityAnnotationPanel.module.css';

interface CityAnnotationPanelProps {
  layerId: string;
  hexKey: string;
  name?: string;
  notes?: string;
  onUpdate: (layerId: string, hexKey: string, annotation: { name?: string, notes?: string }) => void;
  onClose: () => void;
}

const CityAnnotationPanel: React.FC<CityAnnotationPanelProps> = ({ layerId, hexKey, name, notes, onUpdate, onClose }) => {
  const [currentName, setCurrentName] = useState(name || '');
  const [currentNotes, setCurrentNotes] = useState(notes || '');

  useEffect(() => {
    setCurrentName(name || '');
    setCurrentNotes(notes || '');
  }, [name, notes, hexKey]);

  const handleSave = () => {
    onUpdate(layerId, hexKey, { name: currentName, notes: currentNotes });
  };

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <h3>City Annotations</h3>
        <button onClick={onClose} className={styles.closeBtn}>&times;</button>
      </div>
      <div className={styles.content}>
        <div className={styles.field}>
          <label>Name</label>
          <input 
            type="text" 
            value={currentName} 
            onChange={(e) => setCurrentName(e.target.value)} 
            placeholder="City Name"
          />
        </div>
        <div className={styles.field}>
          <label>Notes</label>
          <textarea 
            value={currentNotes} 
            onChange={(e) => setCurrentNotes(e.target.value)} 
            placeholder="Population, lore, etc."
            rows={4}
          />
        </div>
        <button className={styles.saveBtn} onClick={handleSave}>Save</button>
      </div>
    </div>
  );
};

export default CityAnnotationPanel;
