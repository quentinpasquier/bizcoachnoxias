-- =============================================================================
-- Noxias Coach - Migration 0010 : Payload du wizard de configuration guidée
-- =============================================================================
-- Stocke les réponses brutes du wizard 5 étapes (orgs clientes onboardées sur
-- la plateforme qui n'ont pas de matrice de prospection / boîte à outils
-- formalisée). Permet de ré-afficher le wizard lors d'une édition avec les
-- valeurs originales du user, plutôt que la vue dénormalisée extraite par
-- Claude (persona_profiles[], typical_objections[] qui ont déjà été
-- restructurés par l'extracteur).
--
-- NULL si le client a été créé via upload de docs (flux Noxias historique).
-- =============================================================================

alter table public.clients
  add column if not exists guided_payload jsonb;

comment on column public.clients.guided_payload is
  'Réponses originales du wizard de configuration guidée (orgs clientes). NULL si client créé via upload de docs.';
