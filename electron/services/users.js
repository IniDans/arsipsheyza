'use strict';
const db = require('../db');
const session = require('../session');
const activity = require('./activity');
const { fail } = require('../errors');
const { hashPassword, validatePasswordStrength } = require('../security');

const ROLES = ['admin', 'operator'];
const ROLE_LABEL = { admin: 'Administrator', operator: 'Operator' };

function list() {
  session.requireAdmin();
  return db
    .get()
    .prepare(
      `SELECT u.id, u.username, u.full_name, u.role, u.is_active, u.must_change_password,
              u.last_login_at, u.created_at,
              (SELECT COUNT(*) FROM archives a WHERE a.created_by = u.id) AS archive_count
       FROM users u ORDER BY u.role, u.full_name COLLATE NOCASE`
    )
    .all();
}

function validate(data, { isNew }) {
  const username = String(data.username || '').trim();
  const fullName = String(data.full_name || '').trim();
  const role = String(data.role || '');
  if (!/^[A-Za-z0-9._-]{3,32}$/.test(username)) {
    fail('Username 3–32 karakter, hanya huruf, angka, titik, garis bawah, atau tanda hubung.');
  }
  if (!fullName) fail('Nama lengkap wajib diisi.');
  if (fullName.length > 100) fail('Nama lengkap maksimal 100 karakter.');
  if (!ROLES.includes(role)) fail('Role tidak valid.');
  if (isNew) {
    const problem = validatePasswordStrength(data.password);
    if (problem) fail(problem);
  }
  return { username, fullName, role, isActive: data.is_active === false || data.is_active === 0 ? 0 : 1 };
}

function activeAdminCount(excludeId) {
  return db
    .get()
    .prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND is_active = 1 AND id != ?")
    .get(excludeId ?? -1).n;
}

function create(data = {}) {
  session.requireAdmin();
  const v = validate(data, { isNew: true });
  const exists = db.get().prepare('SELECT id FROM users WHERE username = ?').get(v.username);
  if (exists) fail('Username sudah digunakan.');
  const res = db
    .get()
    .prepare(
      `INSERT INTO users (username, password_hash, full_name, role, is_active, must_change_password)
       VALUES (?, ?, ?, ?, ?, 1)`
    )
    .run(v.username, hashPassword(data.password), v.fullName, v.role, v.isActive);
  activity.log('Tambah Pengguna', `Menambahkan pengguna "${v.username}" (${ROLE_LABEL[v.role]}).`);
  return { id: Number(res.lastInsertRowid) };
}

function update(id, data = {}) {
  const me = session.requireAdmin();
  const userId = Number(id);
  const existing = db.get().prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!existing) fail('Pengguna tidak ditemukan.');
  const v = validate(data, { isNew: false });

  const dup = db.get().prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(v.username, userId);
  if (dup) fail('Username sudah digunakan.');

  const losesAdmin = existing.role === 'admin' && existing.is_active && (v.role !== 'admin' || !v.isActive);
  if (losesAdmin && activeAdminCount(userId) === 0) {
    fail('Harus ada minimal satu administrator aktif.');
  }
  if (userId === me.id && (v.role !== 'admin' || !v.isActive)) {
    fail('Anda tidak dapat menurunkan role atau menonaktifkan akun sendiri.');
  }

  db.transaction(() => {
    db.get()
      .prepare(
        `UPDATE users SET username = ?, full_name = ?, role = ?, is_active = ?,
         updated_at = datetime('now', 'localtime') WHERE id = ?`
      )
      .run(v.username, v.fullName, v.role, v.isActive, userId);
    if (data.password) {
      const problem = validatePasswordStrength(data.password);
      if (problem) fail(problem);
      db.get()
        .prepare('UPDATE users SET password_hash = ?, must_change_password = ? WHERE id = ?')
        .run(hashPassword(data.password), userId === me.id ? 0 : 1, userId);
    }
    activity.log('Ubah Pengguna', `Memperbarui data pengguna "${v.username}".`);
  });
  if (userId === me.id) session.set({ ...me, username: v.username, full_name: v.fullName, role: v.role });
  return true;
}

function resetPassword(id, password) {
  const me = session.requireAdmin();
  const userId = Number(id);
  const existing = db.get().prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!existing) fail('Pengguna tidak ditemukan.');
  const problem = validatePasswordStrength(password);
  if (problem) fail(problem);
  db.get()
    .prepare(
      "UPDATE users SET password_hash = ?, must_change_password = ?, updated_at = datetime('now', 'localtime') WHERE id = ?"
    )
    .run(hashPassword(password), userId === me.id ? 0 : 1, userId);
  activity.log('Reset Password', `Mengatur ulang password pengguna "${existing.username}".`);
  return true;
}

function remove(id) {
  const me = session.requireAdmin();
  const userId = Number(id);
  if (userId === me.id) fail('Anda tidak dapat menghapus akun sendiri.');
  const existing = db.get().prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!existing) fail('Pengguna tidak ditemukan.');
  if (existing.role === 'admin' && existing.is_active && activeAdminCount(userId) === 0) {
    fail('Harus ada minimal satu administrator aktif.');
  }
  db.transaction(() => {
    db.get().prepare('DELETE FROM users WHERE id = ?').run(userId);
    activity.log('Hapus Pengguna', `Menghapus pengguna "${existing.username}".`);
  });
  return true;
}

module.exports = { list, create, update, resetPassword, remove };
