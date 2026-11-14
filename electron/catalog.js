'use strict';
// Katalog kategori arsip perusahaan beserta isian "Informasi Dokumen" khusus.
//
// Setiap kategori dan subkategori dapat memiliki daftar isian tambahan (`fields`).
// Isian kategori berlaku untuk semua subkategorinya; isian subkategori ditampilkan
// setelahnya. Nilai yang diisi disimpan sebagai JSON di kolom `archives.extra_fields`.
//
// Tipe isian: text | currency | number | date | month | select

const f = (key, label, type = 'text', extra = {}) => ({ key, label, type, ...extra });
const opt = (...options) => ({ options });

const METODE_BAYAR = opt('Transfer Bank', 'Tunai', 'Cek / Giro', 'E-Wallet', 'Lainnya');
const STATUS_KONTRAK = opt('Aktif', 'Selesai', 'Dibatalkan');

const CATEGORIES = [
  {
    code: 'A',
    slug: 'keuangan',
    name: 'Keuangan',
    description: 'Transaksi masuk dan keluar, investor, investasi, gaji, bonus, dan pajak.',
    fields: [],
    subs: [
      {
        name: 'Pemasukan',
        fields: [
          f('sumber_dana', 'Sumber / Pihak Pembayar', 'text', { required: true }),
          f('nominal', 'Nominal', 'currency', { required: true }),
          f('tanggal_transaksi', 'Tanggal Transaksi', 'date'),
          f('metode_pembayaran', 'Metode Pembayaran', 'select', METODE_BAYAR),
          f('no_invoice', 'No. Invoice / Kuitansi'),
        ],
      },
      {
        name: 'Pengeluaran',
        fields: [
          f('penerima', 'Penerima / Vendor', 'text', { required: true }),
          f('nominal', 'Nominal', 'currency', { required: true }),
          f('tanggal_transaksi', 'Tanggal Transaksi', 'date'),
          f('metode_pembayaran', 'Metode Pembayaran', 'select', METODE_BAYAR),
          f('keperluan', 'Keperluan / Pos Anggaran'),
        ],
      },
      {
        name: 'Investor',
        fields: [
          f('nama_investor', 'Nama Investor', 'text', { required: true }),
          f('jenis_investor', 'Jenis Investor', 'select', opt('Perorangan', 'Institusi')),
          f('nilai_investasi', 'Nilai Investasi', 'currency'),
          f('kepemilikan', 'Kepemilikan Saham (%)', 'number'),
          f('tanggal_perjanjian', 'Tanggal Perjanjian', 'date'),
        ],
      },
      {
        name: 'Investasi',
        fields: [
          f('objek_investasi', 'Objek Investasi', 'text', { required: true }),
          f('nilai_investasi', 'Nilai Investasi', 'currency'),
          f('tanggal_mulai', 'Tanggal Mulai', 'date'),
          f('jangka_waktu', 'Jangka Waktu', 'text', { placeholder: 'mis. 12 bulan' }),
          f('imbal_hasil', 'Estimasi Imbal Hasil', 'text', { placeholder: 'mis. 8% per tahun' }),
        ],
      },
      {
        name: 'Gaji Karyawan',
        fields: [
          f('periode', 'Periode Gaji', 'month', { required: true }),
          f('jumlah_karyawan', 'Jumlah Karyawan', 'number'),
          f('total_gaji', 'Total Gaji', 'currency'),
          f('tanggal_pembayaran', 'Tanggal Pembayaran', 'date'),
        ],
      },
      {
        name: 'Bonus',
        fields: [
          f('jenis_bonus', 'Jenis Bonus', 'select', {
            required: true,
            ...opt('Bonus Tahunan', 'THR', 'Insentif Kinerja', 'Komisi', 'Lainnya'),
          }),
          f('periode', 'Periode', 'month'),
          f('penerima', 'Penerima', 'text', { placeholder: 'Nama karyawan atau jumlah penerima' }),
          f('total_nominal', 'Total Nominal', 'currency'),
        ],
      },
      {
        name: 'Pajak',
        fields: [
          f('jenis_pajak', 'Jenis Pajak', 'select', {
            required: true,
            ...opt('PPh 21', 'PPh 23', 'PPh 25/29', 'PPh Final', 'PPN', 'PBB', 'Lainnya'),
          }),
          f('masa_pajak', 'Masa Pajak', 'month'),
          f('nominal', 'Nominal', 'currency'),
          f('tanggal_setor', 'Tanggal Setor / Lapor', 'date'),
          f('ntpn', 'NTPN / Nomor Bukti'),
        ],
      },
    ],
  },
  {
    code: 'B',
    slug: 'data-perusahaan',
    name: 'Data Perusahaan',
    description: 'Klien, mitra kerja sama, legalitas, serta aset dan inventaris perusahaan.',
    fields: [],
    subs: [
      {
        name: 'Klien',
        fields: [
          f('nama_klien', 'Nama Klien', 'text', { required: true }),
          f('pic_klien', 'Kontak PIC', 'text', { placeholder: 'Nama / telepon / email' }),
          f('nilai_kontrak', 'Nilai Kontrak', 'currency'),
          f('tanggal_mulai', 'Tanggal Mulai', 'date'),
          f('tanggal_berakhir', 'Tanggal Berakhir', 'date'),
          f('status', 'Status', 'select', STATUS_KONTRAK),
        ],
      },
      {
        name: 'Partnership',
        fields: [
          f('nama_mitra', 'Nama Mitra', 'text', { required: true }),
          f('jenis_kerja_sama', 'Jenis Kerja Sama', 'text', { placeholder: 'mis. Distribusi, Joint Venture' }),
          f('tanggal_mulai', 'Tanggal Mulai', 'date'),
          f('tanggal_berakhir', 'Tanggal Berakhir', 'date'),
          f('status', 'Status', 'select', STATUS_KONTRAK),
        ],
      },
      {
        name: 'Legalitas',
        fields: [
          f('jenis_legalitas', 'Jenis Legalitas', 'select', {
            required: true,
            ...opt('Akta Pendirian', 'Akta Perubahan', 'SK Kemenkumham', 'NIB', 'NPWP', 'Izin Usaha', 'Sertifikat', 'Lainnya'),
          }),
          f('instansi_penerbit', 'Instansi Penerbit'),
          f('tanggal_terbit', 'Tanggal Terbit', 'date'),
          f('berlaku_sampai', 'Berlaku Sampai', 'date', { hint: 'Kosongkan bila berlaku seterusnya' }),
        ],
      },
      {
        name: 'Aset & Inventaris',
        fields: [
          f('nama_aset', 'Nama Aset', 'text', { required: true }),
          f('jenis_aset', 'Jenis Aset', 'select', opt('Tanah & Bangunan', 'Kendaraan', 'Peralatan', 'Elektronik', 'Lainnya')),
          f('nomor_bukti', 'No. Sertifikat / BPKB / Seri'),
          f('nilai_perolehan', 'Nilai Perolehan', 'currency'),
          f('tanggal_perolehan', 'Tanggal Perolehan', 'date'),
          f('lokasi_aset', 'Lokasi Aset'),
        ],
      },
    ],
  },
  {
    code: 'C',
    slug: 'data-karyawan',
    name: 'Data Karyawan',
    description: 'Dokumen kepegawaian: identitas, kontrak, SK, kinerja, cuti, pelatihan, hingga pemberhentian.',
    fields: [
      f('nama_karyawan', 'Nama Karyawan', 'text', { required: true }),
      f('nik_karyawan', 'NIK / ID Karyawan'),
      f('jabatan', 'Jabatan'),
      f('divisi', 'Divisi / Departemen'),
    ],
    subs: [
      {
        name: 'Data Pribadi & Identitas',
        fields: [
          f('jenis_identitas', 'Jenis Dokumen Identitas', 'select', opt('KTP', 'KK', 'NPWP', 'BPJS', 'Ijazah', 'CV', 'Lainnya')),
        ],
      },
      {
        name: 'Kontrak Kerja',
        fields: [
          f('jenis_kontrak', 'Jenis Kontrak', 'select', {
            required: true,
            ...opt('PKWT (Kontrak)', 'PKWTT (Tetap)', 'Magang', 'Freelance'),
          }),
          f('tanggal_mulai', 'Tanggal Mulai', 'date'),
          f('tanggal_berakhir', 'Tanggal Berakhir', 'date'),
        ],
      },
      {
        name: 'Surat Keputusan',
        fields: [
          f('jenis_sk', 'Jenis SK', 'select', { required: true, ...opt('Pengangkatan', 'Mutasi', 'Promosi', 'Demosi', 'Lainnya') }),
          f('tanggal_berlaku', 'Tanggal Berlaku', 'date'),
        ],
      },
      {
        name: 'Penilaian Kinerja',
        fields: [
          f('periode_penilaian', 'Periode Penilaian', 'text', { required: true, placeholder: 'mis. Semester 1 2026' }),
          f('nilai_predikat', 'Nilai / Predikat'),
        ],
      },
      {
        name: 'Cuti & Izin',
        fields: [
          f('jenis_cuti', 'Jenis Cuti / Izin', 'select', {
            required: true,
            ...opt('Cuti Tahunan', 'Cuti Sakit', 'Cuti Melahirkan', 'Cuti Alasan Penting', 'Izin', 'Lainnya'),
          }),
          f('tanggal_mulai', 'Tanggal Mulai', 'date'),
          f('tanggal_selesai', 'Tanggal Selesai', 'date'),
        ],
      },
      {
        name: 'Pelatihan & Sertifikasi',
        fields: [
          f('nama_pelatihan', 'Nama Pelatihan / Sertifikasi', 'text', { required: true }),
          f('penyelenggara', 'Penyelenggara'),
          f('tanggal_pelaksanaan', 'Tanggal Pelaksanaan', 'date'),
          f('berlaku_sampai', 'Sertifikat Berlaku Sampai', 'date'),
        ],
      },
      {
        name: 'Surat Peringatan',
        fields: [
          f('tingkat_sp', 'Tingkat SP', 'select', { required: true, ...opt('SP 1', 'SP 2', 'SP 3') }),
          f('tanggal_terbit', 'Tanggal Terbit', 'date'),
          f('alasan', 'Alasan / Pelanggaran'),
        ],
      },
      {
        name: 'Pengunduran Diri / PHK',
        fields: [
          f('jenis_pemberhentian', 'Jenis', 'select', {
            required: true,
            ...opt('Pengunduran Diri', 'PHK', 'Pensiun', 'Habis Kontrak'),
          }),
          f('tanggal_efektif', 'Tanggal Efektif', 'date'),
        ],
      },
    ],
  },
];

const DEFAULT_SETTINGS = {
  app_name: 'ARSIPKU',
  company_name: 'Nama Perusahaan',
  company_reg_number: '',
  company_address: '',
  company_phone: '',
  company_email: '',
  leader_name: '',
  leader_title: 'Direktur',
};

module.exports = { CATEGORIES, DEFAULT_SETTINGS };
