-- Run in Supabase SQL Editor (or via CLI) before enabling sync.
-- See SETUP-GUIDE.md for dashboard steps.

create table public.link_click_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  url text not null,
  clicked_at timestamptz not null default now()
);

create index link_click_events_user_url_idx on public.link_click_events (user_id, url);
create index link_click_events_user_time_idx on public.link_click_events (user_id, clicked_at desc);

alter table public.link_click_events enable row level security;

create policy "link_click_events_select_own"
  on public.link_click_events for select
  using (auth.uid() = user_id);

create policy "link_click_events_insert_own"
  on public.link_click_events for insert
  with check (auth.uid() = user_id);

create policy "link_click_events_delete_own"
  on public.link_click_events for delete
  using (auth.uid() = user_id);
