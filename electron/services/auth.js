'use strict';
const db = require('../db');
const session = require('../session');
const activity = require('./activity');
const { fail } = require('../errors');
const { hashPassword, verifyPassword, validatePasswordStrength } = require('../security');

// Pembatasan percobaan login yang gagal (per username).
const attempts = new Map();
const MAX_ATTEMPTS = 5;
const LOCK_MS = 30_000;

function publicUser(u) {
  return {
    id: u.id,
    username: u.username,
    full_name: u.full_name,
    role: u.role,
    must_change_password: !!u.must_change_password,
  };
}

function login({ username, password } = {}) {
  const name = String(username || '').trim();
  if (!name || !password) fail('Username dan password wajib diisi.');

  const key = name.toLowerCase();
  const state = attempts.get(key);
  if (state && state.lockedUntil > Date.now()) {
    const secs = Math.ceil((state.lockedUntil - Date.now()) / 1000);
    fail(`Terlalu banyak percobaan login. Coba lagi dalam ${secs} detik.`);
  }

  const user = db.get().prepare('SELECT * FROM users WHERE username = ?').get(name);
  const valid = user && verifyPassword(password, user.password_hash);
  if (!valid) {
    const count = (state?.lockedUntil > Date.now() ? 0 : state?.count || 0) + 1;
    attempts.set(key, { count, lockedUntil: count >= MAX_ATTEMPTS ? Date.now() + LOCK_MS : 0 });
    if (user) activity.log('Login Gagal', `Percobaan login gagal untuk "${user.username}".`, user.id);
    fail('Username atau password salah.');
  }
  if (!user.is_active) fail('Akun ini dinonaktifkan. Hubungi administrator.');

  attempts.delete(key);
  db.get().prepare("UPDATE users SET last_login_at = datetime('now', 'localtime') WHERE id = ?").run(user.id);
  session.set(user);
  activity.log('Login', `${user.full_name} masuk ke aplikasi.`);
  return publicUser(user);
}

function logout() {
  const u = session.current();
  if (u) activity.log('Logout', `${u.full_name} keluar dari aplikasi.`);
  session.clear();
  return true;
}

function me() {
  const u = session.current();
  if (!u) return null;
  const row = db.get().prepare('SELECT * FROM users WHERE id = ?').get(u.id);
  if (!row || !row.is_active) {
    session.clear();
    return null;
  }
  return publicUser(row);
}

function changePassword({ currentPassword, newPassword } = {}) {
  const u = session.require();
  const row = db.get().prepare('SELECT * FROM users WHERE id = ?').get(u.id);
  if (!verifyPassword(currentPassword || '', row.password_hash)) fail('Password saat ini salah.');
  const problem = validatePasswordStrength(newPassword);
  if (problem) fail(problem);
  if (currentPassword === newPassword) fail('Password baru harus berbeda dari password saat ini.');
  db.get()
    .prepare(
      "UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = datetime('now', 'localtime') WHERE id = ?"
    )
    .run(hashPassword(newPassword), u.id);
  activity.log('Ubah Password', `${u.full_name} mengubah password akun.`);
  return true;
}

module.exports = { login, logout, me, changePassword };
