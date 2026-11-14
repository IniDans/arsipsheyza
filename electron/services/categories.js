'use strict';
const db = require('../db');
const session = require('../session');
const activity = require('./activity');
const { fail } = require('../errors');

function parseFields(json) {
  try {
    const v = JSON.parse(json || '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

// Isian Informasi Dokumen yang berlaku: isian kategori lalu isian subkategori.
function fieldsFor(categoryId, subcategoryId) {
  const conn = db.get();
  const cat = conn.prepare('SELECT fields FROM categories WHERE id = ?').get(Number(categoryId));
  const sub = subcategoryId ? conn.prepare('SELECT fields FROM subcategories WHERE id = ?').get(Number(subcategoryId)) : null;
  const all = [...parseFields(cat?.fields), ...parseFields(sub?.fields)];
  const seen = new Set();
  return all.filter((f) => f && f.key && !seen.has(f.key) && seen.add(f.key));
}

function list() {
  session.require();
  const conn = db.get();
  const cats = conn
    .prepare(
      `SELECT c.*, (SELECT COUNT(*) FROM archives a WHERE a.category_id = c.id) AS archive_count
       FROM categories c ORDER BY c.sort_order, c.code`
    )
    .all();
  const subs = conn
    .prepare(
      `SELECT s.*, (SELECT COUNT(*) FROM archives a WHERE a.subcategory_id = s.id) AS archive_count
       FROM subcategories s ORDER BY s.category_id, s.sort_order, s.id`
    )
    .all();
  return cats.map((c) => ({
    ...c,
    fields: parseFields(c.fields),
    subcategories: subs.filter((s) => s.category_id === c.id).map((s) => ({ ...s, fields: parseFields(s.fields) })),
  }));
}

function cleanName(name) {
  const n = String(name || '').trim().replace(/\s+/g, ' ');
  if (!n) fail('Nama subkategori wajib diisi.');
  if (n.length > 80) fail('Nama subkategori maksimal 80 karakter.');
  return n;
}

function createSub({ category_id, subcategory_name } = {}) {
  session.requireAdmin();
  const cat = db.get().prepare('SELECT * FROM categories WHERE id = ?').get(Number(category_id));
  if (!cat) fail('Kategori tidak ditemukan.');
  const name = cleanName(subcategory_name);
  const dup = db
    .get()
    .prepare('SELECT id FROM subcategories WHERE category_id = ? AND subcategory_name = ? COLLATE NOCASE')
    .get(cat.id, name);
  if (dup) fail('Subkategori dengan nama tersebut sudah ada pada kategori ini.');
  const order = db
    .get()
    .prepare('SELECT COALESCE(MAX(sort_order), 0) + 1 AS n FROM subcategories WHERE category_id = ?')
    .get(cat.id).n;
  const res = db
    .get()
    .prepare('INSERT INTO subcategories (category_id, subcategory_name, sort_order) VALUES (?, ?, ?)')
    .run(cat.id, name, order);
  activity.log('Tambah Subkategori', `Menambahkan subkategori "${name}" pada ${cat.category_name}.`);
  return { id: Number(res.lastInsertRowid) };
}

function updateSub(id, { subcategory_name } = {}) {
  session.requireAdmin();
  const sub = db.get().prepare('SELECT * FROM subcategories WHERE id = ?').get(Number(id));
  if (!sub) fail('Subkategori tidak ditemukan.');
  const name = cleanName(subcategory_name);
  const dup = db
    .get()
    .prepare('SELECT id FROM subcategories WHERE category_id = ? AND subcategory_name = ? COLLATE NOCASE AND id != ?')
    .get(sub.category_id, name, sub.id);
  if (dup) fail('Subkategori dengan nama tersebut sudah ada pada kategori ini.');
  db.get().prepare('UPDATE subcategories SET subcategory_name = ? WHERE id = ?').run(name, sub.id);
  activity.log('Ubah Subkategori', `Mengubah subkategori "${sub.subcategory_name}" menjadi "${name}".`);
  return true;
}

function removeSub(id) {
  session.requireAdmin();
  const sub = db.get().prepare('SELECT * FROM subcategories WHERE id = ?').get(Number(id));
  if (!sub) fail('Subkategori tidak ditemukan.');
  const used = db.get().prepare('SELECT COUNT(*) AS n FROM archives WHERE subcategory_id = ?').get(sub.id).n;
  if (used > 0) fail(`Subkategori masih digunakan oleh ${used} arsip dan tidak dapat dihapus.`);
  db.get().prepare('DELETE FROM subcategories WHERE id = ?').run(sub.id);
  activity.log('Hapus Subkategori', `Menghapus subkategori "${sub.subcategory_name}".`);
  return true;
}

function updateCategory(id, { description } = {}) {
  session.requireAdmin();
  const cat = db.get().prepare('SELECT * FROM categories WHERE id = ?').get(Number(id));
  if (!cat) fail('Kategori tidak ditemukan.');
  const desc = String(description || '').trim().slice(0, 300);
  db.get().prepare('UPDATE categories SET description = ? WHERE id = ?').run(desc, cat.id);
  activity.log('Ubah Kategori', `Memperbarui deskripsi ${cat.category_name}.`);
  return true;
}

module.exports = { list, fieldsFor, parseFields, createSub, updateSub, removeSub, updateCategory };
