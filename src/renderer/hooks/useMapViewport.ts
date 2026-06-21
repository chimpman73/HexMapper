import { useState, useCallback } from 'react';
import { KonvaEventObject } from 'konva/lib/Node';

export function useMapViewport() {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isRightClickPan, setIsRightClickPan] = useState(false);
  const [lastPanPos, setLastPanPos] = useState({ x: 0, y: 0 });

  const handleWheel = useCallback((e: KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = e.target.getStage();
    if (!stage) return;

    const scaleBy = 1.1;
    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    const newScale = e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;
    const clampedScale = Math.max(0.1, Math.min(newScale, 5));
    setScale(clampedScale);

    setPosition({
      x: pointer.x - mousePointTo.x * clampedScale,
      y: pointer.y - mousePointTo.y * clampedScale,
    });
  }, []);

  const handlePageZoom = useCallback((isZoomIn: boolean) => {
    setScale(oldScale => {
      const scaleBy = 1.2;
      const newScale = isZoomIn ? oldScale * scaleBy : oldScale / scaleBy;
      return Math.max(0.1, Math.min(newScale, 5));
    });
  }, []);

  return {
    scale, setScale,
    position, setPosition,
    isRightClickPan, setIsRightClickPan,
    lastPanPos, setLastPanPos,
    handleWheel,
    handlePageZoom
  };
}
