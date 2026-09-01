const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('planwerkFile', {
  loadCurrent: () => ipcRenderer.invoke('planwerk:load-current'),
  create: (options) => ipcRenderer.invoke('planwerk:create', options),
  open: () => ipcRenderer.invoke('planwerk:open'),
  close: () => ipcRenderer.invoke('planwerk:close'),
  save: (data, options) => ipcRenderer.invoke('planwerk:save', data, options),
  copyExternalVersion: (options) => ipcRenderer.invoke('planwerk:copy-external-version', options),
  getInfo: () => ipcRenderer.invoke('planwerk:get-info'),
  onExternalChange: (handler) => {
    const listener = (_event, payload) => handler(payload);
    ipcRenderer.on('planwerk:external-change', listener);
    return () => ipcRenderer.removeListener('planwerk:external-change', listener);
  },
  onFileOpened: (handler) => {
    const listener = (_event, payload) => handler(payload);
    ipcRenderer.on('planwerk:file-opened', listener);
    return () => ipcRenderer.removeListener('planwerk:file-opened', listener);
  },
});

contextBridge.exposeInMainWorld('planwerkClipboard', {
  writeText: (text) => ipcRenderer.invoke('planwerk:write-clipboard-text', text),
});

contextBridge.exposeInMainWorld('planwerkMcp', {
  getStatus: () => ipcRenderer.invoke('planwerk:mcp-get-status'),
  setEnabled: (enabled) => ipcRenderer.invoke('planwerk:mcp-set-enabled', enabled),
  regenerateToken: () => ipcRenderer.invoke('planwerk:mcp-regenerate-token'),
});

contextBridge.exposeInMainWorld('planwerkUpdater', {
  getStatus: () => ipcRenderer.invoke('planwerk:update-get-status'),
  setAutomaticUpdatesEnabled: (enabled) => ipcRenderer.invoke('planwerk:update-set-automatic', enabled),
  checkNow: () => ipcRenderer.invoke('planwerk:update-check-now'),
  dismissAvailableVersion: (version) => ipcRenderer.invoke('planwerk:update-dismiss-version', version),
  openReleasePage: (version) => ipcRenderer.invoke('planwerk:update-open-release-page', version),
  onStatus: (handler) => {
    const listener = (_event, payload) => handler(payload);
    ipcRenderer.on('planwerk:update-status', listener);
    return () => ipcRenderer.removeListener('planwerk:update-status', listener);
  },
});
