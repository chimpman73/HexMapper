import React from 'react';
import { Line } from 'react-konva';

export const generateCliffHashes = (points: number[], invert: boolean | undefined, color: string, width: number, id: string, opacity: number = 1) => {
  const hashes = [];
  const hashLength = width * 3; 
  const hashSpacing = Math.max(10, width * 2); 
  let distSinceLastHash = 0;
  
  for (let i = 0; i < points.length - 2; i += 2) {
    const x1 = points[i];
    const y1 = points[i+1];
    const x2 = points[i+2];
    const y2 = points[i+3];
    
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if (dist === 0) continue;
    
    distSinceLastHash += dist;
    
    if (distSinceLastHash >= hashSpacing) {
      const nx = -dy / dist;
      const ny = dx / dist;
      
      const dirX = invert ? -nx : nx;
      const dirY = invert ? -ny : ny;
      
      hashes.push(
        <Line 
          key={`hash-${id}-${i}`}
          points={[x1, y1, x1 + dirX * hashLength, y1 + dirY * hashLength]}
          stroke={color}
          strokeWidth={Math.max(1, width / 2)}
          lineCap="round"
          opacity={opacity}
        />
      );
      distSinceLastHash = 0;
    }
  }
  return hashes;
};

export function distToSegment(p: {x: number, y: number}, v: {x: number, y: number}, w: {x: number, y: number}) {
  const l2 = (v.x - w.x) ** 2 + (v.y - w.y) ** 2;
  if (l2 === 0) return Math.sqrt((p.x - v.x) ** 2 + (p.y - v.y) ** 2);
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.sqrt((p.x - (v.x + t * (w.x - v.x))) ** 2 + (p.y - (v.y + t * (w.y - v.y))) ** 2);
}
