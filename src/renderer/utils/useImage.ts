import { useState, useEffect } from 'react';
import { useMapStore } from '../store/mapStore';

const globalImageCache: Record<string, HTMLImageElement> = {};
const globalImagePromises: Record<string, Promise<HTMLImageElement>> = {};

export default function useImage(url: string | null | undefined) {
  const [image, setImage] = useState<HTMLImageElement | null>(url ? (globalImageCache[url] || null) : null);

  useEffect(() => {
    if (!url) {
      setImage(null);
      return;
    }

    if (globalImageCache[url]) {
      setImage(globalImageCache[url]);
      return;
    }

    let isMounted = true;

    if (!globalImagePromises[url]) {
      globalImagePromises[url] = new Promise((resolve, reject) => {
        const img = new window.Image();
        img.src = url;
        img.crossOrigin = 'Anonymous';
        img.onload = () => {
          globalImageCache[url] = img;
          resolve(img);
        };
        img.onerror = reject;
      });
    }

    globalImagePromises[url].then(img => {
      if (isMounted) setImage(img);
    }).catch(e => {
      useMapStore.getState().setToastMessage({ type: 'error', text: 'Failed to load image: ' + url });
      if (isMounted) setImage(null);
    });

    return () => {
      isMounted = false;
    };
  }, [url]);

  return image;
}
