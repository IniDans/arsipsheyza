'use strict';
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { app, BrowserWindow, Menu, dialog, protocol, net } = require('electron');

app.setAppUserModelId('id.sekolah.arsipku');

const isDev = !app.isPackaged && !!process.env.VITE_DEV_SERVER_URL;
const DIST = path.join(__dirname, '..', 'dist');

// Tampilan dimuat melalui protokol lokal app:// (bukan file://) agar
// worker PDF.js dan kebijakan keamanan berjalan dengan origin yang jelas.
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

function registerAppProtocol() {
  protocol.handle('app', (request) => {
    const { pathname } = new URL(request.url);
    const rel = decodeURIComponent(pathname).replace(/^\/+/, '') || 'index.html';
    const file = path.resolve(DIST, rel);
    if (file !== DIST && !file.startsWith(DIST + path.sep)) {
      return new Response('Not found', { status: 404 });
    }
    return net.fetch(pathToFileURL(file).toString());
  });
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  const { ensureDirs } = require('./paths');
  const db = require('./db');
  const ipc = require('./ipc');
  const logger = require('./logger');
  const windowRef = require('./window');

  process.on('uncaughtException', (err) => logger.error('uncaughtException', err));
  process.on('unhandledRejection', (err) => logger.error('unhandledRejection', err));

  function createWindow() {
    const win = new BrowserWindow({
      width: 1360,
      height: 860,
      minWidth: 1100,
      minHeight: 680,
      show: false,
      title: 'ARSIPKU',
      backgroundColor: '#f1f5f9',
      icon: path.join(__dirname, 'assets', 'icon.png'),
      autoHideMenuBar: true,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        spellcheck: false,
        devTools: isDev,
      },
    });
    windowRef.set(win);

    win.once('ready-to-show', () => {
      win.maximize();
      win.show();
    });

    // Aplikasi tidak boleh membuka halaman web dari dalam jendela.
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    win.webContents.on('will-navigate', (event, url) => {
      if (isDev && url.startsWith(process.env.VITE_DEV_SERVER_URL)) return;
      event.preventDefault();
    });

    if (isDev) {
      win.loadURL(process.env.VITE_DEV_SERVER_URL);
    } else {
      win.loadURL('app://arsipku/index.html');
    }
    return win;
  }

  app.on('second-instance', () => {
    const win = windowRef.get();
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    registerAppProtocol();
    try {
      ensureDirs();
      db.open();
    } catch (err) {
      logger.error('Gagal memulai aplikasi', err);
      dialog.showErrorBox('ARSIPKU gagal dimulai', `Database tidak dapat dibuka.\n\n${err.message}`);
      app.quit();
      return;
    }
    ipc.register();
    createWindow();
    logger.info(`ARSIPKU ${app.getVersion()} dimulai`);
  });

  app.on('window-all-closed', () => {
    db.close();
    app.quit();
  });
}
