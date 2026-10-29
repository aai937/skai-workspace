'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { requireSession } from '@/lib/auth';
import { canCreateEvent, canDeleteEvent, canManageEvent } from '@/lib/domain/permissions';
import { eventGuestSchema, eventInputSchema } from '@/lib/domain/schemas';
import { parisLocalToIso } from '@/lib/domain/format';
import { dbErrorMessage, fail, ok, zodFieldErrors, type ActionResult } from '@/lib/result';
import { createClient } from '@/lib/supabase/server';

function eventFromForm(formData: FormData) {
  return {
    title: formData.get('title'),
    description: formData.get('description') ?? '',
    startsAt: formData.get('startsAt'),
    endsAt: formData.get('endsAt') ?? '',
    location: formData.get('location') ?? '',
    leadId: formData.get('leadId') ?? '',
    poleIds: formData.getAll('poleIds'),
    status: formData.get('status') ?? 'preparation',
    budgetEuros: formData.get('budgetEuros') ?? '',
    logisticsNotes: formData.get('logisticsNotes') ?? '',
  };
}

async function loadEventScope(eventId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('events')
    .select('id, lead_id, created_by, event_poles(pole_id)')
    .eq('id', eventId)
    .maybeSingle();
  if (!data) {
    return null;
  }
  const row = data as unknown as { lead_id: string | null; created_by: string | null; event_poles: { pole_id: string }[] };
  return {
    supabase,
    scope: { leadId: row.lead_id, createdBy: row.created_by, poleIds: row.event_poles.map((p) => p.pole_id) },
  };
}

export async function createEventAction(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const session = await requireSession();
  if (!canCreateEvent(session.viewer)) {
    return fail('Seul le bureau ou un responsable d’équipe peut créer un événement.');
  }
  const parsed = eventInputSchema.safeParse(eventFromForm(formData));
  if (!parsed.success) {
    return fail('Vérifiez les champs du formulaire.', zodFieldErrors(parsed.error.issues));
  }
  const input = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('events')
    .insert({
      title: input.title,
      description: input.description,
      starts_at: parisLocalToIso(input.startsAt),
      ends_at: input.endsAt ? parisLocalToIso(input.endsAt) : null,
      location: input.location,
      lead_id: input.leadId,
      status: input.status,
      budget_cents: input.budgetEuros === null ? null : Math.round(input.budgetEuros * 100),
      logistics_notes: input.logisticsNotes,
      created_by: session.viewer.id,
    })
    .select('id')
    .single();
  if (error || !data) {
    return fail(dbErrorMessage(error));
  }
  const { error: polesError } = await supabase
    .from('event_poles')
    .insert(input.poleIds.map((pole_id) => ({ event_id: data.id, pole_id })));
  if (polesError) {
    await supabase.from('events').delete().eq('id', data.id);
    return fail(dbErrorMessage(polesError));
  }
  revalidatePath('/evenements');
  redirect(`/evenements/${data.id}`);
}

export async function updateEventAction(eventId: string, formData: FormData): Promise<ActionResult> {
  const session = await requireSession();
  const loaded = await loadEventScope(eventId);
  if (!loaded || !canManageEvent(session.viewer, loaded.scope)) {
    return fail('Seul le bureau ou un responsable de l\'événement peut le modifier.');
  }
  const parsed = eventInputSchema.safeParse(eventFromForm(formData));
  if (!parsed.success) {
    return fail('Vérifiez les champs du formulaire.', zodFieldErrors(parsed.error.issues));
  }
  const input = parsed.data;
  const { error } = await loaded.supabase
    .from('events')
    .update({
      title: input.title,
      description: input.description,
      starts_at: parisLocalToIso(input.startsAt),
      ends_at: input.endsAt ? parisLocalToIso(input.endsAt) : null,
      location: input.location,
      lead_id: input.leadId,
      status: input.status,
      budget_cents: input.budgetEuros === null ? null : Math.round(input.budgetEuros * 100),
      logistics_notes: input.logisticsNotes,
    })
    .eq('id', eventId);
  if (error) {
    return fail(dbErrorMessage(error));
  }
  await loaded.supabase.from('event_poles').delete().eq('event_id', eventId);
  const { error: polesError } = await loaded.supabase
    .from('event_poles')
    .insert(input.poleIds.map((pole_id) => ({ event_id: eventId, pole_id })));
  if (polesError) {
    return fail(dbErrorMessage(polesError));
  }
  revalidatePath(`/evenements/${eventId}`);
  revalidatePath('/evenements');
  return ok(undefined, 'Événement mis à jour.');
}

export async function addEventGuestAction(formData: FormData): Promise<ActionResult> {
  const session = await requireSession();
  const parsed = eventGuestSchema.safeParse({
    eventId: formData.get('eventId'),
    kind: formData.get('kind'),
    name: formData.get('name'),
    organization: formData.get('organization') ?? '',
  });
  if (!parsed.success) {
    return fail('Nom et type (intervenant ou partenaire) sont obligatoires.', zodFieldErrors(parsed.error.issues));
  }
  const loaded = await loadEventScope(parsed.data.eventId);
  if (!loaded || !canManageEvent(session.viewer, loaded.scope)) {
    return fail('Seul le bureau ou un responsable de l\'événement peut ajouter un intervenant ou un partenaire.');
  }
  const { error } = await loaded.supabase.from('event_guests').insert(parsed.data);
  if (error) {
    return fail(dbErrorMessage(error));
  }
  revalidatePath(`/evenements/${parsed.data.eventId}`);
  return ok(undefined, 'Ajouté.');
}

export async function deleteEventGuestAction(guestId: string, eventId: string): Promise<ActionResult> {
  const session = await requireSession();
  const ids = z.object({ guestId: z.uuid(), eventId: z.uuid() }).safeParse({ guestId, eventId });
  if (!ids.success) {
    return fail('Données invalides.');
  }
  const loaded = await loadEventScope(eventId);
  if (!loaded || !canManageEvent(session.viewer, loaded.scope)) {
    return fail('Action non autorisée.');
  }
  const { error } = await loaded.supabase.from('event_guests').delete().eq('id', guestId).eq('event_id', eventId);
  if (error) {
    return fail(dbErrorMessage(error));
  }
  revalidatePath(`/evenements/${eventId}`);
  return ok(undefined);
}

export async function deleteEventAction(eventId: string): Promise<ActionResult> {
  const session = await requireSession();
  if (!canDeleteEvent(session.viewer)) {
    return fail('Seul le bureau peut supprimer un événement. Vous pouvez l\'annuler à la place.');
  }
  const supabase = await createClient();
  const { error } = await supabase.from('events').delete().eq('id', eventId);
  if (error) {
    return fail(dbErrorMessage(error));
  }
  revalidatePath('/evenements');
  redirect('/evenements');
}
