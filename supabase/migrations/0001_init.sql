-- =============================================================================
-- Noxias Coach — Schema initial
-- =============================================================================
-- À exécuter dans le SQL Editor de Supabase, ou via la CLI :
--   supabase db push
-- =============================================================================

-- ---------- Extensions ----------
create extension if not exists "pgcrypto";

-- ---------- Profiles ----------
-- Étend auth.users avec les infos métier du commercial.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  company text,
  role_title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto-create profile à l'inscription.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Sessions ----------
-- Une session = un appel de prospection simulé.
create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  -- Configuration choisie par le commercial.
  difficulty text not null check (difficulty in ('debutant', 'intermediaire', 'avance', 'expert')),
  persona_key text not null,
  persona_label text not null,
  product_pitch text,                    -- Quel produit/service le commercial pitche
  objective text not null default 'rdv', -- 'rdv' | 'demo' | 'qualification'

  -- État de la session.
  status text not null default 'active' check (status in ('active', 'completed', 'abandoned')),
  ended_by text check (ended_by in ('user', 'prospect', 'timeout')),
  appointment_secured boolean not null default false,

  -- Évaluation (générée à la fin).
  score int check (score >= 0 and score <= 100),
  evaluation jsonb,

  -- Timestamps.
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

create index if not exists sessions_user_id_idx on public.sessions(user_id, started_at desc);
create index if not exists sessions_status_idx on public.sessions(status);

-- ---------- Messages ----------
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  role text not null check (role in ('user', 'prospect', 'system')),
  content text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists messages_session_id_idx on public.messages(session_id, created_at asc);

-- =============================================================================
-- Row Level Security
-- =============================================================================

alter table public.profiles enable row level security;
alter table public.sessions enable row level security;
alter table public.messages enable row level security;

-- Profiles : un user voit/édite son propre profil.
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

-- Sessions : un user voit/gère ses propres sessions.
drop policy if exists "sessions_select_own" on public.sessions;
create policy "sessions_select_own" on public.sessions
  for select using (auth.uid() = user_id);

drop policy if exists "sessions_insert_own" on public.sessions;
create policy "sessions_insert_own" on public.sessions
  for insert with check (auth.uid() = user_id);

drop policy if exists "sessions_update_own" on public.sessions;
create policy "sessions_update_own" on public.sessions
  for update using (auth.uid() = user_id);

drop policy if exists "sessions_delete_own" on public.sessions;
create policy "sessions_delete_own" on public.sessions
  for delete using (auth.uid() = user_id);

-- Messages : un user voit/écrit dans ses propres sessions.
drop policy if exists "messages_select_own" on public.messages;
create policy "messages_select_own" on public.messages
  for select using (
    exists (
      select 1 from public.sessions s
      where s.id = messages.session_id and s.user_id = auth.uid()
    )
  );

drop policy if exists "messages_insert_own" on public.messages;
create policy "messages_insert_own" on public.messages
  for insert with check (
    exists (
      select 1 from public.sessions s
      where s.id = messages.session_id and s.user_id = auth.uid()
    )
  );
