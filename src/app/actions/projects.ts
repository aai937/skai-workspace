'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { requireSession } from '@/lib/auth';
import { canCreateProject, canManageProject } from '@/lib/domain/permissions';
import { milestoneSchema, projectInputSchema } from '@/lib/domain/schemas';
import { dbErrorMessage, fail, ok, zodFieldErrors, type ActionResult } from '@/lib/result';
import { createClient } from '@/lib/supabase/server';

async function loadProjectScope(projectId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('projects')
    .select('id, lead_id, created_by, project_poles(pole_id)')
    .eq('id', projectId)
    .maybeSingle();
  if (!data) {
    return null;
  }
  const row = data as unknown as { lead_id: string | null; created_by: string | null; project_poles: { pole_id: string }[] };
  return {
    supabase,
    scope: {
      leadId: row.lead_id,
      createdBy: row.created_by,
      poleIds: row.project_poles.map((p) => p.pole_id),
    },
  };
}

function projectFromForm(formData: FormData) {
  return {
    title: formData.get('title'),
    description: formData.get('description') ?? '',
    objectives: formData.get('objectives') ?? '',
    deliverables: formData.get('deliverables') ?? '',
    status: formData.get('status') ?? 'a_lancer',
    priority: formData.get('priority') ?? 'normale',
    leadId: formData.get('leadId') ?? '',
    poleIds: formData.getAll('poleIds'),
    startDate: formData.get('startDate') ?? '',
    dueDate: formData.get('dueDate') ?? '',
  };
}

// Création d'un projet, y compris transversal : plusieurs équipes, un responsable.
export async function createProjectAction(formData: FormData): Promise<ActionResult> {
  const session = await requireSession();
  if (!canCreateProject(session.viewer)) {
    return fail('Seul le bureau ou un responsable de équipe peut créer un projet.');
  }
  const parsed = projectInputSchema.safeParse(projectFromForm(formData));
  if (!parsed.success) {
    return fail('Vérifiez les champs du formulaire.', zodFieldErrors(parsed.error.issues));
  }
  const input = parsed.data;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('projects')
    .insert({
      title: input.title,
      description: input.description,
      objectives: input.objectives,
      deliverables: input.deliverables,
      status: input.status,
      priority: input.priority,
      lead_id: input.leadId,
      start_date: input.startDate,
      due_date: input.dueDate,
      created_by: session.viewer.id,
    })
    .select('id')
    .single();
  if (error || !data) {
    return fail(dbErrorMessage(error));
  }

  const { error: polesError } = await supabase
    .from('project_poles')
    .insert(input.poleIds.map((pole_id) => ({ project_id: data.id, pole_id })));
  if (polesError) {
    // Pas de projet sans équipe : on annule la création.
    await supabase.from('projects').delete().eq('id', data.id);
    return fail(dbErrorMessage(polesError));
  }

  revalidatePath('/projets');
  redirect(`/projets/${data.id}`);
}

export async function updateProjectAction(projectId: string, formData: FormData): Promise<ActionResult> {
  const session = await requireSession();
  const loaded = await loadProjectScope(projectId);
  if (!loaded) {
    return fail('Projet introuvable.');
  }
  if (!canManageProject(session.viewer, loaded.scope)) {
    return fail('Seul le bureau ou un responsable du projet peut le modifier.');
  }
  const parsed = projectInputSchema.safeParse(projectFromForm(formData));
  if (!parsed.success) {
    return fail('Vérifiez les champs du formulaire.', zodFieldErrors(parsed.error.issues));
  }
  const input = parsed.data;
  const { error } = await loaded.supabase
    .from('projects')
    .update({
      title: input.title,
      description: input.description,
      objectives: input.objectives,
      deliverables: input.deliverables,
      status: input.status,
      priority: input.priority,
      lead_id: input.leadId,
      start_date: input.startDate,
      due_date: input.dueDate,
    })
    .eq('id', projectId);
  if (error) {
    return fail(dbErrorMessage(error));
  }

  // Remplacement de l'ensemble des équipes impliqués.
  await loaded.supabase.from('project_poles').delete().eq('project_id', projectId);
  const { error: polesError } = await loaded.supabase
    .from('project_poles')
    .insert(input.poleIds.map((pole_id) => ({ project_id: projectId, pole_id })));
  if (polesError) {
    return fail(dbErrorMessage(polesError));
  }

  revalidatePath(`/projets/${projectId}`);
  revalidatePath('/projets');
  return ok(undefined, 'Projet mis à jour.');
}

export async function addProjectMemberAction(projectId: string, profileId: string): Promise<ActionResult> {
  const session = await requireSession();
  const ids = z.object({ projectId: z.uuid(), profileId: z.uuid() }).safeParse({ projectId, profileId });
  if (!ids.success) {
    return fail('Données invalides.');
  }
  const loaded = await loadProjectScope(projectId);
  if (!loaded || !canManageProject(session.viewer, loaded.scope)) {
    return fail('Seul le bureau ou un responsable du projet peut ajouter un membre.');
  }
  const { error } = await loaded.supabase.from('project_members').insert({ project_id: projectId, profile_id: profileId });
  if (error) {
    return fail(dbErrorMessage(error));
  }
  revalidatePath(`/projets/${projectId}`);
  return ok(undefined, 'Membre ajouté au projet.');
}

export async function removeProjectMemberAction(projectId: string, profileId: string): Promise<ActionResult> {
  const session = await requireSession();
  const loaded = await loadProjectScope(projectId);
  if (!loaded || !canManageProject(session.viewer, loaded.scope)) {
    return fail('Seul le bureau ou un responsable du projet peut retirer un membre.');
  }
  const { error } = await loaded.supabase.from('project_members').delete().eq('project_id', projectId).eq('profile_id', profileId);
  if (error) {
    return fail(dbErrorMessage(error));
  }
  revalidatePath(`/projets/${projectId}`);
  return ok(undefined);
}

export async function addMilestoneAction(formData: FormData): Promise<ActionResult> {
  const session = await requireSession();
  const parsed = milestoneSchema.safeParse({
    projectId: formData.get('projectId'),
    title: formData.get('title'),
    dueDate: formData.get('dueDate'),
  });
  if (!parsed.success) {
    return fail('Vérifiez le jalon : titre et date sont obligatoires.', zodFieldErrors(parsed.error.issues));
  }
  const loaded = await loadProjectScope(parsed.data.projectId);
  if (!loaded || !canManageProject(session.viewer, loaded.scope)) {
    return fail('Seul le bureau ou un responsable du projet peut ajouter un jalon.');
  }
  const { error } = await loaded.supabase.from('milestones').insert(parsed.data);
  if (error) {
    return fail(dbErrorMessage(error));
  }
  revalidatePath(`/projets/${parsed.data.projectId}`);
  return ok(undefined, 'Jalon ajouté.');
}

export async function toggleMilestoneAction(milestoneId: string, projectId: string, done: boolean): Promise<ActionResult> {
  const session = await requireSession();
  const loaded = await loadProjectScope(projectId);
  if (!loaded || !canManageProject(session.viewer, loaded.scope)) {
    return fail('Seul le bureau ou un responsable du projet peut valider un jalon.');
  }
  const { error } = await loaded.supabase
    .from('milestones')
    .update({ completed_at: done ? new Date().toISOString() : null })
    .eq('id', milestoneId)
    .eq('project_id', projectId);
  if (error) {
    return fail(dbErrorMessage(error));
  }
  revalidatePath(`/projets/${projectId}`);
  return ok(undefined);
}

export async function archiveProjectAction(projectId: string): Promise<ActionResult> {
  const session = await requireSession();
  const loaded = await loadProjectScope(projectId);
  if (!loaded || !canManageProject(session.viewer, loaded.scope)) {
    return fail('Seul le bureau ou un responsable du projet peut l\'archiver.');
  }
  const { error } = await loaded.supabase
    .from('projects')
    .update({ archived_at: new Date().toISOString(), status: 'archive' })
    .eq('id', projectId);
  if (error) {
    return fail(dbErrorMessage(error));
  }
  revalidatePath('/projets');
  return ok(undefined, 'Projet archivé.');
}
