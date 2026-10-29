'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireSession } from '@/lib/auth';
import { dbErrorMessage, fail, ok, zodFieldErrors, type ActionResult } from '@/lib/result';
import { createClient } from '@/lib/supabase/server';
import { canCreateTask, canDeleteTask, canManageTask, canUpdateTaskProgress } from '@/lib/domain/permissions';
import { taskInputSchema, taskProgressSchema } from '@/lib/domain/schemas';
import { CHECKLIST_CATEGORIES, TASK_PRIORITIES, type TaskStatus } from '@/lib/domain/constants';
import { z } from 'zod';

function taskFromForm(formData: FormData) {
  return {
    title: formData.get('title'),
    description: formData.get('description') ?? '',
    poleId: formData.get('poleId'),
    projectId: formData.get('projectId') ?? '',
    eventId: formData.get('eventId') ?? '',
    assigneeId: formData.get('assigneeId') ?? '',
    priority: formData.get('priority') ?? 'normale',
    status: formData.get('status') ?? 'a_faire',
    dueDate: formData.get('dueDate') ?? '',
    labels: formData.get('labels') ?? '',
    blockedReason: formData.get('blockedReason') ?? '',
    checklistCategory: formData.get('checklistCategory') || null,
    parentId: formData.get('parentId') || null,
  };
}

// Champs que la base accepte, à partir du formulaire validé.
function toRow(input: z.infer<typeof taskInputSchema>) {
  return {
    title: input.title,
    description: input.description,
    pole_id: input.poleId,
    project_id: input.projectId,
    event_id: input.eventId,
    assignee_id: input.assigneeId,
    priority: input.priority,
    status: input.status,
    due_date: input.dueDate,
    labels: input.labels,
    blocked_reason: input.status === 'bloquee' ? input.blockedReason : null,
    checklist_category: input.checklistCategory,
  };
}

export async function createTaskAction(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const session = await requireSession();
  const parsed = taskInputSchema.safeParse(taskFromForm(formData));
  if (!parsed.success) {
    return fail('Vérifiez les champs du formulaire.', zodFieldErrors(parsed.error.issues));
  }
  if (!canCreateTask(session.viewer)) {
    return fail("Seul le bureau ou un responsable de l’équipe peut créer une tâche dans cette équipe.");
  }

  const parentId = z.uuid().nullable().safeParse(formData.get('parentId') || null);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('tasks')
    .insert({ ...toRow(parsed.data), creator_id: session.viewer.id, parent_id: parentId.success ? parentId.data : null })
    .select('id')
    .single();
  if (error || !data) {
    return fail(dbErrorMessage(error));
  }

  revalidatePath('/taches');
  revalidatePath('/tableau-de-bord');
  redirect(`/taches/${data.id}`);
}

// Mise à jour complète d'une tâche (gestionnaires) : titre, attribution, échéance, etc.
export async function updateTaskAction(taskId: string, formData: FormData): Promise<ActionResult> {
  const session = await requireSession();
  const parsed = taskInputSchema.safeParse(taskFromForm(formData));
  if (!parsed.success) {
    return fail('Vérifiez les champs du formulaire.', zodFieldErrors(parsed.error.issues));
  }

  const supabase = await createClient();
  const { data: current } = await supabase.from('tasks').select('pole_id, creator_id, assignee_id').eq('id', taskId).maybeSingle();
  if (!current) {
    return fail('Tâche introuvable.');
  }
  const task = { poleId: current.pole_id as string, creatorId: current.creator_id as string | null, assigneeId: current.assignee_id as string | null };
  if (!canManageTask(session.viewer, task)) {
    return fail("Seul le bureau ou un responsable de l’équipe peut modifier cette tâche.");
  }

  const { error } = await supabase.from('tasks').update(toRow(parsed.data)).eq('id', taskId);
  if (error) {
    return fail(dbErrorMessage(error));
  }
  revalidatePath(`/taches/${taskId}`);
  revalidatePath('/taches');
  revalidatePath('/tableau-de-bord');
  return ok(undefined, 'Tâche mise à jour.');
}

// Avancement : statut et blocage. Possible pour le gestionnaire et pour l'assigné.
export async function updateTaskProgressAction(taskId: string, formData: FormData): Promise<ActionResult> {
  const session = await requireSession();
  const parsed = taskProgressSchema.safeParse({
    taskId,
    status: formData.get('status'),
    blockedReason: formData.get('blockedReason') ?? '',
  });
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? 'Données invalides.');
  }

  const supabase = await createClient();
  const { data: current } = await supabase.from('tasks').select('pole_id, creator_id, assignee_id').eq('id', parsed.data.taskId).maybeSingle();
  if (!current) {
    return fail('Tâche introuvable.');
  }
  const task = { poleId: current.pole_id as string, creatorId: current.creator_id as string | null, assigneeId: current.assignee_id as string | null };
  if (!canUpdateTaskProgress(session.viewer, task)) {
    return fail("Vous ne pouvez pas modifier l'avancement de cette tâche.");
  }

  const { error } = await supabase
    .from('tasks')
    .update({
      status: parsed.data.status as TaskStatus,
      blocked_reason: parsed.data.status === 'bloquee' ? parsed.data.blockedReason : null,
    })
    .eq('id', parsed.data.taskId);
  if (error) {
    return fail(dbErrorMessage(error));
  }

  revalidatePath(`/taches/${parsed.data.taskId}`);
  revalidatePath('/taches');
  revalidatePath('/tableau-de-bord');
  return ok(undefined, 'Avancement enregistré.');
}

// Case « terminé » d’un élément de checklist, sans formulaire.
export async function setTaskDoneAction(taskId: string, done: boolean): Promise<ActionResult> {
  const session = await requireSession();
  const parsed = z.uuid().safeParse(taskId);
  if (!parsed.success) {
    return fail('Tâche introuvable.');
  }
  const supabase = await createClient();
  const { data: current } = await supabase.from('tasks').select('pole_id, creator_id, assignee_id').eq('id', taskId).maybeSingle();
  if (!current) {
    return fail('Tâche introuvable.');
  }
  const task = { poleId: current.pole_id as string, creatorId: current.creator_id as string | null, assigneeId: current.assignee_id as string | null };
  if (!canUpdateTaskProgress(session.viewer, task)) {
    return fail("Vous ne pouvez pas modifier l’avancement de cette tâche.");
  }
  const { error } = await supabase.from('tasks').update({ status: done ? 'terminee' : 'a_faire', blocked_reason: null }).eq('id', taskId);
  if (error) {
    return fail(dbErrorMessage(error));
  }
  revalidatePath('/evenements', 'page');
  revalidatePath('/taches');
  return ok(undefined);
}

export async function archiveTaskAction(taskId: string): Promise<ActionResult> {
  const session = await requireSession();
  const supabase = await createClient();
  const { data: current } = await supabase.from('tasks').select('pole_id, creator_id, assignee_id').eq('id', taskId).maybeSingle();
  if (!current) {
    return fail('Tâche introuvable.');
  }
  const task = { poleId: current.pole_id as string, creatorId: current.creator_id as string | null, assigneeId: current.assignee_id as string | null };
  if (!canManageTask(session.viewer, task)) {
    return fail("Seul le bureau ou un responsable de l’équipe peut archiver cette tâche.");
  }
  const { error } = await supabase.from('tasks').update({ archived_at: new Date().toISOString() }).eq('id', taskId);
  if (error) {
    return fail(dbErrorMessage(error));
  }
  revalidatePath('/taches');
  revalidatePath('/tableau-de-bord');
  return ok(undefined, 'Tâche archivée.');
}

// Suppression définitive : bureau seulement, après confirmation dans l'interface.
export async function deleteTaskAction(taskId: string): Promise<ActionResult> {
  const session = await requireSession();
  if (!canDeleteTask(session.viewer)) {
    return fail('Seul le bureau peut supprimer définitivement une tâche.');
  }
  const supabase = await createClient();
  const { error } = await supabase.from('tasks').delete().eq('id', taskId);
  if (error) {
    return fail(dbErrorMessage(error));
  }
  revalidatePath('/taches');
  redirect('/taches');
}

export async function toggleCollaboratorAction(taskId: string, profileId: string, add: boolean): Promise<ActionResult> {
  await requireSession();
  const parsed = z.object({ taskId: z.uuid(), profileId: z.uuid() }).safeParse({ taskId, profileId });
  if (!parsed.success) {
    return fail('Données invalides.');
  }
  const supabase = await createClient();
  const query = add
    ? supabase.from('task_collaborators').insert({ task_id: taskId, profile_id: profileId })
    : supabase.from('task_collaborators').delete().eq('task_id', taskId).eq('profile_id', profileId);
  const { error } = await query;
  if (error) {
    return fail(dbErrorMessage(error));
  }
  revalidatePath(`/taches/${taskId}`);
  return ok(undefined);
}

// Élément de checklist logistique : une tâche liée à l'événement (aucun doublon).
export async function createChecklistItemAction(formData: FormData): Promise<ActionResult> {
  const session = await requireSession();
  const eventId = z.uuid().safeParse(formData.get('eventId'));
  const category = z.enum(CHECKLIST_CATEGORIES).safeParse(formData.get('checklistCategory'));
  const poleId = z.uuid().safeParse(formData.get('poleId'));
  if (!eventId.success || !category.success || !poleId.success) {
    return fail('Choisissez la catégorie et l’équipe de l\'élément.');
  }
  const parsed = taskInputSchema.safeParse({
    ...taskFromForm(formData),
    title: formData.get('title'),
    poleId: poleId.data,
    eventId: eventId.data,
    checklistCategory: category.data,
    status: 'a_faire',
    priority: TASK_PRIORITIES.includes(formData.get('priority') as (typeof TASK_PRIORITIES)[number]) ? formData.get('priority') : 'normale',
  });
  if (!parsed.success) {
    return fail('Vérifiez les champs du formulaire.', zodFieldErrors(parsed.error.issues));
  }
  if (!canCreateTask(session.viewer)) {
    return fail('Seul le bureau ou un responsable de l’équipe peut ajouter un élément à la checklist.');
  }
  const supabase = await createClient();
  const { error } = await supabase.from('tasks').insert({ ...toRow(parsed.data), creator_id: session.viewer.id });
  if (error) {
    return fail(dbErrorMessage(error));
  }
  revalidatePath(`/evenements/${eventId.data}`);
  revalidatePath('/taches');
  return ok(undefined, 'Élément ajouté.');
}

// Transmission d'une tâche par son titulaire à un autre membre actif.
export async function transferTaskAction(taskId: string, formData: FormData): Promise<ActionResult> {
  await requireSession();
  const ids = z.object({ taskId: z.uuid(), to: z.uuid('Choisissez un membre.') }).safeParse({
    taskId,
    to: formData.get('assigneeId'),
  });
  if (!ids.success) {
    return fail(ids.error.issues[0]?.message ?? 'Données invalides.');
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc('transfer_task', { p_task_id: ids.data.taskId, p_to: ids.data.to });
  if (error) {
    return fail(dbErrorMessage(error));
  }
  revalidatePath(`/taches/${ids.data.taskId}`);
  revalidatePath('/taches');
  revalidatePath('/tableau-de-bord');
  return ok(undefined, 'Tâche transmise. Le nouveau titulaire est prévenu.');
}
