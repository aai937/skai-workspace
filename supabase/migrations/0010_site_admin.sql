-- Un seul administrateur du site : lui seul nomme ou retire les membres du bureau.
-- Le bureau gère les membres (validation, pôles), les tâches, projets, événements et annonces.

alter table public.profiles add column if not exists is_site_admin boolean not null default false;

-- Au plus un administrateur du site dans toute la base.
create unique index if not exists profiles_single_site_admin on public.profiles ((true)) where is_site_admin;

create or replace function public.is_site_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_active and p.is_site_admin
  );
$$;

-- Garde-fous des comptes : rôle réservé à l'administrateur du site, activation réservée au bureau,
-- statut d'administrateur jamais modifiable depuis l'application.
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
  if new.is_active is distinct from old.is_active and not public.is_bureau() then
    raise exception 'Seul le bureau valide ou désactive un compte' using errcode = '42501';
  end if;
  if new.email is distinct from old.email then
    raise exception 'L’adresse e-mail ne peut pas être modifiée ici' using errcode = '42501';
  end if;
  return new;
end;
$$;

update public.profiles set is_site_admin = true where email = 'anis.aniche@skema.edu';
