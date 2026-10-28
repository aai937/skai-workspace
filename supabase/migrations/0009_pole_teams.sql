-- Les pôles sont des équipes : plus de « responsable de pôle ». Le bureau gère les tâches, projets,
-- événements et annonces ; les membres d'une équipe y participent et y voient leurs contenus.
-- La valeur d'enum 'responsable' reste en base (PostgreSQL ne sait pas la retirer simplement), mais
-- plus aucune règle ne la reconnaît : les anciennes affectations deviennent des affectations de membre.

update public.pole_memberships set role = 'membre' where role = 'responsable';

create or replace function public.is_pole_responsable(p_pole_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select false;
$$;

create or replace function public.is_any_pole_responsable()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select false;
$$;
