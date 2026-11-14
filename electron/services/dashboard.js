'use strict';
const db = require('../db');
const session = require('../session');
const activity = require('./activity');

function get() {
  session.require();
  const conn = db.get();
  const now = new Date();
  const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const totalArchives = conn.prepare('SELECT COUNT(*) AS n FROM archives').get().n;
  const thisMonth = conn.prepare('SELECT COUNT(*) AS n FROM archives WHERE substr(input_date, 1, 7) = ?').get(monthPrefix).n;
  const filesRow = conn.prepare('SELECT COUNT(*) AS n, COALESCE(SUM(file_size), 0) AS size FROM archive_files').get();

  const byCategory = conn
    .prepare(
      `SELECT c.id, c.code, c.category_name, COUNT(a.id) AS total
       FROM categories c LEFT JOIN archives a ON a.category_id = c.id
       GROUP BY c.id ORDER BY c.sort_order, c.code`
    )
    .all();

  // Tren 12 bulan terakhir berdasarkan tanggal input.
  const months = [];
  for (let i = 11; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  const monthly = conn
    .prepare(
      `SELECT substr(input_date, 1, 7) AS month, COUNT(*) AS total FROM archives
       WHERE substr(input_date, 1, 7) >= ? GROUP BY month`
    )
    .all(months[0]);
  const monthMap = new Map(monthly.map((m) => [m.month, m.total]));

  return {
    totalArchives,
    thisMonth,
    totalFiles: filesRow.n,
    totalFileSize: filesRow.size,
    categoriesUsed: byCategory.filter((c) => c.total > 0).length,
    byCategory,
    monthly: months.map((m) => ({ month: m, total: monthMap.get(m) || 0 })),
    recentActivity: activity.recent(8),
    recentArchives: conn
      .prepare(
        `SELECT a.id, a.archive_number, a.document_name, a.input_date, c.code AS category_code, c.category_name
         FROM archives a JOIN categories c ON c.id = a.category_id ORDER BY a.id DESC LIMIT 5`
      )
      .all(),
  };
}

module.exports = { get };
