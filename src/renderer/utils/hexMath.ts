export type HexOrientation = 'flat' | 'pointy';

export interface Point {
  x: number;
  y: number;
}

export interface HexCube {
  q: number;
  r: number;
  s: number;
}

export type LayerType = 'terrain' | 'river' | 'cliff' | 'coastline' | 'city' | 'border' | 'label' | 'legend' | 'grid' | 'bg_image' | 'group' | 'road';

export interface BaseLayer {
  id: string;
  name: string;
  type: LayerType;
  visible: boolean;
  opacity: number;
  parentId?: string;
  sourceFilename?: string;
}

export interface TerrainLayer extends BaseLayer {
  type: 'terrain';
  data: Record<string, string>; // hex coords to image url
}

export interface CityLayer extends BaseLayer {
  type: 'city';
  data: Record<string, string>; 
}

export interface BorderLayer extends BaseLayer {
  type: 'border';
  data: Record<string, string>; 
}

export interface CoastlineLayer extends BaseLayer {
  type: 'coastline';
  data: Record<string, string>;
  vectors?: any[];
}

export type RoadStyle = 'path' | 'road' | 'tunnel' | 'highlight';

export interface VectorLine {
  id: string;
  points: number[];
  stroke: string;
  strokeWidth: number;
  tension: number;
  invert?: boolean;
  roadStyle?: RoadStyle;
}

export interface VectorLayer extends BaseLayer {
  type: 'river' | 'cliff' | 'label' | 'road';
  data: VectorLine[];
}

export interface GridLayer extends BaseLayer {
  type: 'grid';
  data: Record<string, string>;
}

export interface BgImageLayer extends BaseLayer {
  type: 'bg_image';
  data: {
    imagePath: string;
  };
}

export interface GroupLayer extends BaseLayer {
  type: 'group';
  data: {};
}

export type MapLayer = TerrainLayer | CityLayer | CoastlineLayer | BorderLayer | VectorLayer | GridLayer | BgImageLayer | GroupLayer;

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
