-- =============================================================================
-- Call-Lab - Migration 0011 : Modes d'entraînement (training_mode)
-- =============================================================================
-- Ajoute le support des 3 modes d'entraînement :
--
--   - 'full'     : appel cold call complet (mode historique, default)
--   - 'block'    : coaching ciblé sur UN bloc de la conversation (brise-glace,
--                  découverte, pitch, objections, closing)
--   - 'embedded' : coaching embarqué — un évaluateur Haiku analyse chaque
--                  réponse du commercial AVANT qu'elle n'arrive au prospect,
--                  bloque les réponses insuffisantes et les fait reformuler
--                  via une voix coach pédagogique
--
-- Les modes 'block' et 'embedded' arrivent en PR séparées (PR B et PR C).
-- Cette migration ne fait que créer les colonnes ; les sessions existantes
-- conservent training_mode='full' par défaut.
-- =============================================================================

-- 1. Mode d'entraînement, NOT NULL avec default pour rétrocompat des sessions
--    existantes qui sont toutes en mode complet.
alter table public.sessions
  add column if not exists training_mode text not null default 'full'
    check (training_mode in ('full', 'block', 'embedded'));

-- 2. Bloc ciblé pour le mode 'block' (NULL pour les autres modes).
--    Les 5 blocs métier correspondent à la décomposition cold call classique :
--    brise-glace (décrochage) → découverte (questions) → pitch (valeur) →
--    objections (gestion) → closing (verrouillage RDV).
alter table public.sessions
  add column if not exists block_target text
    check (
      block_target is null
      or block_target in ('brise_glace', 'decouverte', 'pitch', 'objections', 'closing')
    );

-- 3. Compteur de blocages déclenchés en mode 'embedded' (NULL pour les autres).
--    Sert au débrief final pour montrer "X reformulations imposées par le coach".
alter table public.sessions
  add column if not exists embedded_blocks_count integer
    check (embedded_blocks_count is null or embedded_blocks_count >= 0);

-- Cohérence : si training_mode='block' alors block_target doit être renseigné.
--   si training_mode='embedded' alors embedded_blocks_count démarre à 0.
-- On laisse l'application gérer ces invariants pour rester flexible (vs des
-- contraintes hard côté DB qui rendraient les inserts initiaux fragiles).

-- Index pour filtrer l'historique par mode (vue de l'utilisateur ou du manager).
create index if not exists sessions_training_mode_idx
  on public.sessions (user_id, training_mode);
