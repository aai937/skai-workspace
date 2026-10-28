import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createEventAction } from '@/app/actions/events';
import { ActionForm, SelectField, SubmitButton, TextAreaField, TextField } from '@/components/forms';
import { PageHeader } from '@/components/ui';
import { requireSession } from '@/lib/auth';
import { getFormOptions } from '@/lib/data/options';
import { EVENT_STATUSES, LABELS } from '@/lib/domain/constants';
import { canCreateEvent } from '@/lib/domain/permissions';

export const metadata: Metadata = { title: 'Nouvel événement' };

export default async function NouvelEvenementPage() {
  const session = await requireSession();
  if (!canCreateEvent(session.viewer)) {
    redirect('/acces-refuse');
  }
  const options = await getFormOptions();

  return (
    <>
      <PageHeader title="Nouvel événement" description="Les heures sont celles de Paris. La checklist logistique se remplit ensuite depuis la fiche de l'événement." />
      <div className="rounded-2xl border border-[var(--c-line)] bg-[var(--c-surface)] p-5">
        <ActionForm action={createEventAction} className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <TextField name="title" label="Nom de l'événement" required minLength={2} maxLength={160} />
          </div>
          <div className="md:col-span-2">
            <TextAreaField name="description" label="Description" maxLength={5000} />
          </div>
          <TextField name="startsAt" label="Début" type="datetime-local" required />
          <TextField name="endsAt" label="Fin" type="datetime-local" />
          <TextField name="location" label="Lieu" maxLength={200} />
          <TextField name="budgetEuros" label="Budget (€, facultatif)" inputMode="decimal" />
          <fieldset className="md:col-span-2">
            <legend className="text-sm font-medium">Équipes impliqués</legend>
            <div className="mt-2 flex flex-wrap gap-3">
              {options.poles.map((p) => (
                <label key={p.value} className="inline-flex items-center gap-2 text-sm">
                  <input type="checkbox" name="poleIds" value={p.value} className="size-4" />
                  {p.label}
                </label>
              ))}
            </div>
          </fieldset>
          <SelectField name="leadId" label="Responsable" options={options.members} placeholder="À définir" />
          <SelectField name="status" label="Statut" options={EVENT_STATUSES.map((s) => ({ value: s, label: LABELS.eventStatus[s] }))} defaultValue="preparation" />
          <div className="md:col-span-2">
            <TextAreaField name="logisticsNotes" label="Notes logistiques" maxLength={5000} />
          </div>
          <div className="md:col-span-2">
            <SubmitButton>Créer l’événement</SubmitButton>
          </div>
        </ActionForm>
      </div>
    </>
  );
}
