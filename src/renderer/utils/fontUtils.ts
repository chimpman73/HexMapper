const fontHasNumbersCache: Record<string, boolean> = {};

export const doesFontHaveVisibleNumbers = (fontName: string): boolean => {
  if (fontHasNumbersCache[fontName] !== undefined) {
    return fontHasNumbersCache[fontName];
  }

  const canvas = document.createElement('canvas');
  canvas.width = 50;
  canvas.height = 50;
  const ctx = canvas.getContext('2d');
  
  // If we can't get a context, default to true to prevent loops
  if (!ctx) return true;

  // Render a block of numbers
  ctx.font = `30px "${fontName}"`;
  ctx.fillStyle = 'black';
  ctx.textBaseline = 'top';
  ctx.fillText('0123456789', 0, 0);

  const data = ctx.getImageData(0, 0, 50, 50).data;
  let hasVisiblePixels = false;
  
  // Check the alpha channel (every 4th byte)
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] > 0) {
      hasVisiblePixels = true;
      break;
    }
  }

  fontHasNumbersCache[fontName] = hasVisiblePixels;
  return hasVisiblePixels;
};
