# ARSIPKU — Sistem Informasi Pengelolaan Arsip Sekolah

Aplikasi desktop Windows untuk mengelola arsip sekolah berdasarkan 8 Standar Nasional Pendidikan (A–H). Aplikasi ini berjalan sepenuhnya offline. Data tersimpan di komputer sendiri dan tidak dikirim ke internet.

## Instalasi (pengguna)

1. Jalankan `release\ARSIPKU-Setup-1.0.0.exe`.
2. Installer belum ditandatangani secara digital, jadi Windows SmartScreen mungkin menampilkan peringatan. Klik **More info → Run anyway**.
3. Pilih folder instalasi, lalu selesaikan. Shortcut akan dibuat di Desktop dan Start Menu.

**Login awal:** username `admin`, password `admin123`. Anda wajib mengganti password saat login pertama.

## Lokasi data

Semua data disimpan di luar folder instalasi, sehingga tetap aman saat aplikasi di-update atau di-uninstall:

```
Documents\ARSIPKU\
├── database\arsipku.db   ← basis data SQLite
├── documents\            ← file PDF arsip (per kategori)
├── backup\               ← hasil backup
├── logs\                 ← log aplikasi
└── tmp\
```

Lokasi ini dapat diubah lewat **Pengaturan → Lokasi Penyimpanan** (khusus admin). Untuk pengujian, lokasi juga dapat ditimpa dengan variabel lingkungan `ARSIPKU_DATA_DIR`.

## Fitur

- **Login & role**: Administrator dan Operator, dengan wajib ganti password pada login pertama.
- **Dashboard**: statistik arsip, grafik per 8 standar, arsip per bulan, dan arsip terbaru.
- **Data arsip**: tambah, lihat, edit, dan hapus arsip. Satu arsip dapat memuat banyak file PDF. Ada pencegahan duplikat, dan nomor arsip dibuat otomatis (`ARS-YYYY-NNNNN`).
- **Kategori**: 8 standar (A–H) dengan subkategori yang dapat dikelola admin.
- **Pencarian & filter**: berdasarkan kata kunci, kategori, subkategori, tahun, dan rentang tanggal.
- **Penampil PDF**: navigasi halaman, zoom, pas lebar, buka di aplikasi eksternal, dan ekspor salinan.
- **Laporan**: seluruh arsip, per kategori, per subkategori, per periode, atau per tahun. Laporan dapat diekspor ke PDF atau Excel, atau dicetak.
- **Backup & restore**: database saja, dokumen saja, atau lengkap (.zip). File backup divalidasi sebelum data diganti.
- **Manajemen pengguna**, **pengaturan sekolah**, dan **log aktivitas**.

## Pengembangan

Kebutuhan: Node.js 22.5+ (disarankan Node 24) dan npm. Build Tools C++ tidak diperlukan, karena SQLite memakai modul bawaan `node:sqlite`.

```bash
npm install        # pasang dependensi
npm run dev        # mode pengembangan (Vite + Electron, hot reload)
npm run dist       # build installer → release\ARSIPKU-Setup-<versi>.exe
```

Perintah lain:

- `npm run build:renderer`: build antarmuka React ke `dist/`.
- `npm start`: jalankan Electron dengan hasil build `dist/`.

### Struktur proyek

```
electron/            proses utama (main, preload, IPC, layanan, basis data)
  services/          logika bisnis: auth, archives, files, reports, backup, …
src/                 antarmuka React (Tailwind, React Router)
  pages/             halaman aplikasi
  components/        komponen UI, penampil PDF, layout
scripts/             skrip bantu (salin aset PDF.js)
build/               ikon aplikasi & installer
```

### Teknologi

Electron, React, Vite, Tailwind CSS, SQLite (`node:sqlite`), PDF.js, ExcelJS, archiver/yauzl, Lucide Icons, dan font Inter.
