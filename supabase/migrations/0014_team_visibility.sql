-- Visibilité par équipe : un membre voit ses propres tâches et celles de son équipe, les messages et projets
-- qui le concernent, et les annonces de son audience. Il ne voit pas l'activité des autres équipes.
-- Le bureau voit tout.

-- Peut-on voir une équipe ? (bureau, ou membre de cette équipe)
create or replace function public.can_see_pole(p_pole_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_bureau() or public.is_pole_member(p_pole_id);
$$;

-- Peut-on voir un projet ? (bureau, responsable désigné, créateur, participant, ou équipe du projet)
create or replace function public.can_see_project(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_bureau()
    or exists (select 1 from public.projects pr where pr.id = p_project_id and (pr.lead_id = auth.uid() or pr.created_by = auth.uid()))
    or exists (select 1 from public.project_members pm where pm.project_id = p_project_id and pm.profile_id = auth.uid())
    or exists (
      select 1 from public.project_poles pp
      where pp.project_id = p_project_id and public.is_pole_member(pp.pole_id)
    );
$$;

-- Peut-on voir un événement ? Même logique que pour un projet.
create or replace function public.can_see_event(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_bureau()
    or exists (select 1 from public.events e where e.id = p_event_id and (e.lead_id = auth.uid() or e.created_by = auth.uid()))
    or exists (
      select 1 from public.event_poles ep
      where ep.event_id = p_event_id and public.is_pole_member(ep.pole_id)
    );
$$;

-- Canal visible ? Canal général et canaux libres : tous. Canal d'équipe : membres de l'équipe.
-- Canal de projet ou d'événement : mêmes règles que le projet ou l'événement.
create or replace function public.can_see_channel(p_channel_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.channels c
    where c.id = p_channel_id
      and c.archived_at is null
      and (
        c.kind in ('general', 'libre')
        or (c.kind = 'pole' and public.can_see_pole(c.pole_id))
        or (c.kind = 'projet' and public.can_see_project(c.project_id))
        or (c.kind = 'evenement' and public.can_see_event(c.event_id))
        or public.is_bureau()
      )
  );
$$;

-- Tâches : le bureau voit tout ; un membre voit les tâches de ses équipes, les siennes, et celles où il est
-- collaborateur ou créateur.
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
        or exists (select 1 from public.task_collaborators tc where tc.task_id = id and tc.profile_id = auth.uid())
      )
    )
  );

-- Collaborateurs : visibles avec la tâche.
drop policy if exists task_collaborators_select on public.task_collaborators;
create policy task_collaborators_select on public.task_collaborators for select to authenticated
  using (
    public.is_bureau()
    or exists (select 1 from public.tasks t where t.id = task_id)
  );

-- Projets et événements.
drop policy if exists projects_select on public.projects;
create policy projects_select on public.projects for select to authenticated
  using (public.can_see_project(id));

drop policy if exists events_select on public.events;
create policy events_select on public.events for select to authenticated
  using (public.can_see_event(id));

-- Canaux et messages.
drop policy if exists channels_select on public.channels;
create policy channels_select on public.channels for select to authenticated
  using (public.is_active_member() and public.can_see_channel(id));

drop policy if exists messages_select on public.messages;
create policy messages_select on public.messages for select to authenticated
  using (public.is_active_member() and public.can_see_channel(channel_id));

drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages for insert to authenticated
  with check (author_id = auth.uid() and public.is_active_member() and public.can_see_channel(channel_id));

-- Journal d'activité : bureau seulement (il contient les actions de toutes les équipes).
drop policy if exists activity_log_select on public.activity_log;
create policy activity_log_select on public.activity_log for select to authenticated
  using (public.is_bureau());
