import React, { useEffect } from 'react';
import styles from './GlobalToast.module.css';
import { useMapStore } from '../store/mapStore';

const GlobalToast: React.FC = () => {
  const { toastMessage, clearToast } = useMapStore();

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => {
        clearToast();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage, clearToast]);

  if (!toastMessage) return null;

  const icon = toastMessage.type === 'error' ? '⚠️' : toastMessage.type === 'success' ? '✅' : 'ℹ️';

  return (
    <div className={`${styles.toastContainer} ${styles[toastMessage.type]}`}>
      <div className={styles.toastContent}>
        <span className={styles.icon}>{icon}</span>
        <span className={styles.message}>{toastMessage.text}</span>
        <button className={styles.closeBtn} onClick={clearToast}>×</button>
      </div>
    </div>
  );
};

export default GlobalToast;
