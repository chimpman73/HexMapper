import { useState, useEffect } from 'react';

export default function useImage(url: string | null | undefined) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!url) {
      setImage(null);
      return;
    }
    const img = new window.Image();
    img.src = url;
    img.crossOrigin = 'Anonymous';
    img.onload = () => setImage(img);
  }, [url]);

  return image;
}
