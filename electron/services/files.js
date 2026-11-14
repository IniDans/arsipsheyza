'use strict';
// Penyimpanan file PDF di direktori dokumen lokal.
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { paths } = require('../paths');
const { fail } = require('../errors');

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB per file

async function validatePdf(srcPath) {
  if (typeof srcPath !== 'string' || !path.isAbsolute(srcPath)) fail('Lokasi file tidak valid.');
  const name = path.basename(srcPath);
  if (path.extname(srcPath).toLowerCase() !== '.pdf') fail(`"${name}" bukan file PDF.`);
  let stat;
  try {
    stat = await fsp.stat(srcPath);
  } catch {
    fail(`File "${name}" tidak ditemukan.`);
  }
  if (!stat.isFile()) fail(`"${name}" bukan file.`);
  if (stat.size === 0) fail(`File "${name}" kosong.`);
  if (stat.size > MAX_FILE_SIZE) fail(`File "${name}" melebihi batas 100 MB.`);
  const fh = await fsp.open(srcPath, 'r');
  try {
    const buf = Buffer.alloc(1024);
    const { bytesRead } = await fh.read(buf, 0, 1024, 0);
    // Header PDF harus muncul pada 1024 byte pertama.
    if (!buf.subarray(0, bytesRead).includes(Buffer.from('%PDF-'))) {
      fail(`File "${name}" bukan dokumen PDF yang valid.`);
    }
  } finally {
    await fh.close();
  }
  return { name, size: stat.size };
}

function hashFile(file) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    fs.createReadStream(file)
      .on('data', (chunk) => hash.update(chunk))
      .on('error', reject)
      .on('end', () => resolve(hash.digest('hex')));
  });
}

function resolveStored(relPath) {
  const base = path.resolve(paths.documentsDir());
  const full = path.resolve(base, relPath);
  if (full !== base && !full.startsWith(base + path.sep)) fail('Lokasi file arsip tidak valid.');
  return full;
}

// Menyalin file ke direktori dokumen dengan nama unik.
async function store(srcPath, categorySlug, year) {
  const storedName = `${crypto.randomUUID()}.pdf`;
  const rel = path.join(categorySlug, String(year), storedName);
  const dest = resolveStored(rel);
  await fsp.mkdir(path.dirname(dest), { recursive: true });
  const tmp = dest + '.part';
  await fsp.copyFile(srcPath, tmp);
  const [srcStat, tmpStat] = await Promise.all([fsp.stat(srcPath), fsp.stat(tmp)]);
  if (srcStat.size !== tmpStat.size) {
    await fsp.rm(tmp, { force: true });
    fail('Gagal menyalin file ke penyimpanan arsip.');
  }
  await fsp.rename(tmp, dest);
  return { storedName, relPath: rel.split(path.sep).join('/'), size: tmpStat.size };
}

async function removeStored(relPath) {
  try {
    await fsp.rm(resolveStored(relPath), { force: true });
  } catch {
    // diabaikan: file yang gagal dihapus tidak memengaruhi data
  }
}

function existsStored(relPath) {
  try {
    return fs.statSync(resolveStored(relPath)).isFile();
  } catch {
    return false;
  }
}

function uniqueTarget(dir, name) {
  const ext = path.extname(name);
  const stem = path.basename(name, ext);
  let candidate = path.join(dir, name);
  let i = 1;
  while (fs.existsSync(candidate)) {
    candidate = path.join(dir, `${stem} (${i})${ext}`);
    i += 1;
  }
  return candidate;
}

function safeFileName(name) {
  return String(name).replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').slice(0, 180) || 'dokumen.pdf';
}

module.exports = {
  MAX_FILE_SIZE,
  validatePdf,
  hashFile,
  store,
  removeStored,
  resolveStored,
  existsStored,
  uniqueTarget,
  safeFileName,
};
