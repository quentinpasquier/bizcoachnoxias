-- =============================================================================
-- Noxias Coach - Migration 0008 : Quiz par client
-- =============================================================================
-- Ajoute le stockage du quiz généré par client + table d'attempts pour
-- mesurer la maîtrise des commerciaux par client.
-- =============================================================================

-- ---------- Quiz data stocké sur le client ----------
alter table public.clients
  add column if not exists quiz_data jsonb,
  add column if not exists quiz_generated_at timestamptz;

-- ---------- Tentatives de quiz par utilisateur ----------
create table if not exists public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  total_questions int not null,
  correct_answers int not null,
  score int not null check (score >= 0 and score <= 100),
  answers jsonb not null default '[]'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz not null default now()
);

create index if not exists quiz_attempts_user_idx
  on public.quiz_attempts(user_id, completed_at desc);
create index if not exists quiz_attempts_client_idx
  on public.quiz_attempts(client_id, completed_at desc);

alter table public.quiz_attempts enable row level security;

-- Lecture : commercial voit ses tentatives, manager voit toutes.
drop policy if exists "quiz_attempts_select" on public.quiz_attempts;
create policy "quiz_attempts_select" on public.quiz_attempts
  for select to authenticated
  using (auth.uid() = user_id or public.is_manager());

-- Écriture : un user crée ses propres tentatives.
drop policy if exists "quiz_attempts_insert_own" on public.quiz_attempts;
create policy "quiz_attempts_insert_own" on public.quiz_attempts
  for insert to authenticated
  with check (auth.uid() = user_id);
