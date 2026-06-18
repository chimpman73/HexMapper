import React from 'react';
import { Group, Line } from 'react-konva';
import { GridLayer, HexCube, HexOrientation } from '../../types';
import { hexToPixel, getHexCorners } from '../../utils/hexMath';

interface GridLayerRendererProps {
  layer: GridLayer;
  grid: HexCube[];
  orientation: HexOrientation;
}

const GridLayerRenderer: React.FC<GridLayerRendererProps> = ({ layer, grid, orientation }) => {
  return (
    <Group opacity={layer.opacity} listening={false}>
      {grid.map((hex) => {
        const key = `${hex.q},${hex.r},${hex.s}`;
        return (
          <Line
            key={`grid-${key}`}
            points={getHexCorners(hexToPixel(hex, orientation), orientation)}
            stroke="#333333"
            strokeWidth={2}
            closed
            listening={false}
          />
        );
      })}
    </Group>
  );
};

export default GridLayerRenderer;
