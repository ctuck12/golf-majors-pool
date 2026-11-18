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

-- Season the league is paid through (null for founder leagues, which never expire).
alter table leagues add column if not exists paid_season integer;

-- League season passes bought in the app (RevenueCat purchase id = id). Each one is spent once:
-- league_id / action are set when it's used to create, upgrade or renew a league.
create table if not exists league_purchases (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  product_id text not null,
  store text,
  is_sandbox boolean not null default false,
  purchased_at timestamptz,
  recorded_at timestamptz not null default now(),
  league_id text references leagues(id) on delete set null,
  action text,
  season integer,
  redeemed_at timestamptz
);
create index if not exists league_purchases_user_idx on league_purchases(user_id);

-- Venmo payments: each user's Venmo username (no @), each league's entry fee per tournament,
-- which commissioner collects entry fees, and the winners a commissioner has paid.
alter table users add column if not exists venmo text;
alter table leagues add column if not exists venmo_collector_id text references users(id) on delete set null;
alter table league_tournaments add column if not exists entry_fee double precision;
create table if not exists league_payouts_sent (
  league_id text not null references leagues(id) on delete cascade,
  tournament_id text not null,
  season integer not null,
  place integer not null,
  user_id text references users(id) on delete set null,
  amount double precision not null,
  sent_by text references users(id) on delete set null,
  sent_at timestamptz not null default now(),
  primary key (league_id, tournament_id, season, place)
);

-- One-time data changes, each applied once (the name is recorded so it never re-runs).
create table if not exists app_migrations (
  name text primary key,
  applied_at timestamptz not null default now()
);

-- The founder pool's $30 entry fee and Venmo (@claytont743) used to be built into the app; move
-- them into the data so they work like every other league's.
do $$
declare applied integer;
begin
  insert into app_migrations (name) values ('founder-pool-venmo-and-fees') on conflict do nothing;
  get diagnostics applied = row_count;
  if applied = 1 then
    update users set venmo = 'claytont743' where lower(email) = 'ctuck12@gmail.com' and venmo is null;
    update leagues set venmo_collector_id = (select id from users where lower(email) = 'ctuck12@gmail.com')
      where id = 'golf-majors-pool' and venmo_collector_id is null;
    insert into league_tournaments (league_id, tournament_id, entry_fee)
      select l.id, t.tid, 30 from leagues l
      cross join unnest(array['players', 'masters', 'pga', 'us-open', 'open']) as t(tid)
      where l.id = 'golf-majors-pool'
    on conflict (league_id, tournament_id) do update
      set entry_fee = coalesce(league_tournaments.entry_fee, excluded.entry_fee);
  end if;
end $$;

-- Seasons: picks are kept per season (rows from before this column are 2026's, the first
-- season), and a tournament's picks-open / lineup-lock / winner-score belong to one season's
-- event (state_season; null = 2026). Payouts and entry fees carry over from season to season.
alter table rosters add column if not exists season integer not null default 2026;
do $$
begin
  perform pg_advisory_xact_lock(2027001);
  if exists (
    select 1 from pg_constraint
    where conrelid = 'rosters'::regclass and contype = 'p' and pg_get_constraintdef(oid) not like '%season%'
  ) then
    alter table rosters drop constraint rosters_pkey;
    alter table rosters add constraint rosters_pkey primary key (league_id, user_id, tournament_id, season);
  end if;
end $$;
alter table rosters alter column season drop default;
alter table league_tournaments add column if not exists state_season integer;

-- One commissioner per league. Leagues that had several keep one (the creator, else the app
-- admin in the founder league, else whoever joined first); the others become members.
with ranked as (
  select m.league_id, m.user_id,
    row_number() over (
      partition by m.league_id
      order by (m.user_id = l.created_by) desc nulls last, (lower(u.email) = 'ctuck12@gmail.com') desc, m.joined_at asc, m.user_id asc
    ) as rn
  from league_members m
  join leagues l on l.id = m.league_id
  join users u on u.id = m.user_id
  where m.role = 'commissioner'
)
update league_members m set role = 'member'
from ranked r
where r.league_id = m.league_id and r.user_id = m.user_id and r.rn > 1;
create unique index if not exists league_members_one_commissioner on league_members(league_id) where role = 'commissioner';

-- Accounts confirm their email with a code (accounts from before this are counted as confirmed),
-- and can say they don't use Venmo so they aren't asked again.
alter table users add column if not exists email_verified_at timestamptz;
alter table users add column if not exists venmo_declined boolean not null default false;
do $$
declare applied integer;
begin
  insert into app_migrations (name) values ('existing-accounts-email-verified') on conflict do nothing;
  get diagnostics applied = row_count;
  if applied = 1 then
    update users set email_verified_at = created_at where email_verified_at is null;
  end if;
end $$;

-- Payout plans: how a league splits the pot (see app/lib/payout-plan.ts), applied to every
-- tournament. Amounts a commissioner types in for one tournament override the plan for that
-- season's event only (payouts_season; older rows were for 2026).
alter table leagues add column if not exists payout_plan jsonb;
alter table league_tournaments add column if not exists payouts_season integer;
-- How members pay the entry fee when the commissioner doesn't use Venmo (e.g. "Cash or Zelle to
-- Clayton"). Shown at Submit and in the tournament-week text.
alter table leagues add column if not exists payment_note text;
-- Season championship: an optional season buy-in and how that pot is split (a payout plan).
alter table leagues add column if not exists season_fee double precision;
alter table leagues add column if not exists season_payout_plan jsonb;
do $$
declare applied integer;
begin
  insert into app_migrations (name) values ('founder-payout-plan') on conflict do nothing;
  get diagnostics applied = row_count;
  if applied = 1 then
    update leagues set payout_plan = '{"places":[{"mode":"percent","value":67.5},{"mode":"rest","value":0},{"mode":"fee","value":2}],"roundTo":5}'::jsonb
      where id = 'golf-majors-pool' and payout_plan is null;
  end if;
end $$;

-- Entry fee tracking: a member says they paid (Submit & Pay, or "I paid"), the commissioner
-- confirms it. One row per member per event; no row means not paid.
create table if not exists league_entry_payments (
  league_id text not null references leagues(id) on delete cascade,
  tournament_id text not null,
  season integer not null,
  user_id text not null references users(id) on delete cascade,
  status text not null check (status in ('reported', 'confirmed')),
  updated_at timestamptz not null default now(),
  primary key (league_id, tournament_id, season, user_id)
);
-- Reminder emails a commissioner sent, so they can't be sent again within a few hours.
create table if not exists league_reminders_sent (
  league_id text not null references leagues(id) on delete cascade,
  tournament_id text not null,
  season integer not null,
  kind text not null,
  sent_at timestamptz not null default now(),
  primary key (league_id, tournament_id, season, kind)
);

-- iPhone push notification tokens (one row per device; a device moves to whoever signs in on it).
create table if not exists push_tokens (
  token text primary key,
  user_id text not null references users(id) on delete cascade,
  platform text not null default 'ios',
  updated_at timestamptz not null default now()
);
create index if not exists push_tokens_user on push_tokens (user_id);

-- Each league's final standings per tournament and season ("Past Results"). Saved when a member
-- views a finished tournament; the larger snapshot wins.
create table if not exists league_standings_archive (
  league_id text not null references leagues(id) on delete cascade,
  tournament_id text not null,
  season integer not null,
  standings jsonb not null,
  payouts jsonb,
  saved_at timestamptz not null default now(),
  primary key (league_id, tournament_id, season)
);

-- Copies of important data that lives in Redis (salary lists, lock times, etc.), taken nightly.
create table if not exists redis_backups (
  key text primary key,
  value text not null,
  backed_up_at timestamptz not null default now()
);

alter table users enable row level security;
alter table sessions enable row level security;
alter table leagues enable row level security;
alter table league_members enable row level security;
alter table league_tournaments enable row level security;
alter table rosters enable row level security;
alter table league_purchases enable row level security;
alter table league_payouts_sent enable row level security;
alter table app_migrations enable row level security;
alter table league_standings_archive enable row level security;
alter table redis_backups enable row level security;
alter table league_entry_payments enable row level security;
alter table league_reminders_sent enable row level security;
alter table push_tokens enable row level security;
`;
