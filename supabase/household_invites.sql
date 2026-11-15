-- Invitation directe dans un foyer : un membre invite une adresse e-mail.
-- L'adresse est autorisée à s'inscrire ; à l'inscription elle rejoint le foyer automatiquement,
-- et un compte existant se voit proposer de le rejoindre.

create table if not exists household_invites (
  email        text not null,
  household_id uuid not null references households (id) on delete cascade,
  invited_by   uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  primary key (email, household_id)
);
alter table household_invites enable row level security;
revoke all on household_invites from anon, authenticated;

create or replace function invite_to_household(p_email text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  e text := lower(trim(p_email));
  hid uuid;
  h households;
  inviter text;
  recent int;
begin
  select household_id, display_name into hid, inviter from profiles where id = auth.uid();
  if hid is null then raise exception 'Crée ou rejoins d''abord un foyer'; end if;
  if e !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Adresse e-mail invalide'; end if;
  select count(*) into recent from household_invites where household_id = hid and created_at > now() - interval '1 day';
  if recent >= 15 then raise exception 'Trop d''invitations aujourd''hui pour ce foyer'; end if;
  if exists (select 1 from profiles p join auth.users u on u.id = p.id where lower(u.email) = e and p.household_id = hid) then
    raise exception 'Cette personne fait déjà partie du foyer';
  end if;
  insert into allowed_emails (email) values (e) on conflict do nothing;
  insert into household_invites (email, household_id, invited_by) values (e, hid, auth.uid())
    on conflict (email, household_id) do update set created_at = now(), invited_by = excluded.invited_by;
  select * into h from households where id = hid;
  return jsonb_build_object('household', h.name, 'code', h.invite_code, 'inviter', coalesce(inviter, ''));
end;
$$;

-- Invitation en attente pour l'utilisateur courant (hors foyer actuel), la plus récente.
create or replace function pending_household_invite()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare r record;
begin
  select i.household_id, h.name, coalesce(p.display_name, '') as inviter
    into r
    from household_invites i
    join households h on h.id = i.household_id
    left join profiles p on p.id = i.invited_by
    where lower(i.email) = lower((select email from auth.users where id = auth.uid()))
      and i.household_id is distinct from (select household_id from profiles where id = auth.uid())
    order by i.created_at desc
    limit 1;
  if r.household_id is null then return null; end if;
  return jsonb_build_object('household_id', r.household_id, 'household', r.name, 'inviter', r.inviter);
end;
$$;

create or replace function answer_household_invite(p_household uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare me text := lower((select email from auth.users where id = auth.uid()));
begin
  if not exists (select 1 from household_invites where lower(email) = me and household_id = p_household) then
    raise exception 'Invitation introuvable';
  end if;
  if p_accept then
    update profiles set household_id = p_household where id = auth.uid();
    delete from household_invites where lower(email) = me;
  else
    delete from household_invites where lower(email) = me and household_id = p_household;
  end if;
end;
$$;

-- À l'inscription : profil créé et foyer rejoint directement s'il y a une invitation.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare hid uuid;
begin
  select household_id into hid from household_invites where lower(email) = lower(new.email) order by created_at desc limit 1;
  insert into public.profiles (id, display_name, household_id)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)), hid);
  if hid is not null then delete from household_invites where lower(email) = lower(new.email); end if;
  return new;
end;
$$;

grant execute on function invite_to_household(text) to authenticated;
grant execute on function pending_household_invite() to authenticated;
grant execute on function answer_household_invite(uuid, boolean) to authenticated;
notify pgrst, 'reload schema';
