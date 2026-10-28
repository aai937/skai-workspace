-- Correctif de 0014 : la règle des tâches interrogeait les collaborateurs, dont la règle interroge les tâches
-- (boucle infinie). La vérification passe par une fonction qui ne déclenche pas les règles.

create or replace function public.is_task_collaborator(p_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.task_collaborators tc
    where tc.task_id = p_task_id and tc.profile_id = auth.uid()
  );
$$;

drop policy if exists tasks_select on public.tasks;
create policy tasks_select on public.tasks for select to authenticated
  using (
    public.is_bureau()
    or (
      public.is_active_member()
      and (
        public.is_pole_member(pole_id)
        or assignee_id = auth.uid()
        or creator_id = auth.uid()
        or public.is_task_collaborator(id)
      )
    )
  );

drop policy if exists task_collaborators_select on public.task_collaborators;
create policy task_collaborators_select on public.task_collaborators for select to authenticated
  using (public.is_active_member());
