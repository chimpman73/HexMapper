import React, { useMemo } from 'react';
import { Group, Text } from 'react-konva';
import MixedFontText from '../MixedFontText';
import { MapLayer, HexOrientation, MapVariables } from '../../types';
import { hexToPixel, BoundingBox } from '../../utils/hexMath';

interface CityLabelOverlayProps {
  layers: MapLayer[];
  orientation: HexOrientation;
  mapVariables: MapVariables;
  visibleBounds: BoundingBox;
}

const CityLabelOverlay: React.FC<CityLabelOverlayProps> = ({ layers, orientation, mapVariables, visibleBounds }) => {
  const cityLabels = useMemo(() => {
    const labels: { id: string; x: number; y: number; text: string }[] = [];
    
    layers.filter(l => l.type === 'city' && l.visible).forEach(layer => {
      const cityLayer = layer as import('../../types').CityLayer;
      for (const key in cityLayer.data) {
        const cell = cityLayer.data[key];
        if (typeof cell === 'object' && cell.name) {
          const parts = key.split(',').map(Number);
          if (parts.length >= 3) {
            const hex = { q: parts[0], r: parts[1], s: parts[2] };
            const pixel = hexToPixel(hex, orientation);
            
            // Check bounds to avoid rendering thousands of off-screen labels
            if (
              pixel.x >= visibleBounds.minX - 50 &&
              pixel.x <= visibleBounds.maxX + 50 &&
              pixel.y >= visibleBounds.minY - 50 &&
              pixel.y <= visibleBounds.maxY + 50
            ) {
              labels.push({
                id: `${layer.id}-${key}`,
                x: pixel.x,
                y: pixel.y - 50, // Render above the city
                text: cell.name
              });
            }
          }
        }
      }
    });
    
    return labels;
  }, [layers, orientation, visibleBounds]);

  return (
    <Group listening={false}>
      {cityLabels.map(label => (
        <Group key={label.id}>
          <MixedFontText
            text={label.text}
            x={label.x - 100}
            y={label.y}
            width={200}
            align="center"
            primaryFont={mapVariables.fontName}
            secondaryFont={mapVariables.secondaryFontName}
            fontSize={mapVariables.cityLabelSize || 32}
            fontStyle="bold"
            fill={mapVariables.cityLabelColor || '#000000'}
            stroke={mapVariables.cityLabelOutline || '#ffffff'}
            strokeWidth={3}
            fillAfterStrokeEnabled
          />
        </Group>
      ))}
    </Group>
  );
};

export default React.memo(CityLabelOverlay);
