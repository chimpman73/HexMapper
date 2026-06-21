const fs = require('fs');
const path = require('path');

function generateLargeMap(width, height) {
  const data = {};
  
  const terrainOptions = [
    'Terrain/hex_101.png',
    'Terrain/hex_102.png',
    'Terrain/hex_103.png',
  ];

  for (let q = 0; q < width; q++) {
    const offset = Math.floor(q / 2);
    for (let row = 0; row < height; row++) {
      const r = row - offset;
      const s = -q - r;
      const key = `${q},${r},${s}`;
      data[key] = terrainOptions[Math.floor(Math.random() * terrainOptions.length)];
    }
  }

  const map = {
    mapWidth: width,
    mapHeight: height,
    orientation: 'flat',
    layers: [
      {
        id: '1',
        name: 'Terrain',
        type: 'terrain',
        visible: true,
        opacity: 1,
        data: data
      },
      { id: '2', name: 'Coastline', type: 'coastline', visible: true, opacity: 1, data: [] },
      { id: '3', name: 'Cliffs', type: 'cliff', visible: true, opacity: 1, data: { lines: [], hexes: {} } },
      { id: '4', name: 'Rivers', type: 'river', visible: true, opacity: 1, data: [] },
      { id: '5', name: 'Roads', type: 'road', visible: true, opacity: 1, data: [] },
      { id: '6', name: 'Cities', type: 'city', visible: true, opacity: 1, data: {} },
      { id: '7', name: 'Hex Grid', type: 'grid', visible: true, opacity: 1, data: {} },
      { id: '8', name: 'Borders', type: 'border', visible: true, opacity: 1, data: [] },
      { id: '9', name: 'Labels', type: 'label', visible: true, opacity: 1, data: [] }
    ]
  };

  const outPath = path.join(__dirname, '..', 'large_benchmark_map.json');
  fs.writeFileSync(outPath, JSON.stringify(map, null, 2));
  console.log(`Successfully generated ${width}x${height} map with ${width * height} hexes at ${outPath}`);
}

generateLargeMap(300, 300);
