import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createProjectAction } from '@/app/actions/projects';
import { ActionForm, SelectField, SubmitButton, TextAreaField, TextField } from '@/components/forms';
import { PageHeader } from '@/components/ui';
import { requireSession } from '@/lib/auth';
import { getFormOptions } from '@/lib/data/options';
import { LABELS, PROJECT_STATUSES, TASK_PRIORITIES } from '@/lib/domain/constants';
import { canCreateProject } from '@/lib/domain/permissions';

export const metadata: Metadata = { title: 'Nouveau projet' };

export default async function NouveauProjetPage() {
  const session = await requireSession();
  if (!canCreateProject(session.viewer)) {
    redirect('/acces-refuse');
  }
  const options = await getFormOptions();

  return (
    <>
      <PageHeader title="Nouveau projet" description="Un projet peut être transversal : sélectionnez tous les équipes concernés." />
      <div className="rounded-2xl border border-[var(--c-line)] bg-[var(--c-surface)] p-5">
        <ActionForm action={createProjectAction} className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <TextField name="title" label="Nom du projet" required minLength={2} maxLength={160} />
          </div>
          <div className="md:col-span-2">
            <TextAreaField name="description" label="Description" maxLength={5000} />
          </div>
          <div className="md:col-span-2">
            <TextAreaField name="objectives" label="Objectifs" maxLength={3000} />
          </div>
          <div className="md:col-span-2">
            <TextAreaField name="deliverables" label="Livrables attendus" maxLength={3000} />
          </div>
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
          <SelectField name="leadId" label="Responsable du projet" options={options.members} placeholder="À définir" />
          <SelectField
            name="status"
            label="Statut"
            options={PROJECT_STATUSES.map((s) => ({ value: s, label: LABELS.projectStatus[s] }))}
            defaultValue="a_lancer"
          />
          <SelectField
            name="priority"
            label="Priorité"
            options={TASK_PRIORITIES.map((p) => ({ value: p, label: LABELS.taskPriority[p] }))}
            defaultValue="normale"
          />
          <div className="grid grid-cols-2 gap-4">
            <TextField name="startDate" label="Début" type="date" />
            <TextField name="dueDate" label="Fin prévue" type="date" />
          </div>
          <div className="md:col-span-2">
            <SubmitButton>Créer le projet</SubmitButton>
          </div>
        </ActionForm>
      </div>
    </>
  );
}
