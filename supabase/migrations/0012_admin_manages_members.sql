-- Gestion des membres et des équipes : réservée à l'administrateur du site.
-- Le bureau gère les tâches, projets, événements, idées et annonces ; il ne valide pas les comptes
-- et n'affecte pas les membres aux équipes.

-- Validation et désactivation des comptes : administrateur du site.
create or replace function public.profiles_guard_privileges()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return new; -- opérations serveur avec la clé service (scripts d'administration)
  end if;
  if new.is_site_admin is distinct from old.is_site_admin then
    raise exception 'Le statut d’administrateur du site ne se modifie pas depuis l’application' using errcode = '42501';
  end if;
  if new.role is distinct from old.role and not public.is_site_admin() then
    raise exception 'Seul l’administrateur du site nomme ou retire les membres du bureau' using errcode = '42501';
  end if;
  if new.is_active is distinct from old.is_active and not public.is_site_admin() then
    raise exception 'Seul l’administrateur du site valide ou désactive un compte' using errcode = '42501';
  end if;
  if new.email is distinct from old.email then
    raise exception 'L’adresse e-mail ne peut pas être modifiée ici' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- Profils : chacun modifie le sien ; l'administrateur du site modifie les autres.
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_site_admin())
  with check (id = auth.uid() or public.is_site_admin());

-- Équipes : création, modification, archivage par l'administrateur du site.
drop policy if exists poles_write on public.poles;
create policy poles_write on public.poles for all to authenticated
  using (public.is_site_admin()) with check (public.is_site_admin());

-- Affectations aux équipes : administrateur du site.
drop policy if exists pole_memberships_insert on public.pole_memberships;
create policy pole_memberships_insert on public.pole_memberships for insert to authenticated
  with check (public.is_site_admin());
drop policy if exists pole_memberships_update on public.pole_memberships;
create policy pole_memberships_update on public.pole_memberships for update to authenticated
  using (public.is_site_admin()) with check (public.is_site_admin());
drop policy if exists pole_memberships_delete on public.pole_memberships;
create policy pole_memberships_delete on public.pole_memberships for delete to authenticated
  using (public.is_site_admin());

-- Invitations : administrateur du site.
drop policy if exists invitations_bureau on public.invitations;
create policy invitations_admin on public.invitations for all to authenticated
  using (public.is_site_admin()) with check (public.is_site_admin());
