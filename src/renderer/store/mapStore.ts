import { create } from 'zustand';
import { HexOrientation, MapLayer, RoadStyle, RiverStyle, CoastlineStyle } from '../types';
export type EditorAction = 'paint' | 'select' | 'move' | 'highlight' | 'erase';

interface MapState {
  orientation: HexOrientation;
  showCoordinates: boolean;
  mapWidth: number;
  mapHeight: number;
  
  globalCoastlines: any[];
  globalBorders: any[];
  unknowns: any[];
  showUnknownsPanel: boolean;
  highlightedHexKey: string | null;

  bgScaleX: number;
  bgScaleY: number;
  bgOffsetX: number;
  bgOffsetY: number;
  importType: 'image' | 'directory' | null;
  importDirPath: string | null;
  showImportModal: boolean;
  
  activeAction: EditorAction;
  activeBrush: string | null;
  activeFeatureBrush: string | null;
  activeColor: string | null;
  activeLineWidth: number;
  activeRoadStyle?: RoadStyle;
  activeRiverStyle?: RiverStyle;
  activeCoastlineStyle?: CoastlineStyle;
  activeBorderStyle?: BorderStyle;
  activeBorderColor: string;
  activeBorderWidth: number;
  
  layers: MapLayer[];
  pastLayers: MapLayer[][];
  futureLayers: MapLayer[][];
  activeLayerId: string;
  isScanning: boolean;

  stylesList: string[];
  currentStyle: string;
  assetsBasePath: string;
  roadConfig: any;
  riverConfig: any;
  selectedVertex: {lineId: string, index: number} | null;

  // Actions
  setOrientation: (o: HexOrientation) => void;
  setShowCoordinates: (s: boolean) => void;
  setMapWidth: (w: number | ((prev: number) => number)) => void;
  setMapHeight: (h: number | ((prev: number) => number)) => void;
  setGlobalCoastlines: (c: any[]) => void;
  setGlobalBorders: (b: any[]) => void;
  setUnknowns: (u: any[] | ((prev: any[]) => any[])) => void;
  setShowUnknownsPanel: (s: boolean) => void;
  setHighlightedHexKey: (k: string | null) => void;
  setBgScaleX: (s: number) => void;
  setBgScaleY: (s: number) => void;
  setBgOffsetX: (o: number) => void;
  setBgOffsetY: (o: number) => void;
  setImportType: (t: 'image' | 'directory' | null) => void;
  setImportDirPath: (p: string | null) => void;
  setShowImportModal: (s: boolean) => void;
  setActiveAction: (a: EditorAction) => void;
  setActiveBrush: (b: string | null) => void;
  setActiveFeatureBrush: (b: string | null) => void;
  setActiveColor: (c: string | null) => void;
  setActiveLineWidth: (w: number) => void;
  setActiveRoadStyle: (s: RoadStyle) => void;
  setActiveRiverStyle: (s: RiverStyle) => void;
  setActiveCoastlineStyle: (s: CoastlineStyle) => void;
  setActiveBorderStyle: (s: BorderStyle) => void;
  setLayers: (l: MapLayer[] | ((prev: MapLayer[]) => MapLayer[])) => void;
  setActiveLayerId: (id: string) => void;
  setIsScanning: (s: boolean) => void;
  setStylesList: (l: string[]) => void;
  setCurrentStyle: (s: string) => void;
  setAssetsBasePath: (p: string) => void;
  setRoadConfig: (c: any) => void;
  setRiverConfig: (c: any) => void;
  setSelectedVertex: (v: {lineId: string, index: number} | null) => void;

  undo: () => void;
  redo: () => void;

  moveLayer: (id: string, direction: 'up' | 'down') => void;
  addLayer: (type: string) => void;
  deleteLayer: (id: string) => void;
  renameLayer: (id: string, newName: string) => void;
  toggleLayerVisibility: (id: string) => void;
  setActiveBorderColor: (c: string) => void;
  setActiveBorderWidth: (w: number) => void;
}

export const useMapStore = create<MapState>((set) => ({
  orientation: 'flat',
  showCoordinates: true,
  mapWidth: 50,
  mapHeight: 25,
  
  globalCoastlines: [],
  globalBorders: [],
  unknowns: [],
  showUnknownsPanel: true,
  highlightedHexKey: null,

  bgScaleX: 1,
  bgScaleY: 1,
  bgOffsetX: 0,
  bgOffsetY: 0,
  importType: null,
  importDirPath: null,
  showImportModal: false,
  
  activeAction: 'paint',
  activeBrush: null,
  activeFeatureBrush: null,
  activeColor: '#3b82f6',
  activeLineWidth: 10,
  activeRoadStyle: 'path',
  activeRiverStyle: 'river',
  activeCoastlineStyle: 'smooth',
  activeBorderStyle: 'smooth',
  activeBorderColor: '#dc2626',
  activeBorderWidth: 5,
  
  layers: [
    { id: '1', name: 'Terrain', type: 'terrain', visible: true, opacity: 1, data: {} },
    { id: '4', name: 'Coastline', type: 'coastline', visible: true, opacity: 1, data: [] },
    { id: '2', name: 'Cliffs', type: 'cliff', visible: true, opacity: 1, data: [] },
    { id: '3', name: 'Rivers', type: 'river', visible: true, opacity: 1, data: [] },
    { id: '9', name: 'Roads', type: 'road', visible: true, opacity: 1, data: [] },
    { id: '5', name: 'Cities', type: 'city', visible: true, opacity: 1, data: {} },
    { id: '8', name: 'Hex Grid', type: 'grid', visible: true, opacity: 1, data: {} },
    { id: '6', name: 'Borders', type: 'border', visible: true, opacity: 1, data: [] },
    { id: '7', name: 'Labels', type: 'label', visible: true, opacity: 1, data: [] }
  ],
  pastLayers: [],
  futureLayers: [],
  activeLayerId: '1',
  isScanning: false,

  stylesList: ['Hollow Moon'],
  currentStyle: 'Hollow Moon',
  assetsBasePath: '',
  roadConfig: null,
  riverConfig: null,
  selectedVertex: null,

  setOrientation: (o) => set({ orientation: o }),
  setShowCoordinates: (s) => set({ showCoordinates: s }),
  setMapWidth: (w) => set((state) => ({ mapWidth: typeof w === 'function' ? w(state.mapWidth) : w })),
  setMapHeight: (h) => set((state) => ({ mapHeight: typeof h === 'function' ? h(state.mapHeight) : h })),
  setGlobalCoastlines: (c) => set({ globalCoastlines: c }),
  setGlobalBorders: (b) => set({ globalBorders: b }),
  setUnknowns: (u) => set((state) => ({ unknowns: typeof u === 'function' ? u(state.unknowns) : u })),
  setShowUnknownsPanel: (s) => set({ showUnknownsPanel: s }),
  setHighlightedHexKey: (k) => set({ highlightedHexKey: k }),
  setBgScaleX: (s) => set({ bgScaleX: s }),
  setBgScaleY: (s) => set({ bgScaleY: s }),
  setBgOffsetX: (o) => set({ bgOffsetX: o }),
  setBgOffsetY: (o) => set({ bgOffsetY: o }),
  setImportType: (t) => set({ importType: t }),
  setImportDirPath: (p) => set({ importDirPath: p }),
  setShowImportModal: (s) => set({ showImportModal: s }),
  setActiveAction: (a) => set({ activeAction: a }),
  setActiveBrush: (b) => set({ activeBrush: b }),
  setActiveFeatureBrush: (b) => set({ activeFeatureBrush: b }),
  setActiveColor: (c) => set({ activeColor: c }),
  setActiveLineWidth: (w) => set({ activeLineWidth: w }),
  setActiveRoadStyle: (s) => set({ activeRoadStyle: s }),
  setActiveRiverStyle: (s) => set({ activeRiverStyle: s }),
  setActiveCoastlineStyle: (s) => set({ activeCoastlineStyle: s }),
  setActiveBorderStyle: (s) => set({ activeBorderStyle: s }),
  setLayers: (l) => set((state) => {
    const nextLayers = typeof l === 'function' ? l(state.layers) : l;
    if (nextLayers === state.layers) return state;
    return { 
      layers: nextLayers,
      pastLayers: [...state.pastLayers.slice(-30), state.layers],
      futureLayers: []
    };
  }),
  setActiveLayerId: (id) => set({ activeLayerId: id }),
  setIsScanning: (s) => set({ isScanning: s }),
  setStylesList: (l) => set({ stylesList: l }),
  setCurrentStyle: (s) => set({ currentStyle: s }),
  setAssetsBasePath: (p) => set({ assetsBasePath: p }),
  setRoadConfig: (c) => set({ roadConfig: c }),
  setRiverConfig: (c) => set({ riverConfig: c }),
  setSelectedVertex: (v) => set({ selectedVertex: v }),

  undo: () => set((state) => {
    if (state.pastLayers.length === 0) return state;
    const previous = state.pastLayers[state.pastLayers.length - 1];
    const newPast = state.pastLayers.slice(0, state.pastLayers.length - 1);
    return {
      pastLayers: newPast,
      futureLayers: [state.layers, ...state.futureLayers],
      layers: previous
    };
  }),

  redo: () => set((state) => {
    if (state.futureLayers.length === 0) return state;
    const next = state.futureLayers[0];
    const newFuture = state.futureLayers.slice(1);
    return {
      pastLayers: [...state.pastLayers, state.layers],
      futureLayers: newFuture,
      layers: next
    };
  }),

  moveLayer: (id, direction) => set((state) => {
    const prev = state.layers;
    const idx = prev.findIndex(l => l.id === id);
    if (idx === -1) return { layers: prev };
    
    if (direction === 'up' && idx < prev.length - 1) {
      const next = [...prev];
      const temp = next[idx];
      next[idx] = next[idx + 1];
      next[idx + 1] = temp;
      return { layers: next };
    } else if (direction === 'down' && idx > 0) {
      const next = [...prev];
      const temp = next[idx];
      next[idx] = next[idx - 1];
      next[idx - 1] = temp;
      return { layers: next };
    }
    return { layers: prev };
  }),

  addLayer: (type) => set((state) => {
    const newLayer = {
      id: `layer_${Date.now()}`,
      name: `New ${type.charAt(0).toUpperCase() + type.slice(1)}`,
      type: type as any,
      visible: true,
      opacity: 1,
      data: type === 'cliff' || type === 'river' || type === 'label' || type === 'road' || type === 'coastline' || type === 'border' ? [] : {}
    };
    return { layers: [...state.layers, newLayer] };
  }),

  deleteLayer: (id) => set((state) => {
    if (state.layers.length <= 1) return { layers: state.layers };
    const newLayers = state.layers.filter(l => l.id !== id);
    let newActiveId = state.activeLayerId;
    if (state.activeLayerId === id) {
      newActiveId = newLayers[0]?.id || '';
    }
    return { layers: newLayers, activeLayerId: newActiveId };
  }),

  renameLayer: (id, newName) => set((state) => ({
    layers: state.layers.map(l => l.id === id ? { ...l, name: newName } : l)
  })),

  toggleLayerVisibility: (id) => set((state) => {
    const targetLayer = state.layers.find(l => l.id === id);
    if (!targetLayer) return { layers: state.layers };
    const newVisible = !targetLayer.visible;
    return {
      layers: state.layers.map(l => {
        if (l.id === id) return { ...l, visible: newVisible };
        if (l.parentId === id) return { ...l, visible: newVisible };
        return l;
      })
    };
  })
}));
