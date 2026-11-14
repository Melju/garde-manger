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
  brand        text,
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

-- ---------- Limite IA par foyer (voir ai_limits.sql) ----------
-- ai_quota = -1 : illimité.

alter table households add column if not exists ai_quota int;

create table if not exists ai_keys (
  household_id uuid primary key references households (id) on delete cascade,
  api_key      text not null,
  updated_at   timestamptz not null default now()
);

create table if not exists ai_usage (
  household_id uuid not null references households (id) on delete cascade,
  month        text not null,
  calls        int not null default 0,
  primary key (household_id, month)
);

-- Aucune politique : ces tables ne sont lisibles que par les fonctions SECURITY DEFINER ci-dessous.
alter table ai_keys  enable row level security;
alter table ai_usage enable row level security;
revoke all on ai_keys, ai_usage from anon, authenticated;

-- Appelée uniquement par les edge functions (service_role) : autorise ou refuse un appel IA et le compte.
create or replace function ai_gate(p_uid uuid, p_default_limit int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  hid uuid;
  k text;
  q int;
  used int;
  m text := to_char(now(), 'YYYY-MM');
begin
  select household_id into hid from profiles where id = p_uid;
  if hid is null then
    return jsonb_build_object('allowed', false, 'reason', 'no_household');
  end if;
  select api_key into k from ai_keys where household_id = hid;
  if k is not null then
    return jsonb_build_object('allowed', true, 'key', k);
  end if;
  select coalesce(ai_quota, p_default_limit) into q from households where id = hid;
  if q < 0 then
    return jsonb_build_object('allowed', true);
  end if;
  insert into ai_usage (household_id, month, calls) values (hid, m, 0) on conflict do nothing;
  update ai_usage set calls = calls + 1
    where household_id = hid and month = m and calls < q
    returning calls into used;
  if used is null then
    return jsonb_build_object('allowed', false, 'reason', 'quota', 'limit', q);
  end if;
  return jsonb_build_object('allowed', true, 'used', used, 'limit', q);
end;
$$;
revoke all on function ai_gate(uuid, int) from public, anon, authenticated;
grant execute on function ai_gate(uuid, int) to service_role;

-- État pour l'écran Compte : clé perso active ? usage du mois ?
create or replace function ai_status(p_default_limit int default 60)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  hid uuid := auth_household_id();
  q int;
  used int;
begin
  if hid is null then return jsonb_build_object('hasKey', false, 'used', 0, 'limit', null); end if;
  select coalesce(ai_quota, p_default_limit) into q from households where id = hid;
  select coalesce(calls, 0) into used from ai_usage where household_id = hid and month = to_char(now(), 'YYYY-MM');
  return jsonb_build_object(
    'hasKey', exists (select 1 from ai_keys where household_id = hid),
    'used', coalesce(used, 0),
    'limit', case when q < 0 then null else q end
  );
end;
$$;

create or replace function set_ai_key(p_key text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare hid uuid := auth_household_id();
begin
  if hid is null then raise exception 'Aucun foyer'; end if;
  if p_key is null or p_key !~ '^sk-ant-[A-Za-z0-9_-]{20,}$' then
    raise exception 'Clé Anthropic invalide (elle commence par sk-ant-)';
  end if;
  insert into ai_keys (household_id, api_key) values (hid, trim(p_key))
    on conflict (household_id) do update set api_key = excluded.api_key, updated_at = now();
end;
$$;

create or replace function clear_ai_key()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from ai_keys where household_id = auth_household_id();
end;
$$;

grant execute on function ai_status(int) to authenticated;
grant execute on function set_ai_key(text) to authenticated;
grant execute on function clear_ai_key() to authenticated;

-- ---------- Inscription sur invitation (voir signup_allowlist.sql) ----------

create table if not exists allowed_emails (
  email    text primary key,
  added_at timestamptz not null default now()
);
alter table allowed_emails enable row level security;
revoke all on allowed_emails from anon, authenticated;

alter table profiles add column if not exists is_admin boolean not null default false;

create or replace function check_signup_allowed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from allowed_emails where lower(email) = lower(new.email)) then
    raise exception 'Inscription sur invitation : adresse non autorisée';
  end if;
  return new;
end;
$$;

drop trigger if exists before_signup_check on auth.users;
create trigger before_signup_check
  before insert on auth.users
  for each row execute function check_signup_allowed();

create or replace function is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select is_admin from profiles where id = auth.uid()), false);
$$;

create or replace function admin_allowed_list()
returns setof text
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then raise exception 'Réservé à l''administrateur'; end if;
  return query select email from allowed_emails order by email;
end;
$$;

create or replace function admin_allow_email(p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare e text := lower(trim(p_email));
begin
  if not is_admin() then raise exception 'Réservé à l''administrateur'; end if;
  if e !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Adresse e-mail invalide'; end if;
  insert into allowed_emails (email) values (e) on conflict do nothing;
end;
$$;

create or replace function admin_remove_email(p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then raise exception 'Réservé à l''administrateur'; end if;
  delete from allowed_emails where lower(email) = lower(trim(p_email));
end;
$$;

grant execute on function is_admin() to authenticated;
grant execute on function admin_allowed_list() to authenticated;
grant execute on function admin_allow_email(text) to authenticated;
grant execute on function admin_remove_email(text) to authenticated;

-- Amorçage : les comptes existants restent autorisés ; le plus ancien compte devient administrateur.
insert into allowed_emails (email)
  select lower(email) from auth.users where email is not null
  on conflict do nothing;
update profiles set is_admin = true
  where id = (select id from auth.users order by created_at limit 1);

-- ---------- Administration des quotas (réservé à l'administrateur) ----------
create or replace function admin_ai_overview(p_default_limit int default 60)
returns table (id uuid, name text, members bigint, used int, quota int, has_key boolean, is_default boolean)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then raise exception 'Réservé à l''administrateur'; end if;
  return query
    select h.id, h.name,
           (select count(*) from profiles p where p.household_id = h.id),
           coalesce((select u.calls from ai_usage u where u.household_id = h.id and u.month = to_char(now(), 'YYYY-MM')), 0),
           coalesce(h.ai_quota, p_default_limit),
           exists (select 1 from ai_keys k where k.household_id = h.id),
           h.ai_quota is null
    from households h
    order by h.created_at;
end;
$$;

-- p_quota : nombre d'appels par mois, -1 = illimité, null = quota par défaut.
create or replace function admin_set_quota(p_household uuid, p_quota int)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then raise exception 'Réservé à l''administrateur'; end if;
  update households set ai_quota = p_quota where id = p_household;
end;
$$;

grant execute on function admin_ai_overview(int) to authenticated;
grant execute on function admin_set_quota(uuid, int) to authenticated;
