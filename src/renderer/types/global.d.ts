export {};

declare global {
  interface Window {
    api: {
      runPythonScript: (args: any) => Promise<any>;
      openDirectory: () => Promise<string | null>;
      openImage: () => Promise<string | null>;
      readDir: (dirPath: string) => Promise<string[]>;
      readMapDescription: (targetPath: string) => Promise<any | null>;
      saveMap: (dataString: string) => Promise<{ success: boolean; filePath?: string; canceled?: boolean; error?: string }>;
      loadMap: () => Promise<{ success: boolean; data?: string; filePath?: string; canceled?: boolean; error?: string }>;
      exportImage: (dataUrl: string) => Promise<{ success: boolean; filePath?: string; canceled?: boolean; error?: string }>;
      getStyles: () => Promise<string[]>;
      getAssetsBasePath: () => Promise<string>;
      onPythonProgress: (callback: (data: any) => void) => void;
      removePythonProgress: () => void;
    };
    electron: {
      ipcRenderer: {
        invoke: (channel: string, data: any) => Promise<any>;
      }
    };
  }
}
