'use strict';
// Akses database SQLite lokal menggunakan modul bawaan `node:sqlite`
// (tidak membutuhkan instalasi database maupun kompilasi modul native).
const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');
const { paths } = require('./paths');
const { hashPassword } = require('./security');

const SCHEMA_VERSION = 1;

const CATEGORIES = [
  {
    code: 'A',
    slug: 'standar-isi',
    name: 'Standar Isi',
    description: 'Dokumen kurikulum dan pengembangan diri.',
    subs: ['Kurikulum', 'Pengembangan Kurikulum', 'Pengembangan Diri'],
  },
  {
    code: 'B',
    slug: 'standar-proses',
    name: 'Standar Proses',
    description: 'Administrasi guru dan supervisi pembelajaran.',
    subs: ['Administrasi Guru', 'Supervisi'],
  },
  {
    code: 'C',
    slug: 'standar-penilaian',
    name: 'Standar Penilaian',
    description: 'Perencanaan, pelaksanaan, dan evaluasi penilaian.',
    subs: ['Perencanaan Penilaian', 'Evaluasi', 'Pelaksanaan Penilaian', 'Lain-lain'],
  },
  {
    code: 'D',
    slug: 'sarana-prasarana',
    name: 'Standar Sarana dan Prasarana',
    description: 'Legalitas, laporan, dan buku teks.',
    subs: ['Legalitas', 'Laporan', 'Buku Teks'],
  },
  {
    code: 'E',
    slug: 'pengelolaan-sekolah',
    name: 'Standar Pengelolaan Sekolah',
    description: 'Visi misi, perencanaan, pelaksanaan, dan evaluasi sekolah.',
    subs: ['Visi dan Misi Sekolah', 'Perencanaan', 'Pelaksanaan', 'Evaluasi', 'Lain-lain'],
  },
  {
    code: 'F',
    slug: 'kompetensi-lulusan',
    name: 'Standar Kompetensi Lulusan',
    description: 'Tugas, ujian, dan prestasi siswa.',
    subs: ['Tugas Siswa', 'Ujian Nasional', 'Prestasi Siswa', 'Lain-lain'],
  },
  {
    code: 'G',
    slug: 'sdm',
    name: 'Standar Pendidik dan Tenaga Kependidikan',
    description: 'Dokumen pendidik dan tenaga kependidikan.',
    subs: ['Pendidik', 'Tenaga Kependidikan', 'Supervisi'],
  },
  {
    code: 'H',
    slug: 'keuangan',
    name: 'Standar Pengelolaan Keuangan',
    description: 'Investasi sarana prasarana, keuangan, dan pedoman.',
    subs: ['Investasi Sarana dan Prasarana', 'Keuangan', 'Pedoman'],
  },
];

const DEFAULT_SETTINGS = {
  app_name: 'ARSIPKU',
  school_name: 'Nama Sekolah',
  school_npsn: '',
  school_address: '',
  school_phone: '',
  school_email: '',
  headmaster_name: '',
  headmaster_nip: '',
};

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
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS subcategories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  subcategory_name TEXT NOT NULL,
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
    'INSERT OR IGNORE INTO categories (code, slug, category_name, description, sort_order) VALUES (?, ?, ?, ?, ?)'
  );
  const getCat = conn.prepare('SELECT id FROM categories WHERE code = ?');
  const insertSub = conn.prepare(
    'INSERT OR IGNORE INTO subcategories (category_id, subcategory_name, sort_order) VALUES (?, ?, ?)'
  );
  CATEGORIES.forEach((c, i) => {
    insertCat.run(c.code, c.slug, c.name, c.description, i + 1);
    const { id } = getCat.get(c.code);
    const hasSubs = conn.prepare('SELECT COUNT(*) AS n FROM subcategories WHERE category_id = ?').get(id).n > 0;
    if (!hasSubs) c.subs.forEach((s, j) => insertSub.run(id, s, j + 1));
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

function migrate(conn) {
  const current = conn.prepare('PRAGMA user_version').get().user_version;
  if (current > SCHEMA_VERSION) {
    throw new Error(
      `Database dibuat oleh versi ARSIPKU yang lebih baru (skema ${current}). Perbarui aplikasi terlebih dahulu.`
    );
  }
  runInTransaction(conn, () => {
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
