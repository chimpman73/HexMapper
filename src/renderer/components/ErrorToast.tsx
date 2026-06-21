import React, { useEffect } from 'react';
import styles from './ErrorToast.module.css';
import { useMapStore } from '../store/mapStore';

const ErrorToast: React.FC = () => {
  const { lastError, clearError } = useMapStore();

  useEffect(() => {
    if (lastError) {
      const timer = setTimeout(() => {
        clearError();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [lastError, clearError]);

  if (!lastError) return null;

  return (
    <div className={styles.toastContainer}>
      <div className={styles.toastContent}>
        <span className={styles.icon}>⚠️</span>
        <span className={styles.message}>{lastError}</span>
        <button className={styles.closeBtn} onClick={clearError}>×</button>
      </div>
    </div>
  );
};

export default ErrorToast;
