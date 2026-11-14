'use strict';
const fsp = require('node:fs/promises');
const path = require('node:path');
const { dialog, shell } = require('electron');
const db = require('../db');
const session = require('../session');
const activity = require('./activity');
const files = require('./files');
const windowRef = require('../window');
const { fail } = require('../errors');

const MAX_LEN = {
  document_type: 100,
  document_number: 100,
  document_name: 255,
  description: 2000,
  attachment_description: 500,
  storage_code: 50,
};

const today = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

function isValidDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

function validate(data) {
  const conn = db.get();
  const category = conn.prepare('SELECT * FROM categories WHERE id = ?').get(Number(data.category_id));
  if (!category) fail('Kategori wajib dipilih.');

  let subcategoryId = null;
  if (data.subcategory_id) {
    const sub = conn.prepare('SELECT * FROM subcategories WHERE id = ?').get(Number(data.subcategory_id));
    if (!sub || sub.category_id !== category.id) fail('Subkategori tidak sesuai dengan kategori yang dipilih.');
    subcategoryId = sub.id;
  } else {
    const hasSubs = conn.prepare('SELECT COUNT(*) AS n FROM subcategories WHERE category_id = ?').get(category.id).n;
    if (hasSubs) fail('Subkategori wajib dipilih.');
  }

  const inputDate = String(data.input_date || today());
  if (!isValidDate(inputDate)) fail('Tanggal input tidak valid.');

  const out = { category, subcategoryId, inputDate };
  for (const [key, max] of Object.entries(MAX_LEN)) {
    const value = String(data[key] ?? '').trim();
    if (value.length > max) fail(`Isian terlalu panjang (maksimal ${max} karakter).`);
    out[key] = value;
  }
  if (!out.document_name) fail('Nama dokumen wajib diisi.');
  if (!out.document_type) fail('Jenis dokumen wajib diisi.');

  let year = null;
  if (data.document_year !== undefined && data.document_year !== null && String(data.document_year).trim() !== '') {
    year = Number(data.document_year);
    if (!Number.isInteger(year) || year < 1900 || year > 2200) fail('Tahun dokumen tidak valid.');
  }
  out.document_year = year;
  return out;
}

function nextArchiveNumber(inputDate) {
  const year = String(inputDate || today()).slice(0, 4);
  const prefix = `ARS-${year}-`;
  const row = db
    .get()
    .prepare(
      `SELECT COALESCE(MAX(CAST(substr(archive_number, ?) AS INTEGER)), 0) AS n
       FROM archives WHERE archive_number LIKE ?`
    )
    .get(prefix.length + 1, `${prefix}%`);
  return `${prefix}${String(row.n + 1).padStart(5, '0')}`;
}

// Memvalidasi dan menghitung hash file baru, sekaligus mencegah duplikat.
async function prepareFiles(filePaths, excludeArchiveId) {
  const list = Array.isArray(filePaths) ? filePaths : [];
  if (list.length > 50) fail('Maksimal 50 file per penyimpanan.');
  const prepared = [];
  const seen = new Set();
  const findDup = db
    .get()
    .prepare(
      `SELECT a.archive_number, a.document_name, f.original_filename
       FROM archive_files f JOIN archives a ON a.id = f.archive_id WHERE f.file_hash = ?`
    );
  for (const p of list) {
    const info = await files.validatePdf(p);
    const hash = await files.hashFile(p);
    if (seen.has(hash)) fail(`File "${info.name}" dipilih lebih dari satu kali.`);
    seen.add(hash);
    const dup = findDup.get(hash);
    if (dup) {
      fail(`File "${info.name}" sudah tersimpan pada arsip ${dup.archive_number} (${dup.document_name}).`);
    }
    prepared.push({ src: p, name: info.name, size: info.size, hash });
  }
  return prepared;
}

async function copyPrepared(prepared, category, year) {
  const stored = [];
  try {
    for (const f of prepared) {
      const s = await files.store(f.src, category.slug, year);
      stored.push({ ...f, ...s });
    }
  } catch (err) {
    await Promise.all(stored.map((s) => files.removeStored(s.relPath)));
    throw err;
  }
  return stored;
}

function insertFiles(archiveId, stored) {
  const stmt = db
    .get()
    .prepare(
      `INSERT INTO archive_files (archive_id, original_filename, stored_filename, file_path, file_size, file_hash)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
  for (const s of stored) stmt.run(archiveId, s.name, s.storedName, s.relPath, s.size, s.hash);
}

async function create(data = {}, filePaths = []) {
  const user = session.require();
  const v = validate(data);
  if (!filePaths || filePaths.length === 0) fail('Minimal satu file PDF wajib diunggah.');
  const prepared = await prepareFiles(filePaths);

  // 1) simpan file ke direktori lokal, 2) simpan metadata ke SQLite (PRD §8.4)
  const stored = await copyPrepared(prepared, v.category, v.inputDate.slice(0, 4));
  try {
    return db.transaction(() => {
      const number = nextArchiveNumber(v.inputDate);
      const res = db
        .get()
        .prepare(
          `INSERT INTO archives (archive_number, category_id, subcategory_id, input_date, document_type,
             document_number, document_name, description, attachment_description, storage_code,
             document_year, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          number,
          v.category.id,
          v.subcategoryId,
          v.inputDate,
          v.document_type,
          v.document_number,
          v.document_name,
          v.description,
          v.attachment_description,
          v.storage_code,
          v.document_year,
          user.id
        );
      const id = Number(res.lastInsertRowid);
      insertFiles(id, stored);
      activity.log('Tambah Arsip', `Menambahkan arsip ${number} — ${v.document_name} (${stored.length} file).`);
      return { id, archive_number: number };
    });
  } catch (err) {
    // file baru dihapus kembali agar tidak ada file yatim
    await Promise.all(stored.map((s) => files.removeStored(s.relPath)));
    throw err;
  }
}

async function update(id, data = {}, { addFiles = [], removeFileIds = [] } = {}) {
  session.require();
  const archiveId = Number(id);
  const existing = db.get().prepare('SELECT * FROM archives WHERE id = ?').get(archiveId);
  if (!existing) fail('Arsip tidak ditemukan.');
  const v = validate(data);

  const currentFiles = db.get().prepare('SELECT * FROM archive_files WHERE archive_id = ?').all(archiveId);
  const removeIds = new Set((removeFileIds || []).map(Number));
  const toRemove = currentFiles.filter((f) => removeIds.has(f.id));
  if (currentFiles.length - toRemove.length + (addFiles?.length || 0) === 0) {
    fail('Arsip harus memiliki minimal satu file PDF.');
  }

  const prepared = await prepareFiles(addFiles);
  const stored = await copyPrepared(prepared, v.category, v.inputDate.slice(0, 4));
  try {
    db.transaction(() => {
      db.get()
        .prepare(
          `UPDATE archives SET category_id = ?, subcategory_id = ?, input_date = ?, document_type = ?,
             document_number = ?, document_name = ?, description = ?, attachment_description = ?,
             storage_code = ?, document_year = ?, updated_at = datetime('now', 'localtime')
           WHERE id = ?`
        )
        .run(
          v.category.id,
          v.subcategoryId,
          v.inputDate,
          v.document_type,
          v.document_number,
          v.document_name,
          v.description,
          v.attachment_description,
          v.storage_code,
          v.document_year,
          archiveId
        );
      const del = db.get().prepare('DELETE FROM archive_files WHERE id = ? AND archive_id = ?');
      for (const f of toRemove) del.run(f.id, archiveId);
      insertFiles(archiveId, stored);
      const extra = [];
      if (stored.length) extra.push(`+${stored.length} file`);
      if (toRemove.length) extra.push(`-${toRemove.length} file`);
      activity.log(
        'Ubah Arsip',
        `Memperbarui arsip ${existing.archive_number} — ${v.document_name}${extra.length ? ` (${extra.join(', ')})` : ''}.`
      );
    });
  } catch (err) {
    await Promise.all(stored.map((s) => files.removeStored(s.relPath)));
    throw err;
  }
  // File lama baru dihapus setelah database berhasil diperbarui.
  await Promise.all(toRemove.map((f) => files.removeStored(f.file_path)));
  return true;
}

async function remove(id) {
  session.require();
  const archiveId = Number(id);
  const existing = db.get().prepare('SELECT * FROM archives WHERE id = ?').get(archiveId);
  if (!existing) fail('Arsip tidak ditemukan.');
  const fileRows = db.get().prepare('SELECT * FROM archive_files WHERE archive_id = ?').all(archiveId);
  db.transaction(() => {
    db.get().prepare('DELETE FROM archive_files WHERE archive_id = ?').run(archiveId);
    db.get().prepare('DELETE FROM archives WHERE id = ?').run(archiveId);
    activity.log('Hapus Arsip', `Menghapus arsip ${existing.archive_number} — ${existing.document_name}.`);
  });
  await Promise.all(fileRows.map((f) => files.removeStored(f.file_path)));
  return true;
}

const SELECT_ARCHIVE = `
  SELECT a.*, c.code AS category_code, c.category_name, s.subcategory_name,
         u.full_name AS created_by_name,
         (SELECT COUNT(*) FROM archive_files f WHERE f.archive_id = a.id) AS file_count
  FROM archives a
  JOIN categories c ON c.id = a.category_id
  LEFT JOIN subcategories s ON s.id = a.subcategory_id
  LEFT JOIN users u ON u.id = a.created_by`;

function get(id) {
  session.require();
  const row = db.get().prepare(`${SELECT_ARCHIVE} WHERE a.id = ?`).get(Number(id));
  if (!row) fail('Arsip tidak ditemukan.');
  const fileRows = db
    .get()
    .prepare(
      'SELECT id, original_filename, stored_filename, file_path, file_size, uploaded_at FROM archive_files WHERE archive_id = ? ORDER BY id'
    )
    .all(row.id)
    .map((f) => ({ ...f, missing: !files.existsStored(f.file_path) }));
  return { ...row, files: fileRows };
}

// Membangun klausa WHERE untuk pencarian & filter (dipakai juga oleh laporan).
function buildFilter(f = {}) {
  const where = [];
  const params = [];
  const kw = String(f.keyword || '').trim();
  if (kw) {
    const like = `%${kw}%`;
    where.push(`(a.document_name LIKE ? OR a.document_number LIKE ? OR a.archive_number LIKE ?
      OR a.document_type LIKE ? OR a.storage_code LIKE ? OR a.description LIKE ?
      OR c.category_name LIKE ? OR s.subcategory_name LIKE ?
      OR CAST(a.document_year AS TEXT) LIKE ? OR a.input_date LIKE ?)`);
    params.push(like, like, like, like, like, like, like, like, like, like);
  }
  if (f.category_id) {
    where.push('a.category_id = ?');
    params.push(Number(f.category_id));
  }
  if (f.subcategory_id) {
    where.push('a.subcategory_id = ?');
    params.push(Number(f.subcategory_id));
  }
  if (f.year) {
    where.push('a.document_year = ?');
    params.push(Number(f.year));
  }
  if (f.document_type) {
    where.push('a.document_type = ?');
    params.push(String(f.document_type));
  }
  if (f.date_from && isValidDate(f.date_from)) {
    where.push('a.input_date >= ?');
    params.push(f.date_from);
  }
  if (f.date_to && isValidDate(f.date_to)) {
    where.push('a.input_date <= ?');
    params.push(f.date_to);
  }
  return { sql: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

const SORTS = {
  newest: 'a.input_date DESC, a.id DESC',
  oldest: 'a.input_date ASC, a.id ASC',
  name: 'a.document_name COLLATE NOCASE ASC',
  number: 'a.archive_number ASC',
};

function list(filters = {}) {
  session.require();
  const size = Math.min(Math.max(Number(filters.pageSize) || 10, 5), 100);
  const page = Math.max(Number(filters.page) || 1, 1);
  const { sql, params } = buildFilter(filters);
  const conn = db.get();
  const total = conn
    .prepare(
      `SELECT COUNT(*) AS n FROM archives a JOIN categories c ON c.id = a.category_id
       LEFT JOIN subcategories s ON s.id = a.subcategory_id ${sql}`
    )
    .get(...params).n;
  const order = SORTS[filters.sort] || SORTS.newest;
  const rows = conn.prepare(`${SELECT_ARCHIVE} ${sql} ORDER BY ${order} LIMIT ? OFFSET ?`).all(...params, size, (page - 1) * size);
  return { rows, total, page, pageSize: size };
}

function filterOptions() {
  session.require();
  const conn = db.get();
  return {
    documentTypes: conn
      .prepare("SELECT DISTINCT document_type FROM archives WHERE document_type != '' ORDER BY document_type COLLATE NOCASE")
      .all()
      .map((r) => r.document_type),
    years: conn
      .prepare('SELECT DISTINCT document_year FROM archives WHERE document_year IS NOT NULL ORDER BY document_year DESC')
      .all()
      .map((r) => r.document_year),
  };
}

function previewNumber(inputDate) {
  session.require();
  return nextArchiveNumber(isValidDate(String(inputDate || '')) ? inputDate : today());
}

// ---- Operasi file ----

function fileRow(fileId) {
  const row = db.get().prepare('SELECT * FROM archive_files WHERE id = ?').get(Number(fileId));
  if (!row) fail('File tidak ditemukan.');
  return row;
}

async function readFile(fileId) {
  session.require();
  const row = fileRow(fileId);
  try {
    return await fsp.readFile(files.resolveStored(row.file_path));
  } catch {
    fail(`File "${row.original_filename}" tidak ditemukan di penyimpanan.`);
  }
}

async function openExternal(fileId) {
  session.require();
  const row = fileRow(fileId);
  const full = files.resolveStored(row.file_path);
  const err = await shell.openPath(full);
  if (err) fail(`Gagal membuka file: ${err}`);
  return true;
}

async function exportFiles({ fileIds = [], archiveId } = {}) {
  session.require();
  let rows;
  if (archiveId) {
    rows = db.get().prepare('SELECT * FROM archive_files WHERE archive_id = ? ORDER BY id').all(Number(archiveId));
  } else {
    rows = fileIds.map(fileRow);
  }
  if (rows.length === 0) fail('Tidak ada file untuk diekspor.');
  const win = windowRef.get();

  if (rows.length === 1) {
    const res = await dialog.showSaveDialog(win, {
      title: 'Simpan Dokumen',
      defaultPath: files.safeFileName(rows[0].original_filename),
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    });
    if (res.canceled || !res.filePath) return { canceled: true };
    await fsp.copyFile(files.resolveStored(rows[0].file_path), res.filePath);
    activity.log('Ekspor Dokumen', `Mengekspor file "${rows[0].original_filename}".`);
    return { canceled: false, count: 1, location: res.filePath };
  }

  const res = await dialog.showOpenDialog(win, {
    title: 'Pilih Folder Tujuan',
    properties: ['openDirectory', 'createDirectory'],
  });
  if (res.canceled || !res.filePaths[0]) return { canceled: true };
  const dir = res.filePaths[0];
  for (const r of rows) {
    const target = files.uniqueTarget(dir, files.safeFileName(r.original_filename));
    await fsp.copyFile(files.resolveStored(r.file_path), target);
  }
  activity.log('Ekspor Dokumen', `Mengekspor ${rows.length} file ke ${dir}.`);
  return { canceled: false, count: rows.length, location: dir };
}

async function pickFiles() {
  session.require();
  const res = await dialog.showOpenDialog(windowRef.get(), {
    title: 'Pilih Dokumen PDF',
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Dokumen PDF', extensions: ['pdf'] }],
  });
  if (res.canceled) return [];
  const out = [];
  for (const p of res.filePaths) {
    try {
      const info = await files.validatePdf(p);
      out.push({ path: p, name: info.name, size: info.size });
    } catch (err) {
      out.push({ path: p, name: path.basename(p), size: 0, error: err.message });
    }
  }
  return out;
}

module.exports = {
  create,
  update,
  remove,
  get,
  list,
  buildFilter,
  filterOptions,
  previewNumber,
  readFile,
  openExternal,
  exportFiles,
  pickFiles,
  isValidDate,
};
