import { HexCube, Point, HexOrientation } from '../types';

export const HEX_SIZE = 40; // distance from center to corner

// Convert cube coordinates to pixel coordinates
export function hexToPixel(hex: HexCube, orientation: HexOrientation, size: number = HEX_SIZE): Point {
  const { q, r } = hex;
  let x = 0;
  let y = 0;

  if (orientation === 'flat') {
    x = size * (3.0 / 2.0 * q);
    y = size * (Math.sqrt(3.0) / 2.0 * q + Math.sqrt(3.0) * r);
  } else {
    // pointy
    x = size * (Math.sqrt(3.0) * q + Math.sqrt(3.0) / 2.0 * r);
    y = size * (3.0 / 2.0 * r);
  }

  return { x, y };
}

// Generate the 6 corners of a hex at a given center point
export function getHexCorners(center: Point, orientation: HexOrientation, size: number = HEX_SIZE): number[] {
  const points: number[] = [];
  const startAngle = orientation === 'flat' ? 0 : 30;

  for (let i = 0; i < 6; i++) {
    const angle_deg = 60 * i + startAngle;
    const angle_rad = (Math.PI / 180) * angle_deg;
    points.push(center.x + size * Math.cos(angle_rad));
    points.push(center.y + size * Math.sin(angle_rad));
  }

  return points;
}

export function pixelToHex(p: Point, orientation: HexOrientation, size: number = HEX_SIZE): HexCube {
  let q = 0;
  let r = 0;

  if (orientation === 'flat') {
    q = (2.0 / 3.0 * p.x) / size;
    r = (-1.0 / 3.0 * p.x + Math.sqrt(3.0) / 3.0 * p.y) / size;
  } else {
    // pointy
    q = (Math.sqrt(3.0) / 3.0 * p.x - 1.0 / 3.0 * p.y) / size;
    r = (2.0 / 3.0 * p.y) / size;
  }

  return cubeRound({ q, r, s: -q - r });
}

function cubeRound(frac: HexCube): HexCube {
  let q = Math.round(frac.q);
  let r = Math.round(frac.r);
  let s = Math.round(frac.s);

  const q_diff = Math.abs(q - frac.q);
  const r_diff = Math.abs(r - frac.r);
  const s_diff = Math.abs(s - frac.s);

  if (q_diff > r_diff && q_diff > s_diff) {
    q = -r - s;
  } else if (r_diff > s_diff) {
    r = -q - s;
  } else {
    s = -q - r;
  }

  return { q, r, s };
}

// Helper to generate a grid of hexes within a given radius
export function generateGrid(radius: number): HexCube[] {
  const hexes: HexCube[] = [];
  for (let q = -radius; q <= radius; q++) {
    const r1 = Math.max(-radius, -q - radius);
    const r2 = Math.min(radius, -q + radius);
    for (let r = r1; r <= r2; r++) {
      hexes.push({ q, r, s: -q - r });
    }
  }
  return hexes;
}

export const HEX_NEIGHBORS = [
  { q: 1, r: 0, s: -1 },
  { q: 1, r: -1, s: 0 },
  { q: 0, r: -1, s: 1 },
  { q: -1, r: 0, s: 1 },
  { q: -1, r: 1, s: 0 },
  { q: 0, r: 1, s: -1 }
];

// Check if two hexes are equal
export function isHexEqual(a: HexCube, b: HexCube): boolean {
  return a.q === b.q && a.r === b.r && a.s === b.s;
}

// Generate a rectangular grid of hexes
export function generateRectangularGrid(width: number, height: number, orientation: HexOrientation): HexCube[] {
  const hexes: HexCube[] = [];
  
  if (orientation === 'flat') {
    // Flat-topped -> "odd-q" layout (columns are staggered)
    for (let q = 0; q < width; q++) {
      const offset = Math.floor(q / 2);
      for (let row = 0; row < height; row++) {
        const r = row - offset;
        hexes.push({ q, r, s: -q - r });
      }
    }
  } else {
    // Pointy-topped -> "odd-r" layout (rows are staggered)
    for (let r = 0; r < height; r++) {
      const offset = Math.floor(r / 2);
      for (let col = 0; col < width; col++) {
        const q = col - offset;
        hexes.push({ q, r, s: -q - r });
      }
    }
  }
  
  return hexes;
}

export interface HexEdgeGraph {
  adj: Map<string, {x: number, y: number}[]>;
  size: number;
}

export function buildHexEdgeGraph(orientation: HexOrientation, grid: HexCube[], size: number = HEX_SIZE): HexEdgeGraph {
  const nodeKey = (x: number, y: number) => `${Math.round(x)},${Math.round(y)}`;
  const adj = new Map<string, {x: number, y: number}[]>();
  
  grid.forEach(hex => {
    const center = hexToPixel(hex, orientation, size);
    const corners = getHexCorners(center, orientation, size);
    for (let i = 0; i < 6; i++) {
      const p1 = { x: corners[i * 2], y: corners[i * 2 + 1] };
      const p2 = { x: corners[((i + 1) % 6) * 2], y: corners[((i + 1) % 6) * 2 + 1] };
      
      const k1 = nodeKey(p1.x, p1.y);
      const k2 = nodeKey(p2.x, p2.y);
      
      if (!adj.has(k1)) adj.set(k1, []);
      if (!adj.has(k2)) adj.set(k2, []);
      
      if (!adj.get(k1)!.some(n => nodeKey(n.x, n.y) === k2)) adj.get(k1)!.push(p2);
      if (!adj.get(k2)!.some(n => nodeKey(n.x, n.y) === k1)) adj.get(k2)!.push(p1);
    }
  });
  
  return { adj, size };
}

export function findHexEdgePath(startPixel: Point, endPixel: Point, graph: HexEdgeGraph): number[] {
  const { adj, size } = graph;
  const nodeKey = (x: number, y: number) => `${Math.round(x)},${Math.round(y)}`;

  // Find the closest graph nodes to start and end
  let startNode: {x: number, y: number, key: string} | null = null;
  let endNode: {x: number, y: number, key: string} | null = null;
  let minDistStart = Infinity;
  let minDistEnd = Infinity;

  for (const [key, neighbors] of adj.entries()) {
    // just pick the first neighbor's source coordinates to represent this node
    const [sx, sy] = key.split(',').map(Number);
    
    const dStart = (sx - startPixel.x) ** 2 + (sy - startPixel.y) ** 2;
    if (dStart < minDistStart) {
      minDistStart = dStart;
      startNode = { x: sx, y: sy, key };
    }
    
    const dEnd = (sx - endPixel.x) ** 2 + (sy - endPixel.y) ** 2;
    if (dEnd < minDistEnd) {
      minDistEnd = dEnd;
      endNode = { x: sx, y: sy, key };
    }
  }

  if (!startNode || !endNode) return [startPixel.x, startPixel.y, endPixel.x, endPixel.y];
  if (startNode.key === endNode.key) return [startNode.x, startNode.y];

  // A* pathfinding
  const queue = [{ node: startNode, path: [startNode.x, startNode.y], cost: 0 }];
  const visited = new Set<string>();
  
  while (queue.length > 0) {
    // sort by cost + heuristic (euclidean distance to end)
    queue.sort((a, b) => {
      const fA = a.cost + Math.sqrt((a.node.x - endNode!.x) ** 2 + (a.node.y - endNode!.y) ** 2);
      const fB = b.cost + Math.sqrt((b.node.x - endNode!.x) ** 2 + (b.node.y - endNode!.y) ** 2);
      return fA - fB;
    });
    
    const current = queue.shift()!;
    if (current.node.key === endNode.key) {
      return current.path;
    }
    
    if (visited.has(current.node.key)) continue;
    visited.add(current.node.key);
    
    const neighbors = adj.get(current.node.key) || [];
    for (const n of neighbors) {
      const nKey = nodeKey(n.x, n.y);
      if (!visited.has(nKey)) {
        queue.push({
          node: { x: n.x, y: n.y, key: nKey },
          path: [...current.path, n.x, n.y],
          cost: current.cost + size
        });
      }
    }
  }
  
  // Fallback if no path found
  return [startPixel.x, startPixel.y, endPixel.x, endPixel.y];
}
