# ARSIPKU

## Product Requirements Document (PRD)

**Versi:** 1.0\
**Platform:** Windows Desktop Application\
**Format Distribusi:** `.exe`\
**Arsitektur:** Offline / Local-Based Application\
**Status:** Initial Development

------------------------------------------------------------------------

# 1. Product Overview

## 1.1 Nama Produk

**ARSIPKU (Aplikasi Sistem Informasi Pengelolaan Arsip Sekolah)**

## 1.2 Deskripsi Produk

ARSIPKU merupakan aplikasi desktop berbasis Windows yang dirancang untuk
membantu sekolah dalam mengelola, menyimpan, mengklasifikasikan,
mencari, dan membuat laporan dokumen administrasi sekolah secara
digital.

Aplikasi ini mengadaptasi sistem E-Arsip berbasis 8 Standar Nasional
Pendidikan dengan menyederhanakan struktur menu dan proses pengarsipan
menjadi sistem yang lebih praktis dan mudah digunakan.

ARSIPKU dirancang untuk berjalan sepenuhnya secara offline tanpa
membutuhkan hosting, domain, VPS, maupun koneksi internet.

## 1.3 Tujuan Produk

1.  Mendigitalisasi proses pengarsipan dokumen sekolah.
2.  Mempermudah pencarian dan pengelompokan dokumen.
3.  Mengurangi risiko kehilangan dokumen fisik.
4.  Mempermudah pengelolaan administrasi sekolah.
5.  Menyediakan laporan arsip secara otomatis.
6.  Menyediakan sistem backup dan restore data.

## 1.4 Target Pengguna

-   Kepala sekolah.
-   Tenaga administrasi sekolah.
-   Pengelola arsip.
-   Guru dan tenaga kependidikan yang diberikan akses.

------------------------------------------------------------------------

# 2. Product Scope

## 2.1 Platform

Aplikasi dikembangkan khusus untuk sistem operasi Windows.

-   Windows 10.
-   Windows 11.
-   Desktop dan laptop.
-   Installer berbentuk `.exe`.

## 2.2 Arsitektur Sistem

Aplikasi menggunakan arsitektur local-based application.

-   **Frontend:** React.js.
-   **Desktop Framework:** Electron.js.
-   **Backend:** Node.js.
-   **Database:** SQLite.
-   **Styling:** Tailwind CSS.
-   **PDF Viewer:** PDF.js.

## 2.3 Batasan Sistem

ARSIPKU versi pertama tidak membutuhkan:

-   Web hosting.
-   Domain.
-   VPS.
-   Cloud database.
-   API eksternal.
-   Internet.
-   Sinkronisasi cloud.
-   Server eksternal.

Seluruh data disimpan secara lokal pada perangkat pengguna.

------------------------------------------------------------------------

# 3. Core Features

## 3.1 Authentication System

Fitur autentikasi untuk membatasi akses aplikasi.

**Fungsi:** - Login menggunakan username dan password. - Logout. -
Mengubah password. - Pengelolaan akun pengguna. - Hak akses berdasarkan
role.

**Role pengguna:** - **Administrator:** memiliki akses penuh terhadap
seluruh fitur. - **Operator:** dapat mengelola arsip dan laporan, tetapi
tidak dapat mengelola akun administrator maupun pengaturan sistem yang
dibatasi.

## 3.2 Dashboard

Dashboard merupakan halaman utama setelah pengguna berhasil login.

Informasi yang ditampilkan:

-   Total seluruh arsip.
-   Total dokumen bulan ini.
-   Total dokumen berdasarkan kategori.
-   Total file PDF tersimpan.
-   Aktivitas pengarsipan terbaru.
-   Grafik distribusi arsip berdasarkan 8 standar pendidikan.

## 3.3 Manajemen Arsip

Fitur utama untuk mengelola seluruh dokumen sekolah.

**Operasi yang tersedia:**

-   Create: menambahkan arsip.
-   Read: melihat detail arsip.
-   Update: mengedit arsip.
-   Delete: menghapus arsip.
-   Preview: melihat dokumen PDF.
-   Download/Export: menyalin dokumen ke lokasi pilihan.

### Form Input Arsip

  Field           Keterangan
  --------------- --------------------------------
  ID Arsip        Identitas unik otomatis
  Nomor Arsip     Nomor urut otomatis
  Tanggal Input   Otomatis
  Kategori        Pilihan 8 standar
  Subkategori     Pilihan sesuai kategori
  Jenis Dokumen   Nama jenis dokumen
  Nomor Dokumen   Nomor surat/dokumen
  Nama Dokumen    Judul dokumen
  Deskripsi       Keterangan dokumen
  Lampiran        Jenis dan jumlah lampiran
  Kode Simpan     Kode klasifikasi arsip
  File Dokumen    Upload PDF
  Tahun           Tahun dokumen, jika diperlukan

**Ketentuan:** - Nomor arsip dibuat otomatis. - Tanggal input diisi
otomatis dan dapat disesuaikan jika diperlukan. - File utama dibatasi
pada format PDF. - Satu arsip dapat memiliki lebih dari satu lampiran. -
Sistem harus mencegah file duplikat berdasarkan identitas penyimpanan.

## 3.4 Kategori Arsip

Sistem memiliki 8 kategori utama berdasarkan standar pendidikan.

### A. Standar Isi

-   Kurikulum.
-   Pengembangan Kurikulum.
-   Pengembangan Diri.

### B. Standar Proses

-   Administrasi Guru.
-   Supervisi.

### C. Standar Penilaian

-   Perencanaan Penilaian.
-   Evaluasi.
-   Pelaksanaan Penilaian.
-   Lain-lain.

### D. Standar Sarana dan Prasarana

-   Legalitas.
-   Laporan.
-   Buku Teks.

### E. Standar Pengelolaan Sekolah

-   Visi dan Misi Sekolah.
-   Perencanaan.
-   Pelaksanaan.
-   Evaluasi.
-   Lain-lain.

### F. Standar Kompetensi Lulusan

-   Tugas Siswa.
-   Ujian Nasional.
-   Prestasi Siswa.
-   Lain-lain.

### G. Standar Pendidik dan Tenaga Kependidikan

-   Pendidik.
-   Tenaga Kependidikan.
-   Supervisi.

### H. Standar Pengelolaan Keuangan

-   Investasi Sarana dan Prasarana.
-   Keuangan.
-   Pedoman.

Setiap kategori dan subkategori dapat dipilih ketika pengguna membuat
arsip.

Administrator dapat mengelola daftar subkategori melalui pengaturan.

## 3.5 Search and Filter

Fitur pencarian untuk menemukan arsip secara cepat.

**Pencarian berdasarkan:** - Nama dokumen. - Nomor dokumen. - Nomor
arsip. - Jenis dokumen. - Kode simpan. - Kategori. - Subkategori. -
Tahun. - Tanggal input.

**Filter tambahan:** - Berdasarkan kategori. - Berdasarkan periode
tanggal. - Berdasarkan tahun. - Berdasarkan jenis dokumen.

## 3.6 Document Viewer

Fitur untuk melihat dokumen tanpa perlu membuka aplikasi PDF eksternal.

**Fungsi:** - Preview PDF. - Navigasi halaman. - Zoom in dan zoom out. -
Membuka dokumen dalam aplikasi eksternal. - Export atau salin file.

## 3.7 Report Management

Sistem menyediakan laporan arsip berdasarkan data yang tersimpan.

**Jenis laporan:** - Laporan seluruh arsip. - Laporan berdasarkan
kategori. - Laporan berdasarkan subkategori. - Laporan berdasarkan
periode. - Laporan berdasarkan tahun.

**Format ekspor:** - PDF. - Excel (`.xlsx`).

Laporan dapat dicetak langsung melalui printer Windows.

## 3.8 Backup and Restore

Fitur penting untuk menjaga keamanan data lokal.

**Backup:** - Backup database SQLite. - Backup seluruh dokumen PDF. -
Backup seluruh data dalam satu paket. - Backup manual. - Pengaturan
lokasi backup.

**Restore:** - Memulihkan database. - Memulihkan dokumen. - Memulihkan
seluruh data dari paket backup. - Validasi backup sebelum proses
pemulihan.

Sistem tidak boleh menghapus data lama sebelum proses restore berhasil
divalidasi.

## 3.9 User Management

Administrator dapat:

-   Menambahkan pengguna.
-   Mengubah data pengguna.
-   Menghapus pengguna.
-   Mengatur role pengguna.
-   Mengubah password pengguna.

## 3.10 Application Settings

Pengaturan aplikasi mencakup:

-   Informasi sekolah.
-   Nama aplikasi.
-   Identitas sekolah.
-   Lokasi penyimpanan dokumen.
-   Lokasi backup.
-   Pengaturan akun.
-   Informasi versi aplikasi.

------------------------------------------------------------------------

# 4. User Interface (UI/UX)

## 4.1 Design Concept

Konsep desain menggunakan gaya modern, minimalis, profesional, dan mudah
dipahami.

**Prinsip desain:** - Clean interface. - Minimalist dashboard. -
Consistent navigation. - Responsive desktop layout. - Clear
typography. - Simple interaction.

## 4.2 Layout

Aplikasi menggunakan struktur dashboard dengan:

**Sidebar:** - Logo ARSIPKU. - Dashboard. - Data Arsip. - Kategori
Arsip. - Laporan. - Manajemen Pengguna. - Pengaturan. - Logout.

**Main Content:** - Page title. - Breadcrumb. - Statistik. - Tabel
data. - Form input. - Modal konfirmasi.

## 4.3 Design Guidelines

-   Warna utama: biru navy.
-   Warna sekunder: biru muda.
-   Background: putih dan abu-abu terang.
-   Font: Inter.
-   Ikon: Lucide Icons.
-   Komponen: Card, table, modal, dropdown, sidebar.

------------------------------------------------------------------------

# 5. Database Requirements

Database menggunakan SQLite dengan penyimpanan lokal.

## 5.1 `users`

-   `id`
-   `username`
-   `password_hash`
-   `full_name`
-   `role`
-   `created_at`

## 5.2 `categories`

-   `id`
-   `category_name`
-   `description`

## 5.3 `subcategories`

-   `id`
-   `category_id`
-   `subcategory_name`

## 5.4 `archives`

-   `id`
-   `archive_number`
-   `category_id`
-   `subcategory_id`
-   `input_date`
-   `document_type`
-   `document_number`
-   `document_name`
-   `description`
-   `attachment_description`
-   `storage_code`
-   `document_year`
-   `created_by`
-   `created_at`
-   `updated_at`

## 5.5 `archive_files`

-   `id`
-   `archive_id`
-   `original_filename`
-   `stored_filename`
-   `file_path`
-   `file_size`
-   `uploaded_at`

## 5.6 `activity_logs`

-   `id`
-   `user_id`
-   `activity`
-   `description`
-   `created_at`

## 5.7 `settings`

-   `id`
-   `setting_key`
-   `setting_value`

Database harus menggunakan foreign key, validasi data, dan mekanisme
transaksi untuk menjaga konsistensi data.

------------------------------------------------------------------------

# 6. Non-Functional Requirements

## 6.1 Performance

-   Aplikasi dapat dibuka dengan cepat.
-   Pencarian arsip tidak membutuhkan koneksi internet.
-   Tabel menggunakan pagination jika jumlah data besar.
-   Preview PDF tidak menghambat proses pengarsipan lainnya.

## 6.2 Security

-   Password disimpan menggunakan hashing yang aman.
-   Hak akses dibatasi berdasarkan role.
-   Validasi file sebelum disimpan.
-   Nama file disimpan menggunakan identitas unik.
-   Penghapusan arsip memerlukan konfirmasi.
-   Aktivitas penting dicatat dalam activity logs.

## 6.3 Reliability

-   Data tetap tersimpan setelah aplikasi ditutup.
-   Aplikasi tidak menghapus dokumen ketika terjadi kegagalan database.
-   Backup dapat digunakan untuk pemulihan.
-   Database menggunakan transaksi untuk operasi penting.

## 6.4 Compatibility

-   Mendukung Windows 10 dan Windows 11.
-   Tidak membutuhkan instalasi database secara terpisah.
-   Tidak membutuhkan Node.js untuk pengguna akhir.
-   Tidak membutuhkan internet.

------------------------------------------------------------------------

# 7. Data Storage Architecture

Data aplikasi disimpan di direktori lokal pengguna Windows.

Contoh struktur:

``` text
ARSIPKU/
├── database/
│   └── arsipku.db
├── documents/
│   ├── standar-isi/
│   ├── standar-proses/
│   ├── standar-penilaian/
│   ├── sarana-prasarana/
│   ├── pengelolaan-sekolah/
│   ├── kompetensi-lulusan/
│   ├── sdm/
│   └── keuangan/
├── backup/
└── logs/
```

Database dan dokumen harus tetap berada di luar direktori instalasi
aplikasi agar tidak terhapus ketika aplikasi diperbarui atau
di-uninstall.

------------------------------------------------------------------------

# 8. Application Workflow

## 8.1 Login

Pengguna membuka `ARSIPKU.exe`, kemudian memasukkan username dan
password.

## 8.2 Dashboard

Sistem menampilkan ringkasan seluruh arsip.

## 8.3 Input Arsip

Pengguna memilih menu Data Arsip, menekan tombol Tambah Arsip, mengisi
informasi, memilih kategori dan subkategori, kemudian mengunggah file
PDF.

## 8.4 Penyimpanan

Sistem memvalidasi data, menyimpan file PDF ke direktori lokal, kemudian
menyimpan metadata ke SQLite.

## 8.5 Pencarian

Pengguna memasukkan kata kunci atau menggunakan filter kategori dan
tanggal.

## 8.6 Laporan

Pengguna memilih jenis laporan dan periode, kemudian mengekspor
hasilnya.

## 8.7 Backup

Pengguna menjalankan backup untuk menyimpan database beserta seluruh
dokumen.

------------------------------------------------------------------------

# 9. Minimum Viable Product (MVP)

Pengembangan tahap pertama wajib mencakup:

1.  Authentication.
2.  Dashboard.
3.  CRUD arsip.
4.  Delapan kategori pendidikan.
5.  Subkategori arsip.
6.  Upload PDF.
7.  Preview PDF.
8.  Search and filter.
9.  Export laporan PDF dan Excel.
10. Backup dan restore.
11. User management.
12. Installer Windows `.exe`.

Fitur tambahan seperti OCR, AI, cloud synchronization, dan integrasi
sistem eksternal tidak termasuk dalam MVP.

------------------------------------------------------------------------

# 10. Development Roadmap

## Phase 1: Planning and Setup

-   Menyiapkan struktur proyek.
-   Menentukan desain UI/UX.
-   Menyiapkan database SQLite.
-   Menyiapkan konfigurasi Electron dan React.

## Phase 2: Core Development

-   Authentication.
-   Dashboard.
-   Database integration.
-   CRUD arsip.
-   Kategori dan subkategori.
-   Document management.

## Phase 3: Supporting Features

-   Search and filter.
-   PDF Viewer.
-   Report generation.
-   User management.
-   Activity logs.

## Phase 4: Data Protection

-   Backup database.
-   Backup dokumen.
-   Restore data.
-   Pengujian keamanan dan integritas data.

## Phase 5: Testing and Deployment

-   Functional testing.
-   Performance testing.
-   Offline testing.
-   Windows compatibility testing.
-   Build installer `.exe`.
-   User acceptance testing.

------------------------------------------------------------------------

# 11. Acceptance Criteria

ARSIPKU dinyatakan memenuhi target MVP apabila:

1.  Aplikasi dapat berjalan tanpa internet.
2.  Pengguna dapat login dan logout.
3.  Pengguna dapat menambahkan, mengedit, melihat, dan menghapus arsip.
4.  Delapan kategori pendidikan tersedia.
5.  Subkategori dapat digunakan dalam proses pengarsipan.
6.  File PDF dapat diunggah dan dibuka.
7.  Pencarian dapat menemukan dokumen berdasarkan metadata.
8.  Laporan dapat diekspor menjadi PDF dan Excel.
9.  Backup dan restore berhasil dilakukan.
10. Data tetap tersedia setelah aplikasi ditutup dan dibuka kembali.
11. Installer dapat memasang aplikasi di Windows 10/11.
12. Pembaruan aplikasi tidak menghapus database dan dokumen pengguna.

------------------------------------------------------------------------

# 12. Final Product Definition

ARSIPKU adalah aplikasi pengelolaan arsip sekolah berbasis desktop
Windows yang beroperasi secara offline menggunakan database SQLite dan
penyimpanan dokumen lokal.

Produk difokuskan pada kemudahan penggunaan, pengelolaan arsip
terstruktur, pencarian cepat, pelaporan otomatis, serta perlindungan
data melalui sistem backup dan restore.

**Product Philosophy:**

"One Application, Eight Standards, Integrated Archive Management."

**Tidak membutuhkan hosting, tidak membutuhkan server online, dan tidak
membutuhkan biaya operasional berbasis cloud.**
