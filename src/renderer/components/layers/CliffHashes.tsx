import React from 'react';
import { Shape } from 'react-konva';
import { getCurvePoints } from '../../utils/vectorMath';

interface CliffHashesProps {
  points: number[];
  invert: boolean;
  color: string;
  width: number;
  id: string;
  opacity?: number;
}

export const CliffHashes: React.FC<CliffHashesProps> = React.memo(({ points, invert, color, width, id, opacity = 1 }) => {
  if (!points || points.length < 4) return null;
  
  return (
    <Shape
      stroke={color}
      strokeWidth={Math.max(1, width / 2)}
      lineCap="round"
      opacity={opacity}
      listening={false}
      sceneFunc={(context, shape) => {
        const curvePoints = getCurvePoints(points, 0.5, 10);
        const hashLength = width * 3; 
        const hashSpacing = Math.max(8, width * 1.5); 
        
        let totalLength = 0;
        const cumulativeLengths = [0];
        for (let i = 0; i < curvePoints.length - 2; i += 2) {
          const dx = curvePoints[i+2] - curvePoints[i];
          const dy = curvePoints[i+3] - curvePoints[i+1];
          totalLength += Math.sqrt(dx*dx + dy*dy);
          cumulativeLengths.push(totalLength);
        }

        let distSinceLastHash = 0;
        context.beginPath();
        
        for (let i = 0; i < curvePoints.length - 2; i += 2) {
          const x1 = curvePoints[i];
          const y1 = curvePoints[i+1];
          const x2 = curvePoints[i+2];
          const y2 = curvePoints[i+3];
          
          const dx = x2 - x1;
          const dy = y2 - y1;
          const dist = Math.sqrt(dx*dx + dy*dy);
          if (dist === 0) continue;
          
          const nx = -dy / dist;
          const ny = dx / dist;
          const dirX = invert ? -nx : nx;
          const dirY = invert ? -ny : ny;

          let t = (hashSpacing - distSinceLastHash) / dist;
          while (t <= 1) {
            const hx = x1 + dx * t;
            const hy = y1 + dy * t;
            
            const distFromStart = cumulativeLengths[i/2] + t * dist;
            const distFromEnd = totalLength - distFromStart;
            
            let scale = 1;
            const taperDist = 40; 
            
            if (distFromStart < taperDist) {
               scale = distFromStart / taperDist;
            } else if (distFromEnd < taperDist) {
               scale = distFromEnd / taperDist;
            }
            
            const currentHashLength = hashLength * scale;
            
            if (currentHashLength > 0.5) {
              context.moveTo(hx, hy);
              context.lineTo(hx + dirX * currentHashLength, hy + dirY * currentHashLength);
            }
            t += hashSpacing / dist;
          }
          
          distSinceLastHash = dist - (t - hashSpacing / dist) * dist;
        }
        
        context.fillStrokeShape(shape);
      }}
    />
  );
});
