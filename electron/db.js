'use strict';
// Akses database SQLite lokal menggunakan modul bawaan `node:sqlite`
// (tidak membutuhkan instalasi database maupun kompilasi modul native).
const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');
const { paths } = require('./paths');
const { hashPassword } = require('./security');
const { CATEGORIES, DEFAULT_SETTINGS } = require('./catalog');

const SCHEMA_VERSION = 2;

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'operator')),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  must_change_password INTEGER NOT NULL DEFAULT 0 CHECK (must_change_password IN (0, 1)),
  last_login_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  category_name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  fields TEXT NOT NULL DEFAULT '[]',
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS subcategories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  subcategory_name TEXT NOT NULL,
  fields TEXT NOT NULL DEFAULT '[]',
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE (category_id, subcategory_name)
);

CREATE TABLE IF NOT EXISTS archives (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  archive_number TEXT NOT NULL UNIQUE,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  subcategory_id INTEGER REFERENCES subcategories(id) ON DELETE RESTRICT,
  input_date TEXT NOT NULL CHECK (input_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  document_type TEXT NOT NULL DEFAULT '',
  document_number TEXT NOT NULL DEFAULT '',
  document_name TEXT NOT NULL CHECK (length(trim(document_name)) > 0),
  description TEXT NOT NULL DEFAULT '',
  attachment_description TEXT NOT NULL DEFAULT '',
  storage_code TEXT NOT NULL DEFAULT '',
  document_year INTEGER CHECK (document_year IS NULL OR document_year BETWEEN 1900 AND 2200),
  extra_fields TEXT NOT NULL DEFAULT '{}',
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_archives_category ON archives(category_id);
CREATE INDEX IF NOT EXISTS idx_archives_subcategory ON archives(subcategory_id);
CREATE INDEX IF NOT EXISTS idx_archives_input_date ON archives(input_date);
CREATE INDEX IF NOT EXISTS idx_archives_year ON archives(document_year);

CREATE TABLE IF NOT EXISTS archive_files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  archive_id INTEGER NOT NULL REFERENCES archives(id) ON DELETE CASCADE,
  original_filename TEXT NOT NULL,
  stored_filename TEXT NOT NULL UNIQUE,
  file_path TEXT NOT NULL UNIQUE,
  file_size INTEGER NOT NULL DEFAULT 0,
  file_hash TEXT NOT NULL UNIQUE,
  uploaded_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_archive_files_archive ON archive_files(archive_id);

CREATE TABLE IF NOT EXISTS activity_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  activity TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON activity_logs(created_at);

CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  setting_key TEXT NOT NULL UNIQUE,
  setting_value TEXT NOT NULL DEFAULT ''
);
`;

let db = null;

function configure(conn) {
  conn.exec('PRAGMA foreign_keys = ON;');
  conn.exec('PRAGMA busy_timeout = 5000;');
  // Mode journal DELETE dipilih agar database tetap satu file utuh
  // (aman untuk backup dan folder yang disinkronkan).
  conn.exec('PRAGMA journal_mode = DELETE;');
  conn.exec('PRAGMA synchronous = FULL;');
}

function seed(conn) {
  const insertCat = conn.prepare(
    'INSERT OR IGNORE INTO categories (code, slug, category_name, description, fields, sort_order) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const getCat = conn.prepare('SELECT id FROM categories WHERE code = ?');
  const insertSub = conn.prepare(
    'INSERT OR IGNORE INTO subcategories (category_id, subcategory_name, fields, sort_order) VALUES (?, ?, ?, ?)'
  );
  CATEGORIES.forEach((c, i) => {
    insertCat.run(c.code, c.slug, c.name, c.description, JSON.stringify(c.fields), i + 1);
    const { id } = getCat.get(c.code);
    const hasSubs = conn.prepare('SELECT COUNT(*) AS n FROM subcategories WHERE category_id = ?').get(id).n > 0;
    if (!hasSubs) c.subs.forEach((s, j) => insertSub.run(id, s.name, JSON.stringify(s.fields), j + 1));
  });

  const insertSetting = conn.prepare('INSERT OR IGNORE INTO settings (setting_key, setting_value) VALUES (?, ?)');
  for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) insertSetting.run(k, v);

  const userCount = conn.prepare('SELECT COUNT(*) AS n FROM users').get().n;
  if (userCount === 0) {
    conn
      .prepare(
        `INSERT INTO users (username, password_hash, full_name, role, must_change_password)
         VALUES ('admin', ?, 'Administrator', 'admin', 1)`
      )
      .run(hashPassword('admin123'));
  }
}

// Skema 1 → 2: dari arsip sekolah (8 standar pendidikan) ke arsip perusahaan.
function migrateToCompany(conn) {
  const cols = (t) => new Set(conn.prepare(`PRAGMA table_info(${t})`).all().map((c) => c.name));
  if (!cols('categories').has('fields')) conn.exec("ALTER TABLE categories ADD COLUMN fields TEXT NOT NULL DEFAULT '[]'");
  if (!cols('subcategories').has('fields')) conn.exec("ALTER TABLE subcategories ADD COLUMN fields TEXT NOT NULL DEFAULT '[]'");
  if (!cols('archives').has('extra_fields')) conn.exec("ALTER TABLE archives ADD COLUMN extra_fields TEXT NOT NULL DEFAULT '{}'");

  // Kategori lama yang belum berisi arsip dihapus. Kategori lama yang sudah berisi
  // arsip tetap disimpan dengan tanda "(Lama)" agar tidak ada arsip yang hilang.
  const countArchives = conn.prepare('SELECT COUNT(*) AS n FROM archives WHERE category_id = ?');
  conn
    .prepare('SELECT * FROM categories ORDER BY sort_order, id')
    .all()
    .forEach((c, i) => {
      if (countArchives.get(c.id).n === 0) {
        conn.prepare('DELETE FROM subcategories WHERE category_id = ?').run(c.id);
        conn.prepare('DELETE FROM categories WHERE id = ?').run(c.id);
      } else {
        conn
          .prepare('UPDATE categories SET code = ?, slug = ?, category_name = ?, sort_order = ? WHERE id = ?')
          .run(`L${c.code}`, `lama-${c.slug}`, `${c.category_name} (Lama)`, 100 + i, c.id);
      }
    });

  // Kunci pengaturan sekolah → perusahaan.
  const rename = [
    ['school_name', 'company_name'],
    ['school_npsn', 'company_reg_number'],
    ['school_address', 'company_address'],
    ['school_phone', 'company_phone'],
    ['school_email', 'company_email'],
    ['headmaster_name', 'leader_name'],
  ];
  const renameKey = conn.prepare(
    'UPDATE settings SET setting_key = ? WHERE setting_key = ? AND NOT EXISTS (SELECT 1 FROM settings WHERE setting_key = ?)'
  );
  for (const [from, to] of rename) renameKey.run(to, from, to);
  conn
    .prepare("UPDATE settings SET setting_value = ? WHERE setting_key = 'company_name' AND setting_value = 'Nama Sekolah'")
    .run(DEFAULT_SETTINGS.company_name);
  conn.prepare("DELETE FROM settings WHERE setting_key IN ('school_name', 'school_npsn', 'school_address', 'school_phone', 'school_email', 'headmaster_name', 'headmaster_nip')").run();
}

function migrate(conn) {
  const current = conn.prepare('PRAGMA user_version').get().user_version;
  if (current > SCHEMA_VERSION) {
    throw new Error(
      `Database dibuat oleh versi ARSIPKU yang lebih baru (skema ${current}). Perbarui aplikasi terlebih dahulu.`
    );
  }
  runInTransaction(conn, () => {
    if (current === 1) migrateToCompany(conn);
    conn.exec(SCHEMA_SQL);
    seed(conn);
    conn.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);
  });
}

function runInTransaction(conn, fn) {
  conn.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    conn.exec('COMMIT');
    return result;
  } catch (err) {
    try {
      conn.exec('ROLLBACK');
    } catch {
      // abaikan: transaksi mungkin sudah dibatalkan oleh SQLite
    }
    throw err;
  }
}

function open() {
  if (db) return db;
  fs.mkdirSync(paths.databaseDir(), { recursive: true });
  const conn = new DatabaseSync(paths.databaseFile());
  configure(conn);
  migrate(conn);
  db = conn;
  return db;
}

function close() {
  if (db) {
    db.close();
    db = null;
  }
}

function get() {
  return db || open();
}

const transaction = (fn) => runInTransaction(get(), fn);

// Memeriksa file database lain (misal dari paket backup) tanpa mengubahnya.
function inspectDatabaseFile(file) {
  const conn = new DatabaseSync(file, { readOnly: true });
  try {
    const integrity = conn.prepare('PRAGMA integrity_check').all();
    const ok = integrity.length === 1 && integrity[0].integrity_check === 'ok';
    if (!ok) throw new Error('Pemeriksaan integritas database gagal.');
    const version = conn.prepare('PRAGMA user_version').get().user_version;
    if (version > SCHEMA_VERSION) {
      throw new Error('Paket backup berasal dari versi ARSIPKU yang lebih baru.');
    }
    const tables = new Set(
      conn
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
        .all()
        .map((r) => r.name)
    );
    for (const t of ['users', 'categories', 'subcategories', 'archives', 'archive_files', 'activity_logs', 'settings']) {
      if (!tables.has(t)) throw new Error(`Tabel "${t}" tidak ditemukan pada database backup.`);
    }
    const fk = conn.prepare('PRAGMA foreign_key_check').all();
    if (fk.length > 0) throw new Error('Database backup memiliki relasi data yang tidak valid.');
    const admins = conn.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND is_active = 1").get().n;
    if (admins === 0) throw new Error('Database backup tidak memiliki akun administrator aktif.');
    return {
      version,
      archives: conn.prepare('SELECT COUNT(*) AS n FROM archives').get().n,
      files: conn.prepare('SELECT file_path FROM archive_files').all().map((r) => r.file_path),
      users: conn.prepare('SELECT COUNT(*) AS n FROM users').get().n,
    };
  } finally {
    conn.close();
  }
}

module.exports = {
  open,
  close,
  get,
  transaction,
  inspectDatabaseFile,
  CATEGORIES,
  SCHEMA_VERSION,
};
