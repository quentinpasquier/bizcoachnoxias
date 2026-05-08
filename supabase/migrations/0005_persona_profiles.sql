-- =============================================================================
-- Noxias Coach — Migration 0005 : Personas enrichis avec briefing
-- =============================================================================
-- Chaque client a maintenant des "persona profiles" : un objet par persona
-- qui contient toutes les infos dont le commercial a besoin pour préparer
-- l'appel rapidement (pains, KPI, objections-clés, briefing).
--
-- target_personas (text[]) reste pour la liste rapide de labels.
-- persona_profiles (jsonb) contient les profils complets.
-- =============================================================================

alter table public.clients
  add column if not exists persona_profiles jsonb default '[]'::jsonb;

-- Structure attendue de chaque profil :
-- {
--   "id": "avocat",
--   "label": "Avocat",
--   "role": "Avocat associé en droit des affaires",
--   "typical_company": "Cabinet de 5-15 personnes en grande ville",
--   "key_pains": ["...", "...", "..."],
--   "key_kpis": ["coût d'acquisition", "nombre de RDV"],
--   "main_objections": ["...", "...", "..."],
--   "decision_signals": "...",
--   "prep_briefing": "Brief 2-3 paragraphes pour le commercial avant l'appel"
-- }
