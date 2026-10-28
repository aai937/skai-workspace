import { ActionForm, SelectField, SubmitButton, TextAreaField, TextField } from '@/components/forms';
import { LABELS, TASK_PRIORITIES, TASK_STATUSES, type TaskPriority, type TaskStatus } from '@/lib/domain/constants';
import type { ActionResult } from '@/lib/result';

export type Option = { value: string; label: string };

export type TaskFormValues = {
  title?: string;
  description?: string;
  poleId?: string;
  projectId?: string | null;
  eventId?: string | null;
  assigneeId?: string | null;
  priority?: TaskPriority;
  status?: TaskStatus;
  dueDate?: string | null;
  labels?: string[];
  blockedReason?: string | null;
};

// Formulaire de tâche, partagé entre création et modification.
export function TaskForm({
  action,
  values = {},
  poles,
  projects,
  events,
  members,
  submitLabel,
}: {
  action: (formData: FormData) => Promise<ActionResult<unknown> | void>;
  values?: TaskFormValues;
  poles: Option[];
  projects: Option[];
  events: Option[];
  members: Option[];
  submitLabel: string;
}) {
  return (
    <ActionForm action={action} className="grid gap-4 md:grid-cols-2">
      <div className="md:col-span-2">
        <TextField name="title" label="Titre" required minLength={2} maxLength={200} defaultValue={values.title} />
      </div>
      <div className="md:col-span-2">
        <TextAreaField name="description" label="Description" maxLength={5000} defaultValue={values.description} />
      </div>
      <SelectField name="poleId" label="Pôle" options={poles} defaultValue={values.poleId} required />
      <SelectField name="assigneeId" label="Responsable de la tâche" options={members} placeholder="Non attribuée" defaultValue={values.assigneeId ?? ''} />
      <SelectField name="projectId" label="Projet" options={projects} placeholder="Aucun" defaultValue={values.projectId ?? ''} />
      <SelectField name="eventId" label="Événement" options={events} placeholder="Aucun" defaultValue={values.eventId ?? ''} />
      <SelectField
        name="priority"
        label="Priorité"
        options={TASK_PRIORITIES.map((p) => ({ value: p, label: LABELS.taskPriority[p] }))}
        defaultValue={values.priority ?? 'normale'}
      />
      <SelectField
        name="status"
        label="Statut"
        options={TASK_STATUSES.map((s) => ({ value: s, label: LABELS.taskStatus[s] }))}
        defaultValue={values.status ?? 'a_faire'}
      />
      <TextField name="dueDate" label="Échéance" type="date" defaultValue={values.dueDate ?? ''} />
      <TextField
        name="labels"
        label="Étiquettes"
        hint="Séparées par des virgules, 10 maximum."
        defaultValue={(values.labels ?? []).join(', ')}
      />
      <div className="md:col-span-2">
        <TextAreaField
          name="blockedReason"
          label="Motif du blocage"
          hint="Obligatoire si le statut est « Bloquée »."
          maxLength={1000}
          defaultValue={values.blockedReason ?? ''}
        />
      </div>
      <div className="md:col-span-2">
        <SubmitButton>{submitLabel}</SubmitButton>
      </div>
    </ActionForm>
  );
}
