import { app, BrowserWindow, ipcMain, protocol, net, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { pathToFileURL } from 'url';
import { spawn } from 'child_process';

let mainWindow: BrowserWindow | null = null;

protocol.registerSchemesAsPrivileged([
  { scheme: 'local', privileges: { standard: true, secure: true, supportFetchAPI: true, bypassCSP: true } }
]);

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Always load localhost in development
  mainWindow.loadURL('http://localhost:5173');
  mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
  protocol.handle('local', async (request) => {
    try {
      const urlObj = new URL(request.url);
      const filePath = urlObj.searchParams.get('path');
      if (!filePath) {
        return new Response('Missing path', { status: 400 });
      }
      
      const fileData = await fs.promises.readFile(filePath);
      return new Response(fileData, {
        headers: { 'Content-Type': 'image/png' }
      });
    } catch (e) {
      console.error(e);
      return new Response('Error', { status: 500 });
    }
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.handle('run-python-script', async (event, args) => {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(app.getAppPath(), 'backend', 'main.py');
    
    // Using the user's global python since venv might not be configured identically yet
    const pythonProcess = spawn('python', [scriptPath]);
    
    let stdoutData = '';
    let stderrData = '';

    pythonProcess.stdout.on('data', (data) => {
      stdoutData += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      stderrData += data.toString();
    });

    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Python process exited with code ${code}: ${stderrData}`));
      } else {
        try {
          const result = JSON.parse(stdoutData);
          resolve(result);
        } catch (e) {
          resolve({ rawOutput: stdoutData });
        }
      }
    });

    // Send args as JSON
    pythonProcess.stdin.write(JSON.stringify(args) + '\n');
    pythonProcess.stdin.end();
  });
});

ipcMain.handle('dialog:openDirectory', async () => {
  if (!mainWindow) return null;
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  if (canceled) return null;
  return filePaths[0];
});

ipcMain.handle('dialog:openImage', async () => {
  if (!mainWindow) return null;
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Map Image',
    properties: ['openFile'],
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }]
  });
  if (canceled || filePaths.length === 0) return null;
  return filePaths[0];
});

ipcMain.handle('fs:readDir', async (event, dirPath: string) => {
  try {
    const files = await fs.promises.readdir(dirPath);
    const images = files.filter(f => f.toLowerCase().endsWith('.png') || f.toLowerCase().endsWith('.jpg'));
    // Return absolute paths
    return images.map(f => path.join(dirPath, f).replace(/\\/g, '/'));
  } catch (err) {
    console.error(err);
    return [];
  }
});

ipcMain.handle('fs:readMapDescription', async (event, targetPath: string) => {
  try {
    const stat = await fs.promises.stat(targetPath);
    const dirPath = stat.isDirectory() ? targetPath : path.dirname(targetPath);
    const descPath = path.join(dirPath, 'map_description.json');
    if (!fs.existsSync(descPath)) return null;
    const data = await fs.promises.readFile(descPath, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    console.error(err);
    return null;
  }
});

ipcMain.handle('fs:getDefaultTiles', async (event, folder: string = 'Terrain') => {
  try {
    const dirPath = path.join(app.getAppPath(), 'assets', 'tiles', folder);
    if (!fs.existsSync(dirPath)) return [];
    const files = await fs.promises.readdir(dirPath);
    const images = files.filter(f => f.toLowerCase().endsWith('.png') || f.toLowerCase().endsWith('.jpg'));
    return images.map(f => path.join(dirPath, f).replace(/\\/g, '/'));
  } catch (err) {
    console.error(err);
    return [];
  }
});

ipcMain.handle('map:save', async (event, dataString: string) => {
  if (!mainWindow) return { success: false, error: 'No main window' };
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Save Map Project',
    filters: [{ name: 'HexMapper Project', extensions: ['json'] }]
  });
  if (canceled || !filePath) return { success: false, canceled: true };
  
  try {
    await fs.promises.writeFile(filePath, dataString, 'utf-8');
    return { success: true, filePath };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('map:load', async (event) => {
  if (!mainWindow) return { success: false, error: 'No main window' };
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Open Map Project',
    properties: ['openFile'],
    filters: [{ name: 'HexMapper Project', extensions: ['json'] }]
  });
  if (canceled || filePaths.length === 0) return { success: false, canceled: true };
  
  try {
    const data = await fs.promises.readFile(filePaths[0], 'utf-8');
    return { success: true, data, filePath: filePaths[0] };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('map:exportImage', async (event, dataUrl: string) => {
  if (!mainWindow) return { success: false, error: 'No main window' };
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Export Map as PNG',
    filters: [{ name: 'PNG Image', extensions: ['png'] }]
  });
  if (canceled || !filePath) return { success: false, canceled: true };
  
  try {
    const base64Data = dataUrl.replace(/^data:image\/png;base64,/, "");
    await fs.promises.writeFile(filePath, base64Data, 'base64');
    return { success: true, filePath };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});
