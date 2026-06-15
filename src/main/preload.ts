import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  runPythonScript: (args: any) => ipcRenderer.invoke('run-python-script', args),
  openDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),
  readDir: (dirPath: string) => ipcRenderer.invoke('fs:readDir', dirPath),
  getDefaultTiles: (folder?: string) => ipcRenderer.invoke('fs:getDefaultTiles', folder),
  saveMap: (dataString: string) => ipcRenderer.invoke('map:save', dataString),
  loadMap: () => ipcRenderer.invoke('map:load'),
  exportImage: (dataUrl: string) => ipcRenderer.invoke('map:exportImage', dataUrl),
});
