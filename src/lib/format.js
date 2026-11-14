const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

export function formatDate(iso, short = false) {
  if (!iso) return '-';
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  const names = short ? MONTHS_SHORT : MONTHS;
  return `${Number(m[3])} ${names[Number(m[2]) - 1]} ${m[1]}`;
}

export function formatDateTime(value) {
  if (!value) return '-';
  // Nilai dari SQLite: "YYYY-MM-DD HH:MM:SS" (waktu lokal) atau ISO.
  const d = /T.*Z$/.test(value) ? new Date(value) : new Date(String(value).replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return value;
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}, ${pad(d.getHours())}.${pad(d.getMinutes())}`;
}

export function formatMonth(ym) {
  const [y, m] = String(ym).split('-');
  return `${MONTHS_SHORT[Number(m) - 1]} ${String(y).slice(2)}`;
}

export function formatBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toLocaleString('id-ID', { maximumFractionDigits: v < 10 ? 1 : 0 })} ${units[i]}`;
}

export const formatNumber = (n) => Number(n || 0).toLocaleString('id-ID');

export function formatMonthLong(ym) {
  const m = String(ym || '').match(/^(\d{4})-(\d{2})$/);
  return m ? `${MONTHS[Number(m[2]) - 1]} ${m[1]}` : ym || '-';
}

// Menampilkan nilai isian Informasi Dokumen sesuai tipenya.
export function formatExtraValue(field, value) {
  if (value === undefined || value === null || value === '') return '';
  if (field.type === 'currency') return `Rp ${Number(value).toLocaleString('id-ID')}`;
  if (field.type === 'date') return formatDate(value);
  if (field.type === 'month') return formatMonthLong(value);
  return String(value);
}

export function todayIso() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export const ROLE_LABEL = { admin: 'Administrator', operator: 'Operator' };
