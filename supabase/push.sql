-- Notifications push : abonnements des téléphones + lecture réservée à la fonction d'envoi quotidienne.
-- À exécuter une fois dans l'éditeur SQL de Supabase. Remplacer __PUSH_SECRET__ par la valeur de la variable PUSH_SECRET (Vercel).

create table if not exists push_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null default auth_household_id() references households (id) on delete cascade,
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint     text not null unique,
  p256dh       text not null,
  auth         text not null,
  created_at   timestamptz not null default now()
);

alter table push_subscriptions enable row level security;

drop policy if exists push_subscriptions_own on push_subscriptions;
create policy push_subscriptions_own on push_subscriptions
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and household_id = auth_household_id());

-- Secret partagé avec la fonction d'envoi (table sans politique : illisible depuis l'API).
create table if not exists push_config (key text primary key, value text not null);
alter table push_config enable row level security;
insert into push_config (key, value) values ('secret', '__PUSH_SECRET__')
  on conflict (key) do update set value = excluded.value;

-- Abonnements + stock + réglages par foyer, uniquement si le secret est bon.
create or replace function push_pending(p_secret text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_secret is null or p_secret is distinct from (select value from push_config where key = 'secret') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(h) from (
      select
        s.household_id,
        jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth)) as subs,
        (select to_jsonb(st) from settings st where st.household_id = s.household_id) as settings,
        (select coalesce(jsonb_agg(jsonb_build_object(
            'id', p.id, 'name', p.name, 'category', p.category, 'quantity', p.quantity, 'unit', p.unit,
            'size', p.size, 'expiry_date', p.expiry_date, 'date_type', p.date_type,
            'location', p.location, 'conservation', p.conservation)), '[]'::jsonb)
           from products p where p.household_id = s.household_id) as products
      from push_subscriptions s
      group by s.household_id
    ) h
  ), '[]'::jsonb);
end;
$$;

-- Supprime un abonnement expiré (téléphone désinstallé), toujours sous secret.
create or replace function push_forget(p_secret text, p_endpoint text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_secret is null or p_secret is distinct from (select value from push_config where key = 'secret') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  delete from push_subscriptions where endpoint = p_endpoint;
end;
$$;

revoke all on function push_pending(text) from public;
revoke all on function push_forget(text, text) from public;
grant execute on function push_pending(text) to anon, authenticated;
grant execute on function push_forget(text, text) to anon, authenticated;
