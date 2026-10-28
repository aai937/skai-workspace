-- Fonctions d'autorisation utilisées par les politiques RLS et les triggers.
-- SECURITY DEFINER + search_path vide : elles ne peuvent pas être détournées par un search_path piégé.
-- Elles ne font que lire : la modification de données passe toujours par RLS ou par les triggers.

create or replace function public.is_active_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_active
  );
$$;

create or replace function public.is_bureau()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_active and p.role = 'bureau'
  );
$$;

create or replace function public.is_pole_responsable(p_pole_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.pole_memberships pm
    join public.profiles p on p.id = pm.profile_id
    where pm.profile_id = auth.uid()
      and pm.pole_id = p_pole_id
      and pm.role = 'responsable'
      and p.is_active
  );
$$;

create or replace function public.is_any_pole_responsable()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.pole_memberships pm
    join public.profiles p on p.id = pm.profile_id
    where pm.profile_id = auth.uid()
      and pm.role = 'responsable'
      and p.is_active
  );
$$;

create or replace function public.is_pole_member(p_pole_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.pole_memberships pm
    join public.profiles p on p.id = pm.profile_id
    where pm.profile_id = auth.uid()
      and pm.pole_id = p_pole_id
      and p.is_active
  );
$$;

-- Le bureau ou un responsable d'un pôle lié au projet peut gérer le projet.
create or replace function public.can_manage_project(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_bureau()
    or exists (
      select 1 from public.projects pr
      where pr.id = p_project_id and (pr.lead_id = auth.uid() or pr.created_by = auth.uid())
    )
    or exists (
      select 1
      from public.project_poles pp
      where pp.project_id = p_project_id
        and public.is_pole_responsable(pp.pole_id)
    );
$$;

create or replace function public.can_manage_event(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_bureau()
    or exists (
      select 1 from public.events e
      where e.id = p_event_id and (e.lead_id = auth.uid() or e.created_by = auth.uid())
    )
    or exists (
      select 1
      from public.event_poles ep
      where ep.event_id = p_event_id
        and public.is_pole_responsable(ep.pole_id)
    );
$$;

create or replace function public.can_manage_task(p_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_bureau()
    or exists (
      select 1 from public.tasks t
      where t.id = p_task_id and public.is_pole_responsable(t.pole_id)
    );
$$;

create or replace function public.can_read_document(p_document_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.documents d
    where d.id = p_document_id
      and d.archived_at is null
      and (
        public.is_bureau()
        or (d.visibility = 'membres' and public.is_active_member())
        or (d.visibility = 'pole' and public.is_pole_member(d.pole_id))
      )
  );
$$;

-- Vérifie qu'une cible de commentaire existe (intégrité d'une clé polymorphe).
create or replace function public.comment_target_exists(p_type public.comment_target, p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case p_type
    when 'task' then exists (select 1 from public.tasks where id = p_id)
    when 'project' then exists (select 1 from public.projects where id = p_id)
    when 'idea' then exists (select 1 from public.ideas where id = p_id)
    when 'event' then exists (select 1 from public.events where id = p_id)
  end;
$$;

-- Création de notifications : réservée aux fonctions de la base (pas d'INSERT direct pour les clients).
create or replace function public.notify(
  p_recipient uuid,
  p_kind text,
  p_title text,
  p_body text,
  p_link text,
  p_actor uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_recipient is null or p_recipient = p_actor then
    return;
  end if;
  insert into public.notifications (recipient_id, kind, title, body, link, actor_id)
  values (p_recipient, p_kind, left(p_title, 200), left(coalesce(p_body, ''), 500), p_link, p_actor);
end;
$$;
