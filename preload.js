const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
	selectImages: () => ipcRenderer.invoke('select-images'),
	compressImages: (files) => ipcRenderer.invoke('compress-images', files)
});
