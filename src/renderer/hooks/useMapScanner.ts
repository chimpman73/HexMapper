import { useMapStore } from '../store/mapStore';
import { generateRectangularGrid, buildHexEdgeGraph, findHexEdgePath } from '../utils/hexMath';

export const useMapScanner = () => {
  const handleImportImageSelect = async () => {
    const state = useMapStore.getState();
    state.setShowImportModal(false);
    const imagePath = await window.api.openImage();
    if (!imagePath) return;
    state.setImportDirPath(null);
    state.setImportType('image');
    
    const desc = await window.api.readMapDescription(imagePath);
    if (desc) {
      if (desc['Default Style']) state.setCurrentStyle(desc['Default Style']);
      state.setBgScaleX(desc['Scale x'] !== undefined ? desc['Scale x'] : 1);
      state.setBgScaleY(desc['Scale y'] !== undefined ? desc['Scale y'] : 1);
      state.setBgOffsetX(desc['Offset X'] !== undefined ? desc['Offset X'] : 0);
      state.setBgOffsetY(desc['Offset Y'] !== undefined ? desc['Offset Y'] : 0);
    } else {
      state.setBgScaleX(1);
      state.setBgScaleY(1);
      state.setBgOffsetX(0);
      state.setBgOffsetY(0);
    }
    
    const filename = imagePath.split(/[/\\]/).pop() || 'Background';
    const basename = filename.split('.').slice(0, -1).join('.') || filename;
    const groupId = `group_${Date.now()}`;
    const groupLayer = {
      id: groupId,
      name: 'Reference Images',
      type: 'group' as const,
      visible: true,
      opacity: 1,
      data: {}
    };

    const newBgLayer = {
      id: `bg_${Date.now()}`,
      name: basename,
      type: 'bg_image' as const,
      visible: true,
      opacity: 1,
      parentId: groupId,
      sourceFilename: basename,
      data: { imagePath }
    };
    
    state.setLayers([newBgLayer, groupLayer, ...state.layers]);
  };

  const handleImportDirectorySelect = async () => {
    const state = useMapStore.getState();
    state.setShowImportModal(false);
    const dirPath = await window.api.openDirectory();
    if (!dirPath) return;
    
    state.setImportDirPath(dirPath);
    state.setImportType('directory');
    
    const desc = await window.api.readMapDescription(dirPath);
    if (desc) {
      if (desc['Default Style']) state.setCurrentStyle(desc['Default Style']);
      state.setBgScaleX(desc['Scale x'] !== undefined ? desc['Scale x'] : 1);
      state.setBgScaleY(desc['Scale y'] !== undefined ? desc['Scale y'] : 1);
      state.setBgOffsetX(desc['Offset X'] !== undefined ? desc['Offset X'] : 0);
      state.setBgOffsetY(desc['Offset Y'] !== undefined ? desc['Offset Y'] : 0);
    } else {
      state.setBgScaleX(1);
      state.setBgScaleY(1);
      state.setBgOffsetX(0);
      state.setBgOffsetY(0);
    }
    
    const files = await window.api.readDir(dirPath);
    const groupId = `group_${Date.now()}`;
    const groupLayer = {
      id: groupId,
      name: 'Reference Images',
      type: 'group' as const,
      visible: true,
      opacity: 1,
      data: {}
    };

    const newBgLayers = files.map((file, i) => {
      const filename = file.split(/[/\\]/).pop() || `Layer ${i}`;
      const basename = filename.split('.').slice(0, -1).join('.') || filename;
      return {
        id: `bg_${Date.now()}_${i}`,
        name: basename,
        type: 'bg_image' as const,
        visible: true,
        opacity: 1,
        parentId: groupId,
        sourceFilename: basename,
        data: { imagePath: file }
      };
    });
    
    state.setLayers([...newBgLayers, groupLayer, ...state.layers]);
  };

  const handleScanAlignedMap = async () => {
    const state = useMapStore.getState();
    const firstBgImagePath = state.layers.find(l => l.type === 'bg_image')?.data?.imagePath;
    
    if (state.importType === 'image' && !firstBgImagePath) return;
    if (state.importType === 'directory' && !state.importDirPath) return;
    
    state.setIsScanning(true);
    try {
      const result = await window.api.runPythonScript({ 
        action: 'interpret', 
        mode: state.importType === 'directory' ? 'multi_layer' : 'composite',
        imagePath: state.importType === 'directory' ? state.importDirPath : firstBgImagePath,
        bgScaleX: state.bgScaleX,
        bgScaleY: state.bgScaleY,
        bgOffsetX: state.bgOffsetX,
        bgOffsetY: state.bgOffsetY,
        mapWidth: state.mapWidth,
        mapHeight: state.mapHeight,
        orientation: state.orientation,
        layers: state.layers
      });
      console.log('Scanner result:', result);
      if (result.status === 'success' && result.data && result.data.layers) {
        let newLayers = result.data.layers;
        
        // Auto-snap any newly imported borders that were detected as snapped
        const borderLayer = newLayers.find((l: any) => l.type === 'border');
        if (borderLayer && Array.isArray(borderLayer.data)) {
           const grid = generateRectangularGrid(state.mapWidth, state.mapHeight, state.orientation);
           const graph = buildHexEdgeGraph(state.orientation, grid);
           borderLayer.data = borderLayer.data.map((line: any) => {
              if (line.borderStyle === 'snapped' && line.points.length >= 4) {
                 let newPoints: number[] = [];
                 for (let i = 0; i < line.points.length - 2; i += 2) {
                     const p1 = {x: line.points[i], y: line.points[i+1]};
                     const p2 = {x: line.points[i+2], y: line.points[i+3]};
                     const path = findHexEdgePath(p1, p2, graph);
                     if (i === 0) newPoints.push(path[0], path[1]);
                     newPoints.push(...path.slice(2));
                 }
                 return { ...line, points: newPoints };
              }
              return line;
           });
        }
        
        state.setLayers(newLayers);
        if (result.data.globalCoastlines) {
          state.setGlobalCoastlines(result.data.globalCoastlines);
        }
        if (result.data.globalBorders) {
          state.setGlobalBorders(result.data.globalBorders);
        }
        if (result.data.unknowns) {
          state.setUnknowns(result.data.unknowns);
        }
        state.setImportDirPath(null);
        state.setImportType(null);
        alert(state.importType === 'directory' ? 'Directory scanned successfully!' : 'Image scanned successfully!');
      } else {
        alert('Scan failed: ' + (result.message || 'Unknown error'));
      }
    } catch (err) {
      console.error(err);
      alert('Error during scan');
    } finally {
      state.setIsScanning(false);
    }
  };

  return { handleImportImageSelect, handleImportDirectorySelect, handleScanAlignedMap };
};
