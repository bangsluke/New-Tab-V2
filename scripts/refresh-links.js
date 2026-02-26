#!/usr/bin/env node
/**
 * refresh-links.js
 * Reads the Obsidian markdown file specified in config/config.yaml,
 * parses the "## Links List" table, and writes:
 *   data/links.json
 *   data/umami-config.json
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

// ── Paths ──────────────────────────────────────────────────────────────────
const ROOT = path.resolve(__dirname, '..');
const CONFIG_PATH = path.join(ROOT, 'config', 'config.yaml');
const DATA_DIR = path.join(ROOT, 'data');

// ── Load config ────────────────────────────────────────────────────────────
const config = yaml.load(fs.readFileSync(CONFIG_PATH, 'utf8'));
const mdFilePath = config['links-list-source-file-path'];
const linksListHeading = config['links-list-heading'] || 'Links List';
// Escape any regex special chars in the heading text
const headingPattern = new RegExp(
  `^#{1,6}\\s+${linksListHeading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`
);

if (!mdFilePath) {
  console.error('ERROR: links-list-source-file-path not set in config.yaml');
  process.exit(1);
}

if (!fs.existsSync(mdFilePath)) {
  console.error(`ERROR: Obsidian file not found: ${mdFilePath}`);
  process.exit(1);
}

// ── Parse markdown table ───────────────────────────────────────────────────
const mdContent = fs.readFileSync(mdFilePath, 'utf8');

// Find the Links List section by scanning lines.
// Collect all pipe-table lines after a "Links List" heading until the next heading.
const allLines = mdContent.split('\n');
let inSection = false;
const tableLines = [];

for (const rawLine of allLines) {
  const line = rawLine.trim();
  if (headingPattern.test(line)) {
    inSection = true;
    continue;
  }
  if (inSection) {
    // Stop at any subsequent markdown heading
    if (/^#{1,6}\s+/.test(line)) break;
    if (line.startsWith('|') && line.endsWith('|')) {
      tableLines.push(line);
    }
  }
}

if (!inSection) {
  console.error(`ERROR: Could not find "${linksListHeading}" section in the markdown file`);
  process.exit(1);
}

if (tableLines.length < 2) {
  console.error('ERROR: No table found under "## Links List"');
  process.exit(1);
}

// Parse header row
const parseRow = (line) =>
  line
    .slice(1, -1)           // remove leading/trailing |
    .split('|')
    .map(cell => cell.trim());

const headers = parseRow(tableLines[0]);

// Skip separator row (row of dashes)
const dataRows = tableLines.slice(2); // skip header + separator

/**
 * Extract website ID from a Umami dashboard URL.
 * e.g. https://cloud.umami.is/websites/abc-123 → "abc-123"
 */
function extractUmamiId(url) {
  if (!url) return null;
  // Matches both:
  //   https://cloud.umami.is/websites/{id}
  //   https://cloud.umami.is/analytics/eu/websites/{id}
  const match = url.match(/\/websites\/([0-9a-f-]{36})/i);
  return match ? match[1] : null;
}

// ── Build links array ──────────────────────────────────────────────────────
const links = [];

for (const row of dataRows) {
  const cells = parseRow(row);
  const obj = {};
  headers.forEach((header, i) => {
    obj[header] = cells[i] || '';
  });

  // Skip empty / separator rows
  if (!obj['Link Name'] && !obj['Link']) continue;

  // Extract plain URL from various formats:
  //   [text](url)  — standard markdown link
  //   <url>        — angle-bracket bare URL (Obsidian autolink)
  //   [[Page]]     — Obsidian wiki link (not a real URL; return empty)
  //   bare url
  const extractUrl = (val) => {
    if (!val) return '';
    val = val.trim();
    // Standard markdown link
    const mdLink = val.match(/\[.*?\]\((.*?)\)/);
    if (mdLink) return mdLink[1].trim();
    // Angle-bracket autolink <url>
    const angleLink = val.match(/^<(.+)>$/);
    if (angleLink) return angleLink[1].trim();
    // Obsidian wiki link [[text]] — not a real URL
    if (val.startsWith('[[')) return '';
    return val;
  };

  const umamiTrackingLink = extractUrl(obj['Umami Tracking Link']);

  links.push({
    order: parseInt(obj['Order'], 10) || 0,
    name: obj['Link Name'] || '',
    url: extractUrl(obj['Link']),
    category: obj['Grouping'] || 'Other',
    logo: extractUrl(obj['Logo URL']),
    projectLink: extractUrl(obj['Project Link']),
    umamiId: extractUmamiId(umamiTrackingLink),
    umamiDashboardUrl: umamiTrackingLink || null,
  });
}

// Sort by the Order column
links.sort((a, b) => a.order - b.order);

// ── Write data/links.json ──────────────────────────────────────────────────
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

fs.writeFileSync(
  path.join(DATA_DIR, 'links.json'),
  JSON.stringify(links, null, 2),
  'utf8'
);
console.log(`✓ Wrote ${links.length} links to data/links.json`);

// ── Write data/umami-config.json ───────────────────────────────────────────
const token = process.env.UMAMI_API_KEY;
const umamiConfig = token && token !== 'your_token_here'
  ? { enabled: true, apiBase: 'https://api.umami.is/v1', token }
  : { enabled: false };

fs.writeFileSync(
  path.join(DATA_DIR, 'umami-config.json'),
  JSON.stringify(umamiConfig, null, 2),
  'utf8'
);
console.log(`✓ Wrote data/umami-config.json (enabled: ${umamiConfig.enabled})`);

// ── Write data/football-config.json ────────────────────────────────────────
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
