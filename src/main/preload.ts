import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  runPythonScript: (args: any) => ipcRenderer.invoke('run-python-script', args),
  openDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),
  openImage: () => ipcRenderer.invoke('dialog:openImage'),
  readDir: (dirPath: string) => ipcRenderer.invoke('fs:readDir', dirPath),
  readMapDescription: (targetPath: string) => ipcRenderer.invoke('fs:readMapDescription', targetPath),
  getStyles: () => ipcRenderer.invoke('fs:getStyles'),
  getAssetsBasePath: () => ipcRenderer.invoke('fs:getAssetsBasePath'),
  getDefaultTiles: (style?: string, folder?: string) => ipcRenderer.invoke('fs:getDefaultTiles', style, folder),
  saveMap: (dataString: string) => ipcRenderer.invoke('map:save', dataString),
  loadMap: () => ipcRenderer.invoke('map:load'),
  exportImage: (dataUrl: string) => ipcRenderer.invoke('map:exportImage', dataUrl),
});
