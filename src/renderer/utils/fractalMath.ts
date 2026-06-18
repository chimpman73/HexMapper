export function generateFractalLine(points: number[], iterations: number = 3, displacement: number = 5): number[] {
  if (points.length < 4) return points;
  
  let currentPoints = [...points];
  
  for (let it = 0; it < iterations; it++) {
    const newPoints = [currentPoints[0], currentPoints[1]];
    let currentDisplacement = displacement / Math.pow(2, it * 0.5);
    
    for (let i = 0; i < currentPoints.length - 2; i += 2) {
      const x1 = currentPoints[i];
      const y1 = currentPoints[i + 1];
      const x2 = currentPoints[i + 2];
      const y2 = currentPoints[i + 3];
      
      const midX = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2;
      
      const dx = x2 - x1;
      const dy = y2 - y1;
      const len = Math.sqrt(dx * dx + dy * dy);
      
      if (len < 5) {
        newPoints.push(x2, y2);
        continue;
      }
      
      const nx = -dy / len;
      const ny = dx / len;
      
      const offset = (Math.random() - 0.5) * 2 * currentDisplacement;
      
      newPoints.push(midX + nx * offset, midY + ny * offset);
      newPoints.push(x2, y2);
    }
    currentPoints = newPoints;
  }
  
  return currentPoints;
}
