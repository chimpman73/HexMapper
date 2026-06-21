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

export type CoastlineStyle = 'smooth' | 'fractal' | 'highlight';

export type RoadStyle = 'path' | 'road' | 'tunnel' | 'highlight';
export type RiverStyle = 'stream' | 'river' | 'highlight';
export type BorderStyle = 'smooth' | 'snapped' | 'highlight';
export type CliffStyle = 'smooth' | 'fractal' | 'highlight';

export interface VectorFeature {
  id: string;
  brushUrl: string;
  segmentIndex: number;
  t: number;
}

export interface VectorLine {
  id: string;
  points: number[];
  stroke: string;
  strokeWidth: number;
  tension: number;
  closed?: boolean;
  fill?: string;
  roadStyle?: RoadStyle;
  riverStyle?: RiverStyle;
  coastlineStyle?: CoastlineStyle;
  borderStyle?: BorderStyle;
  cliffStyle?: CliffStyle;
  invert?: boolean; 
  brushKey?: string;
  features?: VectorFeature[];
}

export interface VectorLayer extends BaseLayer {
  type: 'river' | 'label' | 'road' | 'coastline' | 'border';
  data: VectorLine[];
}

export interface CliffLayer extends BaseLayer {
  type: 'cliff';
  data: {
    lines: VectorLine[];
    hexes: Record<string, string>;
  };
}

export interface GridLayer extends BaseLayer {
  type: 'grid';
  data: { color?: string };
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

export type MapLayer = TerrainLayer | CityLayer | VectorLayer | CliffLayer | GridLayer | BgImageLayer | GroupLayer;

export interface PythonScriptArgs {
  action?: string;
  command?: string;
  mode?: string;
  imagePath?: string | null;
  id?: string;
  name?: string;
  bgScaleX?: number;
  bgScaleY?: number;
  bgOffsetX?: number;
  bgOffsetY?: number;
  mapWidth?: number;
  mapHeight?: number;
  orientation?: string;
  layers?: MapLayer[];
}

export interface MapVariables {
  fontName: string;
  hexSize: number;
  hexUnit: string;
}

export interface IpcResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  canceled?: boolean;
}

declare global {
  interface Window {
    api: {
      runPythonScript: <T = any>(args: PythonScriptArgs) => Promise<IpcResponse<T>>;
      openDirectory: () => Promise<IpcResponse<string>>;
      openImage: () => Promise<IpcResponse<string>>;
      readDir: (dirPath: string) => Promise<IpcResponse<string[]>>;
      readMapDescription: (targetPath: string) => Promise<IpcResponse<any>>;
      saveMap: (dataString: string) => Promise<IpcResponse<{ filePath: string }>>;
      loadMap: () => Promise<IpcResponse<{ data: string, filePath: string }>>;
      exportImage: (dataUrl: string) => Promise<IpcResponse<{ filePath: string }>>;
      getStyles: () => Promise<IpcResponse<string[]>>;
      getAssetsBasePath: () => Promise<IpcResponse<string>>;
      getDefaultTiles: (style: string, folder: string) => Promise<IpcResponse<string[]>>;
      getSystemFonts: () => Promise<IpcResponse<string[]>>;
    };
    electron: {
      ipcRenderer: {
        invoke: (channel: string, ...args: any[]) => Promise<any>;
      }
    };
  }
}

