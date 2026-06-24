import { useEffect } from 'react';
import { useMapStore } from '../store/mapStore';
import { generateRectangularGrid, buildHexEdgeGraph, findHexEdgePath } from '../utils/hexMath';

export const useMapScanner = () => {
  useEffect(() => {
    window.api.onPythonProgress((data) => {
      const state = useMapStore.getState();
      if (data.percent !== undefined) state.setScanProgress(data.percent);
      if (data.message !== undefined) state.setScanMessage(data.message);
    });
    return () => window.api.removePythonProgress();
  }, []);

  const handleImportImageSelect = async () => {
    const state = useMapStore.getState();
    state.setShowImportModal(false);
    const imagePathRes = await window.api.openImage();
    if (!imagePathRes || !imagePathRes.success || !imagePathRes.data) {
      if (imagePathRes && !imagePathRes.success && !imagePathRes.canceled) {
        state.setToastMessage({ type: 'error', text: `Failed to open image: ${imagePathRes.error || 'Unknown error'}` });
      }
      return;
    }
    const imagePath = imagePathRes.data;
    state.setImportDirPath(null);
    state.setImportType('image');
    
    const descRes = await window.api.readMapDescription(imagePath);
    const desc = descRes?.success ? descRes.data : null;
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
    const dirPathRes = await window.api.openDirectory();
    if (!dirPathRes || !dirPathRes.success || !dirPathRes.data) {
      if (dirPathRes && !dirPathRes.success && !dirPathRes.canceled) {
        state.setToastMessage({ type: 'error', text: `Failed to open directory: ${dirPathRes.error || 'Unknown error'}` });
      }
      return;
    }
    const dirPath = dirPathRes.data;
    
    state.setImportDirPath(dirPath);
    state.setImportType('directory');
    
    const descRes = await window.api.readMapDescription(dirPath);
    const desc = descRes?.success ? descRes.data : null;
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
    
    const filesRes = await window.api.readDir(dirPath);
    if (filesRes && !filesRes.success && !filesRes.canceled) {
      state.setToastMessage({ type: 'error', text: `Failed to read directory: ${filesRes.error || 'Unknown error'}` });
    }
    const files = filesRes?.success && filesRes.data ? filesRes.data : [];
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
    state.setScanProgress(0);
    state.setScanMessage('Starting scan...');
    try {
      const res = await window.api.runPythonScript({ 
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
      console.log('Scanner result:', res);
      if (res.success && res.data) {
        const payload = res.data;
        if (payload.status === 'success' && payload.data && payload.data.layers) {
          let newLayers = payload.data.layers;
          
          state.setLayers(newLayers);
          if (payload.data.globalCoastlines) {
            state.setGlobalCoastlines(payload.data.globalCoastlines);
          }
          if (payload.data.globalBorders) {
            state.setGlobalBorders(payload.data.globalBorders);
          }
          if (payload.data.unknowns) {
            state.setUnknowns(payload.data.unknowns);
          }
          state.setImportDirPath(null);
          state.setImportType(null);
          state.setToastMessage({ type: 'success', text: state.importType === 'directory' ? 'Directory scanned successfully!' : 'Image scanned successfully!' });
        } else {
          state.setToastMessage({ type: 'error', text: 'Scan failed: ' + (payload.message || payload.error || 'Unknown error') });
        }
      } else {
        state.setToastMessage({ type: 'error', text: 'Scan IPC failed: ' + (res.error || 'Unknown IPC error') });
      }
    } catch (err: any) {
      state.setToastMessage({ type: 'error', text: 'Error during scan: ' + (err.message || err) });
    } finally {
      state.setIsScanning(false);
      state.setScanProgress(null);
      state.setScanMessage(null);
    }
  };

  return { handleImportImageSelect, handleImportDirectorySelect, handleScanAlignedMap };
};
