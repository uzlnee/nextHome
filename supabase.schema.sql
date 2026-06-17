create table if not exists public.user_app_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  zones jsonb not null default '[]'::jsonb,
  weights jsonb not null default '{}'::jsonb,
  chat_messages jsonb not null default '[]'::jsonb,
  api_messages jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_app_data enable row level security;

drop policy if exists "Users can read their own app data" on public.user_app_data;
create policy "Users can read their own app data"
on public.user_app_data
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their own app data" on public.user_app_data;
create policy "Users can insert their own app data"
on public.user_app_data
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own app data" on public.user_app_data;
create policy "Users can update their own app data"
on public.user_app_data
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own app data" on public.user_app_data;
create policy "Users can delete their own app data"
on public.user_app_data
for delete
to authenticated
using ((select auth.uid()) = user_id);
