import React from 'react';
import { Line } from 'react-konva';
import Konva from 'konva';

export const getRelativePointerPosition = (stage: Konva.Stage) => {
  const pointer = stage.getPointerPosition();
  const currentScale = stage.scaleX();
  return {
    x: (pointer!.x - stage.x()) / currentScale,
    y: (pointer!.y - stage.y()) / currentScale,
  };
};

export function getCurvePoints(pts: number[], tension: number = 0.5, numOfSegments: number = 10): number[] {
  if (pts.length < 4 || tension === 0) return pts;

  const res: number[] = [];
  const p = [...pts];
  p.unshift(pts[1]);
  p.unshift(pts[0]);
  p.push(pts[pts.length - 2]);
  p.push(pts[pts.length - 1]);

  for (let i = 2; i < p.length - 2; i += 2) {
    const p0x = p[i - 2];
    const p0y = p[i - 1];
    const p1x = p[i];
    const p1y = p[i + 1];
    const p2x = p[i + 2];
    const p2y = p[i + 3];
    const p3x = p[i + 4] ?? p2x;
    const p3y = p[i + 5] ?? p2y;

    const t1x = (p2x - p0x) * tension;
    const t1y = (p2y - p0y) * tension;
    const t2x = (p3x - p1x) * tension;
    const t2y = (p3y - p1y) * tension;

    for (let t = 0; t <= numOfSegments; t++) {
      const st = t / numOfSegments;
      const st2 = st * st;
      const st3 = st2 * st;

      const c1 = 2 * st3 - 3 * st2 + 1;
      const c2 = -(2 * st3) + 3 * st2;
      const c3 = st3 - 2 * st2 + st;
      const c4 = st3 - st2;

      const x = c1 * p1x + c2 * p2x + c3 * t1x + c4 * t2x;
      const y = c1 * p1y + c2 * p2y + c3 * t1y + c4 * t2y;
      
      if (t === 0 && res.length > 0) continue;
      res.push(x, y);
    }
  }

  return res;
}

export const generateCliffHashes = (points: number[], invert: boolean | undefined, color: string, width: number, id: string, opacity: number = 1) => {
  if (!points || points.length < 4) return null;
  const curvePoints = getCurvePoints(points, 0.5, 10);
  
  const hashes = [];
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
      const taperDist = 40; // Approx one hex size
      
      if (distFromStart < taperDist) {
         scale = distFromStart / taperDist;
      } else if (distFromEnd < taperDist) {
         scale = distFromEnd / taperDist;
      }
      
      const currentHashLength = hashLength * scale;
      
      if (currentHashLength > 0.5) {
        hashes.push(
          <Line 
            key={`hash-${id}-${i}-${t}`}
            points={[hx, hy, hx + dirX * currentHashLength, hy + dirY * currentHashLength]}
            stroke={color}
            strokeWidth={Math.max(1, width / 2)}
            lineCap="round"
            opacity={opacity}
          />
        );
      }
      t += hashSpacing / dist;
    }
    
    distSinceLastHash = dist - (t - hashSpacing / dist) * dist;
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
