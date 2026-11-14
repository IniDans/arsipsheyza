// Menyalin aset PDF.js (font, cmap, wasm, icc) agar viewer bekerja penuh secara offline.
const fs = require('node:fs');
const path = require('node:path');

const src = path.join(__dirname, '..', 'node_modules', 'pdfjs-dist');
const dest = path.join(__dirname, '..', 'public', 'pdfjs');
for (const dir of ['cmaps', 'standard_fonts', 'wasm', 'iccs']) {
  const from = path.join(src, dir);
  if (!fs.existsSync(from)) continue;
  fs.cpSync(from, path.join(dest, dir), { recursive: true });
}
console.log('Aset PDF.js disalin ke public/pdfjs');
