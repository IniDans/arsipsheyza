'use strict';
// Backup & restore: database SQLite + dokumen PDF dalam satu paket .zip.
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { app, dialog } = require('electron');
const { ZipArchive } = require('archiver');
const yauzl = require('yauzl');
const db = require('../db');
const session = require('../session');
const activity = require('./activity');
const windowRef = require('../window');
const logger = require('../logger');
const { paths } = require('../paths');
const { fail } = require('../errors');

const TYPES = {
  full: { label: 'Lengkap (database + dokumen)', db: true, docs: true },
  database: { label: 'Database saja', db: true, docs: false },
  documents: { label: 'Dokumen saja', db: false, docs: true },
};

const stamp = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
};

async function countFiles(dir) {
  let count = 0;
  let size = 0;
  let entries;
  try {
    entries = await fsp.readdir(dir, { withFileTypes: true });
  } catch {
    return { count, size };
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      const sub = await countFiles(full);
      count += sub.count;
      size += sub.size;
    } else if (e.isFile() && !e.name.endsWith('.part')) {
      count += 1;
      size += (await fsp.stat(full)).size;
    }
  }
  return { count, size };
}

// Membuat paket backup. `targetDir` opsional (default: lokasi backup di pengaturan).
async function createPackage(type, { targetDir, label } = {}) {
  const spec = TYPES[type];
  if (!spec) fail('Jenis backup tidak valid.');
  const dir = targetDir || paths.backupDir();
  await fsp.mkdir(dir, { recursive: true });
  await fsp.mkdir(paths.tempDir(), { recursive: true });

  const fileName = `ARSIPKU-backup-${label ? `${label}-` : ''}${type}-${stamp()}.zip`;
  const finalPath = path.join(dir, fileName);
  const partPath = `${finalPath}.part`;

  let tmpDb = null;
  const manifest = {
    app: 'ARSIPKU',
    format: 1,
    type,
    app_version: app.getVersion(),
    schema_version: db.SCHEMA_VERSION,
    created_at: new Date().toISOString(),
    created_by: session.current()?.username || null,
    archives: null,
    documents: null,
  };

  try {
    if (spec.db) {
      // VACUUM INTO menghasilkan salinan database yang konsisten.
      tmpDb = path.join(paths.tempDir(), `backup-${stamp()}-${process.pid}.db`);
      await fsp.rm(tmpDb, { force: true });
      db.get().exec(`VACUUM INTO '${tmpDb.replace(/'/g, "''")}'`);
      manifest.archives = db.get().prepare('SELECT COUNT(*) AS n FROM archives').get().n;
    }
    if (spec.docs) {
      manifest.documents = (await countFiles(paths.documentsDir())).count;
    }

    await new Promise((resolve, reject) => {
      const output = fs.createWriteStream(partPath);
      const zip = new ZipArchive({ zlib: { level: 6 } });
      output.on('close', resolve);
      output.on('error', reject);
      zip.on('error', reject);
      zip.on('warning', (err) => (err.code === 'ENOENT' ? logger.warn('backup warning', err) : reject(err)));
      zip.pipe(output);
      zip.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' });
      if (tmpDb) zip.file(tmpDb, { name: 'database/arsipku.db' });
      if (spec.docs) {
        zip.directory(paths.documentsDir(), 'documents', (entry) => (entry.name.endsWith('.part') ? false : entry));
      }
      zip.finalize();
    });
    await fsp.rename(partPath, finalPath);
  } catch (err) {
    await fsp.rm(partPath, { force: true }).catch(() => {});
    throw err;
  } finally {
    if (tmpDb) await fsp.rm(tmpDb, { force: true }).catch(() => {});
  }

  const { size } = await fsp.stat(finalPath);
  return { file: finalPath, name: fileName, size, manifest };
}

async function create({ type = 'full', chooseLocation = false } = {}) {
  session.require();
  let targetDir;
  if (chooseLocation) {
    const res = await dialog.showOpenDialog(windowRef.get(), {
      title: 'Pilih Folder Penyimpanan Backup',
      properties: ['openDirectory', 'createDirectory'],
    });
    if (res.canceled || !res.filePaths[0]) return { canceled: true };
    targetDir = res.filePaths[0];
  }
  const result = await createPackage(type, { targetDir });
  activity.log('Backup', `Backup ${TYPES[type].label.toLowerCase()} dibuat: ${result.name}.`);
  return { canceled: false, ...result };
}

async function list() {
  session.require();
  const dir = paths.backupDir();
  let names = [];
  try {
    names = await fsp.readdir(dir);
  } catch {
    return [];
  }
  const out = [];
  for (const name of names) {
    if (!/^ARSIPKU-backup-.*\.zip$/i.test(name)) continue;
    const full = path.join(dir, name);
    const st = await fsp.stat(full).catch(() => null);
    if (!st || !st.isFile()) continue;
    const m = name.match(/-(full|database|documents)-\d{8}-\d{6}\.zip$/i);
    out.push({ name, path: full, size: st.size, modified: st.mtime.toISOString(), type: m ? m[1].toLowerCase() : null });
  }
  return out.sort((a, b) => b.modified.localeCompare(a.modified));
}

// ---------- Membaca paket zip ----------

function openZip(file) {
  return new Promise((resolve, reject) => {
    yauzl.open(file, { lazyEntries: true, autoClose: false, validateEntrySizes: true }, (err, zip) =>
      err ? reject(err) : resolve(zip)
    );
  });
}

function readEntry(zip, entry) {
  return new Promise((resolve, reject) => {
    zip.openReadStream(entry, (err, stream) => {
      if (err) return reject(err);
      const chunks = [];
      stream.on('data', (c) => chunks.push(c));
      stream.on('error', reject);
      stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
  });
}

function isSafeEntry(name) {
  if (!name || name.includes('\\') || name.startsWith('/') || /^[A-Za-z]:/.test(name)) return false;
  return !name.split('/').some((seg) => seg === '..');
}

// Iterasi semua entri; `onEntry` dapat mengembalikan Promise.
async function walkZip(file, onEntry) {
  const zip = await openZip(file);
  try {
    await new Promise((resolve, reject) => {
      zip.on('error', reject);
      zip.on('end', resolve);
      zip.on('entry', (entry) => {
        Promise.resolve(onEntry(zip, entry))
          .then(() => zip.readEntry())
          .catch(reject);
      });
      zip.readEntry();
    });
  } finally {
    zip.close();
  }
}

async function inspect(file) {
  session.require();
  if (typeof file !== 'string' || !file.toLowerCase().endsWith('.zip')) fail('File backup harus berformat .zip.');
  if (!fs.existsSync(file)) fail('File backup tidak ditemukan.');

  let manifest = null;
  let hasDb = false;
  let docCount = 0;
  let docSize = 0;
  try {
    await walkZip(file, async (zip, entry) => {
      if (!isSafeEntry(entry.fileName)) throw new Error('UNSAFE');
      if (entry.fileName === 'manifest.json') {
        manifest = JSON.parse((await readEntry(zip, entry)).toString('utf8'));
      } else if (entry.fileName === 'database/arsipku.db') {
        hasDb = true;
      } else if (entry.fileName.startsWith('documents/') && !entry.fileName.endsWith('/')) {
        docCount += 1;
        docSize += entry.uncompressedSize;
      }
    });
  } catch (err) {
    if (err.message === 'UNSAFE') fail('Paket backup berisi lokasi file yang tidak aman.');
    fail('File backup rusak atau bukan paket backup ARSIPKU.');
  }
  if (!manifest || manifest.app !== 'ARSIPKU') fail('File ini bukan paket backup ARSIPKU.');
  if (Number(manifest.schema_version) > db.SCHEMA_VERSION) {
    fail('Paket backup dibuat oleh versi ARSIPKU yang lebih baru. Perbarui aplikasi terlebih dahulu.');
  }
  const spec = TYPES[manifest.type];
  if (!spec) fail('Jenis paket backup tidak dikenal.');
  if (spec.db && !hasDb) fail('Paket backup tidak lengkap: database tidak ditemukan.');

  const modes = [];
  if (hasDb && spec.docs) modes.push('full');
  if (hasDb) modes.push('database');
  if (spec.docs) modes.push('documents');
  return {
    file,
    manifest,
    hasDatabase: hasDb,
    hasDocuments: spec.docs,
    documentCount: docCount,
    documentSize: docSize,
    modes,
  };
}

async function pickFile() {
  session.requireAdmin();
  const res = await dialog.showOpenDialog(windowRef.get(), {
    title: 'Pilih Paket Backup ARSIPKU',
    defaultPath: paths.backupDir(),
    properties: ['openFile'],
    filters: [{ name: 'Paket Backup ARSIPKU', extensions: ['zip'] }],
  });
  if (res.canceled || !res.filePaths[0]) return null;
  return inspect(res.filePaths[0]);
}

async function extract(file, stagingDir, { db: wantDb, docs: wantDocs }) {
  const base = path.resolve(stagingDir);
  await walkZip(file, async (zip, entry) => {
    const name = entry.fileName;
    const wanted = (wantDb && name === 'database/arsipku.db') || (wantDocs && name.startsWith('documents/'));
    if (!wanted || !isSafeEntry(name)) return;
    const target = path.resolve(base, ...name.split('/'));
    if (!target.startsWith(base + path.sep)) throw new Error('Lokasi file tidak aman.');
    if (name.endsWith('/')) {
      await fsp.mkdir(target, { recursive: true });
      return;
    }
    await fsp.mkdir(path.dirname(target), { recursive: true });
    await new Promise((resolve, reject) => {
      zip.openReadStream(entry, (err, stream) => {
        if (err) return reject(err);
        const out = fs.createWriteStream(target);
        stream.on('error', reject);
        out.on('error', reject);
        out.on('close', resolve);
        stream.pipe(out);
      });
    });
  });
}

async function moveDir(src, dest) {
  try {
    await fsp.rename(src, dest);
  } catch (err) {
    if (err.code !== 'EXDEV') throw err;
    await fsp.cp(src, dest, { recursive: true, errorOnExist: true });
    await fsp.rm(src, { recursive: true, force: true });
  }
}

async function restore({ file, mode } = {}) {
  const admin = session.requireAdmin();
  // Tahap 1: validasi paket sebelum menyentuh data apa pun.
  const info = await inspect(file);
  if (!info.modes.includes(mode)) fail('Mode pemulihan tidak tersedia untuk paket backup ini.');
  const spec = TYPES[mode];

  const staging = path.join(paths.tempDir(), `restore-${stamp()}`);
  await fsp.rm(staging, { recursive: true, force: true });
  await fsp.mkdir(staging, { recursive: true });

  const undo = [];
  let safety = null;
  try {
    // Tahap 2: ekstrak ke folder sementara dan validasi isinya.
    try {
      await extract(file, staging, spec);
    } catch {
      fail('Gagal mengekstrak paket backup. File mungkin rusak.');
    }
    const stagedDb = path.join(staging, 'database', 'arsipku.db');
    const stagedDocs = path.join(staging, 'documents');
    let dbInfo = null;
    if (spec.db) {
      try {
        dbInfo = db.inspectDatabaseFile(stagedDb);
      } catch (err) {
        fail(`Validasi database backup gagal: ${err.message}`);
      }
    }
    if (spec.docs) await fsp.mkdir(stagedDocs, { recursive: true });

    let missing = 0;
    if (mode === 'full' && dbInfo) {
      for (const rel of dbInfo.files) {
        if (!fs.existsSync(path.join(stagedDocs, ...rel.split('/')))) missing += 1;
      }
    }

    // Tahap 3: backup pengaman atas data saat ini (data lama tidak dihapus
    // sebelum pemulihan berhasil divalidasi).
    safety = await createPackage(mode, { label: 'sebelum-restore' });

    // Tahap 4: tukar data. Setiap langkah dapat dibatalkan jika gagal.
    const ts = stamp();
    if (spec.docs) {
      const docsDir = path.resolve(paths.documentsDir());
      const oldDocs = `${docsDir}.lama-${ts}`;
      if (fs.existsSync(docsDir)) {
        try {
          await fsp.rename(docsDir, oldDocs);
        } catch {
          fail('Folder dokumen sedang digunakan. Tutup dokumen yang terbuka lalu coba lagi.');
        }
        undo.push(async () => {
          await fsp.rm(docsDir, { recursive: true, force: true });
          await fsp.rename(oldDocs, docsDir);
        });
      } else {
        undo.push(() => fsp.rm(docsDir, { recursive: true, force: true }));
      }
      await moveDir(stagedDocs, docsDir);
      undo.cleanupDocs = oldDocs;
    }

    if (spec.db) {
      const dbFile = paths.databaseFile();
      const oldDb = `${dbFile}.lama-${ts}`;
      db.close();
      await fsp.rename(dbFile, oldDb);
      undo.push(async () => {
        db.close();
        await fsp.rm(dbFile, { force: true });
        await fsp.rename(oldDb, dbFile);
        db.open();
      });
      await fsp.copyFile(stagedDb, dbFile);
      db.open(); // menjalankan migrasi bila paket berasal dari versi skema lama
      undo.cleanupDb = oldDb;
    }

    // Berhasil: bersihkan data lama (sudah tersimpan di paket backup pengaman).
    if (undo.cleanupDocs) await fsp.rm(undo.cleanupDocs, { recursive: true, force: true }).catch(() => {});
    if (undo.cleanupDb) await fsp.rm(undo.cleanupDb, { force: true }).catch(() => {});

    activity.log(
      'Restore',
      `Pemulihan ${spec.label.toLowerCase()} dari ${path.basename(file)} oleh ${admin.username}. Backup pengaman: ${safety.name}.`,
      null
    );
    if (spec.db) session.clear(); // data pengguna mungkin berubah, wajib login ulang
    return {
      ok: true,
      mode,
      requireLogin: spec.db,
      safetyBackup: safety.file,
      missingFiles: missing,
      archives: dbInfo?.archives ?? null,
    };
  } catch (err) {
    for (const step of [...undo].reverse()) {
      try {
        await step();
      } catch (e) {
        logger.error('Rollback restore gagal', e);
      }
    }
    throw err;
  } finally {
    await fsp.rm(staging, { recursive: true, force: true }).catch(() => {});
  }
}

module.exports = { create, list, inspect, pickFile, restore, createPackage, TYPES };
