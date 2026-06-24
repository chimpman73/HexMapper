import { useMapStore } from '../store/mapStore';
import { MapLayer } from '../types';

export const useProjectStorage = (engineRef: React.RefObject<any>) => {
  const handleSaveProject = async () => {
    const state = useMapStore.getState();
    
    const now = new Date();
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const formattedDate = `${months[now.getMonth()]} ${String(now.getDate()).padStart(2, '0')}, ${now.getFullYear()}`;
    
    state.setMapVariables({ dateLastSaved: formattedDate });

    const projectData = {
      layers: state.layers,
      mapWidth: state.mapWidth,
      mapHeight: state.mapHeight,
      orientation: state.orientation,
      mapVariables: { ...state.mapVariables, dateLastSaved: formattedDate },
      bgScaleX: state.bgScaleX,
      bgScaleY: state.bgScaleY,
      bgOffsetX: state.bgOffsetX,
      bgOffsetY: state.bgOffsetY
    };
    const result = await window.api.saveMap(JSON.stringify(projectData, null, 2));
    if (result.success) {
      state.setToastMessage({ type: 'success', text: `Project saved to ${result.filePath}` });
    } else if (result.error) {
      state.setToastMessage({ type: 'error', text: `Save failed: ${result.error}` });
    }
  };

  const handleLoadProject = async () => {
    const result = await window.api.loadMap();
    const jsonString = typeof result.data === 'string' ? result.data : (result.data as any)?.data;
    if (result.success && jsonString) {
      try {
        const projectData = JSON.parse(jsonString);
        if (projectData.layers) {
          let loadedLayers = projectData.layers as MapLayer[];
          if (!loadedLayers.some(l => l.type === 'grid')) {
            const gridLayer: MapLayer = { id: '8', name: 'Hex Grid', type: 'grid', visible: true, opacity: 1, data: {} };
            const citiesIdx = loadedLayers.findIndex(l => l.type === 'city');
            if (citiesIdx !== -1) {
              loadedLayers.splice(citiesIdx, 0, gridLayer);
            } else {
              loadedLayers.push(gridLayer);
            }
          }
          
          if (!loadedLayers.some(l => l.type === 'legend')) {
            const legendLayer: MapLayer = { id: `legend_${Date.now()}`, name: 'Legend', type: 'legend', visible: true, opacity: 1, data: [] };
            loadedLayers.push(legendLayer);
          }
          
          // Migrate legacy cliff layers
          loadedLayers = loadedLayers.map(l => {
            if (l.type === 'cliff' && Array.isArray(l.data)) {
              return { ...l, data: { lines: l.data, hexes: {} } };
            }
            if (l.type === 'cliff' && !l.data) {
              return { ...l, data: { lines: [], hexes: {} } };
            }
            return l;
          });
          
          useMapStore.getState().setLayers(loadedLayers);

          // Calculate the max extent of the loaded hexes
          let maxQ = 25;
          let maxR = 20;

          loadedLayers.forEach(l => {
            if ((l.type === 'terrain' || l.type === 'city' || l.type === 'coastline' || l.type === 'border' || l.type === 'grid') && l.data) {
              for (const key in l.data) {
                const [q, r] = key.split(',').map(Number);
                if (!isNaN(q) && q + 1 > maxQ) maxQ = q + 1;
                if (!isNaN(r) && r + 1 > maxR) maxR = r + 1;
              }
            } else if (l.type === 'cliff' && l.data && l.data.hexes) {
              for (const key in l.data.hexes) {
                const [q, r] = key.split(',').map(Number);
                if (!isNaN(q) && q + 1 > maxQ) maxQ = q + 1;
                if (!isNaN(r) && r + 1 > maxR) maxR = r + 1;
              }
            }
          });

          if (projectData.mapWidth) {
             useMapStore.getState().setMapWidth(Math.max(projectData.mapWidth, maxQ));
          } else {
             useMapStore.getState().setMapWidth(maxQ);
          }

          if (projectData.mapHeight) {
             useMapStore.getState().setMapHeight(Math.max(projectData.mapHeight, maxR));
          } else {
             useMapStore.getState().setMapHeight(maxR);
          }
          
          if (projectData.orientation) useMapStore.getState().setOrientation(projectData.orientation);
          
          if (projectData.mapVariables) {
            useMapStore.getState().setMapVariables(projectData.mapVariables);
          } else {
            // Apply defaults for older saves
            useMapStore.getState().setMapVariables({ fontName: 'Arial', hexSize: 1, hexUnit: 'miles' });
          }

          if (projectData.bgScaleX !== undefined) useMapStore.getState().setBgScaleX(projectData.bgScaleX);
          if (projectData.bgScaleY !== undefined) useMapStore.getState().setBgScaleY(projectData.bgScaleY);
          if (projectData.bgOffsetX !== undefined) useMapStore.getState().setBgOffsetX(projectData.bgOffsetX);
          if (projectData.bgOffsetY !== undefined) useMapStore.getState().setBgOffsetY(projectData.bgOffsetY);
        }
      } catch (err: any) {
        useMapStore.getState().setToastMessage({ type: 'error', text: 'Invalid project file: ' + err.message });
      }
    } else if (!result.success && !result.canceled) {
      useMapStore.getState().setToastMessage({ type: 'error', text: `Failed to load project: ${result.error || 'Unknown error'}` });
    }
  };

  const handleExportImage = async () => {
    if (engineRef.current) {
      const dataUrl = engineRef.current.exportToDataURL();
      if (dataUrl) {
        const result = await window.api.exportImage(dataUrl);
        if (result.success) {
          useMapStore.getState().setToastMessage({ type: 'success', text: `Exported to ${result.filePath}` });
        } else if (result.error) {
          useMapStore.getState().setToastMessage({ type: 'error', text: `Export failed: ${result.error}` });
        }
      }
    }
  };

  return { handleSaveProject, handleLoadProject, handleExportImage };
};
