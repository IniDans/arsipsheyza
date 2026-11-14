'use strict';
const db = require('../db');
const session = require('../session');

function log(activity, description = '', userId) {
  const uid = userId === undefined ? session.current()?.id ?? null : userId;
  db.get()
    .prepare('INSERT INTO activity_logs (user_id, activity, description) VALUES (?, ?, ?)')
    .run(uid, activity, description);
}

function recent(limit = 10) {
  return db
    .get()
    .prepare(
      `SELECT l.id, l.activity, l.description, l.created_at, u.full_name AS user_name
       FROM activity_logs l LEFT JOIN users u ON u.id = l.user_id
       ORDER BY l.id DESC LIMIT ?`
    )
    .all(limit);
}

function list({ page = 1, pageSize = 25, keyword = '' } = {}) {
  const size = Math.min(Math.max(Number(pageSize) || 25, 5), 200);
  const p = Math.max(Number(page) || 1, 1);
  const where = [];
  const params = [];
  if (keyword && String(keyword).trim()) {
    const kw = `%${String(keyword).trim()}%`;
    where.push('(l.activity LIKE ? OR l.description LIKE ? OR u.full_name LIKE ? OR u.username LIKE ?)');
    params.push(kw, kw, kw, kw);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const conn = db.get();
  const total = conn
    .prepare(`SELECT COUNT(*) AS n FROM activity_logs l LEFT JOIN users u ON u.id = l.user_id ${whereSql}`)
    .get(...params).n;
  const rows = conn
    .prepare(
      `SELECT l.id, l.activity, l.description, l.created_at, u.full_name AS user_name, u.username
       FROM activity_logs l LEFT JOIN users u ON u.id = l.user_id
       ${whereSql} ORDER BY l.id DESC LIMIT ? OFFSET ?`
    )
    .all(...params, size, (p - 1) * size);
  return { rows, total, page: p, pageSize: size };
}

module.exports = { log, recent, list };
