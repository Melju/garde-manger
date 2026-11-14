-- Limite d'usage IA par foyer + clé Anthropic personnelle (facultative).
-- Sans clé perso, chaque foyer dispose d'un quota mensuel d'appels (ai_quota, ou le défaut passé par la fonction).
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
