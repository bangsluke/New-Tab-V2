# Setup guide — Supabase click sync (after code implementation)

This project can sync link **click counts** across browsers and devices (for example Microsoft Edge on a laptop and Safari on an iPhone) using **Supabase** as the source of truth. Complete these steps **after** the implementation that reads `data/supabase-config.json` and wires the Supabase client is merged.

Your new tab page must open from the **same HTTPS URL** on every device (for example `https://your-site.netlify.app`). Local `file://` pages cannot complete Supabase Auth redirects reliably.

**Microsoft Edge “Tracking Prevention”:** Lucide and Fuse are loaded from your own site (`assets/vendor/`). You may still see a few warnings for **`esm.sh`** when the Supabase client loads; that is expected and usually harmless. If **first-party** storage for your Netlify origin is blocked, sign-in may not persist across reloads; try **Balanced** tracking prevention or an exception for your new-tab URL.

**Console noise that is not from this repo:** `runtime.lastError` / “message channel closed” / stack traces pointing at **`hook.js`** almost always come from a **browser extension** (ad blocker, password manager, React DevTools, etc.), not from the New Tab page. Test in an **InPrivate** window with extensions disabled to confirm a clean console.

**Edge `[Intervention] Images loaded lazily`:** Link logos intentionally avoid `loading="lazy"` so this should be rare; if it still appears, it may be from another image on the page or another tab.

**GoTrue lock warning (`lock:sb-…-auth-token` not released within 5000ms):** The app passes a **custom auth `lock`** so GoTrue does not use the browser **Web Locks API** (which triggered that message on Edge). If an older deploy still shows it, redeploy. Trade-off: no cross-tab lock between two windows on the same origin (rare for a personal new tab).

**Console 404 for `images`:** Often caused by **malformed `logo` strings** in `data/links.json` (e.g. angle brackets or stray `>` in the URL), which the browser treats as a path on your own site (`/images`). Invalid logos fall back to the letter placeholder and should no longer spam 404s.

---

## 1. Create a Supabase project

1. Sign in at [https://supabase.com](https://supabase.com) and create a **new project** (choose a region close to you).
2. Wait until the project finishes provisioning.
3. Open **Project Settings → API** and note:
   - **Project URL** (e.g. `https://xxxx.supabase.co`)
   - **anon public** key (safe to expose in the browser with RLS enabled)

Do **not** use the **service_role** key in the web app or in Netlify variables that the static site exposes to the client.

---

## 2. Create the table and RLS policies

1. In Supabase, open **SQL Editor → New query**.
2. Paste and run the contents of [`supabase/migrations/001_link_click_events.sql`](supabase/migrations/001_link_click_events.sql) from this repository (table `link_click_events` with `select` / `insert` / `delete` policies for `auth.uid() = user_id`).
3. Confirm under **Table Editor** that `link_click_events` exists.

---

## 3. Configure Auth (magic link)

1. Go to **Authentication → Providers → Email** and ensure **Email** is enabled.
2. For a **personal** dashboard, you may temporarily disable **Confirm email** under **Authentication → Providers → Email** (or **Authentication → Settings**) while testing, so magic links work without an extra confirmation step. Re-enable for stricter security if you prefer.
3. Under **Authentication → URL Configuration**:
   - **Site URL:** your production new tab URL, e.g. `https://your-site.netlify.app`
   - **Redirect URLs:** add the same URL and, if you use Netlify branch previews, add wildcard patterns Supabase supports (e.g. `https://*.netlify.app`) or each preview URL you care about.
4. Optional: configure **SMTP** under **Project Settings → Auth** if the default email rate or deliverability is insufficient.

You will sign in with the **same email address** on Edge and on Safari so both browsers attach to the **same** `auth.users` row and see the same click rows.

---

## 4. Netlify environment variables

In the Netlify UI for this site: **Site configuration → Environment variables**, add:

| Variable | Value |
|----------|--------|
| `SUPABASE_URL` | Project URL from Supabase API settings |
| `SUPABASE_ANON_KEY` | **anon public** key |

Redeploy the site so the build step can generate `data/supabase-config.json` (the implementation uses the same pattern as `UMAMI_API_KEY` in `scripts/netlify-build.js`).

For **local** builds that need sync, set the same variables in your shell or a `.env` file consumed by your local Netlify CLI workflow — do **not** commit secrets. (This repository’s automation may use `netlify dev` or `node scripts/netlify-build.js` with env vars set.)

---

## 5. Verify after deploy

1. Open the new tab URL on **Edge** while signed out (if the UI offers sign-out), then **sign in** with magic link.
2. Click a few links; confirm counts increase.
3. Open the **same URL** on **Safari** (phone), sign in with the **same email**, complete the magic link.
4. Refresh or trigger a sync (per app behavior): totals for the same URLs should **match** on both devices.
5. In Supabase **Table Editor**, confirm new rows appear in `link_click_events` as you click.

---

## 6. If magic link or redirect fails

- **Redirect URL mismatch:** Supabase shows errors when the redirect is not listed under **Redirect URLs** or does not match **Site URL**.
- **Wrong origin:** Opening the page from a different domain than configured will break auth.
- **Email not received:** Check spam; configure custom SMTP in Supabase if needed.

---

## 7. Privacy and data

Rows store **clicked URLs** and timestamps. That is appropriate for a private start page but is sensitive if the project were ever public. Revoke access by rotating keys and tightening RLS; delete data from **Table Editor** or with SQL if you reset the project.

---

## 8. Step-by-step testing (and why rows might be missing)

Work through these in order. If anything fails, use **sync debug** (next section).

1. **Confirm the live site actually has Supabase turned on**  
   In a normal browser tab (not necessarily the new-tab override), open:
   `https://YOUR-SITE.netlify.app/data/supabase-config.json`  
   You should see `"enabled": true` plus a `url` and `anonKey`. If you see `"enabled": false`, the Netlify build did not receive `SUPABASE_URL` / `SUPABASE_ANON_KEY`, or the site was not redeployed after setting them.

2. **Use the same HTTPS origin everywhere**  
   Edge and Safari must open **exactly** the deployed URL (e.g. `https://yoursite.netlify.app/`). If the new-tab setting points at a different host, a `file://` page, or a cached old deploy, auth and config will not match.

3. **Run the SQL migration**  
   In Supabase SQL Editor, run [`supabase/migrations/001_link_click_events.sql`](supabase/migrations/001_link_click_events.sql). Without the table and RLS policies, inserts return errors (visible in sync debug).

4. **Redirect URLs**  
   Under **Authentication → URL Configuration**, **Redirect URLs** must include your live new-tab URL (path included if you use one, e.g. `https://yoursite.netlify.app/`). The app sends magic links with `emailRedirectTo` = `origin + pathname`.

5. **Sign in on device A (e.g. Edge)**  
   Use **Sync clicks** → enter email → **Send link** → complete the email link. After return, the status line should say you are signed in.

6. **Insert test**  
   While signed in, click a normal link card (one that navigates away). The app POSTs a row to `link_click_events`. Check **Supabase → Table Editor → link_click_events** within a few seconds.

7. **Sign in on device B (e.g. Safari)**  
   Open the **same** site URL, sign in with the **same** email, complete the magic link. Reload once. Counts are merged from the server into `localStorage` on pull; they are not read from Postgres on every paint.

**Common reasons for zero rows**

| Symptom | Likely cause |
|--------|----------------|
| `supabase-config.json` has `enabled: false` | Env vars missing on Netlify or no redeploy after adding them. |
| Debug shows `insert skipped` / `not signed in` | Session not established (magic link not completed, or redirect blocked). |
| Debug shows `insert failed HTTP` 401 | Expired or missing JWT; sign out and sign in again. |
| Debug shows 404 / RLS error in body | Table or policies missing; wrong project URL/key. |
| Works on desktop, not phone | Different URL, private browsing, or stricter storage (try non-private Safari). |

---

## 9. Sync debug (on-page log)

To trace sync without desktop DevTools (useful on mobile):

1. Open your new tab page with query **`?syncDebug=1`** (e.g. `https://yoursite.netlify.app/?syncDebug=1`).  
   That flag is saved to `localStorage` as `ntv2-sync-debug=1` and the query is removed from the address bar so it survives magic-link redirects.

2. Scroll to **Links** → under the links grid you should see a **Sync debug** panel with a scrolling log.

3. Reproduce: sign in, click a link, open on the second device. Use **Copy log** to paste into a note if you need to compare devices.

4. **Turn off** when finished (clears the flag and hides the panel).

Alternatively, from DevTools console: `localStorage.setItem('ntv2-sync-debug','1')` then reload.

---

## Reference: what the code should do (checklist)

- [ ] Build writes `data/supabase-config.json` when env vars are present.
- [ ] App loads config, initializes Supabase only when `enabled`.
- [ ] Signed-in user: pull events, merge into local click map, re-render.
- [ ] Each click: local increment + insert row (when session exists).
- [ ] Reset-by-period (and full reset): local trim + matching deletes in Supabase when signed in.

When all of the above are true, follow sections 1–5 once per Supabase project.
