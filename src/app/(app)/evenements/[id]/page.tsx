import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { addEventGuestAction, deleteEventAction, deleteEventGuestAction, updateEventAction } from '@/app/actions/events';
import { createChecklistItemAction, setTaskDoneAction } from '@/app/actions/tasks';
import { CommentsSection } from '@/components/CommentsSection';
import { ActionButton, ActionForm, ConfirmButton, SelectField, SubmitButton, TextAreaField, TextField } from '@/components/forms';
import { Badge, Card, CardTitle, LateBadge, PageHeader, ProgressBar, TaskStatusBadge } from '@/components/ui';
import { requireSession } from '@/lib/auth';
import { getEvent } from '@/lib/data/events';
import { getFormOptions } from '@/lib/data/options';
import { CHECKLIST_CATEGORIES, EVENT_STATUSES, LABELS } from '@/lib/domain/constants';
import { centsToEuros, formatDateTime } from '@/lib/domain/format';
import { canDeleteEvent, canManageEvent } from '@/lib/domain/permissions';
import { isLate } from '@/lib/data/tasks';

export const metadata: Metadata = { title: 'Événement' };

// Fuseau de Paris pour pré-remplir les champs datetime-local.
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(iso));
  return parts.replace(' ', 'T');
}

export default async function EvenementDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;
  const event = await getEvent(id);
  if (!event) {
    notFound();
  }
  const options = await getFormOptions();
  const canManage = canManageEvent(session.viewer, {
    leadId: event.lead?.id ?? null,
    createdBy: null,
    poleIds: event.event_poles.map((p) => p.pole.id),
  });

  return (
    <>
      <nav className="mb-3 text-sm text-[var(--c-ink-faint)]">
        <Link href="/evenements" className="hover:underline">Événements</Link>
      </nav>
      <PageHeader
        title={event.title}
        description={`${formatDateTime(event.starts_at)}${event.location ? ` · ${event.location}` : ''}${event.lead ? ` · Responsable : ${event.lead.full_name}` : ''}`}
        actions={<Badge tone="accent">{LABELS.eventStatus[event.status]}</Badge>}
      />

      <Card className="mb-6">
        <CardTitle>Préparation</CardTitle>
        <ProgressBar value={event.checklistProgress} label="Avancement de la préparation" />
        <p className="mt-2 text-xs text-[var(--c-ink-faint)]">
          {event.checklist.filter((c) => c.status === 'terminee').length} élément(s) terminé(s) sur {event.checklist.length} · budget {centsToEuros(event.budget_cents)}
        </p>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card>
            <CardTitle>Checklist logistique</CardTitle>
            {event.checklist.length === 0 ? (
              <p className="mb-4 text-sm text-[var(--c-ink-faint)]">Aucun élément. Ajoutez la réservation de salle, le matériel, la communication…</p>
            ) : (
              <ul className="divide-y divide-[var(--c-line)]">
                {event.checklist.map((item) => (
                  <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                    <div className="min-w-0">
                      <Link href={`/taches/${item.id}`} className="font-medium hover:underline">{item.title}</Link>
                      <p className="text-xs text-[var(--c-ink-faint)]">
                        {item.checklist_category ? LABELS.checklist[item.checklist_category] : ''}
                        {item.assignee ? ` · ${item.assignee.full_name}` : ' · Non attribuée'}
                        {item.due_date ? ` · échéance ${item.due_date}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {isLate(item) ? <LateBadge /> : null}
                      <TaskStatusBadge status={item.status} />
                      {item.assignee?.id === session.viewer.id || canManage ? (
                        <ActionButton
                          action={setTaskDoneAction.bind(null, item.id, item.status !== 'terminee')}
                        >
                          {item.status === 'terminee' ? 'Rouvrir' : 'Marquer terminé'}
                        </ActionButton>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {canManage ? (
              <details className="mt-5">
                <summary className="cursor-pointer text-sm text-[var(--c-accent)]">Ajouter un élément de checklist</summary>
                <ActionForm action={createChecklistItemAction} resetOnSuccess className="mt-4 grid gap-3 md:grid-cols-2">
                  <input type="hidden" name="eventId" value={event.id} />
                  <SelectField
                    name="checklistCategory"
                    label="Catégorie"
                    options={CHECKLIST_CATEGORIES.map((c) => ({ value: c, label: LABELS.checklist[c] }))}
                    required
                  />
                  <SelectField name="poleId" label="Pôle" options={options.poles.filter((p) => event.event_poles.some((ep) => ep.pole.id === p.value))} required />
                  <div className="md:col-span-2">
                    <TextField name="title" label="Intitulé" required minLength={2} maxLength={200} />
                  </div>
                  <SelectField name="assigneeId" label="Responsable" options={options.members} placeholder="Non attribuée" />
                  <TextField name="dueDate" label="Échéance" type="date" />
                  <div className="md:col-span-2">
                    <SubmitButton>Ajouter</SubmitButton>
                  </div>
                </ActionForm>
              </details>
            ) : null}
          </Card>

          <Card>
            <CardTitle>Intervenants et partenaires</CardTitle>
            {event.guests.length === 0 ? (
              <p className="text-sm text-[var(--c-ink-faint)]">Aucun intervenant ni partenaire renseigné.</p>
            ) : (
              <ul className="divide-y divide-[var(--c-line)]">
                {event.guests.map((g) => (
                  <li key={g.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                    <span>
                      <span className="font-medium">{g.name}</span>
                      <span className="text-[var(--c-ink-faint)]"> · {LABELS.eventGuestKind[g.kind]}{g.organization ? ` · ${g.organization}` : ''}</span>
                    </span>
                    {canManage ? <ActionButton action={deleteEventGuestAction.bind(null, g.id, event.id)}>Retirer</ActionButton> : null}
                  </li>
                ))}
              </ul>
            )}
            {canManage ? (
              <details className="mt-5">
                <summary className="cursor-pointer text-sm text-[var(--c-accent)]">Ajouter un intervenant ou un partenaire</summary>
                <ActionForm action={addEventGuestAction} resetOnSuccess className="mt-4 grid gap-3 md:grid-cols-2">
                  <input type="hidden" name="eventId" value={event.id} />
                  <SelectField
                    name="kind"
                    label="Type"
                    options={[
                      { value: 'intervenant', label: 'Intervenant' },
                      { value: 'partenaire', label: 'Partenaire' },
                    ]}
                    defaultValue="intervenant"
                  />
                  <TextField name="name" label="Nom" required minLength={2} />
                  <TextField name="organization" label="Organisation" />
                  <div className="md:col-span-2">
                    <SubmitButton>Ajouter</SubmitButton>
                  </div>
                </ActionForm>
              </details>
            ) : null}
          </Card>

          <CommentsSection
            targetType="event"
            targetId={event.id}
            comments={event.comments}
            members={options.memberRows}
            viewerId={session.viewer.id}
            isBureau={session.viewer.isBureau}
          />
        </div>

        <aside className="flex flex-col gap-6">
          <Card>
            <CardTitle>Description</CardTitle>
            <p className="whitespace-pre-wrap text-sm text-[var(--c-ink-soft)]">{event.description || 'Aucune description.'}</p>
            <p className="mt-4 text-sm"><span className="text-xs text-[var(--c-ink-faint)]">Pôles :</span> {event.event_poles.map((p) => p.pole.name).join(' · ') || '—'}</p>
            {event.logistics_notes ? (
              <div className="mt-4">
                <p className="text-xs text-[var(--c-ink-faint)]">Notes logistiques</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--c-ink-soft)]">{event.logistics_notes}</p>
              </div>
            ) : null}
          </Card>

          {canManage ? (
            <Card>
              <CardTitle>Modifier l’événement</CardTitle>
              <ActionForm action={updateEventAction.bind(null, event.id)} className="grid gap-3">
                <TextField name="title" label="Nom" required minLength={2} defaultValue={event.title} />
                <TextAreaField name="description" label="Description" defaultValue={event.description} />
                <TextField name="startsAt" label="Début" type="datetime-local" required defaultValue={toLocalInput(event.starts_at)} />
                <TextField name="endsAt" label="Fin" type="datetime-local" defaultValue={toLocalInput(event.ends_at)} />
                <TextField name="location" label="Lieu" defaultValue={event.location} />
                <TextField name="budgetEuros" label="Budget (€)" inputMode="decimal" defaultValue={event.budget_cents === null ? '' : String(event.budget_cents / 100)} />
                <fieldset>
                  <legend className="text-sm font-medium">Pôles impliqués</legend>
                  <div className="mt-2 flex flex-col gap-2">
                    {options.poles.map((p) => (
                      <label key={p.value} className="inline-flex items-center gap-2 text-sm">
                        <input type="checkbox" name="poleIds" value={p.value} defaultChecked={event.event_poles.some((ep) => ep.pole.id === p.value)} className="size-4" />
                        {p.label}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <SelectField name="leadId" label="Responsable" options={options.members} placeholder="À définir" defaultValue={event.lead?.id ?? ''} />
                <SelectField name="status" label="Statut" options={EVENT_STATUSES.map((s) => ({ value: s, label: LABELS.eventStatus[s] }))} defaultValue={event.status} />
                <TextAreaField name="logisticsNotes" label="Notes logistiques" defaultValue={event.logistics_notes} />
                <SubmitButton>Enregistrer</SubmitButton>
              </ActionForm>
            </Card>
          ) : null}

          {canDeleteEvent(session.viewer) ? (
            <ConfirmButton variant="danger" message="Supprimer définitivement cet événement ? Les tâches liées restent dans la liste des tâches." action={deleteEventAction.bind(null, event.id)}>
              Supprimer l’événement
            </ConfirmButton>
          ) : null}
        </aside>
      </div>
    </>
  );
}
