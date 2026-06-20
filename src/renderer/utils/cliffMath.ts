import { HexCube, HexOrientation, Point } from '../types';
import { hexToPixel, getHexCorners, pixelToHex, isHexEqual } from './hexMath';
import { getCurvePoints } from './vectorMath';

export function getLineSegmentsIntersection(
  p1: Point, p2: Point, 
  p3: Point, p4: Point
): Point | null {
  const denom = (p4.y - p3.y) * (p2.x - p1.x) - (p4.x - p3.x) * (p2.y - p1.y);
  if (denom === 0) return null;
  
  const ua = ((p4.x - p3.x) * (p1.y - p3.y) - (p4.y - p3.y) * (p1.x - p3.x)) / denom;
  const ub = ((p2.x - p1.x) * (p1.y - p3.y) - (p2.y - p1.y) * (p1.x - p3.x)) / denom;
  
  if (ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1) {
    return {
      x: p1.x + ua * (p2.x - p1.x),
      y: p1.y + ua * (p2.y - p1.y)
    };
  }
  return null;
}

export function isHexIntersectedByLine(hex: HexCube, orientation: HexOrientation, linePoints: number[]): boolean {
  const center = hexToPixel(hex, orientation);
  const cornersRaw = getHexCorners(center, orientation);
  const corners: Point[] = [];
  for (let i = 0; i < 6; i++) {
    corners.push({ x: cornersRaw[i * 2], y: cornersRaw[i * 2 + 1] });
  }
  
  for (let i = 0; i < linePoints.length - 2; i += 2) {
    const lp1 = { x: linePoints[i], y: linePoints[i + 1] };
    const lp2 = { x: linePoints[i + 2], y: linePoints[i + 3] };
    
    // Check if points are inside
    if (isHexEqual(pixelToHex(lp1, orientation), hex) || isHexEqual(pixelToHex(lp2, orientation), hex)) {
      return true;
    }
    
    // Check intersection with any hex edge
    for (let j = 0; j < 6; j++) {
      const hp1 = corners[j];
      const hp2 = corners[(j + 1) % 6];

      const dist1 = Math.sqrt((lp1.x - hp1.x)**2 + (lp1.y - hp1.y)**2);
      const dist2 = Math.sqrt((lp2.x - hp2.x)**2 + (lp2.y - hp2.y)**2);
      const dist3 = Math.sqrt((lp1.x - hp2.x)**2 + (lp1.y - hp2.y)**2);
      const dist4 = Math.sqrt((lp2.x - hp1.x)**2 + (lp2.y - hp1.y)**2);
      
      if ((dist1 < 1 && dist2 < 1) || (dist3 < 1 && dist4 < 1)) {
         return true;
      }

      if (getLineSegmentsIntersection(lp1, lp2, hp1, hp2)) {
        return true;
      }
    }
  }
  
  return false;
}

// returns polygon points [x1, y1, x2, y2, ...] representing the downslope side using the actual cliff line
export function getDownslopePolygon(hex: HexCube, orientation: HexOrientation, linePoints: number[], invert: boolean = false): number[] | null {
  if (!isHexIntersectedByLine(hex, orientation, linePoints)) {
    return null;
  }
  
  const center = hexToPixel(hex, orientation);
  const MAX_DIST = 160; 
  
  const curvePoints = getCurvePoints(linePoints, 0.5, 10);
  
  let firstIdx = -1;
  let lastIdx = -1;
  
  // Find the segment of the line that is close to the hex
  for (let i = 0; i < curvePoints.length; i += 2) {
    const px = curvePoints[i];
    const py = curvePoints[i+1];
    const dist = Math.sqrt((px - center.x)**2 + (py - center.y)**2);
    if (dist < MAX_DIST) {
      if (firstIdx === -1) firstIdx = i;
      lastIdx = i;
    }
  }
  
  if (firstIdx === -1) return null;
  
  // Pad the indices to ensure the polygon fully crosses the hex boundaries
  firstIdx = Math.max(0, firstIdx - 8);
  lastIdx = Math.min(curvePoints.length - 2, lastIdx + 8);
  
  const points: Point[] = [];
  for (let i = firstIdx; i <= lastIdx; i += 2) {
    points.push({ x: curvePoints[i], y: curvePoints[i+1] });
  }
  
  // Calculate segment normals
  const normals: Point[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i+1];
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if (dist === 0) {
      normals.push({x: 0, y: 0});
      continue;
    }
    const nx = -dy / dist;
    const ny = dx / dist;
    normals.push({ x: invert ? -nx : nx, y: invert ? -ny : ny });
  }
  
  if (normals.length === 0) return null;

  // Average normals to get vertex normals for a smooth offset
  const vNormals: Point[] = [];
  for (let i = 0; i < points.length; i++) {
    if (i === 0) {
      vNormals.push(normals[0]);
    } else if (i === points.length - 1) {
      vNormals.push(normals[normals.length - 1]);
    } else {
      const n1 = normals[i-1];
      const n2 = normals[i];
      let nx = n1.x + n2.x;
      let ny = n1.y + n2.y;
      const len = Math.sqrt(nx*nx + ny*ny);
      if (len > 0.0001) {
        nx /= len;
        ny /= len;
      } else {
        nx = n1.x;
        ny = n1.y;
      }
      vNormals.push({x: nx, y: ny});
    }
  }
  
  // Extend the polygon far in the downslope direction
  const D = 160;
  const offsetPoints: Point[] = [];
  for (let i = points.length - 1; i >= 0; i--) {
    offsetPoints.push({
      x: points[i].x + vNormals[i].x * D,
      y: points[i].y + vNormals[i].y * D
    });
  }
  
  const poly: number[] = [];
  // Trace the cliff line
  for (const p of points) {
    poly.push(p.x, p.y);
  }
  // Trace back along the extended offset boundary
  for (const p of offsetPoints) {
    poly.push(p.x, p.y);
  }
  
  return poly;
}
