# New Tab V2

A fast, local browser new-tab replacement page with a categorised link list, fuzzy search, Umami analytics trends, and a weather widget.

## Table of Contents

- [Features](#features)
- [File Structure](#file-structure)
- [Setup](#setup)
  - [Install dependencies](#1-install-dependencies)
  - [Configure](#2-configure)
  - [Set up Umami (optional)](#3-set-up-umami-optional)
  - [Generate data files](#4-generate-data-files)
  - [Open in browser](#5-open-in-browser)
- [Obsidian Table Format](#obsidian-table-format)
- [Configuration Reference](#configuration-reference)
- [Football Data](#football-data)
- [Widgets & Extras](#widgets--extras)
- [Deploying to Netlify](#deploying-to-netlify)
- [Tech Stack](#tech-stack)

## Features

- **Links list** — sourced from a local Obsidian markdown file, grouped by category, with optional circular logos
- **Tab layout** — Links tab (search, sort, links) and Extra tab (Premier League table + Liverpool fixtures); active tab persists in localStorage
- **Sort toggle** — switch between Frequency (flat grid sorted by click count + A–Z tiebreaker) and Grouping (category headers with Recent group at top); sort bar is hidden by default — click the gear icon (⚙) in the search bar to reveal it; buttons span the full grid width, smaller font on mobile
- **Recently visited** — Google searches made from the search bar appear as a "Recent" group in Grouping mode (stored in localStorage); links from the main list stay in their original category
- **Click tracking** — every link click increments a count, shown with a pointer cursor SVG + count on every card; click timestamps stored in localStorage (`ntv2-click-counts`) to support time-range resets; ↺ Reset stats button opens a modal with options: past hour / 24 h / week / all stats; modal shows a confirmation message after resetting (title + time frame covered), then auto-closes after 1.5 s
- **Umami stats** — per-link icon + count + diff-in-brackets + ▲/▼ indicator; metric (Visitors / Pageviews / Visits) and time period (24 h / 7 d / 30 d) toggle buttons in the sort bar; defaults to 30 d; metric switch is instant from cache, period switch re-fetches from API; metric, period, sort mode, and sort bar visibility all persist in localStorage
- **Fuzzy search** — Fuse.js powered, searches link name and category (typo-tolerant); auto-focused on page load; Enter opens a Google search in a new tab
- **Weather widget** — expanded by default on desktop (>600 px), collapsed on mobile; click to toggle; shows 24-hour strip + 7-day forecast via Open-Meteo (no API key required)
- **Glassmorphism UI** — backdrop blur cards, responsive 3-column grid on desktop / 1 column on mobile
- **Scroll-to-top FAB** — appears after scrolling 10% of page height
- **Footer** — dynamic current year, GitHub link, mailto envelope icon
- **New widgets (Tab 2)** — Premier League table + Liverpool fixtures, GitHub contribution heatmap for `bangsluke`, daily BBC News and BBC Sport headlines, and a BTC→GBP price widget with quick range toggles

## File Structure

```
New-Tab-V2/
├── assets/
│   └── bg.jpg                  # Background image
├── config/
│   └── config.yaml             # Source file path + heading name config
├── data/
│   ├── links.json              # GENERATED locally — committed (no secrets)
│   ├── umami-config.json       # GENERATED — gitignored (contains API key)
│   └── football-config.json    # GENERATED — gitignored (contains API key)
├── prompts/                    # Project planning docs
├── netlify/
│   └── functions/
│       └── football.js         # Serverless proxy — forwards football API calls server-side
├── scripts/
│   ├── refresh-links.js        # Parses Obsidian .md → data/ JSON files (local)
│   └── netlify-build.js        # Netlify build step — generates config JSONs from env vars
├── .env                        # Umami + football API keys (gitignored)
├── .env.example                # Template for .env
├── .gitignore
├── .vscode/
│   └── settings.json           # Sets Live Server host to localhost (CORS fix)
├── app.js                      # Client-side ES module — all runtime logic
├── index.html                  # Page structure
├── netlify.toml                # Netlify build config + security headers
├── package.json
└── style.css                   # Glassmorphism styles
```

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure

Edit `config/config.yaml`:

```yaml
# Absolute path to your Obsidian markdown file
links-list-source-file-path: 'C:\path\to\your\file.md'

# Exact text of the heading above the links table in that file
links-list-heading: 'Links List'
```

### 3. Set up Umami (optional)

Copy `.env.example` to `.env` and add your [Umami Cloud API key](https://umami.is/docs/cloud/api-key):

```
UMAMI_API_KEY=api_xxxxxxxxxxxxxxxx
```

### 4. Generate data files

```bash
npm run refresh
```

This reads the Obsidian file and writes `data/links.json` and `data/umami-config.json`. Re-run whenever you update the links table.

### 5. Open in browser

Open `index.html` directly, or serve locally for geolocation support:

```bash
npx serve .
```

Then visit `http://localhost:3000`.

> **Note:** Browsers block geolocation on `file://` URLs. Use a local server to enable the weather widget.

> **VS Code Live Server:** The included `.vscode/settings.json` configures Live Server to serve on `http://localhost` instead of `http://127.0.0.1`. This is required because the football-data.org free tier only allows CORS requests from `http://localhost`.

## Obsidian Table Format

The script expects a markdown table under the configured heading with these columns:

| Order | Link Name | Link | Grouping | Logo URL | Project Link | Umami Tracking Link | Tags |
|-------|-----------|------|----------|----------|--------------|---------------------|------|

- **Order** — numeric sort order
- **Link Name** — display name shown on the card
- **Link** — destination URL (bare, `<url>`, or `[text](url)` format)
- **Grouping** — category header to group cards under
- **Logo URL** — circular icon image URL (optional)
- **Project Link** — secondary link shown as "Project" below the name (optional)
- **Umami Tracking Link** — full Umami dashboard URL, e.g. `https://cloud.umami.is/analytics/eu/websites/{uuid}` (optional)
- **Tags** — optional tags used for search, e.g. `Insurance, Finance` or `#Insurance #Finance`; these are normalised into a `tags: string[]` field in `data/links.json`

## Configuration Reference

| Key | Description | Default |
|-----|-------------|---------|
| `links-list-source-file-path` | Absolute path to the Obsidian `.md` file | _(required)_ |
| `links-list-heading` | Heading text above the links table | `Links List` |

## Widgets & Extras

The `Extra` tab surfaces ambient context widgets that are independent from the primary Links tab.

### Premier League table & fixtures

- Uses the free [football-data.org](https://www.football-data.org/) API, proxied via a Netlify Function (`netlify/functions/football.js`) so the API key is never exposed to the browser.
- Shows the full Premier League table, with Liverpool highlighted, plus the next 5 Liverpool fixtures (opponent, date/time, competition, home/away).
- Data is cached in `sessionStorage` (`ntv2-football-cache`) and refreshed once per browser session to stay within free-tier limits.

### GitHub contribution heatmap

- Builds a lightweight activity heatmap for the GitHub user `bangsluke` from the public events API (`https://api.github.com/users/{username}/events/public`).
- Normalises events into a per-day activity score and renders a 7-column glassmorphism grid with intensity buckets (`level-0` … `level-4`).
- Results are cached in `sessionStorage` (e.g. `ntv2-github-heatmap`) for the duration of the session to minimise API calls and avoid rate limits.

### Daily BBC News & Sport headlines

- Fetches the latest headlines from the BBC News and BBC Sport RSS feeds via a public RSS→JSON proxy.
- Renders the top headline for each feed (title + source label + relative time) in a compact card below the football sections.
- Responses are cached in `sessionStorage` (`ntv2-bbc-headlines`) with a short TTL so you only hit the RSS proxy occasionally.

### Crypto / FX — BTC → GBP

- Uses public, no-auth market data (e.g. CoinGecko’s `market_chart` endpoints) to show BTC priced in GBP.
- Shows the latest BTC/GBP price and 24h delta, plus a small line chart inside a glass card.
- Range toggle buttons (24h / 1M / 1Y / All) switch the underlying time window; each range is cached in `sessionStorage` under its own key to avoid repeat fetches.

### Architecture overview

- All runtime logic lives in a single ES module (`app.js`), wired up from `index.html` with no bundler or framework.
- Static JSON config in `data/` (links, Umami config, football config) is generated by Node.js scripts at build/refresh time and then consumed client-side.
- Secondary widgets (weather, football, Umami, GitHub, BBC, crypto) initialise asynchronously after the core links/search UI so that time-to-type in the search box stays fast.

## Football Data

The Extra tab shows a live Premier League table (P / W / D / L / GD / Pts) and Liverpool's next 5 fixtures, both in glass-card containers. Liverpool is highlighted in red. On mobile, fixture time wraps below the date and (H)/(A) wraps below the competition name. This requires a free API key from [football-data.org](https://www.football-data.org/):

1. Register at football-data.org (free tier: 10 req/min)
2. Add `FOOTBALL_DATA_API_KEY=your_key` to `.env`
3. Run `npm run refresh`

Data is cached in `sessionStorage` and refreshed once per browser session.

Football requests are proxied through a Netlify Function (`netlify/functions/football.js`) so the API key is never exposed to the browser and the free-tier CORS restriction is bypassed. To test football data locally, run `npm run dev:netlify` (this uses `npx netlify dev` under the hood and will prompt to install the Netlify CLI if it's not already available).

## Deploying to Netlify

The site is fully static — Netlify serves it directly. The build step generates the two API config files from environment variables; `data/links.json` is pre-committed (no secrets).

### Steps

1. Push the repo to GitHub — verify `.gitignore` excludes `data/umami-config.json` and `data/football-config.json`
2. Import the repo in Netlify — it will auto-detect `netlify.toml`
3. In **Site configuration → Environment variables**, add:
   - `UMAMI_API_KEY` — your Umami Cloud API key (mark as sensitive)
   - `FOOTBALL_DATA_API_KEY` — your football-data.org API key (mark as sensitive)
4. Trigger a deploy — Netlify runs `node scripts/netlify-build.js`, which writes the two config files, then serves the project root

> **Updating links after deploy:** Run `npm run refresh` locally and push the updated `data/links.json`. Netlify will redeploy automatically if auto-deploy is enabled, or trigger a manual deploy.

> **Testing the build locally:** Run `npm run netlify` (with env vars set in your shell or `.env`) to verify the config files are generated correctly before pushing.

> **Local football data:** The football API is proxied through a Netlify Function — it won't work with `npx serve .`. Run `npm run dev:netlify` to serve the site with Functions support for local testing.

## Tech Stack

| Concern | Solution |
|---------|----------|
| Fuzzy / tagged search | [Fuse.js](https://fusejs.io/) v7 (CDN), plus direct matching over name, category, and tags |
| Icons | [Lucide](https://lucide.dev/) (CDN) |
| Weather | [Open-Meteo](https://open-meteo.com/) (free, no key) |
| Reverse geocoding | [Nominatim / OpenStreetMap](https://nominatim.org/) (free, no key) |
| Analytics trends | [Umami Cloud API](https://umami.is/docs/cloud/api-key) (API key required) |
| Markdown parsing | Node.js script (`scripts/refresh-links.js`) |
