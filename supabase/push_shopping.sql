-- Notification « X a ajouté … à la liste de courses » envoyée aux autres membres du foyer.
-- Réglable par appareil (colonne notify_shopping de l'abonnement).
alter table push_subscriptions add column if not exists notify_shopping boolean not null default true;

-- Appareils des AUTRES membres du foyer de p_user, sous secret (appelé par la fonction Vercel).
create or replace function push_shopping_targets(p_secret text, p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare hid uuid; who text;
begin
  if p_secret is null or p_secret is distinct from (select value from push_config where key = 'secret') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select household_id, display_name into hid, who from profiles where id = p_user;
  if hid is null then return jsonb_build_object('who', who, 'subs', '[]'::jsonb); end if;
  return jsonb_build_object(
    'who', coalesce(who, ''),
    'subs', coalesce((
      select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
      from push_subscriptions s
      where s.household_id = hid and s.user_id <> p_user and s.notify_shopping
    ), '[]'::jsonb)
  );
end;
$$;
revoke all on function push_shopping_targets(text, uuid) from public;
grant execute on function push_shopping_targets(text, uuid) to anon, authenticated;
notify pgrst, 'reload schema';
