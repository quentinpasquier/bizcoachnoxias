-- =============================================================================
-- Noxias Coach - Migration 0009 : Multi-tenancy (organizations)
-- =============================================================================
-- Introduit la notion d'"organisation" : chaque ressource (profil, client,
-- session, message, quiz_attempt) appartient à UNE organisation. Les RLS
-- garantissent qu'un user ne voit JAMAIS les données d'une autre org.
--
-- Rôles utilisateur :
--   - commercial    : voit ses propres sessions
--   - manager       : voit toutes les sessions de SON org
--   - org_admin     : idem manager + peut gérer les clients de son org
--   - platform_admin: superadmin Noxias, peut tout voir/gérer (toutes orgs)
--
-- IMPORTANT : à exécuter dans une transaction. Backup conseillé avant.
-- À exécuter dans le SQL Editor de Supabase APRÈS 0008.
-- =============================================================================

begin;

-- ---------- 1. Table organizations ----------
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists organizations_touch_updated_at on public.organizations;
create trigger organizations_touch_updated_at
  before update on public.organizations
  for each row execute function public.touch_updated_at();

-- ---------- 2. Org "Noxias" (id fixe pour backfill stable) ----------
insert into public.organizations (id, name, slug, active)
values ('00000000-0000-0000-0000-000000000001', 'Noxias', 'noxias', true)
on conflict (id) do nothing;

-- ---------- 3. Étend les rôles utilisateur ----------
alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('commercial', 'manager', 'org_admin', 'platform_admin'));

-- ---------- 4. Ajoute organization_id sur les tables scopées ----------
alter table public.profiles
  add column if not exists organization_id uuid references public.organizations(id) on delete restrict;

alter table public.clients
  add column if not exists organization_id uuid references public.organizations(id) on delete restrict;

alter table public.sessions
  add column if not exists organization_id uuid references public.organizations(id) on delete restrict;

-- ---------- 5. Backfill : tout l'existant rattaché à l'org Noxias ----------
update public.profiles
  set organization_id = '00000000-0000-0000-0000-000000000001'
  where organization_id is null;

update public.clients
  set organization_id = '00000000-0000-0000-0000-000000000001'
  where organization_id is null;

update public.sessions
  set organization_id = '00000000-0000-0000-0000-000000000001'
  where organization_id is null;

-- ---------- 6. NOT NULL une fois backfillé ----------
alter table public.profiles
  alter column organization_id set not null;
alter table public.clients
  alter column organization_id set not null;
alter table public.sessions
  alter column organization_id set not null;

create index if not exists profiles_organization_id_idx on public.profiles(organization_id);
create index if not exists clients_organization_id_idx on public.clients(organization_id, active);
create index if not exists sessions_organization_id_idx on public.sessions(organization_id, started_at desc);

-- ---------- 7. Quentin = platform_admin (super-admin Noxias) ----------
-- Adapter l'email si besoin. Au moins un platform_admin doit exister pour
-- gérer les orgs clientes depuis le back-office.
update public.profiles
  set role = 'platform_admin'
  where id in (
    select id from auth.users
    where lower(email) = 'quentin.pasquier@noxias.com'
  );

-- ---------- 8. Helpers SQL ----------
-- Renvoie l'org_id du user courant (ou NULL si non connecté / profil absent)
create or replace function public.current_user_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id from public.profiles where id = auth.uid();
$$;

-- True si le user courant est platform_admin
create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'platform_admin'
  );
$$;

-- True si le user courant est manager/org_admin/platform_admin DANS l'org spécifiée
create or replace function public.is_org_manager(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and (
        role = 'platform_admin'
        or (organization_id = p_org_id and role in ('manager', 'org_admin'))
      )
  );
$$;

-- Rétro-compat : is_manager() = manager/admin de l'org courante du user
create or replace function public.is_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_org_manager(public.current_user_org_id());
$$;

-- ---------- 9. Trigger auto-fill organization_id ----------
-- Si l'app INSERT sans préciser organization_id, on prend celle du user.
-- Empêche aussi un user d'insérer dans une AUTRE org que la sienne
-- (sauf platform_admin).
create or replace function public.set_organization_id_from_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_org uuid;
  v_is_admin boolean;
begin
  v_user_org := public.current_user_org_id();
  v_is_admin := public.is_platform_admin();

  if new.organization_id is null then
    new.organization_id := v_user_org;
  elsif not v_is_admin and new.organization_id <> v_user_org then
    raise exception 'Impossible d''insérer dans une autre organisation que la vôtre.'
      using errcode = '42501';
  end if;

  if new.organization_id is null then
    raise exception 'organization_id requis : aucun profil trouvé pour l''utilisateur courant.'
      using errcode = '23502';
  end if;

  return new;
end;
$$;

drop trigger if exists clients_set_org_id on public.clients;
create trigger clients_set_org_id
  before insert on public.clients
  for each row execute function public.set_organization_id_from_user();

drop trigger if exists sessions_set_org_id on public.sessions;
create trigger sessions_set_org_id
  before insert on public.sessions
  for each row execute function public.set_organization_id_from_user();

-- ---------- 10. RLS organizations ----------
alter table public.organizations enable row level security;

drop policy if exists "orgs_select_own_or_admin" on public.organizations;
create policy "orgs_select_own_or_admin" on public.organizations
  for select to authenticated
  using (id = public.current_user_org_id() or public.is_platform_admin());

drop policy if exists "orgs_insert_platform_admin" on public.organizations;
create policy "orgs_insert_platform_admin" on public.organizations
  for insert to authenticated
  with check (public.is_platform_admin());

drop policy if exists "orgs_update_platform_admin" on public.organizations;
create policy "orgs_update_platform_admin" on public.organizations
  for update to authenticated
  using (public.is_platform_admin());

drop policy if exists "orgs_delete_platform_admin" on public.organizations;
create policy "orgs_delete_platform_admin" on public.organizations
  for delete to authenticated
  using (public.is_platform_admin());

-- ---------- 11. RLS profiles : scope par org ----------
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_select_all_authenticated" on public.profiles;
drop policy if exists "profiles_select_org" on public.profiles;
create policy "profiles_select_org" on public.profiles
  for select to authenticated
  using (
    organization_id = public.current_user_org_id()
    or public.is_platform_admin()
  );

-- INSERT/UPDATE own profile : on garde, mais on empêche de changer son own org_id
-- (sauf platform_admin) en ré-écrivant la policy update.
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and (
      organization_id = public.current_user_org_id()
      or public.is_platform_admin()
    )
  );

-- platform_admin peut modifier n'importe quel profil (changer rôle, org, etc.)
drop policy if exists "profiles_update_platform_admin" on public.profiles;
create policy "profiles_update_platform_admin" on public.profiles
  for update to authenticated
  using (public.is_platform_admin());

-- ---------- 12. RLS clients : scope par org ----------
drop policy if exists "clients_select_authenticated" on public.clients;
drop policy if exists "clients_insert_authenticated" on public.clients;
drop policy if exists "clients_update_authenticated" on public.clients;
drop policy if exists "clients_delete_authenticated" on public.clients;
drop policy if exists "clients_select_org" on public.clients;
drop policy if exists "clients_insert_org" on public.clients;
drop policy if exists "clients_update_org" on public.clients;
drop policy if exists "clients_delete_org" on public.clients;

create policy "clients_select_org" on public.clients
  for select to authenticated
  using (
    organization_id = public.current_user_org_id()
    or public.is_platform_admin()
  );

create policy "clients_insert_org" on public.clients
  for insert to authenticated
  with check (
    organization_id = public.current_user_org_id()
    or public.is_platform_admin()
  );

create policy "clients_update_org" on public.clients
  for update to authenticated
  using (
    organization_id = public.current_user_org_id()
    or public.is_platform_admin()
  );

create policy "clients_delete_org" on public.clients
  for delete to authenticated
  using (
    organization_id = public.current_user_org_id()
    or public.is_platform_admin()
  );

-- ---------- 13. RLS sessions : scope par org + rôle ----------
drop policy if exists "sessions_select_role_based" on public.sessions;
drop policy if exists "sessions_select_own" on public.sessions;
drop policy if exists "sessions_select_all_authenticated" on public.sessions;
create policy "sessions_select_role_based" on public.sessions
  for select to authenticated
  using (
    public.is_platform_admin()
    or (
      organization_id = public.current_user_org_id()
      and (user_id = auth.uid() or public.is_manager())
    )
  );

drop policy if exists "sessions_insert_own" on public.sessions;
drop policy if exists "sessions_insert_own_in_org" on public.sessions;
create policy "sessions_insert_own_in_org" on public.sessions
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and (
      organization_id = public.current_user_org_id()
      or public.is_platform_admin()
    )
  );

drop policy if exists "sessions_update_own" on public.sessions;
drop policy if exists "sessions_update_own_in_org" on public.sessions;
create policy "sessions_update_own_in_org" on public.sessions
  for update to authenticated
  using (
    user_id = auth.uid()
    and organization_id = public.current_user_org_id()
  );

drop policy if exists "sessions_delete_own" on public.sessions;
drop policy if exists "sessions_delete_own_in_org" on public.sessions;
create policy "sessions_delete_own_in_org" on public.sessions
  for delete to authenticated
  using (
    user_id = auth.uid()
    and organization_id = public.current_user_org_id()
  );

-- ---------- 14. RLS messages : scope via la session ----------
drop policy if exists "messages_select_role_based" on public.messages;
drop policy if exists "messages_select_own" on public.messages;
drop policy if exists "messages_select_all_authenticated" on public.messages;
create policy "messages_select_role_based" on public.messages
  for select to authenticated
  using (
    exists (
      select 1 from public.sessions s
      where s.id = messages.session_id
        and (
          public.is_platform_admin()
          or (
            s.organization_id = public.current_user_org_id()
            and (s.user_id = auth.uid() or public.is_manager())
          )
        )
    )
  );

drop policy if exists "messages_insert_own" on public.messages;
drop policy if exists "messages_insert_own_in_org" on public.messages;
create policy "messages_insert_own_in_org" on public.messages
  for insert to authenticated
  with check (
    exists (
      select 1 from public.sessions s
      where s.id = messages.session_id
        and s.user_id = auth.uid()
        and s.organization_id = public.current_user_org_id()
    )
  );

-- ---------- 15. RLS quiz_attempts : scope via le client ----------
drop policy if exists "quiz_attempts_select" on public.quiz_attempts;
create policy "quiz_attempts_select" on public.quiz_attempts
  for select to authenticated
  using (
    public.is_platform_admin()
    or exists (
      select 1 from public.clients c
      where c.id = quiz_attempts.client_id
        and c.organization_id = public.current_user_org_id()
        and (quiz_attempts.user_id = auth.uid() or public.is_manager())
    )
  );

drop policy if exists "quiz_attempts_insert_own" on public.quiz_attempts;
drop policy if exists "quiz_attempts_insert_own_in_org" on public.quiz_attempts;
create policy "quiz_attempts_insert_own_in_org" on public.quiz_attempts
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.clients c
      where c.id = quiz_attempts.client_id
        and c.organization_id = public.current_user_org_id()
    )
  );

-- ---------- 16. Signup : règles différenciées ----------
-- Plus de hard-lock @noxias.com pour TOUS les signups. On garde une protection :
--   - Signup public (pas d'organization_id en metadata) → @noxias.com only
--   - Création admin (avec organization_id) → aucun check de domaine
drop trigger if exists enforce_noxias_email_domain_trigger on auth.users;
drop function if exists public.enforce_noxias_email_domain();

create or replace function public.enforce_signup_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id text;
begin
  v_org_id := new.raw_user_meta_data->>'organization_id';

  -- Signup public (sans org_id en metadata) : réservé à Noxias
  if v_org_id is null or v_org_id = '' then
    if new.email is null or lower(new.email) !~ '@noxias\.com$' then
      raise exception 'Inscription publique réservée aux emails @noxias.com. Demandez une invitation à votre administrateur.'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_signup_rules_trigger on auth.users;
create trigger enforce_signup_rules_trigger
  before insert on auth.users
  for each row execute function public.enforce_signup_rules();

-- ---------- 17. handle_new_user : lit org_id depuis metadata ----------
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
  v_org_id uuid;
  v_role text;
begin
  v_full := coalesce(new.raw_user_meta_data->>'full_name', new.email);
  v_first := split_part(v_full, ' ', 1);
  v_last := nullif(trim(substring(v_full from position(' ' in v_full) + 1)), '');

  -- Lit organization_id depuis raw_user_meta_data (passé par admin.createUser)
  begin
    v_org_id := nullif(new.raw_user_meta_data->>'organization_id', '')::uuid;
  exception when others then
    v_org_id := null;
  end;

  -- Fallback : signup spontané (Noxias) → org Noxias par défaut
  if v_org_id is null then
    v_org_id := '00000000-0000-0000-0000-000000000001';
  end if;

  -- Rôle souhaité (commercial par défaut). Garde-fou : pas de platform_admin
  -- via metadata public (uniquement assignable manuellement en base).
  v_role := coalesce(new.raw_user_meta_data->>'role', 'commercial');
  if v_role not in ('commercial', 'manager', 'org_admin') then
    v_role := 'commercial';
  end if;

  insert into public.profiles (id, full_name, first_name, last_name, organization_id, role)
  values (new.id, v_full, v_first, v_last, v_org_id, v_role)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- 18. Leaderboard scoped par org ----------
drop function if exists public.get_leaderboard_stats();
create or replace function public.get_leaderboard_stats(p_org_id uuid default null)
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
  with target_org as (
    select coalesce(
      p_org_id,                       -- arg explicite (utilisé par platform_admin)
      public.current_user_org_id()    -- sinon, org du user connecté
    ) as org_id
  )
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
  cross join target_org
  left join public.sessions s
    on s.user_id = p.id and s.organization_id = target_org.org_id
  where p.organization_id = target_org.org_id
    -- platform_admin peut interroger n'importe quelle org via p_org_id ; tout
    -- autre user est limité à sa propre org (current_user_org_id l'impose).
    and (
      target_org.org_id = public.current_user_org_id()
      or public.is_platform_admin()
    )
  group by p.id, p.full_name, p.avatar_url, p.role;
$$;

grant execute on function public.get_leaderboard_stats(uuid) to authenticated;

commit;

-- =============================================================================
-- Vérifications post-migration (à exécuter manuellement, hors transaction)
-- =============================================================================
--
-- 1. Toutes les lignes ont bien un organization_id :
--      select count(*) from profiles where organization_id is null;  -- 0 attendu
--      select count(*) from clients  where organization_id is null;  -- 0 attendu
--      select count(*) from sessions where organization_id is null;  -- 0 attendu
--
-- 2. Au moins un platform_admin existe :
--      select email, role from profiles p join auth.users u on u.id = p.id
--      where role = 'platform_admin';
--
-- 3. Tester l'isolation depuis le SQL editor (en simulant un autre user) :
--      set local role authenticated;
--      set local request.jwt.claims = '{"sub": "<UUID_USER_AUTRE_ORG>"}';
--      select count(*) from clients;  -- ne doit PAS voir les clients Noxias
--
-- 4. Créer une org cliente de test :
--      insert into organizations (name, slug) values ('Acme Corp', 'acme');
--
-- 5. Créer un user dans Acme via Supabase Dashboard :
--      Auth > Users > Invite. Renseigner email + dans "Raw user meta data" :
--      { "full_name": "Jean Dupont", "organization_id": "<uuid_org_acme>", "role": "org_admin" }
-- =============================================================================
