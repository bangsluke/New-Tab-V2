# Plan: New Tab V2 — Full Implementation

## Context

Building a local browser new-tab replacement page. It must load fast, display a categorised link list sourced from an Obsidian markdown file, support fuzzy search, show Umami analytics trends, and display an Open-Meteo weather widget. The page is served via a browser extension (e.g. New Tab Redirect) pointing to the local `index.html` file.

A Node.js refresh script pre-processes the Obsidian markdown file and writes `data/links.json` + `data/umami-config.json`. The browser loads these static JSON files at runtime (works with `file://` since they share the same origin). Live Umami API calls are made client-side at page load using credentials in `data/umami-config.json`.

---

## File Structure

```
New-Tab-V2/
├── assets/
│   └── bg.jpg
├── config/
│   └── config.yaml
├── data/                     # GENERATED — do not edit by hand
│   ├── links.json
│   └── umami-config.json
├── prompts/
│   ├── initialPrompt.md
│   └── plan.md
├── scripts/
│   └── refresh-links.js      # Node.js script
├── .env                      # Umami API key (gitignored)
├── .env.example
├── .gitignore
├── index.html
├── style.css
├── app.js
├── package.json
└── CLAUDE.md
```

---

## Files to Create

### `package.json`
- `"scripts": { "refresh": "node scripts/refresh-links.js" }`
- Dependencies: `js-yaml`, `dotenv`
- No build step; just the refresh script.

---

### `scripts/refresh-links.js`
1. Load `.env` via `dotenv`.
2. Parse `config/config.yaml` with `js-yaml` to get `links-list-source-file-path`.
3. Read the Obsidian `.md` file.
4. Find the `## Links List` section and extract the markdown table.
5. Parse headers and rows using these exact column names from the Obsidian table:

   | Order | Link Name | Link | Grouping | Logo URL | Project Link | Umami Tracking Link |

   - `Order` — numeric sort order; sort rows by this before grouping
   - `Link Name` — display name
   - `Link` — href URL
   - `Grouping` — category header
   - `Logo URL` — circular icon src (optional)
   - `Project Link` — secondary link shown after the name (optional)
   - `Umami Tracking Link` — full Umami dashboard URL e.g. `https://cloud.umami.is/websites/abc123`; extract the website ID from the last path segment

6. Write `data/links.json`:
   ```json
   [{ "name": "...", "url": "...", "category": "...", "logo": "...", "projectLink": "...", "umamiId": "abc123" }]
   ```
7. Read `UMAMI_API_TOKEN` from `.env`, write `data/umami-config.json`:
   ```json
   { "enabled": true, "apiBase": "https://api.umami.is/v1", "token": "..." }
   ```
   If no token present, write `{ "enabled": false }`.

**Run command:** `npm run refresh`

---

### `.env` / `.env.example`
```
UMAMI_API_TOKEN=your_token_here
```

### `.gitignore`
```
.env
data/
node_modules/
```
`data/` is generated — do not commit it.

---

### `index.html`
- No framework, no bundler.
- CDN scripts (non-blocking):
  - **Fuse.js** `^7` — fuzzy search
  - **Lucide Icons** — envelope icon + weather icons
- Layout:
  ```
  <header>        — Welcome text
  <main>
    <section id="weather">
    <div id="search-bar">
    <section id="links">
  </main>
  <footer>
  <button id="scroll-top-fab">
  ```
- Background image via CSS referencing `assets/bg.jpg`.

---

### `style.css`
- CSS custom properties: `--glass-bg`, `--glass-border`, `--accent`, `--text`, `--radius`.
- Background: `bg.jpg` covers viewport, `background-attachment: fixed`.
- **Glassmorphism** cards: `backdrop-filter: blur(12px)`, semi-transparent background, subtle border.
- Link list: CSS Grid, auto-fill columns, responsive.
- Category headers: uppercase, letter-spaced.
- Search bar: full-width glassmorphism input with focus ring.
- Weather widget: horizontal scroll strip for 24-hour forecast; CSS grid for 7-day view.
- FAB: `position: fixed; bottom: 2rem; right: 2rem;` — circular, hidden by default, shown via `.visible` class.
- Footer: centered, small text, flex row.

---

### `app.js`
Plain ES module (`<script type="module">`). No bundler.

**Init sequence (all kicked off in parallel where possible):**
```
loadLinks() → renderLinks() → initSearch()
loadUmamiConfig() → fetchUmamiStats() → injectTrends()
initWeather() → fetchWeather() → renderWeather()
initFAB()
```

**`loadLinks()`**
- `fetch('data/links.json')` → group by `category`, preserving first-seen order.

**`renderLinks(groups)`**
- For each category: `<h2>` header + link cards.
- Each card: optional circular `<img>` logo, `<a>` for the main link, optional `<a>` for `projectLink`, and an empty `<span class="umami-trend" data-umami-id="...">` placeholder.

**`initSearch(links)`**
- Fuse.js with `keys: ['name', 'category']`, `threshold: 0.4`.
- Input event listener re-renders filtered links.

**`fetchUmamiStats(links, config)`**
- Skip if `config.enabled === false`.
- For each link with a `umamiId`: two API calls to `GET {apiBase}/websites/{id}/stats`
  - Previous 24h: `startAt = now - 48h`, `endAt = now - 24h`
  - Current 24h: `startAt = now - 24h`, `endAt = now`
  - Header: `Authorization: Bearer {token}`
- Compare `pageviews.value` — inject `▲` (green) or `▼` (red) into matching `.umami-trend` span.

**`initWeather()`**
- `navigator.geolocation.getCurrentPosition()` → lat/lon.
- Fetch Open-Meteo: `https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&hourly=temperature_2m,weathercode,precipitation_probability&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=7`
- Reverse geocode city name via Nominatim: `https://nominatim.openstreetmap.org/reverse?lat=...&lon=...&format=json` (free, no key).
- Render:
  - **24-hour strip** — horizontally scrollable, current + next 23 hours, temp + WMO weather icon.
  - **7-day grid** — icon, high/low temps.
- Map WMO weather codes → Lucide icon names (with emoji fallback).

**`initFAB()`**
- Show FAB when `scrollY > window.innerHeight * 0.1`.
- On click: `window.scrollTo({ top: 0, behavior: 'smooth' })`.

---

## Verification

1. `npm install` then `npm run refresh` — confirm `data/links.json` and `data/umami-config.json` are written.
2. Open `index.html` in browser (or point New Tab Redirect extension at it).
3. Check:
   - Background fills screen, welcome header visible.
   - Links render grouped by category, with logos where present.
   - Fuzzy search filters by name and grouping (including typos).
   - Weather widget appears after granting geolocation permission.
   - Umami trend `▲`/`▼` appears for links that have IDs (check DevTools Network tab).
   - Scrolling 10%+ down reveals FAB; clicking scrolls back to top.
   - Footer shows current year, GitHub link, envelope icon.

---

## Hosting on Netlify

### Overview

The project is primarily designed for local use via a browser extension pointing at `index.html`. It can also be deployed to Netlify as a publicly accessible version with minimal changes.

The core challenge is that Netlify's build runners have no access to the local Obsidian vault, so `data/links.json` cannot be generated during the Netlify build. The solution is a split workflow:

| File | Strategy |
|------|----------|
| `data/links.json` | Generated locally via `npm run refresh`, then **committed to the repo** |
| `data/umami-config.json` | **Never committed** — generated at Netlify build time from a secret env var |

---

### Required File Changes

#### 1. Update `.gitignore`

Stop ignoring `data/links.json` so it can be committed. Keep `data/umami-config.json` out of the repo (it contains the API token).

```
.env
data/umami-config.json
node_modules/
```

#### 2. Add `netlify.toml` at the project root

```toml
[build]
  command   = "node scripts/netlify-build.js"
  publish   = "."

[build.environment]
  NODE_VERSION = "20"
```

`publish = "."` tells Netlify to serve the project root (where `index.html` lives).

#### 3. Add `scripts/netlify-build.js`

A small script that runs during the Netlify build to generate `data/umami-config.json` from the injected environment variable:

```js
const fs   = require('fs');
const path = require('path');

const DATA_DIR = path.resolve(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const token = process.env.UMAMI_API_KEY;
const config = token
  ? { enabled: true, apiBase: 'https://api.umami.is/v1', token }
  : { enabled: false };

fs.writeFileSync(
  path.join(DATA_DIR, 'umami-config.json'),
  JSON.stringify(config, null, 2)
);
console.log(`✓ umami-config.json written (enabled: ${config.enabled})`);
```

---

### Netlify Dashboard Setup

1. Connect the GitHub/GitLab repo to Netlify (or drag-and-drop deploy).
2. Under **Site configuration → Environment variables**, add:
   - Key: `UMAMI_API_KEY`
   - Value: the API key from your Umami Cloud account.
3. Netlify will auto-detect `netlify.toml` and run the build command on each push.

---

### Ongoing Deployment Workflow

Every time you update your links in Obsidian:

```bash
npm run refresh        # regenerates data/links.json from the Obsidian file
git add data/links.json
git commit -m "refresh links"
git push               # triggers a Netlify deploy
```

Netlify then:
1. Runs `node scripts/netlify-build.js` → writes `data/umami-config.json` from the env var.
2. Serves the project root as a static site.

---

### Caveats and Considerations

- **Links freshness**: The deployed links are only as current as the last `npm run refresh` + push. There is no automated sync with the Obsidian vault.
- **`assets/bg.jpg`**: Must be committed to the repo. It is not gitignored, so this should already be the case.
- **Geolocation on HTTPS**: Netlify serves sites over HTTPS by default, so the weather widget's `navigator.geolocation` will work without any extra configuration.
- **Umami API CORS**: The Umami Cloud API (`api.umami.is`) accepts cross-origin requests from browser clients, so the trend indicators will work from a Netlify-hosted origin.
- **The Umami token is never in git**: It exists only in `.env` locally and as a Netlify environment variable — `data/umami-config.json` is always generated fresh at build time and is excluded from the repo via `.gitignore`.

---

## Potential Additional Features (from prompt — not in scope for v1)

- **Clock widget** in the header.
- **Quick-note / scratchpad** (localStorage).
- **Recently visited** links (localStorage).
- **Keyboard shortcut navigation** (number keys jump to nth link).
- **Dark/light theme toggle** (preference in localStorage).
- **Link click counter** (localStorage).

---

## Tab 2 — Extra Information

Secondary tab for ambient context widgets. All are independent of the Links tab.

### Recently Visited Links (implemented in this plan)
- `localStorage` key: `ntv2-recent` — `Array<{ url, name, logo, visitedAt }>`, max 10, newest first, deduplicated by URL
- Integrated into the main links list (Tab 1), not as a separate Tab 2 section
- In **grouping** mode: appears as a "Recent" group at the top of the links list
- In **frequency** mode: recently visited links naturally rank highest in the click-count sort

### Premier League Table (planned)
- API: [football-data.org](https://www.football-data.org/) free tier (10 req/min, API key required)
- Endpoint: `GET /v4/competitions/PL/standings` with `X-Auth-Token` header
- Display all 20 teams: position, crest, name, played, GD, points
- Highlight Liverpool's row with accent colour border
- Cache result in `sessionStorage` with a timestamp key (refresh once per session)

### Ideation: Other Potential Widgets

**Upcoming Fixtures**
- Pull Liverpool's next 5 fixtures from the same football-data.org API
- Show opponent crest, date/time, home/away label
- Live countdown in hours to next fixture via `setInterval`

**Last.fm Now Playing / Recently Played**
- Last.fm API `/user.getRecentTracks?user={username}&limit=1` — no OAuth, only an API key
- Show album art, track name, artist; link to the track page
- Poll every 60 seconds or on tab focus

**GitHub Contribution Graph**
- `GET https://api.github.com/users/{username}/events` — no auth required for public events
- Render a 7-column heatmap of contribution intensity with glassmorphism cells
- Link to GitHub profile

**Daily News Headlines**
- RSS-to-JSON proxy (e.g. `https://api.rss2json.com`) pointing at BBC News or Guardian RSS
- Show top 5 headlines with publication time, each opening the article in a new tab
- Refresh once on page load; cache in sessionStorage

**Currency / Crypto Rates**
- FX: `https://open.er-api.com/v6/latest/GBP` — free, no key
- Crypto: CoinGecko `/simple/price?ids=bitcoin,ethereum&vs_currencies=gbp` — free, no key
- Display as a compact badge row with 24h delta arrows

**Countdown Timers to Key Dates**
- Define events in `data/countdowns.json`: `[{ label, date, emoji }]`
- Render as a horizontal strip of cards: label + days/hours remaining
- Update every minute via `setInterval`
