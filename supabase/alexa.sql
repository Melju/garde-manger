-- Skill Alexa « Miam miam » : association d'un compte Alexa à un membre du foyer.
-- L'utilisateur dit « Alexa, demande à Miam miam de m'associer », reçoit un code à 6 chiffres
-- et le saisit dans l'app (Paramètres). Les fonctions « sous secret » sont appelées par la fonction
-- Vercel /api/alexa (même secret que les notifications, table push_config).

create table if not exists alexa_links (
  alexa_user text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  last_undo jsonb
);
create table if not exists alexa_codes (
  code text primary key,
  alexa_user text not null,
  expires_at timestamptz not null
);
alter table alexa_links enable row level security;
alter table alexa_codes enable row level security;
-- Un membre voit (et peut supprimer) ses propres associations.
drop policy if exists alexa_links_own on alexa_links;
create policy alexa_links_own on alexa_links for select using (user_id = auth.uid());
drop policy if exists alexa_links_del on alexa_links;
create policy alexa_links_del on alexa_links for delete using (user_id = auth.uid());

create or replace function alexa_check(p_secret text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_secret is null or p_secret is distinct from (select value from push_config where key = 'secret') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
end $$;

-- Membre associé à un compte Alexa (null si pas encore associé).
create or replace function alexa_lookup(p_secret text, p_alexa text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r record;
begin
  perform alexa_check(p_secret);
  select l.user_id, p.household_id, coalesce(p.display_name, '') as name, l.last_undo
    into r from alexa_links l join profiles p on p.id = l.user_id where l.alexa_user = p_alexa;
  if r.user_id is null then return null; end if;
  return jsonb_build_object('user_id', r.user_id, 'household_id', r.household_id, 'name', r.name, 'last_undo', r.last_undo);
end $$;

-- Nouveau code d'association (valable 10 min).
create or replace function alexa_new_code(p_secret text, p_alexa text)
returns text language plpgsql security definer set search_path = public as $$
declare c text;
begin
  perform alexa_check(p_secret);
  delete from alexa_codes where expires_at < now() or alexa_user = p_alexa;
  loop
    c := lpad((floor(random() * 1000000))::int::text, 6, '0');
    exit when not exists (select 1 from alexa_codes where code = c);
  end loop;
  insert into alexa_codes(code, alexa_user, expires_at) values (c, p_alexa, now() + interval '10 minutes');
  return c;
end $$;

-- Mémorise de quoi annuler la dernière commande vocale.
create or replace function alexa_set_undo(p_secret text, p_alexa text, p_undo jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform alexa_check(p_secret);
  update alexa_links set last_undo = p_undo where alexa_user = p_alexa;
end $$;

-- Appelée par l'app (utilisateur connecté) avec le code dicté par Alexa.
create or replace function alexa_link(p_code text)
returns boolean language plpgsql security definer set search_path = public as $$
declare a text;
begin
  if auth.uid() is null then raise exception 'connexion requise' using errcode = '42501'; end if;
  select alexa_user into a from alexa_codes where code = trim(p_code) and expires_at > now();
  if a is null then return false; end if;
  insert into alexa_links(alexa_user, user_id) values (a, auth.uid())
    on conflict (alexa_user) do update set user_id = excluded.user_id, created_at = now(), last_undo = null;
  delete from alexa_codes where code = trim(p_code);
  return true;
end $$;

revoke all on function alexa_check(text) from public;
grant execute on function alexa_lookup(text, text), alexa_new_code(text, text), alexa_set_undo(text, text, jsonb) to anon, authenticated;
grant execute on function alexa_link(text) to authenticated;
notify pgrst, 'reload schema';
