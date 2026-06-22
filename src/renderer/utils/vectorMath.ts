import Konva from 'konva';

export const getRelativePointerPosition = (stage: Konva.Stage) => {
  const pointer = stage.getPointerPosition();
  const currentScale = stage.scaleX();
  return {
    x: (pointer!.x - stage.x()) / currentScale,
    y: (pointer!.y - stage.y()) / currentScale,
  };
};

export function getCurvePoints(pts: number[], tension: number = 0.5, numOfSegments: number = 10): number[] {
  if (pts.length < 4 || tension === 0) return pts;

  const res: number[] = [];
  const p = [...pts];
  p.unshift(pts[1]);
  p.unshift(pts[0]);
  p.push(pts[pts.length - 2]);
  p.push(pts[pts.length - 1]);

  for (let i = 2; i < p.length - 4; i += 2) {
    const p0x = p[i - 2];
    const p0y = p[i - 1];
    const p1x = p[i];
    const p1y = p[i + 1];
    const p2x = p[i + 2];
    const p2y = p[i + 3];
    const p3x = p[i + 4] ?? p2x;
    const p3y = p[i + 5] ?? p2y;

    const t1x = (p2x - p0x) * tension;
    const t1y = (p2y - p0y) * tension;
    const t2x = (p3x - p1x) * tension;
    const t2y = (p3y - p1y) * tension;

    for (let t = 0; t <= numOfSegments; t++) {
      const st = t / numOfSegments;
      const st2 = st * st;
      const st3 = st2 * st;

      const c1 = 2 * st3 - 3 * st2 + 1;
      const c2 = -(2 * st3) + 3 * st2;
      const c3 = st3 - 2 * st2 + st;
      const c4 = st3 - st2;

      const x = c1 * p1x + c2 * p2x + c3 * t1x + c4 * t2x;
      const y = c1 * p1y + c2 * p2y + c3 * t1y + c4 * t2y;
      
      if (t === 0 && res.length > 0) continue;
      res.push(x, y);
    }
  }

  return res;
}

export function distToSegment(p: {x: number, y: number}, v: {x: number, y: number}, w: {x: number, y: number}) {
  const l2 = (v.x - w.x) ** 2 + (v.y - w.y) ** 2;
  if (l2 === 0) return Math.sqrt((p.x - v.x) ** 2 + (p.y - v.y) ** 2);
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.sqrt((p.x - (v.x + t * (w.x - v.x))) ** 2 + (p.y - (v.y + t * (w.y - v.y))) ** 2);
}
