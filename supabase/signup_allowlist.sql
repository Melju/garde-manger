-- Inscription sur invitation : seules les adresses de allowed_emails peuvent créer un compte.
-- Les comptes existants ne sont pas touchés (le contrôle ne porte que sur les nouvelles inscriptions).

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
