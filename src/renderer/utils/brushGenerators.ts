export function generateRoadBrush(type: 'path' | 'road' | 'tunnel' | 'highlight', config: any): string {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const cx = 32;
  const cy = 32;
  const r = 30;

  // Draw hex background
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = config?.brushBackground || '#7cb342';
  ctx.fill();
  
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Draw road
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  
  if (type === 'highlight') {
     ctx.shadowColor = '#ffff00';
     ctx.shadowBlur = 10;
     ctx.strokeStyle = '#ffff00';
     ctx.lineWidth = 6;
     ctx.beginPath();
     ctx.moveTo(12, 32);
     ctx.lineTo(52, 32);
     ctx.stroke();
  } else {
     const style = config?.[type] || {};
     ctx.shadowBlur = 0;
     const width = 8;
     
     if (type === 'tunnel') {
       ctx.strokeStyle = style.color || '#555555';
       ctx.lineWidth = width;
       ctx.beginPath(); ctx.moveTo(12, 32); ctx.lineTo(52, 32); ctx.stroke();
       
       ctx.strokeStyle = style.innerColor || '#ffffff';
       ctx.lineWidth = Math.max(1, width * (style.innerWidthMultiplier ?? 0.6));
       ctx.beginPath(); ctx.moveTo(12, 32); ctx.lineTo(52, 32); ctx.stroke();
     } else {
       ctx.strokeStyle = style.color || '#404040';
       ctx.lineWidth = width;
       if (style.dash && style.dash.length > 0) {
          ctx.setLineDash(style.dash);
       }
       ctx.beginPath(); ctx.moveTo(12, 32); ctx.lineTo(52, 32); ctx.stroke();
       ctx.setLineDash([]);
     }
  }

  return canvas.toDataURL();
}

export function generateRiverBrush(type: 'stream' | 'river' | 'highlight', config: any): string {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const cx = 32;
  const cy = 32;
  const r = 30;

  // Draw hex background
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = config?.brushBackground || '#7cb342';
  ctx.fill();
  
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Draw river
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  
  if (type === 'highlight') {
     ctx.shadowColor = '#ffff00';
     ctx.shadowBlur = 10;
     ctx.strokeStyle = '#ffff00';
     ctx.lineWidth = 6;
     ctx.beginPath();
     ctx.moveTo(12, 32);
     ctx.lineTo(52, 32);
     ctx.stroke();
  } else {
     const style = config?.[type] || {};
     ctx.shadowBlur = 0;
     const width = type === 'stream' ? 4 : 8;
     ctx.strokeStyle = style.color || (type === 'stream' ? '#60a5fa' : '#3b82f6');
     ctx.lineWidth = width;
     if (style.dash && style.dash.length > 0) {
        ctx.setLineDash(style.dash);
     }
     ctx.beginPath(); ctx.moveTo(12, 32); ctx.bezierCurveTo(25, 10, 39, 54, 52, 32); ctx.stroke();
     ctx.setLineDash([]);
  }

  return canvas.toDataURL();
}

export function generateCoastlineBrush(type: 'smooth' | 'fractal' | 'highlight'): string {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const cx = 32;
  const cy = 32;
  const r = 30;

  // Draw hex background
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = '#7cb342';
  ctx.fill();
  
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Draw coastline
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#222222';
  ctx.lineWidth = 3;
  ctx.beginPath();
  
  if (type === 'smooth') {
     ctx.moveTo(12, 32);
     ctx.bezierCurveTo(25, 15, 39, 49, 52, 32);
     ctx.stroke();
  } else if (type === 'fractal') {
     ctx.moveTo(12, 32);
     ctx.lineTo(20, 24);
     ctx.lineTo(28, 36);
     ctx.lineTo(36, 26);
     ctx.lineTo(44, 40);
     ctx.lineTo(52, 32);
     ctx.stroke();
  } else if (type === 'highlight') {
     ctx.shadowColor = '#ffff00';
     ctx.shadowBlur = 10;
     ctx.strokeStyle = '#ffff00';
     ctx.lineWidth = 6;
     ctx.moveTo(12, 32);
     ctx.bezierCurveTo(25, 15, 39, 49, 52, 32);
     ctx.stroke();
  }

  return canvas.toDataURL();
}

export function generateBorderBrush(type: BorderStyle): string {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const cx = 32;
  const cy = 32;
  const r = 30;

  // Draw hex background
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = '#7cb342';
  ctx.fill();
  
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Draw border
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#dc2626'; // Red color for borders
  ctx.lineWidth = 4;
  ctx.beginPath();
  
  if (type === 'smooth') {
     ctx.moveTo(12, 32);
     ctx.bezierCurveTo(25, 15, 39, 49, 52, 32);
     ctx.stroke();
  } else if (type === 'snapped') {
     // Draw zigzag along hex edges
     ctx.moveTo(12, 32);
     ctx.lineTo(22, 14);
     ctx.lineTo(42, 14);
     ctx.lineTo(52, 32);
     ctx.stroke();
  } else if (type === 'highlight') {
     ctx.shadowColor = '#ffff00';
     ctx.shadowBlur = 10;
     ctx.strokeStyle = '#ffff00';
     ctx.lineWidth = 6;
     ctx.moveTo(12, 32);
     ctx.bezierCurveTo(25, 15, 39, 49, 52, 32);
     ctx.stroke();
  }

  return canvas.toDataURL();
}

export function generateCliffBrush(type: import('../types').CliffStyle): string {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const cx = 32;
  const cy = 32;
  const r = 30;

  // Draw hex background
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = '#7cb342';
  ctx.fill();
  
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Draw cliff
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 3;
  
  const drawHashes = (pts: number[]) => {
    for (let i = 0; i < pts.length - 2; i += 2) {
      const dx = pts[i+2] - pts[i];
      const dy = pts[i+3] - pts[i+1];
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist === 0) continue;
      const nx = -dy / dist;
      const ny = dx / dist;
      
      const pCx = (pts[i] + pts[i+2])/2;
      const pCy = (pts[i+1] + pts[i+3])/2;
      
      ctx.beginPath();
      ctx.moveTo(pCx, pCy);
      ctx.lineTo(pCx + nx * 8, pCy + ny * 8);
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  };

  if (type === 'smooth') {
     ctx.beginPath();
     ctx.moveTo(12, 32);
     ctx.bezierCurveTo(25, 15, 39, 49, 52, 32);
     ctx.stroke();
     drawHashes([12, 32, 25, 25, 39, 40, 52, 32]);
  } else if (type === 'fractal') {
     const pts = [12, 32, 20, 24, 28, 36, 36, 26, 44, 40, 52, 32];
     ctx.beginPath();
     ctx.moveTo(pts[0], pts[1]);
     for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i+1]);
     ctx.stroke();
     drawHashes(pts);
  } else if (type === 'highlight') {
     ctx.shadowColor = '#ffff00';
     ctx.shadowBlur = 10;
     ctx.strokeStyle = '#ffff00';
     ctx.lineWidth = 6;
     ctx.beginPath();
     ctx.moveTo(12, 32);
     ctx.bezierCurveTo(25, 15, 39, 49, 52, 32);
     ctx.stroke();
  }

  return canvas.toDataURL();
}
