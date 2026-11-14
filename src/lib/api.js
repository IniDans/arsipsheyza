// Pemanggil IPC ke proses utama. Melempar Error berisi pesan yang siap
// ditampilkan kepada pengguna.
const listeners = new Set();

export function onSessionExpired(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export async function call(channel, ...args) {
  if (!window.arsipku) throw new Error('Aplikasi harus dijalankan melalui ARSIPKU desktop.');
  const res = await window.arsipku.invoke(channel, ...args);
  if (!res || !res.ok) {
    if (res?.code === 'UNAUTHENTICATED') listeners.forEach((fn) => fn());
    const err = new Error(res?.error || 'Terjadi kesalahan.');
    err.code = res?.code;
    throw err;
  }
  return res.data;
}
