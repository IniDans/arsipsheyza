'use strict';
// Sesi login disimpan di proses utama, sehingga hak akses tidak dapat
// dimanipulasi dari sisi tampilan (renderer).
const { fail } = require('./errors');

let user = null;

module.exports = {
  set(u) {
    user = u ? { id: u.id, username: u.username, full_name: u.full_name, role: u.role } : null;
  },
  clear() {
    user = null;
  },
  current() {
    return user;
  },
  require() {
    if (!user) fail('Sesi berakhir. Silakan login kembali.', 'UNAUTHENTICATED');
    return user;
  },
  requireAdmin() {
    const u = this.require();
    if (u.role !== 'admin') fail('Hanya administrator yang dapat melakukan tindakan ini.', 'FORBIDDEN');
    return u;
  },
};
