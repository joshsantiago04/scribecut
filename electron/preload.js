const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openFile:      () => ipcRenderer.invoke('dialog:open-file'),
  openDirectory: () => ipcRenderer.invoke('dialog:open-directory'),
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close:    () => ipcRenderer.send('window:close'),
});
