-- Hitster Bingo — databaseschema
--
-- Alles staat in het schema `hitster`, volledig los van andere projecten in
-- dezelfde Supabase-instantie. Verwijderen van dit project is dan ook één
-- `drop schema hitster cascade;` en niets anders raakt.
--
-- Draaien: Supabase Dashboard → SQL Editor → plakken → Run.

create schema if not exists hitster;

-- ---------------------------------------------------------------------------
-- Afspeellijsten en nummers
-- ---------------------------------------------------------------------------

create table if not exists hitster.playlists (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  description  text,
  -- 'spotify' voor een import, 'builtin' voor de meegeleverde edities,
  -- 'manual' voor een handmatig samengestelde lijst
  source       text not null default 'spotify',
  spotify_id   text,
  edition      text,
  is_public    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create unique index if not exists playlists_spotify_id_key
  on hitster.playlists (spotify_id) where spotify_id is not null;

create table if not exists hitster.tracks (
  id            uuid primary key default gen_random_uuid(),
  playlist_id   uuid not null references hitster.playlists(id) on delete cascade,
  spotify_id    text,
  spotify_uri   text,
  title         text not null,
  artist        text not null,
  -- Jaartal mag leeg zijn: dan is de track niet bruikbaar voor de tijdlijn
  year          integer,
  -- 'spotify' is het albumjaar en dus onbetrouwbaar bij compilaties;
  -- 'musicbrainz' is gecorrigeerd naar de eerste release
  year_source   text,
  album_name    text,
  -- 'person' of 'group', voor de solo-of-groep categorie
  artist_type   text,
  position      integer,
  created_at    timestamptz not null default now()
);

create index if not exists tracks_playlist_idx on hitster.tracks (playlist_id);
create unique index if not exists tracks_playlist_spotify_key
  on hitster.tracks (playlist_id, spotify_id) where spotify_id is not null;

-- ---------------------------------------------------------------------------
-- Kamers en spelers
-- ---------------------------------------------------------------------------

create table if not exists hitster.rooms (
  code         text primary key,
  mode         text not null default 'classic',
  playlist_id  uuid references hitster.playlists(id) on delete set null,
  -- De volledige spelstaat als JSON. Eén rij bijwerken is genoeg om alle
  -- telefoons via realtime gelijk te trekken.
  state        jsonb not null default '{}'::jsonb,
  is_open      boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists hitster.players (
  id         uuid primary key default gen_random_uuid(),
  room_code  text not null references hitster.rooms(code) on delete cascade,
  name       text not null,
  is_host    boolean not null default false,
  -- Laatste teken van leven, om afhakers te herkennen
  last_seen  timestamptz not null default now(),
  joined_at  timestamptz not null default now()
);

create index if not exists players_room_idx on hitster.players (room_code);

-- updated_at automatisch bijhouden, zodat clients kunnen zien wat vers is
create or replace function hitster.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists rooms_touch_updated_at on hitster.rooms;
create trigger rooms_touch_updated_at
  before update on hitster.rooms
  for each row execute function hitster.touch_updated_at();

drop trigger if exists playlists_touch_updated_at on hitster.playlists;
create trigger playlists_touch_updated_at
  before update on hitster.playlists
  for each row execute function hitster.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- Het spel kent geen accounts: wie de kamercode heeft, mag meespelen. De
-- toegang is dus bewust ruim voor anonieme bezoekers. Dat betekent ook dat
-- iemand die een geldige kamercode raadt, kan meekijken en schrijven. Voor een
-- muziekspel is dat acceptabel; zet hier nooit persoonsgegevens in.
--
-- Wat RLS hier wél doet: alleen deze tabellen zijn bereikbaar, en alleen via
-- de publishable key. De rest van de database blijft dicht.
-- ---------------------------------------------------------------------------

alter table hitster.playlists enable row level security;
alter table hitster.tracks    enable row level security;
alter table hitster.rooms     enable row level security;
alter table hitster.players   enable row level security;

drop policy if exists playlists_read on hitster.playlists;
create policy playlists_read on hitster.playlists
  for select to anon, authenticated using (is_public);

drop policy if exists playlists_write on hitster.playlists;
create policy playlists_write on hitster.playlists
  for all to anon, authenticated using (true) with check (true);

drop policy if exists tracks_read on hitster.tracks;
create policy tracks_read on hitster.tracks
  for select to anon, authenticated using (true);

drop policy if exists tracks_write on hitster.tracks;
create policy tracks_write on hitster.tracks
  for all to anon, authenticated using (true) with check (true);

drop policy if exists rooms_all on hitster.rooms;
create policy rooms_all on hitster.rooms
  for all to anon, authenticated using (true) with check (true);

drop policy if exists players_all on hitster.players;
create policy players_all on hitster.players
  for all to anon, authenticated using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Toegang voor de PostgREST-rollen; zonder dit is het schema onzichtbaar
-- ---------------------------------------------------------------------------

grant usage on schema hitster to anon, authenticated;
grant all on all tables in schema hitster to anon, authenticated;
grant all on all sequences in schema hitster to anon, authenticated;

alter default privileges in schema hitster
  grant all on tables to anon, authenticated;
alter default privileges in schema hitster
  grant all on sequences to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Realtime: kamers en spelers pushen naar alle telefoons in de lobby
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'hitster'
      and tablename = 'rooms'
  ) then
    alter publication supabase_realtime add table hitster.rooms;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'hitster'
      and tablename = 'players'
  ) then
    alter publication supabase_realtime add table hitster.players;
  end if;
end $$;

-- Volledige rij meesturen bij updates, zodat clients de nieuwe state zien
alter table hitster.rooms replica identity full;
alter table hitster.players replica identity full;
