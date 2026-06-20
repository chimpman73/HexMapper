import React, { useState, useEffect } from 'react';
import { Image as KonvaImage } from 'react-konva';

import { useMapStore } from '../store/mapStore';

interface BrushCursorOverlayProps {
  url: string;
  x: number;
  y: number;
}

const BrushCursorOverlay: React.FC<BrushCursorOverlayProps> = ({ url, x, y }) => {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const { assetsBasePath, currentStyle } = useMapStore();

  useEffect(() => {
    const img = new window.Image();
    let src = url;
    if (src && !src.startsWith('local://') && assetsBasePath && currentStyle) {
      src = `local://file?path=${encodeURIComponent(`${assetsBasePath}/styles/${currentStyle}/tiles/${src}`)}`;
    }
    img.src = src;
    img.onload = () => setImage(img);
  }, [url, assetsBasePath, currentStyle]);

  if (!image) return null;

  return (
    <KonvaImage
      image={image}
      x={x}
      y={y}
      scaleX={0.75}
      scaleY={0.75}
      offsetX={image.width / 2}
      offsetY={image.height / 2}
      listening={false}
      opacity={0.8}
    />
  );
};

export default BrushCursorOverlay;
