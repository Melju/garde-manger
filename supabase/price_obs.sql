-- Prix relevés par magasin (tickets, étiquettes scannées) pour savoir où un produit est le moins cher.
create table if not exists price_obs (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null default auth_household_id() references households (id) on delete cascade,
  name         text not null,
  name_key     text not null,
  store        text not null,
  price        numeric not null check (price > 0),
  unit_price   numeric,
  unit_label   text,
  source       text not null default 'ticket',
  observed_at  timestamptz not null default now()
);
create index if not exists price_obs_lookup on price_obs (household_id, name_key, observed_at desc);
alter table price_obs enable row level security;
drop policy if exists price_obs_household on price_obs;
create policy price_obs_household on price_obs for all to authenticated
  using (household_id = auth_household_id())
  with check (household_id = auth_household_id());
grant select, insert, delete on price_obs to authenticated;
notify pgrst, 'reload schema';
