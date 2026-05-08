-- =============================================================================
-- Noxias Coach — Migration 0004 : Scénario par session
-- =============================================================================
-- Quand un commercial démarre une session, l'app génère un SCÉNARIO via Claude
-- à partir des docs du client + du persona/difficulté/genre choisis. Le
-- scénario fixe l'identité du prospect (nom, fonction, contexte, douleurs,
-- objections à apporter, signaux de décision). Cohérence garantie pendant
-- toute la session, et variété entre sessions.
-- =============================================================================

alter table public.sessions
  add column if not exists scenario_data jsonb,
  add column if not exists gender text check (gender in ('homme', 'femme'));
