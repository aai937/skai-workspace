'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { requireSession } from '@/lib/auth';
import { canDecideIdea, canEditIdea, canVoteIdea, canCreateTask } from '@/lib/domain/permissions';
import { ideaDecisionSchema, ideaInputSchema, projectInputSchema } from '@/lib/domain/schemas';
import { dbErrorMessage, fail, ok, zodFieldErrors, type ActionResult } from '@/lib/result';
import { createClient } from '@/lib/supabase/server';

function ideaFromForm(formData: FormData) {
  return {
    title: formData.get('title'),
    problem: formData.get('problem'),
    solution: formData.get('solution'),
    benefits: formData.get('benefits') ?? '',
    poleId: formData.get('poleId') ?? '',
    effort: formData.get('effort') ?? 'moyen',
  };
}

export async function submitIdeaAction(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const session = await requireSession();
  const parsed = ideaInputSchema.safeParse(ideaFromForm(formData));
  if (!parsed.success) {
    return fail('Vérifiez les champs du formulaire.', zodFieldErrors(parsed.error.issues));
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('ideas')
    .insert({
      title: parsed.data.title,
      problem: parsed.data.problem,
      solution: parsed.data.solution,
      benefits: parsed.data.benefits,
      pole_id: parsed.data.poleId,
      effort: parsed.data.effort,
      author_id: session.viewer.id,
    })
    .select('id')
    .single();
  if (error || !data) {
    return fail(dbErrorMessage(error));
  }
  revalidatePath('/idees');
  redirect(`/idees/${data.id}`);
}

export async function updateIdeaAction(ideaId: string, formData: FormData): Promise<ActionResult> {
  const session = await requireSession();
  const supabase = await createClient();
  const { data: current } = await supabase.from('ideas').select('author_id, status').eq('id', ideaId).maybeSingle();
  if (!current) {
    return fail('Idée introuvable.');
  }
  if (!canEditIdea(session.viewer, { authorId: current.author_id, status: current.status })) {
    return fail("Vous ne pouvez modifier cette idée qu'avant qu'elle ne soit examinée.");
  }
  const parsed = ideaInputSchema.safeParse(ideaFromForm(formData));
  if (!parsed.success) {
    return fail('Vérifiez les champs du formulaire.', zodFieldErrors(parsed.error.issues));
  }
  const { error } = await supabase
    .from('ideas')
    .update({
      title: parsed.data.title,
      problem: parsed.data.problem,
      solution: parsed.data.solution,
      benefits: parsed.data.benefits,
      pole_id: parsed.data.poleId,
      effort: parsed.data.effort,
    })
    .eq('id', ideaId);
  if (error) {
    return fail(dbErrorMessage(error));
  }
  revalidatePath(`/idees/${ideaId}`);
  return ok(undefined, 'Idée mise à jour.');
}

// Vote : un seul par membre et par idée (clé primaire en base).
export async function toggleVoteAction(ideaId: string, vote: boolean): Promise<ActionResult> {
  const session = await requireSession();
  const parsedId = z.uuid().safeParse(ideaId);
  if (!parsedId.success) {
    return fail('Idée introuvable.');
  }
  const supabase = await createClient();
  const { data: idea } = await supabase.from('ideas').select('status, author_id').eq('id', ideaId).maybeSingle();
  if (!idea) {
    return fail('Idée introuvable.');
  }
  if (vote && !canVoteIdea({ status: idea.status })) {
    return fail('Cette idée n\'accepte plus de votes.');
  }
  const query = vote
    ? supabase.from('idea_votes').insert({ idea_id: ideaId, voter_id: session.viewer.id })
    : supabase.from('idea_votes').delete().eq('idea_id', ideaId).eq('voter_id', session.viewer.id);
  const { error } = await query;
  if (error && error.code !== '23505') {
    return fail(dbErrorMessage(error));
  }
  revalidatePath(`/idees/${ideaId}`);
  revalidatePath('/idees');
  return ok(undefined);
}

// Décision du bureau : statut et explication obligatoire pour approuver ou refuser.
export async function decideIdeaAction(formData: FormData): Promise<ActionResult> {
  const session = await requireSession();
  if (!canDecideIdea(session.viewer)) {
    return fail('Seul le bureau décide du sort d\'une idée.');
  }
  const parsed = ideaDecisionSchema.safeParse({
    ideaId: formData.get('ideaId'),
    status: formData.get('status'),
    decisionNote: formData.get('decisionNote') ?? '',
  });
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? 'Données invalides.', zodFieldErrors(parsed.error.issues));
  }
  if (parsed.data.status === 'convertie') {
    return fail('Utilisez « Convertir en projet » ou « Convertir en tâche ».');
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from('ideas')
    .update({ status: parsed.data.status, decision_note: parsed.data.decisionNote })
    .eq('id', parsed.data.ideaId);
  if (error) {
    return fail(dbErrorMessage(error));
  }
  revalidatePath(`/idees/${parsed.data.ideaId}`);
  revalidatePath('/idees');
  revalidatePath('/tableau-de-bord');
  return ok(undefined, 'Décision enregistrée.');
}

// Transforme une idée approuvée en projet, en conservant son contenu, son auteur et son historique.
export async function convertIdeaToProjectAction(ideaId: string): Promise<ActionResult> {
  const session = await requireSession();
  if (!canDecideIdea(session.viewer)) {
    return fail('Seul le bureau peut convertir une idée.');
  }
  const supabase = await createClient();
  const { data: idea } = await supabase
    .from('ideas')
    .select('id, title, problem, solution, benefits, pole_id, author_id, status')
    .eq('id', ideaId)
    .maybeSingle();
  if (!idea || idea.status !== 'approuvee') {
    return fail('Seule une idée approuvée peut devenir un projet.');
  }

  const description = `Problème identifié :\n${idea.problem}\n\nSolution proposée :\n${idea.solution}`;
  const objectives = idea.benefits || 'À définir avec le responsable du projet.';
  const poleIds = idea.pole_id ? [idea.pole_id] : [];
  const parsed = projectInputSchema.safeParse({
    title: idea.title,
    description,
    objectives,
    deliverables: '',
    status: 'a_lancer',
    priority: 'normale',
    leadId: idea.author_id ?? '',
    poleIds,
    startDate: '',
    dueDate: '',
  });
  if (!parsed.success) {
    return fail('Cette idée doit d\'abord être rattachée à une équipe avant sa conversion.');
  }

  const { data: project, error } = await supabase
    .from('projects')
    .insert({
      title: idea.title,
      description,
      objectives,
      status: 'a_lancer',
      lead_id: idea.author_id,
      created_by: session.viewer.id,
    })
    .select('id')
    .single();
  if (error || !project) {
    return fail(dbErrorMessage(error));
  }
  await supabase.from('project_poles').insert(poleIds.map((pole_id) => ({ project_id: project.id, pole_id })));

  const { error: ideaError } = await supabase
    .from('ideas')
    .update({ status: 'convertie', project_id: project.id, decision_note: `Convertie en projet le ${new Date().toLocaleDateString('fr-FR')}.` })
    .eq('id', ideaId);
  if (ideaError) {
    await supabase.from('projects').delete().eq('id', project.id);
    return fail(dbErrorMessage(ideaError));
  }

  revalidatePath('/idees');
  revalidatePath('/projets');
  redirect(`/projets/${project.id}`);
}

// Transforme une idée approuvée en tâche dans l’équipe concerné.
export async function convertIdeaToTaskAction(ideaId: string): Promise<ActionResult> {
  const session = await requireSession();
  const supabase = await createClient();
  const { data: idea } = await supabase
    .from('ideas')
    .select('id, title, problem, solution, pole_id, status')
    .eq('id', ideaId)
    .maybeSingle();
  if (!idea || idea.status !== 'approuvee' || !idea.pole_id) {
    return fail('Seule une idée approuvée et rattachée à une équipe peut devenir une tâche.');
  }
  if (!canCreateTask(session.viewer)) {
    return fail('Seul le bureau ou un responsable de l’équipe peut créer cette tâche.');
  }
  const { data: task, error } = await supabase
    .from('tasks')
    .insert({
      title: idea.title,
      description: `Issue de l'idée « ${idea.title} ».\n\n${idea.problem}\n\n${idea.solution}`,
      pole_id: idea.pole_id,
      creator_id: session.viewer.id,
      labels: ['idee'],
    })
    .select('id')
    .single();
  if (error || !task) {
    return fail(dbErrorMessage(error));
  }
  const { error: ideaError } = await supabase
    .from('ideas')
    .update({ status: 'convertie', task_id: task.id })
    .eq('id', ideaId);
  if (ideaError) {
    await supabase.from('tasks').delete().eq('id', task.id);
    return fail(dbErrorMessage(ideaError));
  }
  revalidatePath('/idees');
  revalidatePath('/taches');
  redirect(`/taches/${task.id}`);
}
