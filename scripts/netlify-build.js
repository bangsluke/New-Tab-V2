#!/usr/bin/env node
/**
 * netlify-build.js
 * Netlify build step: generates data/umami-config.json and data/football-config.json
 * from environment variables set in the Netlify dashboard.
 * data/links.json is pre-committed — this script does not regenerate it.
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.resolve(__dirname, '..', 'data');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Umami config
const umamiToken = process.env.UMAMI_API_KEY;
const umamiConfig = umamiToken && umamiToken !== 'your_key_here'
  ? { enabled: true, apiBase: 'https://api.umami.is/v1', token: umamiToken }
  : { enabled: false };
fs.writeFileSync(
  path.join(DATA_DIR, 'umami-config.json'),
  JSON.stringify(umamiConfig, null, 2),
  'utf8'
);
console.log(`✓ Wrote data/umami-config.json (enabled: ${umamiConfig.enabled})`);

// Football config
const footballToken = process.env.FOOTBALL_DATA_API_KEY;
const footballConfig = footballToken && footballToken !== 'your_key_here'
  ? { enabled: true, token: footballToken }
  : { enabled: false };
fs.writeFileSync(
  path.join(DATA_DIR, 'football-config.json'),
  JSON.stringify(footballConfig, null, 2),
  'utf8'
);
console.log(`✓ Wrote data/football-config.json (enabled: ${footballConfig.enabled})`);
