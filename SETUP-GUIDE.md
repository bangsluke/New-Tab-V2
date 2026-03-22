# Setup guide — Supabase click sync (after code implementation)

This project can sync link **click counts** across browsers and devices (for example Microsoft Edge on a laptop and Safari on an iPhone) using **Supabase** as the source of truth. Complete these steps **after** the implementation that reads `data/supabase-config.json` and wires the Supabase client is merged.

Your new tab page must open from the **same HTTPS URL** on every device (for example `https://your-site.netlify.app`). Local `file://` pages cannot complete Supabase Auth redirects reliably.

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

## Reference: what the code should do (checklist)

- [ ] Build writes `data/supabase-config.json` when env vars are present.
- [ ] App loads config, initializes Supabase only when `enabled`.
- [ ] Signed-in user: pull events, merge into local click map, re-render.
- [ ] Each click: local increment + insert row (when session exists).
- [ ] Reset-by-period (and full reset): local trim + matching deletes in Supabase when signed in.

When all of the above are true, follow sections 1–5 once per Supabase project.
