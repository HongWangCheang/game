const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('pet', {
  walk: dx => ipcRenderer.invoke('pet:walk', dx),
  ignoreMouse: ignore => ipcRenderer.send('pet:ignore-mouse', ignore),
  dragStart: () => ipcRenderer.send('pet:drag-start'),
  dragMove: () => ipcRenderer.send('pet:drag-move'),
  dragEnd: () => ipcRenderer.send('pet:drag-end'),
  menu: () => ipcRenderer.send('pet:menu'),
  onMode: callback => ipcRenderer.on('pet:mode', (_event, mode) => callback(mode)),
});
