'use strict';
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { app, dialog, shell } = require('electron');
const db = require('../db');
const session = require('../session');
const activity = require('./activity');
const windowRef = require('../window');
const { paths, saveConfig } = require('../paths');
const { fail } = require('../errors');

const EDITABLE = {
  app_name: 60,
  company_name: 150,
  company_reg_number: 50,
  company_address: 300,
  company_phone: 30,
  company_email: 100,
  leader_name: 100,
  leader_title: 60,
};

function readAll() {
  const rows = db.get().prepare('SELECT setting_key, setting_value FROM settings').all();
  return Object.fromEntries(rows.map((r) => [r.setting_key, r.setting_value]));
}

// Informasi publik (untuk layar login dan kop laporan).
function publicInfo() {
  const s = readAll();
  return {
    app_name: s.app_name || 'ARSIPKU',
    company_name: s.company_name || '',
    version: app.getVersion(),
  };
}

function get() {
  session.require();
  return {
    values: readAll(),
    documentsDir: paths.documentsDir(),
    backupDir: paths.backupDir(),
    dataRoot: paths.root(),
    databaseFile: paths.databaseFile(),
    version: app.getVersion(),
    electron: process.versions.electron,
    node: process.versions.node,
  };
}

function update(values = {}) {
  session.requireAdmin();
  const upsert = db
    .get()
    .prepare(
      `INSERT INTO settings (setting_key, setting_value) VALUES (?, ?)
       ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value`
    );
  db.transaction(() => {
    for (const [key, max] of Object.entries(EDITABLE)) {
      if (!(key in values)) continue;
      const v = String(values[key] ?? '').trim();
      if (v.length > max) fail(`Isian "${key}" maksimal ${max} karakter.`);
      if (key === 'app_name' && !v) fail('Nama aplikasi wajib diisi.');
      if (key === 'company_email' && v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) fail('Format email perusahaan tidak valid.');
      upsert.run(key, v);
    }
    activity.log('Ubah Pengaturan', 'Memperbarui informasi perusahaan dan aplikasi.');
  });
  return readAll();
}

async function pickDirectory(title) {
  const res = await dialog.showOpenDialog(windowRef.get(), {
    title,
    properties: ['openDirectory', 'createDirectory'],
  });
  if (res.canceled || !res.filePaths[0]) return null;
  return res.filePaths[0];
}

function isInside(child, parent) {
  const rel = path.relative(parent, child);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

async function copyTree(src, dest) {
  let count = 0;
  const entries = await fsp.readdir(src, { withFileTypes: true });
  await fsp.mkdir(dest, { recursive: true });
  for (const e of entries) {
    const s = path.join(src, e.name);
    const d = path.join(dest, e.name);
    if (e.isDirectory()) count += await copyTree(s, d);
    else if (e.isFile()) {
      await fsp.copyFile(s, d);
      count += 1;
    }
  }
  return count;
}

// Memindahkan seluruh dokumen ke lokasi baru: salin → verifikasi → hapus lama.
async function changeDocumentsDir() {
  session.requireAdmin();
  const picked = await pickDirectory('Pilih Lokasi Penyimpanan Dokumen');
  if (!picked) return { canceled: true };
  const current = path.resolve(paths.documentsDir());
  const target = path.resolve(picked);
  if (target === current) return { canceled: true };
  if (isInside(target, current) || isInside(current, target)) {
    fail('Lokasi baru tidak boleh berada di dalam lokasi lama (atau sebaliknya).');
  }
  if (fs.existsSync(target) && (await fsp.readdir(target)).length > 0) {
    fail('Folder tujuan harus kosong.');
  }

  const fileRows = db.get().prepare('SELECT file_path FROM archive_files').all();
  const copied = fs.existsSync(current) ? await copyTree(current, target) : 0;
  await fsp.mkdir(target, { recursive: true });
  for (const r of fileRows) {
    const src = path.join(current, r.file_path);
    if (fs.existsSync(src) && !fs.existsSync(path.join(target, r.file_path))) {
      await fsp.rm(target, { recursive: true, force: true }).catch(() => {});
      fail('Verifikasi salinan dokumen gagal. Lokasi penyimpanan tidak diubah.');
    }
  }
  saveConfig({ documentsDir: target });
  await fsp.rm(current, { recursive: true, force: true }).catch(() => {});
  activity.log('Ubah Lokasi Dokumen', `Memindahkan ${copied} file dokumen ke ${target}.`);
  return { canceled: false, documentsDir: target, moved: copied };
}

async function changeBackupDir() {
  session.requireAdmin();
  const picked = await pickDirectory('Pilih Lokasi Backup');
  if (!picked) return { canceled: true };
  const target = path.resolve(picked);
  if (isInside(target, path.resolve(paths.documentsDir()))) {
    fail('Lokasi backup tidak boleh berada di dalam folder dokumen.');
  }
  await fsp.mkdir(target, { recursive: true });
  saveConfig({ backupDir: target });
  activity.log('Ubah Lokasi Backup', `Lokasi backup diubah ke ${target}.`);
  return { canceled: false, backupDir: target };
}

async function openFolder(which) {
  session.require();
  const map = {
    documents: paths.documentsDir(),
    backup: paths.backupDir(),
    data: paths.root(),
    logs: paths.logsDir(),
  };
  const dir = map[which];
  if (!dir) fail('Folder tidak dikenal.');
  await fsp.mkdir(dir, { recursive: true });
  const err = await shell.openPath(dir);
  if (err) fail(err);
  return true;
}

module.exports = { get, update, publicInfo, readAll, changeDocumentsDir, changeBackupDir, openFolder };
