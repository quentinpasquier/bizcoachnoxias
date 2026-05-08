-- =============================================================================
-- Noxias Coach — Migration 0003 : Docs clients (upload de fichiers)
-- =============================================================================
-- Chaque client Noxias a une matrice de prospection et une boîte à outils.
-- L'admin uploade ces docs (PDF, DOCX, CSV, TXT). L'app les parse en plaintext
-- et concatène le contenu dans `synced_content` qui sert de contexte au
-- prospect IA et au générateur de scénarios.
--
-- À exécuter APRÈS 0001 et 0002.
-- =============================================================================

alter table public.clients
  add column if not exists synced_content text,
  add column if not exists synced_at timestamptz,
  add column if not exists synced_files jsonb default '[]'::jsonb,
  add column if not exists target_personas text[] default '{}'::text[];

-- synced_files = [
--   { filename: "matrice_doko.pdf", size: 123456, char_count: 45678,
--     uploaded_at: "2026-05-08T...", kind: "pdf" },
--   ...
-- ]

create index if not exists clients_synced_at_idx on public.clients(synced_at);
