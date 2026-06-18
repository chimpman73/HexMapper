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
