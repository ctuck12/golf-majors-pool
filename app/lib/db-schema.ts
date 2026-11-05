// User-data tables in Postgres (Supabase). Safe to run repeatedly: every statement is
// "if not exists". Applied by /api/admin/migrate-user-data before it copies data in.
//
// Row Level Security is on with no policies, so Supabase's public API keys can't read or
// write any of this; only the server, connecting with DATABASE_URL, can.
export const SCHEMA_SQL = `
create table if not exists users (
  id text primary key,
  email text not null unique,
  display_name text not null,
  password_hash text not null,
  password_salt text not null,
  active_league_id text,
  created_at timestamptz not null default now()
);

create table if not exists sessions (
  token_hash text primary key,
  user_id text not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists sessions_user_id_idx on sessions(user_id);

-- plan: 'founder' (free for life), 'unpaid', or a paid tier. member_limit null = unlimited.
create table if not exists leagues (
  id text primary key,
  name text not null,
  join_code text not null unique,
  plan text not null default 'unpaid',
  member_limit integer,
  created_by text references users(id) on delete set null,
  created_at timestamptz not null default now()
);

do $$ begin
  alter table users add constraint users_active_league_fk
    foreign key (active_league_id) references leagues(id) on delete set null;
exception when duplicate_object then null; end $$;

create table if not exists league_members (
  league_id text not null references leagues(id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  role text not null default 'member' check (role in ('member', 'commissioner')),
  joined_at timestamptz not null default now(),
  primary key (league_id, user_id)
);
create index if not exists league_members_user_id_idx on league_members(user_id);

create table if not exists league_tournaments (
  league_id text not null references leagues(id) on delete cascade,
  tournament_id text not null,
  picks_open boolean,
  lineup_locked boolean,
  payout_first double precision,
  payout_second double precision,
  payout_third double precision,
  winner_score double precision,
  primary key (league_id, tournament_id)
);

-- golfer_ids null = no roster saved (a row can exist for a tie-break alone).
create table if not exists rosters (
  league_id text not null,
  user_id text not null,
  tournament_id text not null,
  golfer_ids integer[],
  tie_break double precision,
  submitted_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (league_id, user_id, tournament_id),
  foreign key (league_id, user_id) references league_members(league_id, user_id) on delete cascade
);
create index if not exists rosters_tournament_idx on rosters(tournament_id);

alter table users enable row level security;
alter table sessions enable row level security;
alter table leagues enable row level security;
alter table league_members enable row level security;
alter table league_tournaments enable row level security;
alter table rosters enable row level security;
`;
