import React from 'react';
import { Shape } from 'react-konva';
import { VectorLine } from '../../types';

export const PatternFilledShape: React.FC<{ line: VectorLine & { displayPoints: number[] }, assetsBasePath: string, currentStyle: string }> = React.memo(({ line, assetsBasePath, currentStyle }) => {
  const [image, setImage] = React.useState<HTMLImageElement | null>(null);
  React.useEffect(() => {
    if (!line.fillPatternUrl) return;
    const img = new window.Image();
    let src = line.fillPatternUrl;
    if (!src.startsWith('local://')) {
       src = `local://file?path=${encodeURIComponent(`${assetsBasePath}/styles/${currentStyle}/textures/${src}`)}`;
    }
    img.src = src;
    img.onload = () => setImage(img);
  }, [line.fillPatternUrl, assetsBasePath, currentStyle]);

  return (
    <Shape
      fill={!image ? (line.fill || '#3b82f6') : undefined}
      fillPatternImage={image || undefined}
      fillPatternRepeat="repeat"
      sceneFunc={(context, shape) => {
        context.beginPath();
        const pts = line.displayPoints;
        if (pts.length >= 4) {
          context.moveTo(pts[0], pts[1]);
          for (let i = 2; i < pts.length; i += 2) {
            context.lineTo(pts[i], pts[i+1]);
          }
          context.closePath();
        }
        if (line.holes) {
          for (const hole of line.holes) {
            if (hole.length >= 4) {
              context.moveTo(hole[0], hole[1]);
              for (let i = 2; i < hole.length; i += 2) {
                context.lineTo(hole[i], hole[i+1]);
              }
              context.closePath();
            }
          }
        }
        context.fillStrokeShape(shape);
      }}
      listening={false}
    />
  );
}, (prev, next) => 
  prev.line.id === next.line.id && 
  prev.line.displayPoints === next.line.displayPoints && 
  prev.line.fill === next.line.fill && 
  prev.line.fillPatternUrl === next.line.fillPatternUrl && 
  prev.assetsBasePath === next.assetsBasePath && 
  prev.currentStyle === next.currentStyle
);
