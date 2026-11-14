'use strict';
// Lokasi data aplikasi. Semua data berada di luar direktori instalasi
// sehingga aman ketika aplikasi diperbarui atau di-uninstall (PRD §7).
const fs = require('node:fs');
const path = require('node:path');
const { app } = require('electron');

let config = null;

function dataRoot() {
  if (process.env.ARSIPKU_DATA_DIR) return path.resolve(process.env.ARSIPKU_DATA_DIR);
  return path.join(app.getPath('documents'), 'ARSIPKU');
}

// Konfigurasi lokasi bersifat spesifik per-komputer, sehingga disimpan di
// luar database. Restore database dari komputer lain tidak akan menimpa
// lokasi penyimpanan dokumen/backup di komputer ini.
function configFile() {
  return path.join(dataRoot(), 'arsipku.config.json');
}

function defaults() {
  const root = dataRoot();
  return {
    documentsDir: path.join(root, 'documents'),
    backupDir: path.join(root, 'backup'),
  };
}

function loadConfig() {
  if (config) return config;
  config = defaults();
  try {
    const raw = JSON.parse(fs.readFileSync(configFile(), 'utf8'));
    if (raw && typeof raw.documentsDir === 'string' && raw.documentsDir) config.documentsDir = raw.documentsDir;
    if (raw && typeof raw.backupDir === 'string' && raw.backupDir) config.backupDir = raw.backupDir;
  } catch {
    // file belum ada: gunakan default
  }
  return config;
}

function saveConfig(patch) {
  const next = { ...loadConfig(), ...patch };
  const tmp = configFile() + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(next, null, 2), 'utf8');
  fs.renameSync(tmp, configFile());
  config = next;
  return config;
}

const paths = {
  root: () => dataRoot(),
  databaseDir: () => path.join(dataRoot(), 'database'),
  databaseFile: () => path.join(dataRoot(), 'database', 'arsipku.db'),
  logsDir: () => path.join(dataRoot(), 'logs'),
  tempDir: () => path.join(dataRoot(), 'tmp'),
  documentsDir: () => loadConfig().documentsDir,
  backupDir: () => loadConfig().backupDir,
};

function ensureDirs() {
  for (const dir of [paths.root(), paths.databaseDir(), paths.logsDir(), paths.tempDir(), paths.documentsDir(), paths.backupDir()]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

module.exports = { paths, ensureDirs, loadConfig, saveConfig };
