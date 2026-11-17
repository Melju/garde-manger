-- Auteur d'un ajout au stock, pour l'animation « X vient d'ajouter … » chez les autres membres.
alter table public.products add column if not exists created_by uuid default auth.uid();
notify pgrst, 'reload schema';
