/**
 * app.js — New Tab V2
 * Plain ES module, no bundler.
 */

// ── WMO weather code → emoji ──────────────────────────────────────────────
const WMO_EMOJI = {
  0: '☀️',
  1: '🌤️', 2: '⛅', 3: '☁️',
  45: '🌫️', 48: '🌫️',
  51: '🌦️', 53: '🌦️', 55: '🌧️',
  56: '🌨️', 57: '🌨️',
  61: '🌧️', 63: '🌧️', 65: '🌧️',
  66: '🌨️', 67: '🌨️',
  71: '❄️', 73: '❄️', 75: '❄️',
  77: '🌨️',
  80: '🌦️', 81: '🌧️', 82: '⛈️',
  85: '🌨️', 86: '🌨️',
  95: '⛈️',
  96: '⛈️', 99: '⛈️',
};

function wmoEmoji(code) {
  return WMO_EMOJI[code] ?? '🌡️';
}

function wmoDescription(code) {
  const map = {
    0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
    45: 'Foggy', 48: 'Icy fog',
    51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle',
    61: 'Light rain', 63: 'Rain', 65: 'Heavy rain',
    71: 'Light snow', 73: 'Snow', 75: 'Heavy snow',
    80: 'Rain showers', 81: 'Showers', 82: 'Violent showers',
    95: 'Thunderstorm', 96: 'Thunderstorm+hail', 99: 'Thunderstorm+hail',
  };
  return map[code] ?? 'Unknown';
}

// ── Utilities ─────────────────────────────────────────────────────────────
function $(selector, root = document) {
  return root.querySelector(selector);
}

function el(tag, attrs = {}, ...children) {
  const elem = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'className') elem.className = v;
    else if (k === 'textContent') elem.textContent = v;
    else if (k === 'innerHTML') elem.innerHTML = v;
    else elem.setAttribute(k, v);
  }
  for (const child of children) {
    if (child == null) continue;
    elem.append(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return elem;
}

const CURSOR_SVG = `<svg class="click-icon-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m4 4 7.07 17 2.51-7.39L21 11.07z"/></svg>`;

// ── Links ─────────────────────────────────────────────────────────────────
let allLinks = [];

// ── localStorage helpers ───────────────────────────────────────────────────
const RECENT_KEY = 'ntv2-recent';
const RECENT_MAX = 10;
const CLICKS_KEY = 'ntv2-click-counts';
const SORT_KEY   = 'ntv2-sort-mode';

function getRecentLinks() {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch { return []; }
}
function saveRecentLink(link) {
  let r = getRecentLinks().filter(x => x.url !== link.url);
  r.unshift({ url: link.url, name: link.name, logo: link.logo, visitedAt: Date.now() });
  localStorage.setItem(RECENT_KEY, JSON.stringify(r.slice(0, RECENT_MAX)));
}
// Click counts stored as { url: [ts1, ts2, ...] } so time-range resets work.
// migrateClickCounts() converts legacy { url: number } format on first load.
function getRawClickData() {
  try { return JSON.parse(localStorage.getItem(CLICKS_KEY) || '{}'); } catch { return {}; }
}
function migrateClickCounts() {
  const data = getRawClickData();
  if (!Object.values(data).some(v => typeof v === 'number')) return;
  const now = Date.now();
  const migrated = {};
  for (const [url, val] of Object.entries(data)) {
    migrated[url] = typeof val === 'number' ? Array(val).fill(now) : val;
  }
  localStorage.setItem(CLICKS_KEY, JSON.stringify(migrated));
}
function getClickCounts() {
  const data = getRawClickData();
  const counts = {};
  for (const [url, ts] of Object.entries(data)) {
    counts[url] = Array.isArray(ts) ? ts.length : (ts || 0);
  }
  return counts;
}
function incrementClickCount(url) {
  const data = getRawClickData();
  if (!Array.isArray(data[url])) data[url] = [];
  data[url].push(Date.now());
  localStorage.setItem(CLICKS_KEY, JSON.stringify(data));
}
function resetClicksByPeriod(periodMs) {
  const cutoff = Date.now() - periodMs;
  const data = getRawClickData();
  const updated = {};
  for (const [url, ts] of Object.entries(data)) {
    const kept = (Array.isArray(ts) ? ts : []).filter(t => t < cutoff);
    if (kept.length) updated[url] = kept;
  }
  localStorage.setItem(CLICKS_KEY, JSON.stringify(updated));
}
function resetRecentByPeriod(periodMs) {
  const cutoff = Date.now() - periodMs;
  localStorage.setItem(RECENT_KEY, JSON.stringify(getRecentLinks().filter(r => r.visitedAt < cutoff)));
}
function getSortMode() { return localStorage.getItem(SORT_KEY) || 'frequency'; }
function setSortMode(m) { localStorage.setItem(SORT_KEY, m); }

const UMAMI_METRIC_KEY = 'ntv2-umami-metric';
const UMAMI_PERIOD_KEY  = 'ntv2-umami-period';
function getUmamiMetric() { return localStorage.getItem(UMAMI_METRIC_KEY) || 'visitors'; }
function setUmamiMetric(m) { localStorage.setItem(UMAMI_METRIC_KEY, m); }
function getUmamiPeriod() { return localStorage.getItem(UMAMI_PERIOD_KEY) || 'month'; }
function setUmamiPeriod(p) { localStorage.setItem(UMAMI_PERIOD_KEY, p); }

const umamiCache = {}; // { [umamiId]: rawStatObj }

function umamiTooltipText() {
  const metric = getUmamiMetric();
  const period = getUmamiPeriod();
  const metricLabels = { visitors: 'Unique visitors', pageviews: 'Pageviews', visits: 'Sessions' };
  const periodLabels = { '24h': 'past 24 hours', week: 'past 7 days', month: 'past 30 days' };
  return `${metricLabels[metric]}: ${periodLabels[period]} vs prior ${periodLabels[period]}`;
}

function applyUmamiFromCache() {
  const metric  = getUmamiMetric();
  const tooltip = umamiTooltipText();
  for (const [umamiId, stat] of Object.entries(umamiCache)) {
    const elem = document.getElementById(`umami-${umamiId}`);
    if (!elem) continue;
    const isClickable = elem.classList.contains('umami-clickable');
    const curr = stat[metric] ?? 0;
    const prev = stat.comparison?.[metric] ?? 0;
    const diff = curr - prev;
    const diffStr   = diff > 0 ? `(+${diff})` : diff < 0 ? `(${diff})` : '(=)';
    const trendChar = diff > 0 ? '▲' : diff < 0 ? '▼' : '–';
    const trendCls  = diff > 0 ? 'up' : diff < 0 ? 'down' : 'neutral';
    const icons = { visitors: '👤', pageviews: '👁', visits: '🔁' };
    const icon = icons[metric] || '📊';
    elem.className = `umami-stat ${trendCls}${isClickable ? ' umami-clickable' : ''}`;
    elem.title = tooltip;
    elem.innerHTML =
      `<span class="umami-icon">${icon}</span>` +
      `<span class="umami-value">${curr}</span>` +
      `<span class="umami-diff ${trendCls}">${diffStr}</span>` +
      `<span class="umami-arrow ${trendCls}">${trendChar}</span>`;
  }
}

async function requestPersistentStorage() {
  if (!navigator.storage || !navigator.storage.persist) return;
  try {
    const granted = await navigator.storage.persist();
    if (!granted) {
      console.warn('Persistent storage not granted; click stats may be cleared by the browser.');
    }
  } catch (err) {
    console.warn('Persistent storage request failed:', err && err.message ? err.message : err);
  }
}

// ── Session storage helpers ────────────────────────────────────────────────
function getSessionJSON(key) {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setSessionJSON(key, value) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore quota errors
  }
}

async function loadLinks() {
  try {
    const res = await fetch('data/links.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    allLinks = await res.json();
  } catch (err) {
    console.warn('Could not load links.json:', err.message);
    $('#links').innerHTML = '<p class="no-results">Could not load links. Run <code>npm run refresh</code> first.</p>';
    allLinks = [];
  }
  return allLinks;
}

function groupByCategory(links) {
  const groups = new Map();
  for (const link of links) {
    if (!groups.has(link.category)) groups.set(link.category, []);
    groups.get(link.category).push(link);
  }
  return groups;
}

function renderLinks(links, mode = 'grouping') {
  const container = $('#links');
  container.innerHTML = '';

  if (!links.length) {
    container.innerHTML = '<p class="no-results">No links found.</p>';
    return;
  }

  if (mode === 'frequency') {
    const counts = getClickCounts();
    const sorted = [...links].sort((a, b) => {
      const diff = (counts[b.url] || 0) - (counts[a.url] || 0);
      return diff !== 0 ? diff : a.name.localeCompare(b.name);
    });
    const grid = el('div', { className: 'links-grid' });
    sorted.forEach(link => grid.append(buildLinkCard(link)));
    container.append(grid);
  } else {
    // Prepend "Recent" group — only non-list URLs (Google searches etc.)
    // Links from the main list stay in their original category.
    const recent = getRecentLinks();
    const recentNonList = recent.filter(r => !allLinks.some(l => l.url === r.url));

    if (recentNonList.length) {
      const group = el('div', { className: 'category-group' });
      group.append(el('h2', { className: 'category-header', textContent: 'Recent' }));
      const grid = el('div', { className: 'links-grid' });
      recentNonList.forEach(r => grid.append(buildLinkCard({ url: r.url, name: r.name || r.url, logo: r.logo || null })));
      group.append(grid);
      container.append(group);
    }

    // Then regular category groups, sorted by total click count descending
    const groups = groupByCategory(links);
    const counts = getClickCounts();
    const sortedGroups = [...groups.entries()].sort((a, b) => {
      const sumA = a[1].reduce((s, l) => s + (counts[l.url] || 0), 0);
      const sumB = b[1].reduce((s, l) => s + (counts[l.url] || 0), 0);
      return sumB - sumA;
    });
    for (const [category, items] of sortedGroups) {
      const group = el('div', { className: 'category-group' });
      group.append(el('h2', { className: 'category-header', textContent: category }));
      const grid = el('div', { className: 'links-grid' });
      items.forEach(link => grid.append(buildLinkCard(link)));
      group.append(grid);
      container.append(group);
    }
  }
  applyUmamiFromCache();
}

function buildLinkCard(link, opts = {}) {
  // Card is the main link
  const card = el('a', {
    className: 'link-card',
    href: link.url || '#',
  });

  // Track clicks
  card.addEventListener('click', () => {
    incrementClickCount(link.url);
  });

  // Logo or placeholder
  if (link.logo) {
    const img = el('img', {
      className: 'link-logo',
      src: link.logo,
      alt: '',
      loading: 'lazy',
    });
    img.onerror = () => img.replaceWith(makeLogoPlaceholder(link.name));
    card.append(img);
  } else {
    card.append(makeLogoPlaceholder(link.name));
  }

  // Info section
  const info = el('div', { className: 'link-info' });

  // Name row: name + umami stat + click stat
  const nameRow = el('div', { className: 'link-name-row' });
  nameRow.append(el('span', { className: 'link-name', textContent: link.name }));

  // Umami stat (loading placeholder; populated by applyUmamiFromCache)
  if (link.umamiId) {
    const hasDashboard = link.umamiDashboardUrl && isUrl(link.umamiDashboardUrl);
    const umamiSpan = el('span', {
      className: hasDashboard ? 'umami-stat neutral umami-clickable' : 'umami-stat neutral',
      id: `umami-${link.umamiId}`,
      title: hasDashboard
        ? `${umamiTooltipText()} — click to open Umami dashboard`
        : umamiTooltipText(),
      textContent: '…',
    });
    if (hasDashboard) {
      umamiSpan.addEventListener('click', (e) => {
        e.stopPropagation();
        window.open(link.umamiDashboardUrl, '_blank', 'noopener');
      });
    }
    nameRow.append(umamiSpan);
  }

  // Click count — always shown (mouse icon + count)
  const clickStat = el('span', { className: 'click-stat', title: 'Total clicks' });
  const clickCount = getClickCounts()[link.url] || 0;
  clickStat.innerHTML = CURSOR_SVG + `<span class="click-value">${clickCount}</span>`;
  nameRow.append(clickStat);

  info.append(nameRow);

  // Meta row: project link only
  if (link.projectLink) {
    const meta = el('div', { className: 'link-meta' });
    const projLink = el('a', {
      className: 'link-project',
      href: link.projectLink,
      target: '_blank',
      rel: 'noopener noreferrer',
      textContent: 'Project',
    });
    projLink.addEventListener('click', e => e.stopPropagation());
    meta.append(projLink);
    info.append(meta);
  }

  card.append(info);
  return card;
}

function makeLogoPlaceholder(name) {
  const letter = (name || '?').charAt(0).toUpperCase();
  return el('div', { className: 'link-logo-placeholder', textContent: letter });
}

function isUrl(str) {
  try {
    const u = new URL(str);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch { return false; }
}

// ── Search ────────────────────────────────────────────────────────────────
function initSearch(links, mode = getSortMode()) {
  const input = $('#search-input');
  if (!input) return;

  // Replace node to clear stale listeners when re-called after sort toggle
  const wasFocused = document.activeElement === input;
  const currentValue = input.value;
  const fresh = input.cloneNode(true);
  input.replaceWith(fresh);
  if (typeof currentValue === 'string') {
    fresh.value = currentValue;
  }
  if (wasFocused) {
    fresh.focus();
  }

  const fuse = new Fuse(links, { keys: ['name', 'category'], threshold: 0.4 });
  const searchBar = document.getElementById('search-bar');
  const clearBtn = document.getElementById('search-clear-btn');

  const updateClearVisibility = () => {
    if (searchBar) searchBar.classList.toggle('has-value', fresh.value.trim().length > 0);
  };

  fresh.addEventListener('input', () => {
    const q = fresh.value.trim();
    updateClearVisibility();
    renderLinks(q ? fuse.search(q).map(r => r.item) : links, mode);
  });

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      fresh.value = '';
      fresh.focus();
      updateClearVisibility();
      renderLinks(links, mode);
    });
  }

  fresh.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const q = fresh.value.trim();
      if (isUrl(q)) {
        window.location.assign(q);
      } else {
        const url = q ? `https://www.google.com/search?q=${encodeURIComponent(q)}` : 'https://www.google.com/';
        if (q) saveRecentLink({ url, name: `🔍 ${q}`, logo: 'https://www.google.com/favicon.ico' });
        window.location.assign(url);
      }
    }
  });
}

// ── Search Google button ──────────────────────────────────────────────────
function initSearchGoogleBtn() {
  const btn = document.getElementById('search-google-btn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const q = document.getElementById('search-input')?.value.trim() || '';
    if (isUrl(q)) {
      window.location.assign(q);
    } else {
      const url = q ? `https://www.google.com/search?q=${encodeURIComponent(q)}` : 'https://www.google.com/';
      if (q) saveRecentLink({ url, name: `🔍 ${q}`, logo: 'https://www.google.com/favicon.ico' });
      window.location.assign(url);
    }
  });
}

// ── Reset stats button + modal ────────────────────────────────────────────
function initResetStatsBtn(links) {
  const btn = document.getElementById('reset-stats-btn');
  const modal = document.getElementById('reset-stats-modal');
  if (!btn || !modal) return;

  btn.addEventListener('click', () => modal.removeAttribute('hidden'));

  // Close on overlay click or Escape
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.setAttribute('hidden', '');
  });
  document.getElementById('reset-modal-cancel')?.addEventListener('click', () => {
    modal.setAttribute('hidden', '');
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.hasAttribute('hidden')) modal.setAttribute('hidden', '');
  });

  modal.querySelectorAll('.modal-option-btn').forEach(optBtn => {
    optBtn.addEventListener('click', () => {
      const range = optBtn.dataset.range;
      const h = 60 * 60 * 1000;
      const RANGE_LABELS = {
        hour: 'the past hour',
        day:  'the past 24 hours',
        week: 'the past week',
        all:  'all time',
      };
      if (range === 'hour') { resetClicksByPeriod(h);            resetRecentByPeriod(h); }
      if (range === 'day')  { resetClicksByPeriod(24 * h);       resetRecentByPeriod(24 * h); }
      if (range === 'week') { resetClicksByPeriod(7 * 24 * h);   resetRecentByPeriod(7 * 24 * h); }
      if (range === 'all')  { localStorage.removeItem(CLICKS_KEY); localStorage.removeItem(RECENT_KEY); }

      // Show confirmation, then auto-close and restore modal for next use
      const titleEl  = modal.querySelector('.modal-title');
      const descEl   = modal.querySelector('.modal-desc');
      const optionsEl = modal.querySelector('.modal-options');
      const cancelEl  = modal.querySelector('.modal-cancel-btn');
      if (titleEl)   titleEl.textContent = '✓ Stats cleared';
      if (descEl)    descEl.textContent  = `Removed click stats from ${RANGE_LABELS[range]}.`;
      if (optionsEl) optionsEl.hidden = true;
      if (cancelEl)  cancelEl.hidden  = true;

      setTimeout(() => {
        modal.setAttribute('hidden', '');
        if (titleEl)   titleEl.textContent = 'Reset click stats';
        if (descEl)    descEl.textContent  = 'Choose a time range to reset:';
        if (optionsEl) optionsEl.hidden = false;
        if (cancelEl)  cancelEl.hidden  = false;
      }, 1500);

      renderLinks(links, getSortMode());
    });
  });
}

// ── Sort bar ──────────────────────────────────────────────────────────────
function initSortBar(links) {
  const sortBar = document.getElementById('sort-bar');
  if (!sortBar) return;

  // Settings toggle — show/hide sort bar
  const SORT_BAR_VISIBLE_KEY = 'ntv2-sort-visible';
  const settingsBtn = document.getElementById('search-settings-btn');
  if (localStorage.getItem(SORT_BAR_VISIBLE_KEY) === 'true') {
    sortBar.classList.add('visible');
    settingsBtn?.classList.add('active');
  }
  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
      const isVisible = sortBar.classList.toggle('visible');
      settingsBtn.classList.toggle('active', isVisible);
      localStorage.setItem(SORT_BAR_VISIBLE_KEY, isVisible);
    });
  }

  let mode = getSortMode();
  const btn = el('button', { className: 'sort-toggle-btn sort-mode-btn', type: 'button' });
  const update = () => {
    btn.innerHTML = `<span class="sort-icon">⇄</span> ${mode === 'frequency' ? 'Sort by: Frequency' : 'Sort by: Grouping'}`;
    btn.title = mode === 'frequency'
      ? 'Sort mode: Frequency (most clicked first). Click to switch to Grouping.'
      : 'Sort mode: Grouping (by category). Click to switch to Frequency.';
  };
  btn.addEventListener('click', () => {
    mode = mode === 'grouping' ? 'frequency' : 'grouping';
    setSortMode(mode);
    update();
    renderLinks(links, mode);
    initSearch(links, mode);
    if (window.innerWidth > 600) document.getElementById('search-input')?.focus();
  });
  update();
  sortBar.append(btn);

  // Metric toggle
  const METRIC_CYCLE  = ['visitors', 'pageviews', 'visits'];
  const METRIC_LABELS = { visitors: '👤 Visitors', pageviews: '👁 Pageviews', visits: '🔁 Visits' };
  const METRIC_DESCRIPTIONS = { visitors: 'Unique Visitors', pageviews: 'Pageviews', visits: 'Sessions' };
  const metricBtn = el('button', { className: 'sort-toggle-btn sort-metric-btn', type: 'button' });
  const updateMetricBtn = () => {
    const m = getUmamiMetric();
    metricBtn.textContent = METRIC_LABELS[m];
    metricBtn.title = `Umami metric: ${METRIC_DESCRIPTIONS[m]}. Click to cycle (Visitors → Pageviews → Visits).`;
  };
  metricBtn.addEventListener('click', () => {
    const next = METRIC_CYCLE[(METRIC_CYCLE.indexOf(getUmamiMetric()) + 1) % METRIC_CYCLE.length];
    setUmamiMetric(next);
    updateMetricBtn();
    applyUmamiFromCache();
  });
  updateMetricBtn();
  sortBar.append(metricBtn);

  // Period toggle
  const PERIOD_CYCLE  = ['24h', 'week', 'month'];
  const PERIOD_LABELS = { '24h': '📅 24h', week: '📅 7d', month: '📅 30d' };
  const PERIOD_DESCRIPTIONS = { '24h': 'previous 24 hours comparison', week: 'previous 7 days comparison', month: 'previous 30 days comparison' };
  const periodBtn = el('button', { className: 'sort-toggle-btn sort-period-btn', type: 'button' });
  const updatePeriodBtn = () => {
    const p = getUmamiPeriod();
    periodBtn.textContent = PERIOD_LABELS[p];
    periodBtn.title = `Umami time period: ${PERIOD_DESCRIPTIONS[p]}. Click to cycle (24h → 7 days → 30 days).`;
  };
  periodBtn.addEventListener('click', () => {
    const next = PERIOD_CYCLE[(PERIOD_CYCLE.indexOf(getUmamiPeriod()) + 1) % PERIOD_CYCLE.length];
    setUmamiPeriod(next);
    updatePeriodBtn();
    Object.keys(umamiCache).forEach(k => delete umamiCache[k]);
    fetchUmamiStats(allLinks);
  });
  updatePeriodBtn();
  sortBar.append(periodBtn);
}

// ── Tabs ──────────────────────────────────────────────────────────────────
function initTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  if (!tabBtns.length) return;
  const saved = localStorage.getItem('ntv2-active-tab');
  if (saved) {
    const btn = document.querySelector(`.tab-btn[data-tab="${saved}"]`);
    const panel = document.getElementById(`tab-${saved}`);
    if (btn && panel) {
      tabBtns.forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active'); panel.classList.add('active');
    }
  }
  tabBtns.forEach(btn => btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    tabBtns.forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`tab-${tab}`)?.classList.add('active');
    localStorage.setItem('ntv2-active-tab', tab);
  }));
}

// ── Umami ─────────────────────────────────────────────────────────────────
async function loadUmamiConfig() {
  try {
    const res = await fetch('data/umami-config.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch {
    return { enabled: false };
  }
}

async function fetchUmamiStats(links) {
  const config = await loadUmamiConfig();
  if (!config.enabled) return;
  const umamiLinks = links.filter(l => l.umamiId);
  if (!umamiLinks.length) return;

  const now = Date.now();
  const h1 = 60 * 60 * 1000;
  const durations = { '24h': 24 * h1, week: 7 * 24 * h1, month: 30 * 24 * h1 };
  const duration = durations[getUmamiPeriod()] || durations['24h'];

  await Promise.allSettled(
    umamiLinks.map(async (link) => {
      try {
        const stat = await fetchUmamiWindow(config, link.umamiId, now - duration, now);
        umamiCache[link.umamiId] = stat;
      } catch (err) {
        console.warn(`Umami fetch failed for ${link.name}:`, err.message);
      }
    })
  );
  applyUmamiFromCache();
}

async function fetchUmamiWindow(config, siteId, startAt, endAt) {
  const url = `${config.apiBase}/websites/${siteId}/stats?startAt=${startAt}&endAt=${endAt}`;
  const res = await fetch(url, {
    headers: { 'x-umami-api-key': config.token },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ── Weather ───────────────────────────────────────────────────────────────
async function initWeather() {
  const section = $('#weather');

  if (!navigator.geolocation) {
    section.innerHTML = '<p class="weather-error">Geolocation not supported.</p>';
    return;
  }

  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const { latitude: lat, longitude: lon } = pos.coords;
      try {
        const [weather, geo] = await Promise.all([
          fetchWeather(lat, lon),
          fetchCityName(lat, lon),
        ]);
        renderWeather(section, weather, geo);
      } catch (err) {
        section.innerHTML = `<p class="weather-error">Weather unavailable: ${err.message}</p>`;
      }
    },
    (err) => {
      const messages = {
        1: 'Location permission denied. Click the lock/location icon in your browser\'s address bar and allow access, then refresh.',
        2: 'Location unavailable. Check your device\'s location settings and try refreshing.',
        3: 'Location request timed out. Try refreshing the page.',
      };
      const msg = messages[err.code] || `Geolocation error (code ${err.code}).`;
      const fileNote = location.protocol === 'file:'
        ? ' <em>Tip: run <code>npx serve .</code> and open via localhost — some browsers block geolocation on file:// URLs.</em>'
        : '';
      section.innerHTML = `<p class="weather-error">${msg}${fileNote}</p>`;
    },
    { timeout: 10000 }
  );
}

async function fetchWeather(lat, lon) {
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lat}&longitude=${lon}` +
    `&hourly=temperature_2m,weathercode,precipitation_probability` +
    `&daily=weathercode,temperature_2m_max,temperature_2m_min` +
    `&timezone=auto&forecast_days=7`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);
  return res.json();
}

async function fetchCityName(lat, lon) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
      { headers: { 'Accept-Language': 'en' } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return (
      data.address?.city ||
      data.address?.town ||
      data.address?.village ||
      data.address?.county ||
      null
    );
  } catch {
    return null;
  }
}

function renderWeather(section, data, cityName) {
  section.innerHTML = '';

  const now = new Date();
  const currentHourIndex = data.hourly.time.findIndex(t => {
    const d = new Date(t);
    return d.getHours() === now.getHours() &&
      d.toDateString() === now.toDateString();
  });
  const startIdx = currentHourIndex >= 0 ? currentHourIndex : 0;

  const currentTemp = Math.round(data.hourly.temperature_2m[startIdx]);
  const currentCode = data.hourly.weathercode[startIdx];

  // ── Summary row (always visible, clickable to expand) ──────────────────
  const summary = el('div', { className: 'weather-summary' });
  summary.append(
    el('div', { className: 'weather-summary-left' },
      el('span', { className: 'weather-location', textContent: cityName ? `📍 ${cityName}` : '📍 Your Location' }),
      el('span', { className: 'weather-summary-now' },
        el('span', { className: 'weather-summary-emoji', textContent: wmoEmoji(currentCode) }),
        el('span', { className: 'weather-summary-temp', textContent: `${currentTemp}°` }),
        el('span', { className: 'weather-summary-desc', textContent: wmoDescription(currentCode) })
      )
    ),
    el('button', {
      className: 'weather-toggle',
      'aria-label': 'Toggle weather details',
      type: 'button',
    })
  );

  // Set chevron icon after inserting into DOM
  const toggleBtn = summary.querySelector('.weather-toggle');
  toggleBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>';

  // ── Detail section (collapsed by default) ──────────────────────────────
  const detail = el('div', { className: 'weather-detail' });

  // 24-hour strip
  const hourlyStrip = el('div', { className: 'weather-hourly' });
  const hours = data.hourly.time.slice(startIdx, startIdx + 24);

  hours.forEach((time, i) => {
    const idx = startIdx + i;
    const temp = Math.round(data.hourly.temperature_2m[idx]);
    const code = data.hourly.weathercode[idx];
    const precip = data.hourly.precipitation_probability[idx];
    const d = new Date(time);
    const label = i === 0 ? 'Now' : d.toLocaleTimeString([], { hour: 'numeric', hour12: true });

    const item = el('div', { className: `hour-item${i === 0 ? ' current-hour' : ''}` });
    item.append(
      el('span', { className: 'hour-time', textContent: label }),
      el('span', { className: 'hour-icon', textContent: wmoEmoji(code), title: wmoDescription(code) }),
      el('span', { className: 'hour-temp', textContent: `${temp}°` }),
      precip > 0
        ? el('span', { className: 'hour-precip', textContent: `${precip}%` })
        : el('span', { className: 'hour-precip' })
    );
    hourlyStrip.append(item);
  });

  // 7-day daily
  const dailyLabel = el('div', { className: 'weather-daily-label', textContent: '7-Day Forecast' });
  const dailyGrid = el('div', { className: 'weather-daily' });

  data.daily.time.forEach((date, i) => {
    const d = new Date(date + 'T00:00:00');
    const dayName = i === 0 ? 'Today' : d.toLocaleDateString([], { weekday: 'short' });
    const high = Math.round(data.daily.temperature_2m_max[i]);
    const low = Math.round(data.daily.temperature_2m_min[i]);
    const code = data.daily.weathercode[i];

    const item = el('div', { className: 'day-item' });
    item.append(
      el('span', { className: 'day-name', textContent: dayName }),
      el('span', { className: 'day-icon', textContent: wmoEmoji(code), title: wmoDescription(code) }),
      el('div', { className: 'day-temps' },
        el('span', { className: 'day-high', textContent: `${high}°` }),
        el('span', { className: 'day-low', textContent: `${low}°` })
      )
    );
    dailyGrid.append(item);
  });

  detail.append(hourlyStrip, dailyLabel, dailyGrid);
  section.append(summary, detail);

  // Desktop: expanded by default; mobile: collapsed
  if (window.innerWidth > 600) {
    section.classList.add('weather-expanded');
  }

  // ── Toggle collapse ─────────────────────────────────────────────────────
  summary.addEventListener('click', () => {
    section.classList.toggle('weather-expanded');
  });
}

// ── FAB ───────────────────────────────────────────────────────────────────
function initFAB() {
  const fab = $('#scroll-top-fab');
  if (!fab) return;

  const threshold = () => window.innerHeight * 0.1;

  window.addEventListener('scroll', () => {
    fab.classList.toggle('visible', window.scrollY > threshold());
  }, { passive: true });

  fab.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

// ── Clock ─────────────────────────────────────────────────────────────────
function initClock() {
  const timeEl = document.getElementById('welcome-clock-time');
  const dateEl = document.getElementById('welcome-clock-date');
  if (!timeEl || !dateEl) return;

  const update = () => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    });
    const dateStr = now.toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    timeEl.textContent = timeStr;
    dateEl.textContent = dateStr;
  };

  update();
  setInterval(update, 30000);
}

// ── Footer year ───────────────────────────────────────────────────────────
function initFooter() {
  const yearEl = $('#current-year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();
}

// ── Football ──────────────────────────────────────────────────────────────
const FOOTBALL_CACHE_KEY = 'ntv2-football-cache';
const LIVERPOOL_ID = 64;

async function loadFootballConfig() {
  try {
    const res = await fetch('data/football-config.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch {
    return { enabled: false };
  }
}

async function fetchFootball(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function initFootball() {
  const plSection = document.getElementById('premier-league');
  const fixSection = document.getElementById('liverpool-fixtures');
  if (!plSection) return;

  const config = await loadFootballConfig();
  if (!config.enabled) {
    plSection.innerHTML = '<p class="section-placeholder">Add FOOTBALL_DATA_API_KEY to .env and run <code>npm run refresh</code> to enable.</p>';
    if (fixSection) fixSection.innerHTML = '';
    return;
  }

  // Serve from session cache if available
  const cached = sessionStorage.getItem(FOOTBALL_CACHE_KEY);
  if (cached) {
    const { standings, fixtures } = JSON.parse(cached);
    renderPLTable(plSection, standings);
    if (fixSection) renderFixtures(fixSection, fixtures);
    return;
  }

  plSection.innerHTML = '<p class="section-placeholder">Loading Premier League table…</p>';

  try {
    const [standingsData, fixturesData] = await Promise.all([
      fetchFootball('/.netlify/functions/football?type=standings'),
      fetchFootball('/.netlify/functions/football?type=fixtures'),
    ]);

    const table = standingsData?.standings?.[0]?.table ?? [];
    const matches = (fixturesData?.matches ?? []).slice(0, 5);

    sessionStorage.setItem(FOOTBALL_CACHE_KEY, JSON.stringify({ standings: table, fixtures: matches }));
    renderPLTable(plSection, table);
    if (fixSection) renderFixtures(fixSection, matches);
  } catch (err) {
    const msg = `Football data unavailable (${err.message}). To test locally, run <code>netlify dev</code>.`;
    plSection.innerHTML = `<p class="section-placeholder">${msg}</p>`;
    if (fixSection) fixSection.innerHTML = '';
  }
}

function startNextKickoffCountdown(countdownEl, matches) {
  if (!countdownEl || !matches || !matches.length) return;

  const upcoming = matches
    .map(match => ({ match, ts: new Date(match.utcDate).getTime() }))
    .filter(x => !Number.isNaN(x.ts) && x.ts > Date.now())
    .sort((a, b) => a.ts - b.ts)[0];

  if (!upcoming) {
    countdownEl.textContent = '';
    return;
  }

  const target = upcoming.ts;

  const formatDiff = (ms) => {
    if (ms <= 0) return 'Kickoff now';
    const totalMinutes = Math.floor(ms / 60000);
    const days = Math.floor(totalMinutes / (60 * 24));
    const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
    const mins = totalMinutes % 60;
    const parts = [];
    if (days) parts.push(`${days}d`);
    if (hours || days) parts.push(`${hours}h`);
    parts.push(`${mins}m`);
    return `Next kickoff in ${parts.join(' ')}`;
  };

  const update = () => {
    const now = Date.now();
    countdownEl.textContent = formatDiff(target - now);
  };

  if (countdownEl._intervalId) {
    clearInterval(countdownEl._intervalId);
  }
  update();
  countdownEl._intervalId = setInterval(update, 60000);
}

function renderPLTable(container, table) {
  container.innerHTML = '';
  if (!table.length) return;

  container.append(el('h2', { className: 'category-header', textContent: 'Premier League' }));

  const tbl = document.createElement('table');
  tbl.className = 'pl-table';

  // Header
  const thead = tbl.createTHead();
  const hrow = thead.insertRow();
  [['#', 'pos'], ['Team', ''], ['P', 'num'], ['W', 'num'], ['D', 'num'], ['L', 'num'], ['GD', 'num'], ['Pts', 'pts']].forEach(([text, cls]) => {
    const th = document.createElement('th');
    th.textContent = text;
    if (cls) th.className = cls;
    hrow.append(th);
  });

  // Rows
  const tbody = tbl.createTBody();
  for (const entry of table) {
    const isLiv = entry.team.id === LIVERPOOL_ID;
    const row = tbody.insertRow();
    if (isLiv) row.className = 'liverpool-row';

    // Position
    const posCell = row.insertCell();
    posCell.className = 'pos';
    posCell.textContent = entry.position;

    // Team (crest + short name)
    const teamCell = row.insertCell();
    teamCell.className = 'team-name-cell';
    if (entry.team.crest) {
      const img = el('img', { className: 'team-crest', src: entry.team.crest, alt: '' });
      teamCell.append(img);
    }
    teamCell.append(document.createTextNode(entry.team.shortName || entry.team.name));

    // Played
    const pCell = row.insertCell(); pCell.className = 'num'; pCell.textContent = entry.playedGames;

    // Won / Drawn / Lost
    const wCell = row.insertCell(); wCell.className = 'num'; wCell.textContent = entry.won;
    const dCell = row.insertCell(); dCell.className = 'num'; dCell.textContent = entry.draw;
    const lCell = row.insertCell(); lCell.className = 'num'; lCell.textContent = entry.lost;

    // GD
    const gdCell = row.insertCell();
    gdCell.className = 'num';
    gdCell.textContent = entry.goalDifference > 0 ? `+${entry.goalDifference}` : entry.goalDifference;

    // Points
    const ptsCell = row.insertCell(); ptsCell.className = 'pts'; ptsCell.textContent = entry.points;
  }

  container.append(tbl);
}

function renderFixtures(container, matches) {
  container.innerHTML = '';
  if (!matches.length) return;

  const header = el('div', { className: 'fixtures-header' });
  const title = el('h2', { className: 'category-header', textContent: 'Liverpool — Upcoming Fixtures' });
  const countdownEl = el('span', { className: 'fixture-countdown', textContent: '' });
  header.append(title, countdownEl);
  container.append(header);

  const list = el('div', { className: 'fixtures-list' });
  for (const match of matches) {
    const isHome = match.homeTeam.id === LIVERPOOL_ID;
    const opponent = isHome ? match.awayTeam : match.homeTeam;

    const date = new Date(match.utcDate);
    const dateStr = date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
    const timeStr = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

    const card = el('div', { className: 'fixture-card' });
    const dateEl = el('div', { className: 'fixture-date' });
    dateEl.append(
      el('span', { className: 'fixture-date-text', textContent: dateStr }),
      el('span', { className: 'fixture-time', textContent: timeStr })
    );
    card.append(dateEl);

    const teams = el('div', { className: 'fixture-teams' });
    const livSpan = el('span', { className: 'fixture-team liverpool', textContent: 'Liverpool' });
    const vsSpan = el('span', { className: 'fixture-vs', textContent: isHome ? 'vs' : '@' });
    const oppSpan = el('span', { className: 'fixture-team' });
    if (opponent.crest) oppSpan.append(el('img', { className: 'team-crest', src: opponent.crest, alt: '' }));
    oppSpan.append(document.createTextNode(opponent.shortName || opponent.name));

    teams.append(isHome ? livSpan : oppSpan, vsSpan, isHome ? oppSpan : livSpan);
    card.append(teams);
    const metaEl = el('div', { className: 'fixture-meta' });
    metaEl.append(
      el('span', { textContent: match.competition.name }),
      el('span', { textContent: isHome ? '(H)' : '(A)' })
    );
    card.append(metaEl);
    list.append(card);
  }
  container.append(list);

  startNextKickoffCountdown(countdownEl, matches);
}

// ── GitHub contribution heatmap ───────────────────────────────────────────
const GITHUB_CACHE_KEY = 'ntv2-github-heatmap';

async function initGithubHeatmap() {
  const section = document.getElementById('github-contributions');
  if (!section) return;

  const cached = getSessionJSON(GITHUB_CACHE_KEY);
  if (cached && Array.isArray(cached.days)) {
    renderGithubHeatmap(section, cached.days, cached.generatedAt);
    return;
  }

  section.innerHTML = '<p class="section-placeholder">Loading GitHub activity…</p>';

  try {
    const res = await fetch('/.netlify/functions/github-contribs');
    let json = null;
    try {
      json = await res.json();
    } catch {
      json = null;
    }

    if (!res.ok) {
      const msg =
        (json && (json.error || json.message)) ||
        `HTTP ${res.status}`;
      throw new Error(msg);
    }

    const days = Array.isArray(json && json.days) ? json.days : [];

    const now = new Date();
    const payload = { days, generatedAt: now.toISOString() };
    setSessionJSON(GITHUB_CACHE_KEY, payload);
    renderGithubHeatmap(section, days, payload.generatedAt);
  } catch (err) {
    section.innerHTML = `<p class="section-placeholder">GitHub activity unavailable (${err.message}).</p>`;
  }
}

function renderGithubHeatmap(section, days, generatedAt) {
  section.innerHTML = '';

  section.append(el('h2', { className: 'category-header', textContent: 'GitHub — Contributions' }));

  const wrapper = el('div', { className: 'heatmap-wrapper' });
  const monthsRow = el('div', { className: 'heatmap-months' });
  const body = el('div', { className: 'heatmap-body' });
  const weekdaysCol = el('div', { className: 'heatmap-weekdays' });
  const grid = el('div', { className: 'heatmap-grid' });

  // Weekday labels down the left
  const weekdayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  weekdayLabels.forEach((name) => {
    weekdaysCol.append(el('span', { className: 'heatmap-weekday-label', textContent: name }));
  });

  // Month labels above the graph, one per week column where the month changes
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const weeks = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  weeks.forEach((week, index) => {
    const firstDay = week.find(Boolean);
    if (!firstDay) {
      monthsRow.append(el('span', { className: 'heatmap-month-label', textContent: '' }));
      return;
    }
    const thisMonth = monthNames[new Date(firstDay.date + 'T00:00:00Z').getUTCMonth()];
    let prevMonth = null;
    if (index > 0) {
      const prevFirst = weeks[index - 1].find(Boolean);
      if (prevFirst) {
        prevMonth = monthNames[new Date(prevFirst.date + 'T00:00:00Z').getUTCMonth()];
      }
    }
    const label = index === 0 || thisMonth !== prevMonth ? thisMonth : '';
    monthsRow.append(el('span', { className: 'heatmap-month-label', textContent: label }));
  });

  const maxCount = days.reduce((m, d) => Math.max(m, d.count), 0);
  const bucket = (count) => {
    if (count === 0) return 0;
    if (maxCount <= 1) return 2;
    const ratio = count / maxCount;
    if (ratio > 0.75) return 4;
    if (ratio > 0.5) return 3;
    if (ratio > 0.25) return 2;
    return 1;
  };

  days.forEach((d) => {
    const dateObj = new Date(d.date + 'T00:00:00Z');
    const label = dateObj.toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    const level = bucket(d.count);
    const cell = el('div', {
      className: `heatmap-cell level-${level}`,
      title: `${d.count} contribution${d.count === 1 ? '' : 's'} on ${label}`,
    });
    grid.append(cell);
  });

  body.append(weekdaysCol, grid);
  wrapper.append(monthsRow, body);

  const footer = el('div', { className: 'heatmap-footer' },
    el('a', {
      href: 'https://github.com/bangsluke',
      target: '_blank',
      rel: 'noopener noreferrer',
      className: 'heatmap-link',
    }, 'View GitHub profile'),
    generatedAt
      ? el('span', { className: 'heatmap-updated', textContent: `Updated ${new Date(generatedAt).toLocaleDateString('en-GB')}` })
      : null,
  );

  section.append(wrapper, footer);
}

// ── BBC News & Sport headlines ────────────────────────────────────────────
const BBC_HEADLINES_KEY = 'ntv2-bbc-headlines';

async function initNewsHeadlines() {
  const section = document.getElementById('bbc-headlines');
  if (!section) return;

  const cached = getSessionJSON(BBC_HEADLINES_KEY);
  const now = Date.now();
  if (cached && cached.expiresAt && cached.expiresAt > now) {
    renderNewsHeadlines(section, cached);
    return;
  }

  section.innerHTML = '<p class="section-placeholder">Loading headlines…</p>';

  try {
    const res = await fetch('/.netlify/functions/bbc-headlines');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();

    const payload = {
      news: json.news || null,
      sport: json.sport || null,
      fetchedAt: now,
      expiresAt: now + 60 * 60 * 1000, // 1 hour
    };

    setSessionJSON(BBC_HEADLINES_KEY, payload);
    renderNewsHeadlines(section, payload);
  } catch (err) {
    section.innerHTML = `<p class="section-placeholder">Headlines unavailable (${err.message}).</p>`;
  }
}

function renderNewsHeadlines(section, payload) {
  section.innerHTML = '';

  section.append(el('h2', { className: 'category-header', textContent: 'Headlines' }));

  const list = el('div', { className: 'headline-list' });

  const buildRow = (item, label) => {
    if (!item) {
      return el('div', { className: 'headline-row' },
        el('span', { className: 'headline-source' },
          el('span', {
            className: `headline-logo-pill ${label === 'BBC News' ? 'news' : 'sport'}`,
            textContent: 'BBC',
          }),
          document.createTextNode(label.replace('BBC ', ' ')),
        ),
        el('span', { className: 'headline-missing', textContent: 'No headline available.' }),
      );
    }
    const when = item.pubDate ? timeAgo(new Date(item.pubDate)) : '';
    return el('div', { className: 'headline-row' },
      el('span', { className: 'headline-source' },
        el('span', {
          className: `headline-logo-pill ${label === 'BBC News' ? 'news' : 'sport'}`,
          textContent: 'BBC',
        }),
        document.createTextNode(label.replace('BBC ', ' ')),
      ),
      el('a', {
        className: 'headline-title',
        href: item.link,
        target: '_blank',
        rel: 'noopener noreferrer',
      }, item.title),
      when ? el('span', { className: 'headline-time', textContent: when }) : null,
    );
  };

  list.append(
    buildRow(payload.news, 'BBC News'),
    buildRow(payload.sport, 'BBC Sport'),
  );

  section.append(list);
}

function timeAgo(date) {
  const diffMs = Date.now() - date.getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min${mins === 1 ? '' : 's'} ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

// ── Crypto — BTC → GBP ─────────────────────────────────────────────────────
const CRYPTO_CACHE_KEY_PREFIX = 'ntv2-btc-gbp-';
const CRYPTO_RANGES = {
  '7d': { label: '7D', days: 7 },
  '24h': { label: '24H', days: 1 },
  '1m': { label: '1M', days: 30 },
  '1y': { label: '1Y', days: 365 },
};

async function initCryptoBtcGbp() {
  const section = document.getElementById('crypto-btc-gbp');
  if (!section) return;

  section.classList.add('crypto-expanded');

  let currentRange = '7d';

  const priceEl = el('span', { className: 'crypto-price', textContent: '—' });
  const deltaEl = el('span', { className: 'crypto-delta', textContent: '' });
  const rangeBar = el('div', { className: 'crypto-range-bar' });
  const toggleBtn = el('button', {
    className: 'crypto-toggle',
    type: 'button',
    'aria-label': 'Toggle BTC chart',
  });

  // Create the root SVG element in the proper namespace.
  const chart = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  chart.setAttribute('class', 'crypto-chart');
  chart.setAttribute('viewBox', '0 0 100 40');
  // Use uniform scaling so axis labels and line are not distorted.
  chart.setAttribute('preserveAspectRatio', 'xMidYMid meet');

  section.innerHTML = '';

  // Title row: "Crypto" + collapse toggle
  const titleRow = el(
    'div',
    { className: 'crypto-title-row' },
    el('h2', { className: 'category-header', textContent: 'Crypto' }),
    toggleBtn,
  );

  // Main header: pair label/price/delta with range buttons on one line
  const headerMain = el('div', { className: 'crypto-header-main' });
  headerMain.append(
    el('span', { className: 'crypto-label', textContent: 'BTC → GBP' }),
    priceEl,
    deltaEl,
  );

  const header = el('div', { className: 'crypto-header' });
  header.append(headerMain, rangeBar);

  section.append(titleRow, header, chart);

  const setRangeButtons = () => {
    rangeBar.innerHTML = '';
    Object.entries(CRYPTO_RANGES).forEach(([key, cfg]) => {
      const btn = el('button', {
        className: `crypto-range-btn${key === currentRange ? ' active' : ''}`,
        type: 'button',
        'data-range': key,
      }, cfg.label);
      btn.addEventListener('click', () => {
        if (currentRange === key) return;
        currentRange = key;
        setRangeButtons();
        void loadAndRenderRange();
      });
      rangeBar.append(btn);
    });
  };

  setRangeButtons();

  toggleBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>';
  toggleBtn.addEventListener('click', () => {
    section.classList.toggle('crypto-expanded');
  });

  const loadAndRenderRange = async () => {
    const cfg = CRYPTO_RANGES[currentRange];
    const cacheKey = `${CRYPTO_CACHE_KEY_PREFIX}${currentRange}`;
    const cached = getSessionJSON(cacheKey);
    let series;

    if (cached && Array.isArray(cached.prices)) {
      series = cached.prices;
    } else {
      try {
        const daysParam = cfg.days;
        const url = `https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=gbp&days=${daysParam}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        series = json.prices || [];
        setSessionJSON(cacheKey, { prices: series });
      } catch (err) {
        console.warn('BTC data unavailable for range', currentRange, err);
        priceEl.textContent = '—';
        deltaEl.textContent = 'Data unavailable';
        deltaEl.className = 'crypto-delta flat';
        chart.innerHTML = '';
        return;
      }
    }

    if (!series.length) {
      section.innerHTML = '<p class="section-placeholder">No BTC data available.</p>';
      return;
    }

    const prices = series.map(p => p[1]);
    const times = series.map(p => p[0]);
    const latest = prices[prices.length - 1];
    const earlier = prices[0];
    const diff = latest - earlier;
    const pct = earlier ? (diff / earlier) * 100 : 0;
    const sign = diff > 0 ? '+' : diff < 0 ? '−' : '';
    const colourClass = diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat';

    priceEl.textContent = `£${latest.toLocaleString('en-GB', { maximumFractionDigits: 0 })}`;
    deltaEl.textContent = `${sign}${Math.abs(pct).toFixed(1)}%`;
    deltaEl.className = `crypto-delta ${colourClass}`;

    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const span = max - min || 1;

    const points = prices.map((price, idx) => {
      const x = (idx / (prices.length - 1 || 1)) * 96 + 4; // leave 4px left padding for y-axis
      const y = 38 - ((price - min) / span) * 28;          // fit between top (10) and bottom (38)
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    });

    chart.innerHTML = '';

    // Create the polyline in the proper SVG namespace so it actually renders.
    const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    poly.setAttribute('points', points.join(' '));
    poly.setAttribute('fill', 'none');
    poly.setAttribute('stroke', 'currentColor');
    poly.setAttribute('stroke-width', '0.9');
    poly.setAttribute('class', 'crypto-line');
    chart.append(poly);

    // Axes and labels
    const axisGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    axisGroup.setAttribute('class', 'crypto-axes');

    // X axis line (bottom)
    const xAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    xAxis.setAttribute('x1', '4');
    xAxis.setAttribute('y1', '38');
    xAxis.setAttribute('x2', '100');
    xAxis.setAttribute('y2', '38');
    xAxis.setAttribute('stroke', 'rgba(240,244,255,0.18)');
    xAxis.setAttribute('stroke-width', '0.4');
    axisGroup.append(xAxis);

    // Y axis line (left)
    const yAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    yAxis.setAttribute('x1', '4');
    yAxis.setAttribute('y1', '5');
    yAxis.setAttribute('x2', '4');
    yAxis.setAttribute('y2', '35');
    yAxis.setAttribute('stroke', 'rgba(240,244,255,0.18)');
    yAxis.setAttribute('stroke-width', '0.4');
    axisGroup.append(yAxis);

    const fmtDate = (ts) =>
      new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

    const firstTs = times[0];
    const lastTs = times[times.length - 1];

    // X axis labels
    const xLabelStart = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    xLabelStart.setAttribute('x', '4');
    xLabelStart.setAttribute('y', '39');
    xLabelStart.setAttribute('text-anchor', 'start');
    xLabelStart.setAttribute('font-size', '3');
    xLabelStart.setAttribute('fill', 'rgba(240,244,255,0.6)');
    xLabelStart.textContent = fmtDate(firstTs);
    axisGroup.append(xLabelStart);

    const xLabelEnd = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    xLabelEnd.setAttribute('x', '98');
    xLabelEnd.setAttribute('y', '39');
    xLabelEnd.setAttribute('text-anchor', 'end');
    xLabelEnd.setAttribute('font-size', '3');
    xLabelEnd.setAttribute('fill', 'rgba(240,244,255,0.6)');
    xLabelEnd.textContent = fmtDate(lastTs);
    axisGroup.append(xLabelEnd);

    // Y axis labels (min / max)
    const maxLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    maxLabel.setAttribute('x', '6');
    maxLabel.setAttribute('y', '10');
    maxLabel.setAttribute('text-anchor', 'start');
    maxLabel.setAttribute('font-size', '3');
    maxLabel.setAttribute('fill', 'rgba(240,244,255,0.6)');
    maxLabel.textContent = `£${max.toLocaleString('en-GB', { maximumFractionDigits: 0 })}`;
    axisGroup.append(maxLabel);

    const minLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    minLabel.setAttribute('x', '6');
    minLabel.setAttribute('y', '35');
    minLabel.setAttribute('text-anchor', 'start');
    minLabel.setAttribute('font-size', '3');
    minLabel.setAttribute('fill', 'rgba(240,244,255,0.6)');
    minLabel.textContent = `£${min.toLocaleString('en-GB', { maximumFractionDigits: 0 })}`;
    axisGroup.append(minLabel);

    chart.append(axisGroup);
  };

  void loadAndRenderRange();
}

// ── Init ──────────────────────────────────────────────────────────────────
(async function init() {
  const searchEl = document.getElementById('search-input');
  if (searchEl) {
    searchEl.focus();
    searchEl.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      const q = (e.currentTarget && e.currentTarget.value ? e.currentTarget.value : '').trim();
      if (!q && !isUrl(q)) {
        window.location.assign('https://www.google.com/');
        return;
      }
      if (isUrl(q)) {
        window.location.assign(q);
      } else {
        const url = `https://www.google.com/search?q=${encodeURIComponent(q)}`;
        saveRecentLink({ url, name: `🔍 ${q}`, logo: 'https://www.google.com/favicon.ico' });
        window.location.assign(url);
      }
    });
  }

  migrateClickCounts();
  initFooter();
  initTabs();
  initFAB();
  initClock();
  initSearchGoogleBtn();

  if (window.lucide) {
    lucide.createIcons();
  } else {
    document.addEventListener('DOMContentLoaded', () => { if (window.lucide) lucide.createIcons(); });
    setTimeout(() => { if (window.lucide) lucide.createIcons(); }, 500);
  }

  const links = await loadLinks();
  if (links.length) {
    const mode = getSortMode();
    renderLinks(links, mode);
    initSortBar(links);
    initSearch(links, mode);
    initResetStatsBtn(links);
    fetchUmamiStats(links);
  }

  requestPersistentStorage();
  initWeather();
  initFootball();
  initGithubHeatmap();
  initNewsHeadlines();
  initCryptoBtcGbp();
})();
