const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('pet', {
  walk: dx => ipcRenderer.invoke('pet:walk', dx),
  ignoreMouse: ignore => ipcRenderer.send('pet:ignore-mouse', ignore),
  dragStart: () => ipcRenderer.send('pet:drag-start'),
  dragMove: () => ipcRenderer.send('pet:drag-move'),
  dragEnd: () => ipcRenderer.send('pet:drag-end'),
  menu: () => ipcRenderer.send('pet:menu'),
  onStudy: callback => ipcRenderer.on('pet:study', (_event, status) => callback(status)),
  getFaceSetting: () => ipcRenderer.invoke('pet:face-setting'),
  onFaceSetting: callback => ipcRenderer.on('pet:face-setting', (_event, value) => callback(value)),
  cameraAccess: () => ipcRenderer.invoke('pet:camera-access'),
  onMode: callback => ipcRenderer.on('pet:mode', (_event, mode) => callback(mode)),
});
