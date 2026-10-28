-- Transmission d'une tâche : son titulaire actuel la confie à un autre membre actif.
-- Le titulaire ne peut changer que l'assigné, le statut et le motif de blocage ; le reste reste réservé au bureau.

create or replace function public.tasks_before_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_manager boolean;
  v_holder boolean;
begin
  new.updated_at := now();

  if new.status = 'terminee' and old.status is distinct from 'terminee' then
    new.completed_at := now();
  elsif new.status <> 'terminee' then
    new.completed_at := null;
  end if;

  if auth.uid() is null then
    return new;
  end if;

  v_manager := public.is_bureau();
  v_holder := old.assignee_id is not distinct from auth.uid();

  if not v_manager then
    if new.title is distinct from old.title
      or new.description is distinct from old.description
      or new.priority is distinct from old.priority
      or new.pole_id is distinct from old.pole_id
      or new.project_id is distinct from old.project_id
      or new.event_id is distinct from old.event_id
      or new.parent_id is distinct from old.parent_id
      or new.creator_id is distinct from old.creator_id
      or new.due_date is distinct from old.due_date
      or new.labels is distinct from old.labels
      or new.checklist_category is distinct from old.checklist_category
      or new.archived_at is distinct from old.archived_at then
      raise exception 'Vous pouvez seulement mettre à jour le statut, le blocage ou transmettre la tâche'
        using errcode = '42501';
    end if;
    -- Seul le titulaire actuel peut changer l'assigné, et uniquement vers un membre actif.
    if new.assignee_id is distinct from old.assignee_id then
      if not v_holder then
        raise exception 'Seul le titulaire de la tâche peut la transmettre' using errcode = '42501';
      end if;
      if new.assignee_id is not null and not exists (
        select 1 from public.profiles p where p.id = new.assignee_id and p.is_active
      ) then
        raise exception 'La tâche ne peut être transmise qu’à un membre actif' using errcode = '42501';
      end if;
    end if;
  end if;

  return new;
end;
$$;

-- Transmission : la fonction vérifie les droits ; elle ne passe pas par les règles de visibilité.
create or replace function public.transfer_task(p_task_id uuid, p_to uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Connexion requise' using errcode = '42501';
  end if;
  update public.tasks
  set assignee_id = p_to
  where id = p_task_id
    and archived_at is null
    and (assignee_id = auth.uid() or public.is_bureau());
  if not found then
    raise exception 'Tâche introuvable ou transmission non autorisée' using errcode = '42501';
  end if;
end;
$$;

grant execute on function public.transfer_task(uuid, uuid) to authenticated;
