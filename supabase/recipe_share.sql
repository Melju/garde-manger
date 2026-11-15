-- Partage de recettes entre foyers : un lien contient un instantané de la recette,
-- que le destinataire (connecté) copie dans son propre foyer.
create table if not exists shared_recipes (
  token      text primary key,
  recipe     jsonb not null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
alter table shared_recipes enable row level security;  -- aucune policy : accès uniquement via les fonctions ci-dessous

create or replace function share_recipe(p_recipe jsonb) returns text
language plpgsql security definer set search_path = public as $$
declare t text;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if length(p_recipe::text) > 40000 then raise exception 'Recette trop volumineuse'; end if;
  t := substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
  insert into shared_recipes (token, recipe, created_by) values (t, p_recipe, auth.uid());
  return t;
end $$;

create or replace function get_shared_recipe(p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r jsonb;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  select recipe into r from shared_recipes
   where token = p_token and created_at > now() - interval '60 days';
  return r;
end $$;

revoke all on function share_recipe(jsonb) from public, anon;
revoke all on function get_shared_recipe(text) from public, anon;
grant execute on function share_recipe(jsonb) to authenticated;
grant execute on function get_shared_recipe(text) to authenticated;
