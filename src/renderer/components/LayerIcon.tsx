import React from 'react';

export const LayerIcon: React.FC<{ type: string, assetsBasePath: string }> = ({ type, assetsBasePath }) => {
  const hexPoints = "100,50 75,93.3 25,93.3 0,50 25,6.7 75,6.7";
  const green = "#7cb342";
  
  if (type === 'terrain') {
    return <img src={`local://file?path=${encodeURIComponent(assetsBasePath + '/styles/Hollow Moon/tiles/Terrain/hex_mountains.png')}`} style={{width: 20, height: 20, objectFit: 'contain'}} alt="Terrain" />;
  }
  
  if (type === 'river') {
    return (
      <svg width="20" height="20" viewBox="0 0 100 100">
        <polygon points={hexPoints} fill={green} />
        <path d="M 0,50 Q 50,30 100,50" fill="none" stroke="#3b82f6" strokeWidth="15" />
      </svg>
    );
  }
  
  if (type === 'road') {
    return (
      <svg width="20" height="20" viewBox="0 0 100 100">
        <polygon points={hexPoints} fill={green} />
        <path d="M 0,70 L 100,30" fill="none" stroke="#222" strokeWidth="12" />
      </svg>
    );
  }
  
  if (type === 'coastline') {
    return (
      <svg width="20" height="20" viewBox="0 0 100 100">
        <defs>
          <clipPath id="coastlineClip">
            <polygon points={hexPoints} />
          </clipPath>
        </defs>
        <polygon points={hexPoints} fill="#3b82f6" />
        <polygon points="0,0 50,0 50,100 0,100" fill={green} clipPath="url(#coastlineClip)" />
      </svg>
    );
  }
  
  if (type === 'border') {
    return (
      <svg width="20" height="20" viewBox="0 0 100 100">
        <polygon points={hexPoints} fill={green} />
        <polyline points="25,6.7 0,50 25,93.3 75,93.3" fill="none" stroke="#dc2626" strokeWidth="10" strokeLinejoin="round" />
      </svg>
    );
  }
  
  if (type === 'label') {
    return (
      <svg width="20" height="20" viewBox="0 0 100 100">
        <polygon points={hexPoints} fill={green} />
        <text x="50" y="65" fontSize="55" fontWeight="bold" fill="#222" textAnchor="middle">T</text>
      </svg>
    );
  }
  
  if (type === 'legend') {
    return (
      <svg width="20" height="20" viewBox="0 0 100 100">
        <polygon points={hexPoints} fill={green} />
        <text x="50" y="65" fontSize="55" fontWeight="bold" fill="#222" textAnchor="middle">L</text>
      </svg>
    );
  }
  
  if (type === 'grid') {
    return (
      <svg width="20" height="20" viewBox="0 0 100 100">
        <polygon points={hexPoints} fill="none" stroke="#ffffff" strokeWidth="8" />
      </svg>
    );
  }
  
  if (type === 'cliff') {
    return (
      <svg width="20" height="20" viewBox="0 0 100 100">
        <polygon points={hexPoints} fill={green} />
        <path d="M 0,50 L 100,50" stroke="#555" strokeWidth="6" />
        <path d="M 20,50 L 20,30 M 40,50 L 40,30 M 60,50 L 60,30 M 80,50 L 80,30" stroke="#555" strokeWidth="4" />
      </svg>
    );
  }
  
  if (type === 'bg_image') {
    return <span style={{fontSize: '16px', lineHeight: '20px'}}>🖼️</span>;
  }
  
  if (type === 'city') {
    return (
      <svg width="20" height="20" viewBox="0 0 100 100">
        <polygon points={hexPoints} fill={green} />
        <path d="M 20,70 L 20,40 L 50,15 L 80,40 L 80,70 Z" fill="#444" />
        <rect x="40" y="50" width="20" height="20" fill="#222" />
      </svg>
    );
  }

  if (type === 'group') {
    return <span style={{fontSize: '16px', lineHeight: '20px'}}>📁</span>;
  }

  return <span style={{fontSize: '16px', lineHeight: '20px'}}>📄</span>;
};
