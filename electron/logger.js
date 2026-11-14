'use strict';
// Log teknis aplikasi (error, peringatan) ke folder logs/.
// Aktivitas pengguna dicatat terpisah di tabel activity_logs.
const fs = require('node:fs');
const path = require('node:path');
const { paths } = require('./paths');

function write(level, message, err) {
  const now = new Date();
  const stamp = now.toISOString();
  const file = path.join(paths.logsDir(), `arsipku-${stamp.slice(0, 7)}.log`);
  let line = `[${stamp}] ${level.toUpperCase()} ${message}`;
  if (err) line += `\n  ${err.stack || err.message || String(err)}`;
  try {
    fs.mkdirSync(paths.logsDir(), { recursive: true });
    fs.appendFileSync(file, line + '\n', 'utf8');
  } catch {
    // log gagal ditulis tidak boleh menghentikan aplikasi
  }
  if (level === 'error') console.error(line);
}

module.exports = {
  info: (msg) => write('info', msg),
  warn: (msg, err) => write('warn', msg, err),
  error: (msg, err) => write('error', msg, err),
};
