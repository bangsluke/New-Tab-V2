#!/usr/bin/env node
/**
 * Re-download vendored UMD bundles (Lucide, Fuse.js) into assets/vendor/.
 * Run after bumping versions in this file.
 */
const fs = require('fs');
const https = require('https');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'assets', 'vendor');

const FILES = [
  {
    url: 'https://unpkg.com/lucide@0.468.0/dist/umd/lucide.min.js',
    file: 'lucide.min.js',
  },
  {
    url: 'https://cdn.jsdelivr.net/npm/fuse.js@7.1.0/dist/fuse.min.js',
    file: 'fuse.min.js',
  },
];

function fetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetch(res.headers.location).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} ${url}`));
        return;
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', reject);
  });
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  for (const { url, file } of FILES) {
    const buf = await fetch(url);
    fs.writeFileSync(path.join(OUT, file), buf);
    console.log(`✓ ${file} (${buf.length} bytes)`);
  }
})().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
