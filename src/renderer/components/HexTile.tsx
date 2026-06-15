import React, { useMemo } from 'react';
import { Line, Text, Group, Image as KonvaImage } from 'react-konva';
import { HexCube, HexOrientation, hexToPixel, getHexCorners, HEX_SIZE } from '../utils/hexMath';
import useImage from '../utils/useImage';

interface HexTileProps {
  hex: HexCube;
  orientation: HexOrientation;
  isHovered: boolean;
  onHover: (hex: HexCube) => void;
  onLeave: () => void;
  onPointerDown: (e: any) => void;
  showCoordinates: boolean;
  imageSrc?: string;
  fillColor?: string;
  isBaseLayer?: boolean;
}

const HexTile: React.FC<HexTileProps> = ({ 
  hex, orientation, isHovered, onHover, onLeave, onPointerDown, showCoordinates, imageSrc, fillColor, isBaseLayer = true
}) => {
  const center = useMemo(() => hexToPixel(hex, orientation), [hex, orientation]);
  const points = useMemo(() => getHexCorners({ x: 0, y: 0 }, orientation), [orientation]);
  
  const image = useImage(imageSrc);

  return (
    <Group 
      x={center.x} 
      y={center.y}
      onMouseEnter={() => onHover(hex)}
      onMouseLeave={onLeave}
      onPointerDown={onPointerDown}
    >
      <Line
        points={points}
        fill={fillColor || (imageSrc ? undefined : (isHovered ? '#bb86fc' : (isBaseLayer ? '#1e1e1e' : 'transparent')))}
        stroke={isHovered ? '#03dac6' : (isBaseLayer ? '#333333' : 'transparent')}
        strokeWidth={isHovered ? 3 : (isBaseLayer ? 2 : 0)}
        closed
      />
      {image && (
        <Group clipFunc={(ctx) => {
          ctx.beginPath();
          ctx.moveTo(points[0], points[1]);
          for(let i=2; i<points.length; i+=2) ctx.lineTo(points[i], points[i+1]);
          ctx.closePath();
        }}>
          <KonvaImage
            image={image}
            x={-HEX_SIZE}
            y={-HEX_SIZE}
            width={HEX_SIZE * 2}
            height={HEX_SIZE * 2}
            listening={false}
          />
        </Group>
      )}
      {showCoordinates && (
        <Text
          text={`${hex.q}, ${hex.r}`}
          x={-HEX_SIZE / 2}
          y={-5}
          width={HEX_SIZE}
          align="center"
          fill={isHovered ? '#000' : '#888'}
          fontSize={10}
          listening={false}
        />
      )}
    </Group>
  );
};

export default React.memo(HexTile);
