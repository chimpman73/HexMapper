import React, { useState } from 'react';
import { Group, Image as KonvaImage } from 'react-konva';

interface BgImageRendererProps {
  layer: any;
  bgScaleX: number;
  bgScaleY: number;
  bgOffsetX: number;
  bgOffsetY: number;
}

const BgImageRenderer: React.FC<BgImageRendererProps> = ({ layer, bgScaleX, bgScaleY, bgOffsetX, bgOffsetY }) => {
  const [imageObj, setImageObj] = useState<HTMLImageElement | null>(null);
  
  React.useEffect(() => {
    if (layer.data?.imagePath) {
      const img = new window.Image();
      img.onload = () => setImageObj(img);
      img.src = `local://file?path=${encodeURIComponent(layer.data.imagePath)}`;
    }
  }, [layer.data?.imagePath]);

  if (!imageObj) return null;

  return (
    <Group x={bgOffsetX} y={bgOffsetY} scaleX={bgScaleX} scaleY={bgScaleY} opacity={layer.opacity}>
      <KonvaImage image={imageObj} />
    </Group>
  );
};

export default BgImageRenderer;
