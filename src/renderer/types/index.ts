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
  invert?: boolean; 
  brushKey?: string;
}

export interface VectorLayer extends BaseLayer {
  type: 'river' | 'cliff' | 'label' | 'road' | 'coastline' | 'border';
  data: VectorLine[];
}

export interface GridLayer extends BaseLayer {
  type: 'grid';
  data: {};
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

export type MapLayer = TerrainLayer | CityLayer | VectorLayer | GridLayer | BgImageLayer | GroupLayer;

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

declare global {
  interface Window {
    api: {
      runPythonScript: (args: PythonScriptArgs) => Promise<any>;
      openDirectory: () => Promise<string | null>;
      openImage: () => Promise<string | null>;
      readDir: (dirPath: string) => Promise<string[]>;
      readMapDescription: (targetPath: string) => Promise<any | null>;
      saveMap: (dataString: string) => Promise<{ success: boolean; filePath?: string; canceled?: boolean; error?: string }>;
      loadMap: () => Promise<{ success: boolean; data?: string; filePath?: string; canceled?: boolean; error?: string }>;
      exportImage: (dataUrl: string) => Promise<{ success: boolean; filePath?: string; canceled?: boolean; error?: string }>;
      getStyles: () => Promise<string[]>;
      getAssetsBasePath: () => Promise<string>;
      getDefaultTiles: (style: string, folder: string) => Promise<string[]>;
    };
    electron: {
      ipcRenderer: {
        invoke: (channel: string, data: any) => Promise<any>;
      }
    };
  }
}

