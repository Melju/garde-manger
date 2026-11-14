-- Garde-Manger : diffusion temps réel (Supabase Realtime) des tables du foyer.
-- Sans effet si les tables sont déjà publiées : le script est rejouable.
do $$
declare t text;
begin
  foreach t in array array['products','shopping_items','recipes','family_members','meals','history','expenses','budget','settings','shop_catalog'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

select tablename from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' order by 1;
