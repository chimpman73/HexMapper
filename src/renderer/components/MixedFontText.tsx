import React, { useMemo } from 'react';
import { Group, Text } from 'react-konva';
import { useMapStore } from '../store/mapStore';
import { doesFontHaveVisibleNumbers } from '../utils/fontUtils';

interface MixedFontTextProps {
  text: string;
  primaryFont: string;
  secondaryFont?: string;
  fontSize: number;
  x?: number;
  y?: number;
  fill?: string;
  fontStyle?: string;
  align?: 'left' | 'center' | 'right';
  width?: number;
  [key: string]: any;
}

const MixedFontText: React.FC<MixedFontTextProps> = ({ 
  text, 
  primaryFont, 
  secondaryFont = 'sans-serif', 
  fontSize, 
  x = 0, 
  y = 0, 
  fill = '#000', 
  fontStyle = 'normal', 
  align = 'left', 
  width, 
  ...props 
}) => {
  const hasNumbers = useMemo(() => doesFontHaveVisibleNumbers(primaryFont), [primaryFont]);

  const renderedElements = useMemo(() => {
    if (!text) return null;
    
    const defaultFamily = `${primaryFont}${secondaryFont ? `, ${secondaryFont}` : ''}, sans-serif`;
    
    if (hasNumbers) {
      return (
        <Text 
          text={text} 
          fontFamily={defaultFamily} 
          fontSize={fontSize} 
          x={0} 
          y={0} 
          fill={fill} 
          fontStyle={fontStyle} 
          align={align} 
          width={width} 
          {...props} 
        />
      );
    }

    const parts = text.split(/(\s+)/);
    
    if (parts.length === 1 && !/\d/.test(text)) {
      return (
        <Text 
          text={text} 
          fontFamily={defaultFamily} 
          fontSize={fontSize} 
          x={0} 
          y={0} 
          fill={fill} 
          fontStyle={fontStyle} 
          align={align} 
          width={width} 
          {...props} 
        />
      );
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    let currentX = 0;
    const elements = [];
    let totalWidth = 0;
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (!part) continue;
      
      const hasNumber = /\d/.test(part);
      const family = hasNumber ? `${secondaryFont}, sans-serif` : defaultFamily;
      
      let partWidth = 0;
      if (ctx) {
        ctx.font = `${fontStyle !== 'normal' ? fontStyle + ' ' : ''}${fontSize}px ${family}`;
        partWidth = ctx.measureText(part).width;
      }
      
      elements.push({ text: part, family, x: currentX, width: partWidth });
      currentX += partWidth;
      totalWidth += partWidth;
    }

    let startX = 0;
    if (align === 'center' && width) {
      startX = (width - totalWidth) / 2;
    } else if (align === 'right' && width) {
      startX = width - totalWidth;
    }

    return (
      <Group x={startX}>
        {elements.map((el, idx) => (
          <Text 
            key={idx} 
            text={el.text} 
            fontFamily={el.family} 
            fontSize={fontSize} 
            fill={fill} 
            fontStyle={fontStyle} 
            x={el.x} 
            y={0} 
            {...props} 
          />
        ))}
      </Group>
    );
  }, [text, primaryFont, secondaryFont, fontSize, fill, fontStyle, align, width, hasNumbers, props]);

  return (
    <Group x={x} y={y}>
      {renderedElements}
    </Group>
  );
};

export default MixedFontText;
