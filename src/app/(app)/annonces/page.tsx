import type { Metadata } from 'next';
import { archiveAnnouncementAction, markAnnouncementReadAction, publishAnnouncementAction, setAnnouncementPinnedAction } from '@/app/actions/announcements';
import { ActionButton, ActionForm, ConfirmButton, SelectField, SubmitButton, TextAreaField, TextField } from '@/components/forms';
import { Badge, Card, CardTitle, EmptyState, PageHeader } from '@/components/ui';
import { requireSession } from '@/lib/auth';
import { listAnnouncements } from '@/lib/data/messaging';
import { listPoles } from '@/lib/data/people';
import { canPublishAnnouncementAnywhere } from '@/lib/domain/messaging';
import { formatDateTime } from '@/lib/domain/format';

export const metadata: Metadata = { title: 'Annonces' };

export default async function AnnoncesPage() {
  const session = await requireSession();
  const announcements = await listAnnouncements(session.viewer.id);
  const canPublish = canPublishAnnouncementAnywhere(session.viewer);
  const isBureau = session.viewer.isBureau;

  // Seul le bureau publie : pour tous les membres ou pour une équipe.
  const allPoles = await listPoles();
  const poles = isBureau ? allPoles : [];
  const audienceOptions = [
    ...(isBureau ? [{ value: 'tous', label: 'Tous les membres' }] : []),
    ...(poles.length > 0 ? [{ value: 'pole', label: 'Un équipe' }] : []),
  ];

  return (
    <>
      <PageHeader
        title="Annonces"
        description={canPublish ? 'Publiez les informations officielles et suivez qui les a lues.' : 'Les informations officielles de l’association. Les annonces épinglées restent en haut.'}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          {announcements.length === 0 ? (
            <EmptyState title="Aucune annonce" text="Les annonces du bureau apparaîtront ici." />
          ) : (
            announcements.map((a) => (
              <Card key={a.id} className={a.pinned ? 'border-[var(--c-accent)]' : ''}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {a.pinned ? <Badge tone="accent">Épinglée</Badge> : null}
                    {a.audience === 'pole' ? <Badge>{a.pole?.name ?? 'Équipe'}</Badge> : <Badge>Tous les membres</Badge>}
                    {!a.read ? <Badge tone="warning">Nouvelle</Badge> : null}
                  </div>
                  <span className="text-xs text-[var(--c-ink-faint)]">
                    {a.author?.full_name ?? 'Auteur supprimé'} · {formatDateTime(a.created_at)}
                  </span>
                </div>
                <h2 className="mt-3 text-lg font-semibold tracking-tight">{a.title}</h2>
                <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--c-ink-soft)]">{a.body}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {!a.read ? <ActionButton action={markAnnouncementReadAction.bind(null, a.id)}>Marquer comme lue</ActionButton> : null}
                  {canPublish ? (
                    <ActionButton action={setAnnouncementPinnedAction.bind(null, a.id, !a.pinned)}>
                      {a.pinned ? 'Désépingler' : 'Épingler'}
                    </ActionButton>
                  ) : null}
                  {canPublish ? (
                    <ConfirmButton message="Archiver cette annonce ?" action={archiveAnnouncementAction.bind(null, a.id)}>
                      Archiver
                    </ConfirmButton>
                  ) : null}
                </div>
              </Card>
            ))
          )}
        </div>

        {canPublish && audienceOptions.length > 0 ? (
          <Card>
            <CardTitle>Publier une annonce</CardTitle>
            <ActionForm action={publishAnnouncementAction} resetOnSuccess className="grid gap-3">
              <TextField name="title" label="Titre" required minLength={2} maxLength={160} />
              <TextAreaField name="body" label="Message" required maxLength={5000} />
              <SelectField name="audience" label="Destinataires" options={audienceOptions} defaultValue={audienceOptions[0]!.value} />
              <SelectField
                name="poleId"
                label="Équipe (si « Un équipe »)"
                options={poles.map((p) => ({ value: p.id, label: p.name }))}
                placeholder="Aucun"
              />
              <label className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" name="pinned" className="size-4" /> Épingler en haut de la liste
              </label>
              <label className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" name="sendEmail" className="size-4" /> Envoyer aussi par e-mail
              </label>
              <SubmitButton>Publier</SubmitButton>
            </ActionForm>
          </Card>
        ) : null}
      </div>
    </>
  );
}
