'use strict';
const fsp = require('node:fs/promises');
const { BrowserWindow, dialog } = require('electron');
const ExcelJS = require('exceljs');
const db = require('../db');
const session = require('../session');
const activity = require('./activity');
const archives = require('./archives');
const settings = require('./settings');
const categories = require('./categories');
const windowRef = require('../window');
const { fail } = require('../errors');

const TYPES = {
  all: 'Laporan Seluruh Arsip',
  category: 'Laporan Arsip per Kategori',
  subcategory: 'Laporan Arsip per Subkategori',
  period: 'Laporan Arsip per Periode',
  year: 'Laporan Arsip per Tahun',
};

const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

function formatDate(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return iso || '';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

function formatExtra(field, value) {
  if (field.type === 'currency') return `Rp ${Number(value).toLocaleString('id-ID')}`;
  if (field.type === 'date') return formatDate(value);
  if (field.type === 'month' && /^d{4}-d{2}$/.test(value)) {
    const [y, m] = value.split('-').map(Number);
    return `${MONTHS[m - 1]} ${y}`;
  }
  return value;
}

function normalize(params = {}) {
  const type = TYPES[params.type] ? params.type : 'all';
  const filter = {};
  const conn = db.get();
  let subtitle = 'Seluruh arsip';
  if (type === 'category') {
    const cat = conn.prepare('SELECT * FROM categories WHERE id = ?').get(Number(params.category_id));
    if (!cat) fail('Pilih kategori untuk laporan ini.');
    filter.category_id = cat.id;
    subtitle = `Kategori: ${cat.code}. ${cat.category_name}`;
  } else if (type === 'subcategory') {
    const sub = conn
      .prepare(
        `SELECT s.*, c.code, c.category_name FROM subcategories s JOIN categories c ON c.id = s.category_id WHERE s.id = ?`
      )
      .get(Number(params.subcategory_id));
    if (!sub) fail('Pilih subkategori untuk laporan ini.');
    filter.category_id = sub.category_id;
    filter.subcategory_id = sub.id;
    subtitle = `Kategori: ${sub.code}. ${sub.category_name} — Subkategori: ${sub.subcategory_name}`;
  } else if (type === 'period') {
    if (!archives.isValidDate(params.date_from || '') || !archives.isValidDate(params.date_to || '')) {
      fail('Tentukan tanggal awal dan akhir periode.');
    }
    if (params.date_from > params.date_to) fail('Tanggal awal tidak boleh melebihi tanggal akhir.');
    filter.date_from = params.date_from;
    filter.date_to = params.date_to;
    subtitle = `Periode input: ${formatDate(params.date_from)} s.d. ${formatDate(params.date_to)}`;
  } else if (type === 'year') {
    const y = Number(params.year);
    if (!Number.isInteger(y) || y < 1900 || y > 2200) fail('Tentukan tahun dokumen.');
    filter.year = y;
    subtitle = `Tahun dokumen: ${y}`;
  }
  return { type, title: TYPES[type], subtitle, filter };
}

function query(params = {}) {
  session.require();
  const n = normalize(params);
  const { sql, params: args } = archives.buildFilter(n.filter);
  const rows = db
    .get()
    .prepare(
      `SELECT a.id, a.archive_number, a.input_date, a.document_type, a.document_number, a.document_name,
              a.description, a.attachment_description, a.storage_code, a.document_year,
              a.category_id, a.subcategory_id, a.extra_fields,
              c.code AS category_code, c.category_name, s.subcategory_name,
              (SELECT COUNT(*) FROM archive_files f WHERE f.archive_id = a.id) AS file_count
       FROM archives a JOIN categories c ON c.id = a.category_id
       LEFT JOIN subcategories s ON s.id = a.subcategory_id
       ${sql}
       ORDER BY c.sort_order, a.input_date, a.archive_number`
    )
    .all(...args);

  // Isian Informasi Dokumen dirangkum menjadi teks "Label: nilai; ...".
  const fieldCache = new Map();
  for (const r of rows) {
    const key = `${r.category_id}:${r.subcategory_id || ''}`;
    if (!fieldCache.has(key)) fieldCache.set(key, categories.fieldsFor(r.category_id, r.subcategory_id));
    const extra = archives.parseExtras(r.extra_fields);
    r.extra_text = fieldCache
      .get(key)
      .filter((f) => extra[f.key])
      .map((f) => `${f.label}: ${formatExtra(f, extra[f.key])}`)
      .join('; ');
    delete r.extra_fields;
  }

  const summaryMap = new Map();
  for (const r of rows) {
    const key = `${r.category_code}. ${r.category_name}`;
    summaryMap.set(key, (summaryMap.get(key) || 0) + 1);
  }
  return {
    type: n.type,
    title: n.title,
    subtitle: n.subtitle,
    rows,
    summary: [...summaryMap.entries()].map(([category, total]) => ({ category, total })),
    generatedAt: new Date().toISOString(),
  };
}

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);

function buildHtml(report) {
  const s = settings.readAll();
  const user = session.current();
  const today = new Date();
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const contact = [s.company_address, s.company_phone && `Telp. ${s.company_phone}`, s.company_email].filter(Boolean).join(' · ');

  const body = report.rows.length
    ? report.rows
        .map(
          (r, i) => `<tr>
        <td class="c">${i + 1}</td>
        <td class="nw">${esc(r.archive_number)}</td>
        <td class="nw">${esc(formatDate(r.input_date))}</td>
        <td>${esc(r.category_code)}. ${esc(r.subcategory_name || '-')}</td>
        <td>${esc(r.document_type)}</td>
        <td>${esc(r.document_number || '-')}</td>
        <td>${esc(r.document_name)}</td>
        <td class="c">${esc(r.document_year ?? '-')}</td>
        <td class="c">${esc(r.storage_code || '-')}</td>
        <td class="c">${r.file_count}</td>
      </tr>`
        )
        .join('')
    : '<tr><td colspan="10" class="c empty">Tidak ada data arsip untuk kriteria laporan ini.</td></tr>';

  const summary = report.summary
    .map((x) => `<tr><td>${esc(x.category)}</td><td class="c">${x.total}</td></tr>`)
    .join('');

  return `<!doctype html><html lang="id"><head><meta charset="utf-8">
<title>${esc(report.title)}</title>
<style>
  @page { size: A4 landscape; margin: 14mm 12mm; }
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI", Arial, sans-serif; color: #0f172a; font-size: 10.5px; margin: 0; }
  .kop { text-align: center; border-bottom: 3px double #1e3a5f; padding-bottom: 8px; margin-bottom: 14px; }
  .kop h1 { margin: 0; font-size: 18px; letter-spacing: .5px; color: #1e3a5f; }
  .kop .meta { margin-top: 2px; color: #475569; font-size: 10px; }
  h2 { text-align: center; margin: 0 0 2px; font-size: 14px; text-transform: uppercase; }
  .sub { text-align: center; color: #475569; margin-bottom: 12px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #94a3b8; padding: 4px 5px; vertical-align: top; }
  th { background: #1e3a5f; color: #fff; font-weight: 600; text-align: center; }
  thead { display: table-header-group; }
  tr { page-break-inside: avoid; }
  tbody tr:nth-child(even) td { background: #f1f5f9; }
  .c { text-align: center; } .nw { white-space: nowrap; }
  .empty { padding: 16px; color: #64748b; }
  .bottom { display: flex; justify-content: space-between; margin-top: 18px; gap: 24px; page-break-inside: avoid; }
  .summary { width: 45%; } .summary th { text-align: left; }
  .sign { width: 260px; text-align: center; }
  .sign .space { height: 64px; }
  .sign .name { font-weight: 600; text-decoration: underline; }
  .total { margin-top: 6px; font-weight: 600; }
</style></head><body>
  <div class="kop">
    <h1>${esc((s.company_name || '').toUpperCase())}</h1>
    ${s.company_reg_number ? `<div class="meta">NIB / NPWP: ${esc(s.company_reg_number)}</div>` : ''}
    ${contact ? `<div class="meta">${esc(contact)}</div>` : ''}
  </div>
  <h2>${esc(report.title)}</h2>
  <div class="sub">${esc(report.subtitle)}</div>
  <table>
    <thead><tr>
      <th style="width:28px">No</th><th>Nomor Arsip</th><th>Tanggal Input</th><th>Kategori / Subkategori</th>
      <th>Jenis Dokumen</th><th>Nomor Dokumen</th><th>Nama Dokumen</th><th>Tahun</th><th>Kode Simpan</th><th>File</th>
    </tr></thead>
    <tbody>${body}</tbody>
  </table>
  <div class="bottom">
    <div class="summary">
      ${summary ? `<table><thead><tr><th>Rekapitulasi Kategori</th><th style="width:70px">Jumlah</th></tr></thead><tbody>${summary}</tbody></table>` : ''}
      <div class="total">Total arsip: ${report.rows.length}</div>
      <div style="color:#64748b;margin-top:4px">Dicetak oleh ${esc(user?.full_name || '-')} melalui ${esc(s.app_name || 'ARSIPKU')}</div>
    </div>
    <div class="sign">
      <div>${esc(formatDate(todayIso))}</div>
      <div>${esc(s.leader_title || 'Pimpinan')},</div>
      <div class="space"></div>
      <div class="name">${esc(s.leader_name || '................................')}</div>
    </div>
  </div>
</body></html>`;
}

async function withReportWindow(html, fn) {
  const win = new BrowserWindow({
    show: false,
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, javascript: false },
  });
  try {
    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    return await fn(win);
  } finally {
    if (!win.isDestroyed()) win.destroy();
  }
}

function defaultName(report, ext) {
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return `${report.title.replace(/\s+/g, '-')}-${stamp}.${ext}`;
}

async function exportPdf(params) {
  const report = query(params);
  const res = await dialog.showSaveDialog(windowRef.get(), {
    title: 'Simpan Laporan PDF',
    defaultPath: defaultName(report, 'pdf'),
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  });
  if (res.canceled || !res.filePath) return { canceled: true };
  const pdf = await withReportWindow(buildHtml(report), (win) =>
    win.webContents.printToPDF({ landscape: true, pageSize: 'A4', printBackground: true, displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate:
        '<div style="font-size:8px;width:100%;text-align:right;padding-right:12mm;color:#64748b">Halaman <span class="pageNumber"></span> / <span class="totalPages"></span></div>',
      margins: { top: 0.5, bottom: 0.6, left: 0.45, right: 0.45 } })
  );
  await fsp.writeFile(res.filePath, pdf);
  activity.log('Ekspor Laporan', `${report.title} (${report.rows.length} arsip) diekspor ke PDF.`);
  return { canceled: false, location: res.filePath, count: report.rows.length };
}

async function exportXlsx(params) {
  const report = query(params);
  const res = await dialog.showSaveDialog(windowRef.get(), {
    title: 'Simpan Laporan Excel',
    defaultPath: defaultName(report, 'xlsx'),
    filters: [{ name: 'Excel', extensions: ['xlsx'] }],
  });
  if (res.canceled || !res.filePath) return { canceled: true };

  const s = settings.readAll();
  const wb = new ExcelJS.Workbook();
  wb.creator = s.app_name || 'ARSIPKU';
  wb.created = new Date();
  const ws = wb.addWorksheet('Laporan', {
    pageSetup: { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  const columns = [
    { header: 'No', key: 'no', width: 6 },
    { header: 'Nomor Arsip', key: 'archive_number', width: 18 },
    { header: 'Tanggal Input', key: 'input_date', width: 14 },
    { header: 'Kategori', key: 'category', width: 34 },
    { header: 'Subkategori', key: 'subcategory_name', width: 26 },
    { header: 'Jenis Dokumen', key: 'document_type', width: 20 },
    { header: 'Nomor Dokumen', key: 'document_number', width: 22 },
    { header: 'Nama Dokumen', key: 'document_name', width: 40 },
    { header: 'Informasi Dokumen', key: 'extra_text', width: 48 },
    { header: 'Deskripsi', key: 'description', width: 40 },
    { header: 'Lampiran', key: 'attachment_description', width: 22 },
    { header: 'Kode Simpan', key: 'storage_code', width: 14 },
    { header: 'Tahun', key: 'document_year', width: 8 },
    { header: 'Jumlah File', key: 'file_count', width: 11 },
  ];
  ws.columns = columns.map((c) => ({ key: c.key, width: c.width }));

  const lastCol = String.fromCharCode(64 + columns.length);
  const titleRows = [
    [(s.company_name || '').toUpperCase(), { bold: true, size: 14 }],
    [report.title, { bold: true, size: 12 }],
    [report.subtitle, { italic: true, size: 10 }],
  ];
  titleRows.forEach(([text, font], i) => {
    const r = i + 1;
    ws.mergeCells(`A${r}:${lastCol}${r}`);
    const cell = ws.getCell(`A${r}`);
    cell.value = text;
    cell.font = font;
    cell.alignment = { horizontal: 'center' };
  });

  const headerRow = ws.getRow(5);
  headerRow.values = columns.map((c) => c.header);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
  });

  report.rows.forEach((r, i) => {
    const row = ws.addRow({
      no: i + 1,
      archive_number: r.archive_number,
      input_date: r.input_date,
      category: `${r.category_code}. ${r.category_name}`,
      subcategory_name: r.subcategory_name || '',
      document_type: r.document_type,
      document_number: r.document_number,
      document_name: r.document_name,
      extra_text: r.extra_text,
      description: r.description,
      attachment_description: r.attachment_description,
      storage_code: r.storage_code,
      document_year: r.document_year ?? '',
      file_count: r.file_count,
    });
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.alignment = { vertical: 'top', wrapText: true };
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    });
  });
  ws.views = [{ state: 'frozen', ySplit: 5 }];
  ws.autoFilter = { from: 'A5', to: `${lastCol}5` };

  const sum = wb.addWorksheet('Rekapitulasi');
  sum.columns = [
    { header: 'Kategori', key: 'category', width: 48 },
    { header: 'Jumlah Arsip', key: 'total', width: 14 },
  ];
  sum.getRow(1).font = { bold: true };
  report.summary.forEach((x) => sum.addRow(x));
  sum.addRow({ category: 'TOTAL', total: report.rows.length }).font = { bold: true };

  await wb.xlsx.writeFile(res.filePath);
  activity.log('Ekspor Laporan', `${report.title} (${report.rows.length} arsip) diekspor ke Excel.`);
  return { canceled: false, location: res.filePath, count: report.rows.length };
}

async function print(params) {
  const report = query(params);
  const printed = await withReportWindow(
    buildHtml(report),
    (win) =>
      new Promise((resolve, reject) => {
        win.webContents.print({ silent: false, printBackground: true, landscape: true }, (success, reason) => {
          if (success || reason === 'cancelled' || reason === 'Print job canceled') resolve(success);
          else reject(new Error(`Gagal mencetak: ${reason}`));
        });
      })
  );
  if (printed) activity.log('Cetak Laporan', `${report.title} (${report.rows.length} arsip) dikirim ke printer.`);
  return printed;
}

module.exports = { query, exportPdf, exportXlsx, print, TYPES };
