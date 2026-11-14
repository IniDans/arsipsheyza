'use strict';
const { ipcMain } = require('electron');
const logger = require('./logger');
const { AppError } = require('./errors');
const session = require('./session');

const auth = require('./services/auth');
const users = require('./services/users');
const categories = require('./services/categories');
const archives = require('./services/archives');
const dashboard = require('./services/dashboard');
const reports = require('./services/reports');
const backup = require('./services/backup');
const settings = require('./services/settings');
const activity = require('./services/activity');

// Setiap handler mengembalikan { ok, data } atau { ok:false, error } agar
// pesan error tampil rapi di antarmuka.
const handlers = {
  'app:info': () => settings.publicInfo(),

  'auth:login': (p) => auth.login(p),
  'auth:logout': () => auth.logout(),
  'auth:me': () => auth.me(),
  'auth:changePassword': (p) => auth.changePassword(p),

  'dashboard:get': () => dashboard.get(),

  'categories:list': () => categories.list(),
  'categories:update': (id, p) => categories.updateCategory(id, p),
  'subcategories:create': (p) => categories.createSub(p),
  'subcategories:update': (id, p) => categories.updateSub(id, p),
  'subcategories:delete': (id) => categories.removeSub(id),

  'archives:list': (f) => archives.list(f),
  'archives:get': (id) => archives.get(id),
  'archives:create': (data, files) => archives.create(data, files),
  'archives:update': (id, data, changes) => archives.update(id, data, changes),
  'archives:delete': (id) => archives.remove(id),
  'archives:filterOptions': () => archives.filterOptions(),
  'archives:previewNumber': (date) => archives.previewNumber(date),

  'files:pick': () => archives.pickFiles(),
  'files:read': (id) => archives.readFile(id),
  'files:openExternal': (id) => archives.openExternal(id),
  'files:export': (p) => archives.exportFiles(p),

  'reports:query': (p) => reports.query(p),
  'reports:exportPdf': (p) => reports.exportPdf(p),
  'reports:exportXlsx': (p) => reports.exportXlsx(p),
  'reports:print': (p) => reports.print(p),

  'backup:create': (p) => backup.create(p),
  'backup:list': () => backup.list(),
  'backup:inspect': (file) => {
    session.requireAdmin();
    return backup.inspect(file);
  },
  'backup:pickFile': () => backup.pickFile(),
  'backup:restore': (p) => backup.restore(p),

  'users:list': () => users.list(),
  'users:create': (p) => users.create(p),
  'users:update': (id, p) => users.update(id, p),
  'users:resetPassword': (id, pw) => users.resetPassword(id, pw),
  'users:delete': (id) => users.remove(id),

  'settings:get': () => settings.get(),
  'settings:update': (p) => settings.update(p),
  'settings:changeDocumentsDir': () => settings.changeDocumentsDir(),
  'settings:changeBackupDir': () => settings.changeBackupDir(),
  'settings:openFolder': (which) => settings.openFolder(which),

  'logs:list': (p) => {
    session.requireAdmin();
    return activity.list(p);
  },
};

function register() {
  for (const [channel, fn] of Object.entries(handlers)) {
    ipcMain.handle(channel, async (_event, ...args) => {
      try {
        return { ok: true, data: await fn(...args) };
      } catch (err) {
        if (err instanceof AppError) return { ok: false, error: err.message, code: err.code };
        logger.error(`IPC ${channel} gagal`, err);
        let message = 'Terjadi kesalahan tak terduga. Detail tercatat di folder logs.';
        if (/UNIQUE constraint failed/i.test(err.message)) message = 'Data yang sama sudah ada.';
        else if (/FOREIGN KEY constraint failed/i.test(err.message)) message = 'Data masih terhubung dengan data lain.';
        else if (err.code === 'EBUSY' || err.code === 'EPERM') message = 'File sedang digunakan oleh aplikasi lain.';
        else if (err.code === 'ENOSPC') message = 'Ruang penyimpanan tidak cukup.';
        return { ok: false, error: message, code: 'INTERNAL' };
      }
    });
  }
}

module.exports = { register, channels: Object.keys(handlers) };
