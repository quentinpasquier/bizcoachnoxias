-- =============================================================================
-- Call-Lab - Migration 0012 : Scans IA par commercial pour le manager
-- =============================================================================
-- Stocke le résultat des scans approfondis lancés par le manager sur un
-- commercial donné. Le scan analyse les 5 dernières sessions complètes
-- (transcripts + évaluations + delta_category) via Claude Sonnet et
-- produit une synthèse structurée : patterns récurrents avec citations,
-- axes de travail prioritaires, mode d'entraînement recommandé.
--
-- Le scan est mis en cache 24h pour éviter les re-runs Claude inutiles
-- (~$0.05 par scan) si le manager rouvre la page.
-- =============================================================================

create table if not exists public.commercial_scans (
  id uuid primary key default gen_random_uuid(),
  -- Le commercial scanné. ON DELETE CASCADE pour qu'un scan disparaisse
  -- si l'utilisateur est supprimé de la plateforme.
  user_id uuid not null references public.profiles(id) on delete cascade,
  -- L'organisation pour le filtre multi-tenant (RLS).
  organization_id uuid not null references public.organizations(id) on delete cascade,
  -- Qui a déclenché le scan (manager / org_admin / platform_admin).
  scanned_by uuid not null references public.profiles(id),
  scanned_at timestamptz not null default now(),
  -- Nombre de sessions analysées par le scan (fenêtre = 5 max).
  sessions_analyzed integer not null default 0,
  -- Résultat structuré : voir CoachScanResult dans src/lib/coach-scan.ts
  analysis jsonb not null
);

create index if not exists commercial_scans_user_id_idx
  on public.commercial_scans (user_id, scanned_at desc);

create index if not exists commercial_scans_org_id_idx
  on public.commercial_scans (organization_id, scanned_at desc);

-- RLS : un user voit uniquement les scans de sa propre organisation.
-- Les managers / org_admin / platform_admin peuvent lire ; seuls les
-- managers / above peuvent insérer.
alter table public.commercial_scans enable row level security;

create policy commercial_scans_select_own_org
  on public.commercial_scans for select
  using (
    organization_id = public.current_user_org_id()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('manager', 'org_admin', 'platform_admin')
    )
  );

create policy commercial_scans_insert_manager
  on public.commercial_scans for insert
  with check (
    organization_id = public.current_user_org_id()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('manager', 'org_admin', 'platform_admin')
    )
  );
