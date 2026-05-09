-- =============================================================================
-- Noxias Coach - Migration 0007 : Roles, profils enrichis, avatars
-- =============================================================================
-- Ajoute first_name, last_name, avatar_url, role sur profiles.
-- Crée le bucket avatars dans Storage.
-- Met à jour les RLS sessions/messages : manager voit tout, commercial voit ses propres sessions.
-- =============================================================================

-- ---------- Profile fields ----------
alter table public.profiles
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists avatar_url text,
  add column if not exists role text not null default 'commercial'
    check (role in ('commercial', 'manager'));

create index if not exists profiles_role_idx on public.profiles(role);

-- Helper : retourne true si l'utilisateur courant est manager
create or replace function public.is_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'manager'
  );
$$;

-- ---------- Sessions RLS : manager voit tout, commercial voit le sien ----------
drop policy if exists "sessions_select_own" on public.sessions;
drop policy if exists "sessions_select_all_authenticated" on public.sessions;
create policy "sessions_select_role_based" on public.sessions
  for select to authenticated
  using (auth.uid() = user_id or public.is_manager());

-- ---------- Messages RLS : idem (suit la session) ----------
drop policy if exists "messages_select_own" on public.messages;
drop policy if exists "messages_select_all_authenticated" on public.messages;
create policy "messages_select_role_based" on public.messages
  for select to authenticated
  using (
    exists (
      select 1 from public.sessions s
      where s.id = messages.session_id
        and (s.user_id = auth.uid() or public.is_manager())
    )
  );

-- ---------- Profiles : tout authentifié peut lire (pour leaderboard) ----------
-- (déjà ouvert par 0006, on garde)
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_select_all_authenticated" on public.profiles;
create policy "profiles_select_all_authenticated" on public.profiles
  for select to authenticated using (true);

-- ---------- Storage : bucket avatars (public read, RLS write) ----------
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Lecture publique (les avatars sont visibles partout dans l'app)
drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read" on storage.objects
  for select using (bucket_id = 'avatars');

-- Upload : seul le owner peut uploader dans son dossier {user_id}/...
drop policy if exists "avatars_user_upload" on storage.objects;
create policy "avatars_user_upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars_user_update" on storage.objects;
create policy "avatars_user_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars_user_delete" on storage.objects;
create policy "avatars_user_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---------- Trigger : split full_name si renseigné ----------
-- Maintient first_name/last_name à jour quand seul full_name est saisi à l'inscription
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_full text;
  v_first text;
  v_last text;
begin
  v_full := coalesce(new.raw_user_meta_data->>'full_name', new.email);

  -- Split sur le premier espace : "Quentin Pasquier" -> "Quentin" + "Pasquier"
  v_first := split_part(v_full, ' ', 1);
  v_last := nullif(trim(substring(v_full from position(' ' in v_full) + 1)), '');

  insert into public.profiles (id, full_name, first_name, last_name)
  values (new.id, v_full, v_first, v_last)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- RPC : stats agrégées équipe (pour leaderboard) ----------
-- Retourne par user les KPI nécessaires au classement et aux badges.
-- SECURITY DEFINER : contourne le RLS sessions. Ne retourne que des AGRÉGATS,
-- jamais le contenu d'une session, donc pas de fuite de données sensibles.
create or replace function public.get_leaderboard_stats()
returns table (
  user_id uuid,
  full_name text,
  avatar_url text,
  role text,
  total_sessions bigint,
  completed_sessions bigint,
  rdv_count bigint,
  score_sum bigint,
  perfect_scores bigint,
  expert_sessions bigint,
  distinct_clients bigint,
  distinct_personas bigint,
  days_active bigint,
  best_score int
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id as user_id,
    p.full_name,
    p.avatar_url,
    p.role,
    coalesce(count(s.id), 0)::bigint as total_sessions,
    coalesce(sum(case when s.status = 'completed' then 1 else 0 end), 0)::bigint as completed_sessions,
    coalesce(sum(case when s.appointment_secured then 1 else 0 end), 0)::bigint as rdv_count,
    coalesce(sum(coalesce(s.score, 0)) filter (where s.status = 'completed'), 0)::bigint as score_sum,
    coalesce(sum(case when s.score >= 90 then 1 else 0 end) filter (where s.status = 'completed'), 0)::bigint as perfect_scores,
    coalesce(sum(case when s.difficulty = 'expert' and s.status = 'completed' then 1 else 0 end), 0)::bigint as expert_sessions,
    coalesce(count(distinct s.client_id) filter (where s.status = 'completed' and s.client_id is not null), 0)::bigint as distinct_clients,
    coalesce(count(distinct s.persona_key) filter (where s.status = 'completed'), 0)::bigint as distinct_personas,
    coalesce(count(distinct date_trunc('day', s.started_at)) filter (where s.status = 'completed'), 0)::bigint as days_active,
    max(s.score) filter (where s.status = 'completed') as best_score
  from public.profiles p
  left join public.sessions s on s.user_id = p.id
  group by p.id, p.full_name, p.avatar_url, p.role;
$$;

grant execute on function public.get_leaderboard_stats() to authenticated;

-- =============================================================================
-- Pour promouvoir un user en manager :
--   update public.profiles set role = 'manager'
--   where id = (select id from auth.users where email = 'quentin@noxias.fr');
-- =============================================================================
