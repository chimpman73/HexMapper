import React from 'react';
import { useMapStore } from '../store/mapStore';

import { RoadPalette } from './palettes/RoadPalette';
import { RiverPalette } from './palettes/RiverPalette';
import { CoastlinePalette } from './palettes/CoastlinePalette';
import { BorderPalette } from './palettes/BorderPalette';
import { CliffPalette } from './palettes/CliffPalette';
import { LabelPalette } from './palettes/LabelPalette';
import { GridPalette } from './palettes/GridPalette';
import { TerrainPalette } from './palettes/TerrainPalette';
import { CityPalette } from './palettes/CityPalette';
import { LegendPalette } from './palettes/LegendPalette';

const LayerPalette: React.FC = () => {
  const { layers, activeLayerId } = useMapStore();
  const activeLayer = layers.find(l => l.id === activeLayerId) || layers[0];

  if (!activeLayer) return null;

  switch (activeLayer.type) {
    case 'road': return <RoadPalette />;
    case 'river': return <RiverPalette />;
    case 'coastline': return <CoastlinePalette />;
    case 'border': return <BorderPalette />;
    case 'cliff': return <CliffPalette />;
    case 'label': return <LabelPalette />;
    case 'grid': return <GridPalette />;
    case 'terrain': return <TerrainPalette />;
    case 'city': return <CityPalette />;
    case 'legend': return <LegendPalette />;
    default: return null;
  }
};

export default LayerPalette;
