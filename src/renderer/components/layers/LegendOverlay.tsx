import React, { useEffect, useState } from 'react';
import { Group, Text, Image, RegularPolygon, Rect } from 'react-konva';
import MixedFontText from '../MixedFontText';
import { MapLayer, LegendLayer, MapVariables } from '../../types';
import { useMapStore } from '../../store/mapStore';

interface LegendOverlayProps {
  layers: MapLayer[];
  mapVariables: MapVariables;
}

export const LegendOverlay: React.FC<LegendOverlayProps> = ({ layers, mapVariables }) => {
  const { setLayers } = useMapStore();
  const legendLayers = layers.filter(l => l.type === 'legend' && l.visible) as LegendLayer[];

  const handleDragEnd = (layerId: string, elementId: string, x: number, y: number) => {
    setLayers(prev => prev.map(l => {
      if (l.id === layerId && l.type === 'legend') {
        const newData = (l.data || []).map(el => {
          if (el.id === elementId) {
            return { ...el, x, y };
          }
          return el;
        });
        return { ...l, data: newData };
      }
      return l;
    }));
  };

  const handleMouseDown = (e: any, layerId: string, elementId: string) => {
    if (useMapStore.getState().activeAction === 'erase') {
      e.cancelBubble = true;
      setLayers(prev => prev.map(l => {
        if (l.id === layerId && l.type === 'legend') {
          return { ...l, data: (l.data || []).filter((el: any) => el.id !== elementId) };
        }
        return l;
      }));
    }
  };

  const [compassImg, setCompassImg] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (mapVariables.compassRoseAsset) {
      const img = new window.Image();
      let src = mapVariables.compassRoseAsset;
      if (src.startsWith('file:///')) {
        src = `local://file?path=${encodeURIComponent(src.replace('file:///', ''))}`;
      }
      img.src = src;
      img.onload = () => setCompassImg(img);
    } else {
      setCompassImg(null);
    }
  }, [mapVariables.compassRoseAsset]);

  return (
    <Group>
      {legendLayers.map(layer => (
        <Group key={layer.id} opacity={layer.opacity}>
          {(layer.data || []).map(el => {
            if (el.type === 'titleBlock') {
              return (
                <Group
                  key={el.id}
                  x={el.x}
                  y={el.y}
                  draggable
                  onDragEnd={(e) => handleDragEnd(layer.id, el.id, e.target.x(), e.target.y())}
                  onMouseDown={(e) => handleMouseDown(e, layer.id, el.id)}
                  onMouseEnter={(e) => {
                    if (useMapStore.getState().activeAction === 'erase') {
                      const stage = e.target.getStage();
                      if (stage) stage.container().style.cursor = 'crosshair';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (useMapStore.getState().activeAction === 'erase') {
                      const stage = e.target.getStage();
                      if (stage) stage.container().style.cursor = 'default';
                    }
                  }}
                >
                  <Rect x={-20} y={-20} width={500} height={180} fill="#ffffff" stroke="#000000" strokeWidth={2} cornerRadius={10} />
                  {mapVariables.mapTitle && (
                    <MixedFontText 
                      text={mapVariables.mapTitle} 
                      fontSize={48} 
                      primaryFont={mapVariables.fontName}
                      secondaryFont={mapVariables.secondaryFontName}
                      fill="#000" 
                      fontStyle="bold"
                    />
                  )}
                  {mapVariables.mapSubtitle && (
                    <MixedFontText 
                      text={mapVariables.mapSubtitle} 
                      fontSize={32} 
                      y={50}
                      primaryFont={mapVariables.fontName}
                      secondaryFont={mapVariables.secondaryFontName}
                      fill="#333" 
                    />
                  )}
                  {(mapVariables.mapAuthor || mapVariables.dateLastSaved) && (
                    <MixedFontText 
                      text={[
                        mapVariables.mapAuthor ? `By: ${mapVariables.mapAuthor}` : '',
                        mapVariables.dateLastSaved ? `Updated: ${mapVariables.dateLastSaved}` : ''
                      ].filter(Boolean).join(' - ')} 
                      fontSize={24} 
                      y={90}
                      primaryFont={mapVariables.fontName}
                      secondaryFont={mapVariables.secondaryFontName}
                      fill="#555" 
                    />
                  )}
                </Group>
              );
            } else if (el.type === 'distanceShield') {
              return (
                <Group
                  key={el.id}
                  x={el.x}
                  y={el.y}
                  draggable
                  onDragEnd={(e) => handleDragEnd(layer.id, el.id, e.target.x(), e.target.y())}
                  onMouseDown={(e) => handleMouseDown(e, layer.id, el.id)}
                  onMouseEnter={(e) => {
                    if (useMapStore.getState().activeAction === 'erase') {
                      const stage = e.target.getStage();
                      if (stage) stage.container().style.cursor = 'crosshair';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (useMapStore.getState().activeAction === 'erase') {
                      const stage = e.target.getStage();
                      if (stage) stage.container().style.cursor = 'default';
                    }
                  }}
                >
                  <RegularPolygon 
                    sides={6} 
                    radius={60} 
                    fill="#ffffff" 
                    stroke="#000000" 
                    strokeWidth={3} 
                    rotation={30} 
                  />
                  <MixedFontText 
                    text={`1 Hex =`} 
                    fontSize={18} 
                    primaryFont={mapVariables.fontName}
                    secondaryFont={mapVariables.secondaryFontName}
                    fill="#000" 
                    x={-100}
                    y={-35}
                    width={200}
                    align="center"
                  />
                  <MixedFontText 
                    text={mapVariables.hexSize !== undefined ? String(mapVariables.hexSize) : '0'} 
                    fontSize={36} 
                    primaryFont={mapVariables.fontName}
                    secondaryFont={mapVariables.secondaryFontName}
                    fill="#000" 
                    fontStyle="bold"
                    x={-100}
                    y={-18}
                    width={200}
                    align="center"
                  />
                  <MixedFontText 
                    text={`${mapVariables.hexUnit || ''}`} 
                    fontSize={20} 
                    primaryFont={mapVariables.fontName}
                    secondaryFont={mapVariables.secondaryFontName}
                    fill="#000" 
                    x={-100}
                    y={22}
                    width={200}
                    align="center"
                  />
                </Group>
              );
            } else if (el.type === 'compassRose') {
              if (!compassImg) return null;
              return (
                <Image
                  key={el.id}
                  image={compassImg}
                  x={el.x}
                  y={el.y}
                  draggable
                  onDragEnd={(e) => handleDragEnd(layer.id, el.id, e.target.x(), e.target.y())}
                  onMouseDown={(e) => handleMouseDown(e, layer.id, el.id)}
                  onMouseEnter={(e) => {
                    if (useMapStore.getState().activeAction === 'erase') {
                      const stage = e.target.getStage();
                      if (stage) stage.container().style.cursor = 'crosshair';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (useMapStore.getState().activeAction === 'erase') {
                      const stage = e.target.getStage();
                      if (stage) stage.container().style.cursor = 'default';
                    }
                  }}
                />
              );
            }
            return null;
          })}
        </Group>
      ))}
    </Group>
  );
};
