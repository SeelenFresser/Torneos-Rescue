-- =============================================
-- TORNEO MANAGER — Schema Supabase
-- Ejecuta esto en: supabase.com → tu proyecto → SQL Editor
-- =============================================

-- ===== TOURNAMENTS =====
create table if not exists public.tournaments (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz default now(),
  owner_id      uuid references auth.users(id) on delete cascade,
  name          text not null,
  type          text not null check (type in ('commander','standard','beyblade')),
  format        text not null default 'swiss' check (format in ('swiss','elimination','pods')),
  description   text,
  status        text not null default 'active' check (status in ('active','finished')),
  current_round int not null default 0
);

-- ===== PLAYERS =====
create table if not exists public.players (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz default now(),
  tournament_id   uuid references public.tournaments(id) on delete cascade,
  name            text not null,
  bey_name        text,
  wins            int default 0,
  losses          int default 0,
  draws           int default 0,
  points          int default 0,
  game_wins       int default 0,
  game_losses     int default 0,
  eliminated      boolean default false
);

-- ===== MATCHES =====
create table if not exists public.matches (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz default now(),
  tournament_id   uuid references public.tournaments(id) on delete cascade,
  round           int not null,
  match_number    int,
  pod_number      int,
  match_type      text not null check (match_type in ('swiss','elimination','commander')),
  player1_id      uuid references public.players(id) on delete set null,
  player1_name    text,
  player2_id      uuid references public.players(id) on delete set null,
  player2_name    text,
  score_p1        int,
  score_p2        int,
  winner_id       uuid references public.players(id) on delete set null,
  is_complete     boolean default false,
  players_data    text,  -- JSON array of player IDs (commander pods)
  result_data     text   -- JSON map of player_id → place (commander)
);

-- Unique constraint for commander pods
create unique index if not exists matches_commander_pod_unique
  on public.matches(tournament_id, round, pod_number)
  where match_type = 'commander';

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================

alter table public.tournaments enable row level security;
alter table public.players     enable row level security;
alter table public.matches     enable row level security;

-- TOURNAMENTS: anyone authenticated can read; only owner can write
create policy "tournaments_read"  on public.tournaments for select to authenticated using (true);
create policy "tournaments_insert" on public.tournaments for insert to authenticated with check (auth.uid() = owner_id);
create policy "tournaments_update" on public.tournaments for update to authenticated using (auth.uid() = owner_id);
create policy "tournaments_delete" on public.tournaments for delete to authenticated using (auth.uid() = owner_id);

-- PLAYERS: anyone authenticated can read; tournament owner can write
create policy "players_read"   on public.players for select to authenticated using (true);
create policy "players_insert" on public.players for insert to authenticated
  with check (exists (select 1 from public.tournaments t where t.id = tournament_id and t.owner_id = auth.uid()));
create policy "players_update" on public.players for update to authenticated
  using (exists (select 1 from public.tournaments t where t.id = tournament_id and t.owner_id = auth.uid()));
create policy "players_delete" on public.players for delete to authenticated
  using (exists (select 1 from public.tournaments t where t.id = tournament_id and t.owner_id = auth.uid()));

-- MATCHES: anyone authenticated can read; owner can write
create policy "matches_read"   on public.matches for select to authenticated using (true);
create policy "matches_insert" on public.matches for insert to authenticated
  with check (exists (select 1 from public.tournaments t where t.id = tournament_id and t.owner_id = auth.uid()));
create policy "matches_update" on public.matches for update to authenticated
  using (exists (select 1 from public.tournaments t where t.id = tournament_id and t.owner_id = auth.uid()));
create policy "matches_delete" on public.matches for delete to authenticated
  using (exists (select 1 from public.tournaments t where t.id = tournament_id and t.owner_id = auth.uid()));

-- =============================================
-- REALTIME — habilitar para las 3 tablas
-- =============================================
-- En Supabase Dashboard → Database → Replication
-- habilita las tablas: tournaments, players, matches

-- =============================================
-- LISTO. Ahora ve a js/supabase.js y pon tu URL y ANON KEY
-- =============================================
