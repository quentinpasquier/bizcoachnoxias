-- =============================================================================
-- Noxias Coach — Migration 0006 : Visibilité team
-- =============================================================================
-- Tous les utilisateurs Noxias authentifiés peuvent VOIR toutes les sessions,
-- tous les messages et tous les profils (pour l'attribution session → user).
-- L'écriture (INSERT/UPDATE/DELETE) reste restreinte au propriétaire.
-- =============================================================================

-- Sessions : lecture ouverte à tous les authentifiés
drop policy if exists "sessions_select_own" on public.sessions;
drop policy if exists "sessions_select_all_authenticated" on public.sessions;
create policy "sessions_select_all_authenticated" on public.sessions
  for select to authenticated using (true);

-- Messages : lecture ouverte (pour pouvoir consulter le transcript dans la
-- restitution de n'importe quelle session de l'équipe)
drop policy if exists "messages_select_own" on public.messages;
drop policy if exists "messages_select_all_authenticated" on public.messages;
create policy "messages_select_all_authenticated" on public.messages
  for select to authenticated using (true);

-- Profiles : lecture ouverte (nécessaire pour afficher le nom de l'auteur
-- d'une session : on joint sessions.user_id → profiles.id)
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_select_all_authenticated" on public.profiles;
create policy "profiles_select_all_authenticated" on public.profiles
  for select to authenticated using (true);

-- Les policies INSERT/UPDATE/DELETE existantes restent : seul le propriétaire
-- peut créer/modifier/supprimer ses propres sessions, messages, profil.
