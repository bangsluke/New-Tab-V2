# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

New Tab V2 is a browser new tab replacement page. It is a local HTML/CSS/JS project (no build system) designed to load fast and direct the user to their next destination quickly.

## Architecture

This is a **single-page static web app** — no framework, no bundler, no server. The output should be a self-contained `index.html` (with optional sibling CSS/JS files) that a browser can open directly as a local file via `file:///`.

### Key Design Decisions

- **Links source**: Link data is read from a local Obsidian markdown file. The file path is stored in `config/config.yaml` under `links-list-source-file-path`. The markdown file contains a table under a `## Links List` header — this table is parsed at runtime to populate the page.
- **Config loading**: Because this runs as a local file, `config/config.yaml` must be fetched relative to the HTML file. Since browsers block local file fetches by default, the config path and Obsidian file path will need to be either embedded at build time or handled via a small local server/Node script.
- **Background**: `assets/bg.jpg` fills the viewport as the page background.

### Features to Implement (from `prompts/initialPrompt.md`)

1. **Header**: `Welcome @bangsluke to your new tab.`
2. **Links list**: Fetched from the Obsidian markdown file (path in config), parsed from a markdown table below `## Links List`, grouped by category, with optional circular logo icons.
3. **Umami analytics**: If a link has an Umami Tracking Link, show a link to the Umami dashboard and display visitor trend (24h vs prior 24h) as a green ▲ or red ▼.
4. **Fuzzy search bar**: Above the links list; searches link name and category (tolerant of typos).
5. **Weather widget**: 24-hour forecast + 7-day outlook using the user's current geolocation.
6. **Footer**: `© 2026-{currentYear} bangsluke designs.` with a GitHub link and mailto envelope icon.
7. **Scroll-to-top FAB**: Circular floating button, appears after scrolling 10% of page height.

## Configuration

`config/config.yaml`:
```yaml
links-list-source-file-path: '<absolute Windows path to Obsidian .md file>'
```

The Obsidian source file is **not** in this repository. It lives in the user's local Obsidian vault. Any code that reads it must handle the case where the file is inaccessible.

## README Maintenance

**Always keep `README.md` up to date.** After every change that affects any of the following, update the relevant section of the README before finishing the task:

- Features added, changed, or removed
- New config keys in `config/config.yaml`
- Changes to the Obsidian table columns the script expects
- Changes to the file structure
- Changes to setup steps or commands
- New dependencies or tech stack changes

## Development

No build step is defined yet. If a build/serving approach is introduced (e.g., a small Node/Vite/Python server to proxy local file reads), document it here.

To open the page during development, open `index.html` directly in a browser, or serve the project root with any static file server:
```bash
npx serve .
# or
python -m http.server
```
