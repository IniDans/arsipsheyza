'use strict';
const { contextBridge, ipcRenderer } = require('electron');

// Hanya fungsi pemanggil IPC yang diekspos ke tampilan; tidak ada akses
// langsung ke Node.js, sistem file, maupun database dari renderer.
contextBridge.exposeInMainWorld('arsipku', {
  invoke: (channel, ...args) => {
    if (typeof channel !== 'string' || !/^[a-z]+:[A-Za-z]+$/.test(channel)) {
      return Promise.resolve({ ok: false, error: 'Perintah tidak valid.' });
    }
    return ipcRenderer.invoke(channel, ...args);
  },
});
