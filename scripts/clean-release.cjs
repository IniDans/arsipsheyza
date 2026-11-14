// Mengosongkan folder release sebelum build installer, sehingga yang tersisa
// hanya installer versi terbaru (tidak menumpuk installer versi lama).
const fs = require('node:fs');
const path = require('node:path');

const dir = path.join(__dirname, '..', 'release');
if (fs.existsSync(dir)) {
  for (const name of fs.readdirSync(dir)) {
    fs.rmSync(path.join(dir, name), { recursive: true, force: true });
  }
  console.log('Folder release dibersihkan');
}
