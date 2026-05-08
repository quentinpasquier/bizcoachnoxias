-- =============================================================================
-- Noxias Coach — Migration 0002 : Clients + scénarios
-- =============================================================================
-- Noxias fait de la prospection externalisée. Chaque "client" est une
-- entreprise pour qui Noxias prospecte. Les commerciaux Noxias jouent
-- au nom du client et pitchent l'offre du client.
--
-- À exécuter dans le SQL Editor Supabase APRÈS 0001_init.sql.
-- =============================================================================

-- ---------- Clients ----------
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,                          -- "Cabinet Mercier & Associés"
  sector text,                                 -- "Conseil RH", "Logiciel BTP", etc.
  description text,                            -- 1-2 phrases de contexte
  value_proposition text,                      -- "On aide X à faire Y en Z"
  product_pitch text not null,                 -- Ce que le commercial pitche concrètement
  ideal_targets text,                          -- "DG PME industrielle, DAF holding"
  typical_objections jsonb default '[]'::jsonb, -- ["déjà un prestataire", ...]
  active boolean not null default true,        -- Désactiver sans supprimer
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create index if not exists clients_active_idx on public.clients(active, name);

-- Trigger updated_at
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists clients_touch_updated_at on public.clients;
create trigger clients_touch_updated_at
  before update on public.clients
  for each row execute function public.touch_updated_at();

-- ---------- Lier sessions à un client ----------
alter table public.sessions
  add column if not exists client_id uuid references public.clients(id) on delete set null;

alter table public.sessions
  add column if not exists client_name_snapshot text;
-- Snapshot du nom du client au moment de la session, pour conserver l'historique
-- même si le client est supprimé/renommé.

create index if not exists sessions_client_id_idx on public.sessions(client_id);

-- ---------- RLS clients ----------
alter table public.clients enable row level security;

-- Tous les utilisateurs Noxias authentifiés peuvent voir/gérer les clients.
-- (Outil interne — pas de cloisonnement par utilisateur.)

drop policy if exists "clients_select_authenticated" on public.clients;
create policy "clients_select_authenticated" on public.clients
  for select to authenticated
  using (true);

drop policy if exists "clients_insert_authenticated" on public.clients;
create policy "clients_insert_authenticated" on public.clients
  for insert to authenticated
  with check (true);

drop policy if exists "clients_update_authenticated" on public.clients;
create policy "clients_update_authenticated" on public.clients
  for update to authenticated
  using (true);

drop policy if exists "clients_delete_authenticated" on public.clients;
create policy "clients_delete_authenticated" on public.clients
  for delete to authenticated
  using (true);

-- =============================================================================
-- Restriction email @noxias.com
-- =============================================================================
-- Empêche toute inscription avec un email hors du domaine @noxias.com,
-- au niveau base (sécurité robuste, ne dépend pas du front).

create or replace function public.enforce_noxias_email_domain()
returns trigger language plpgsql security definer as $$
begin
  if new.email is null or lower(new.email) !~ '@noxias\.com$' then
    raise exception 'Inscription refusée : seuls les emails @noxias.com sont autorisés.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_noxias_email_domain_trigger on auth.users;
create trigger enforce_noxias_email_domain_trigger
  before insert on auth.users
  for each row execute function public.enforce_noxias_email_domain();

-- =============================================================================
-- Seed : quelques clients exemples (à éditer/supprimer selon besoin)
-- =============================================================================

insert into public.clients (name, sector, description, value_proposition, product_pitch, ideal_targets, typical_objections, active)
values
(
  'TrésoFlow',
  'SaaS finance B2B',
  'Plateforme de pilotage de trésorerie pour PME multi-entités.',
  'Centraliser les comptes de toutes les filiales en temps réel et anticiper les besoins de financement à 90 jours.',
  'Plateforme SaaS de pilotage de trésorerie qui consolide tous les comptes bancaires multi-banques et multi-filiales en temps réel, avec prévisionnel automatisé sur 90 jours.',
  'DAF de holdings, DG de PME multi-entités, DAF d''ETI',
  '["On a déjà notre ERP", "Pas le bon timing", "Trop cher pour notre taille", "On reste sur Excel ça suffit"]'::jsonb,
  true
),
(
  'Cabinet Lelong RH',
  'Conseil RH',
  'Cabinet de conseil RH spécialisé dans la rétention de talents tech.',
  'Diviser par 2 le turnover des profils tech en 6 mois grâce à un programme structuré de rétention et d''engagement.',
  'Programme d''accompagnement RH sur 6 mois pour diviser par 2 le turnover des profils tech, avec audit, plan d''action et suivi mensuel.',
  'DRH grand compte, DRH ETI tech, DG scaleup avec problème de turnover',
  '["On a déjà un cabinet RH", "On gère ça en interne", "Pas le moment, on est en pleine NAO", "Trop cher", "Le turnover est inévitable dans la tech"]'::jsonb,
  true
),
(
  'Studio Octant',
  'Agence design B2B',
  'Studio de design qui refonde l''identité visuelle de scaleups B2B.',
  'Une refonte de marque qui transforme la perception et augmente la conversion lead → SQL de 40% en 4 mois.',
  'Refonte complète d''identité visuelle (logo, charte, site, decks) pour scaleups B2B, avec promesse de +40% de conversion lead → SQL en 4 mois.',
  'CEO et CMO de scaleups série A/B, dirigeants ETI en repositionnement',
  '["On vient de refaire notre site", "Pas le bon moment, on est focus produit", "Trop cher", "On a un designer en interne", "Notre marque ça va"]'::jsonb,
  true
)
on conflict do nothing;
