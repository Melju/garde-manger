-- =====================================================================
-- Garde-Manger — schéma de base de données (Supabase / PostgreSQL)
-- À exécuter dans Studio → SQL Editor (une fois le projet en ligne).
--
-- Modèle : chaque utilisateur appartient à un FOYER (household). Toutes les
-- données sont rattachées à un foyer et protégées par RLS : un membre ne voit
-- que les données de son foyer. On rejoint un foyer via un CODE d'invitation.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- Foyers & profils ----------

create table if not exists households (
  id          uuid primary key default gen_random_uuid(),
  name        text not null default 'Mon foyer',
  invite_code text not null unique,
  created_at  timestamptz not null default now()
);

create table if not exists profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  household_id uuid references households (id) on delete set null,
  display_name text,
  created_at   timestamptz not null default now()
);

-- household_id du foyer de l'utilisateur courant (SECURITY DEFINER → contourne
-- la RLS pour éviter toute récursion dans les politiques).
create or replace function auth_household_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select household_id from profiles where id = auth.uid()
$$;

-- Création automatique d'un profil à l'inscription.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Génère un code d'invitation court et lisible (8 caractères, sans 0/O/1/I).
create or replace function gen_invite_code()
returns text
language plpgsql
as $$
declare
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
  i int;
begin
  loop
    code := '';
    for i in 1..8 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from households where invite_code = code);
  end loop;
  return code;
end;
$$;

-- Créer un foyer et y rattacher l'utilisateur courant.
create or replace function create_household(p_name text default 'Mon foyer')
returns households
language plpgsql
security definer
set search_path = public
as $$
declare
  h households;
begin
  insert into households (name, invite_code)
  values (coalesce(nullif(trim(p_name), ''), 'Mon foyer'), gen_invite_code())
  returning * into h;

  update profiles set household_id = h.id where id = auth.uid();
  return h;
end;
$$;

-- Rejoindre un foyer via son code d'invitation.
create or replace function join_household(p_code text)
returns households
language plpgsql
security definer
set search_path = public
as $$
declare
  h households;
begin
  select * into h from households where invite_code = upper(trim(p_code));
  if h.id is null then
    raise exception 'Code d''invitation invalide';
  end if;
  update profiles set household_id = h.id where id = auth.uid();
  return h;
end;
$$;

-- ---------- Collections de données ----------

create table if not exists products (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  name         text not null,
  category     text not null default 'epicerie',
  quantity     numeric not null default 1,
  unit         text,
  size         text,
  expiry_date  date,
  price        numeric,
  barcode      text,
  conservation text,
  date_type    text,
  location     text,
  image_url    text,
  nutriscore   text,
  nova         int,
  kcal         numeric,
  allergens    text[],
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists shopping_items (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  name         text not null,
  category     text not null default 'frais',
  quantity     numeric not null default 1,
  unit         text,
  checked      boolean not null default false,
  source       text not null default 'manuel',
  created_at   timestamptz not null default now()
);

create table if not exists recipes (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  title        text not null,
  time_min     int not null default 20,
  cuisine      text,
  tags         text[] not null default '{}',
  favorite     boolean not null default false,
  ingredients  jsonb not null default '[]',
  steps        jsonb not null default '[]'
);

create table if not exists family_members (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  name         text not null,
  diet         text not null default 'omnivore',
  restrictions text[] not null default '{}',
  aversions    text,
  color        text not null default 'linear-gradient(135deg, #3b82f6, #1d4ed8)'
);

create table if not exists meals (
  household_id uuid not null references households (id) on delete cascade,
  meal_date    date not null,
  slot         text not null,
  label        text not null,
  primary key (household_id, meal_date, slot)
);

create table if not exists history (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  entry_date   date not null,
  at           timestamptz not null default now(),
  kind         text not null,
  label        text not null,
  amount       numeric,
  meta         jsonb
);

create table if not exists expenses (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  expense_date date not null,
  category     text not null,
  label        text not null,
  amount       numeric not null
);

create table if not exists budget (
  household_id  uuid primary key references households (id) on delete cascade,
  monthly_limit numeric not null default 400
);

create table if not exists settings (
  household_id        uuid primary key references households (id) on delete cascade,
  notif_expiry        boolean not null default true,
  notif_low_stock     boolean not null default true,
  low_stock_threshold int not null default 1
);

-- Catalogue d'apprentissage des courses (partagé au foyer).
create table if not exists shop_catalog (
  household_id uuid not null references households (id) on delete cascade,
  name_key     text not null,
  name         text not null,
  category     text not null,
  unit         text not null default '',
  qty          numeric not null default 1,
  count        int not null default 1,
  at           timestamptz not null default now(),
  primary key (household_id, name_key)
);

-- ---------- Row Level Security ----------

alter table households      enable row level security;
alter table profiles        enable row level security;
alter table products        enable row level security;
alter table shopping_items  enable row level security;
alter table recipes         enable row level security;
alter table family_members  enable row level security;
alter table meals           enable row level security;
alter table history         enable row level security;
alter table expenses        enable row level security;
alter table budget          enable row level security;
alter table settings        enable row level security;
alter table shop_catalog    enable row level security;

-- Profil : chacun lit/modifie le sien.
create policy profiles_self on profiles
  for all to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Lecture des profils du même foyer (liste des membres).
create policy profiles_household_read on profiles
  for select to authenticated
  using (household_id = auth_household_id());

-- Foyer : un membre voit son foyer ; la création passe par les fonctions RPC.
create policy households_member_read on households
  for select to authenticated
  using (id = auth_household_id());

-- Politique générique « même foyer » pour toutes les collections.
do $$
declare t text;
begin
  foreach t in array array[
    'products','shopping_items','recipes','family_members',
    'meals','history','expenses','budget','settings','shop_catalog'
  ] loop
    execute format($f$
      create policy %1$s_household on %1$s
        for all to authenticated
        using (household_id = auth_household_id())
        with check (household_id = auth_household_id());
    $f$, t);
  end loop;
end $$;

-- ---------- Droits d'exécution des fonctions ----------

grant execute on function create_household(text) to authenticated;
grant execute on function join_household(text)   to authenticated;
grant execute on function auth_household_id()     to authenticated;
