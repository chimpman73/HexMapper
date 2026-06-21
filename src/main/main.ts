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
      
      try {
        await fs.promises.access(filePath, fs.constants.F_OK);
      } catch {
        return new Response('File not found', { status: 404 });
      }
      
      const fileData = await fs.promises.readFile(filePath);
      
      let contentType = 'application/octet-stream';
      if (filePath.toLowerCase().endsWith('.png')) contentType = 'image/png';
      else if (filePath.toLowerCase().endsWith('.jpg') || filePath.toLowerCase().endsWith('.jpeg')) contentType = 'image/jpeg';
      else if (filePath.toLowerCase().endsWith('.json')) contentType = 'application/json';
      
      return new Response(fileData, {
        headers: { 'Content-Type': contentType }
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
  return new Promise((resolve) => {
    if (!args || typeof args !== 'object') {
      return resolve({ success: false, error: 'Invalid arguments provided to Python script.', code: 'INVALID_ARGS' });
    }

    const scriptPath = path.join(app.getAppPath(), 'backend', 'main.py');
    const pythonProcess = spawn('python', [scriptPath]);
    
    let stdoutData = '';
    let stderrData = '';
    let stdoutBuffer = '';

    const timer = setTimeout(() => {
      pythonProcess.kill();
      resolve({ success: false, error: 'Python script execution timed out.', code: 'PYTHON_TIMEOUT' });
    }, 300000); // 5 minutes

    pythonProcess.stdout.on('data', (data) => {
      stdoutBuffer += data.toString();
      let newlineIdx;
      while ((newlineIdx = stdoutBuffer.indexOf('\n')) !== -1) {
        const line = stdoutBuffer.slice(0, newlineIdx);
        stdoutBuffer = stdoutBuffer.slice(newlineIdx + 1);
        if (!line.trim()) continue;
        
        try {
          const parsed = JSON.parse(line);
          if (parsed.progress) {
            if (mainWindow) {
              mainWindow.webContents.send('python-progress', parsed);
            }
            continue;
          }
        } catch (e) {}
        
        stdoutData += line + '\n';
      }
    });

    pythonProcess.stderr.on('data', (data) => {
      stderrData += data.toString();
    });

    pythonProcess.on('close', (code) => {
      clearTimeout(timer);
      if (stdoutBuffer.trim()) {
        stdoutData += stdoutBuffer + '\n';
      }
      
      if (code !== 0) {
        resolve({ success: false, error: `Python process exited with code ${code}: ${stderrData}`, code: 'PYTHON_EXIT_ERROR' });
      } else {
        try {
          const result = JSON.parse(stdoutData);
          // If python already returns success property, return it directly
          if (result && typeof result.success === 'boolean') {
            resolve(result);
          } else {
            resolve({ success: true, data: result });
          }
        } catch (e) {
          resolve({ success: false, error: 'Invalid JSON from Python backend: ' + stdoutData, code: 'INVALID_JSON' });
        }
      }
    });

    // Send args as JSON
    pythonProcess.stdin.write(JSON.stringify(args) + '\n');
    pythonProcess.stdin.end();
  });
});

ipcMain.handle('dialog:openDirectory', async () => {
  if (!mainWindow) return { success: false, error: 'No main window' };
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  if (canceled || filePaths.length === 0) return { success: false, canceled: true };
  return { success: true, data: filePaths[0] };
});

ipcMain.handle('dialog:openImage', async () => {
  if (!mainWindow) return { success: false, error: 'No main window' };
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Map Image',
    properties: ['openFile'],
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }]
  });
  if (canceled || filePaths.length === 0) return { success: false, canceled: true };
  return { success: true, data: filePaths[0] };
});

ipcMain.handle('fs:readDir', async (event, dirPath: string) => {
  try {
    const files = await fs.promises.readdir(dirPath);
    const images = files.filter(f => f.toLowerCase().endsWith('.png') || f.toLowerCase().endsWith('.jpg'));
    return { success: true, data: images.map(f => path.join(dirPath, f).replace(/\\/g, '/')) };
  } catch (err: any) {
    console.error(err);
    return { success: false, error: err.message, data: [] };
  }
});

ipcMain.handle('fs:readMapDescription', async (event, targetPath: string) => {
  try {
    const stat = await fs.promises.stat(targetPath);
    const dirPath = stat.isDirectory() ? targetPath : path.dirname(targetPath);
    const descPath = path.join(dirPath, 'map_description.json');
    if (!fs.existsSync(descPath)) return { success: true, data: null };
    const data = await fs.promises.readFile(descPath, 'utf-8');
    return { success: true, data: JSON.parse(data) };
  } catch (err: any) {
    console.error(err);
    return { success: false, error: err.message, data: null };
  }
});

ipcMain.handle('fs:getAssetsBasePath', () => {
  return { success: true, data: path.join(app.getAppPath(), 'assets').replace(/\\/g, '/') };
});

ipcMain.handle('fs:getStyles', async () => {
  try {
    const stylesDir = path.join(app.getAppPath(), 'assets', 'styles');
    if (!fs.existsSync(stylesDir)) return { success: true, data: ['Hollow Moon'] };
    const entries = await fs.promises.readdir(stylesDir, { withFileTypes: true });
    return { success: true, data: entries.filter(e => e.isDirectory()).map(e => e.name) };
  } catch (err: any) {
    console.error('Error reading styles:', err);
    return { success: false, error: err.message, data: ['Hollow Moon'] };
  }
});

ipcMain.handle('fs:getDefaultTiles', async (event, style: string = 'Hollow Moon', folder: string = 'Terrain') => {
  try {
    const dirPath = path.join(app.getAppPath(), 'assets', 'styles', style, 'tiles', folder);
    if (!fs.existsSync(dirPath)) return { success: true, data: [] };
    const files = await fs.promises.readdir(dirPath);
    const images = files.filter(f => f.toLowerCase().endsWith('.png') || f.toLowerCase().endsWith('.jpg'));
    return { success: true, data: images.map(f => path.join(dirPath, f).replace(/\\/g, '/')) };
  } catch (err: any) {
    console.error(err);
    return { success: false, error: err.message, data: [] };
  }
});

ipcMain.handle('fs:getSystemFonts', async () => {
  try {
    const fontManager = require('font-list');
    const fonts = await fontManager.getFonts();
    return { success: true, data: fonts.map((f: string) => f.replace(/"/g, '')) };
  } catch (err: any) {
    console.error('Error fetching system fonts:', err);
    return { success: false, error: err.message, data: ['Arial', 'Times New Roman', 'Courier New', 'Verdana', 'Georgia', 'Comic Sans MS'] };
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
    return { success: true, data: { filePath } };
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
    return { success: true, data: { data, filePath: filePaths[0] } };
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
    return { success: true, data: { filePath } };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});
