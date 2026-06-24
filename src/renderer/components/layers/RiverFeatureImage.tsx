import React from 'react';
import { Image as KonvaImage } from 'react-konva';
import { useMapStore } from '../../store/mapStore';
import { VectorFeature } from '../../types';

export const RiverFeatureImage: React.FC<{ feature: VectorFeature, x: number, y: number, rotation: number, opacity: number }> = React.memo(({ feature, x, y, rotation, opacity }) => {
  const [image, setImage] = React.useState<HTMLImageElement | null>(null);
  const assetsBasePath = useMapStore(state => state.assetsBasePath);
  const currentStyle = useMapStore(state => state.currentStyle);

  React.useEffect(() => {
    const img = new window.Image();
    let src = feature.brushUrl;
    if (src && !src.startsWith('local://') && assetsBasePath && currentStyle) {
      src = `local://file?path=${encodeURIComponent(`${assetsBasePath}/styles/${currentStyle}/tiles/${src}`)}`;
    }
    img.src = src;
    img.onload = () => setImage(img);
  }, [feature.brushUrl, assetsBasePath, currentStyle]);

  if (!image) return null;

  // Render at half the size of a standard hex tile
  return (
    <KonvaImage
      id={feature.id}
      image={image}
      x={x}
      y={y}
      scaleX={0.5}
      scaleY={0.5}
      offsetX={image.width / 2}
      offsetY={image.height / 2}
      rotation={rotation}
      opacity={opacity}
    />
  );
});
