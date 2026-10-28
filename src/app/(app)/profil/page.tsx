import type { Metadata } from 'next';
import { updateOwnProfileAction } from '@/app/actions/members';
import { ActionForm, SubmitButton, TextAreaField, TextField } from '@/components/forms';
import { Card, CardTitle, PageHeader } from '@/components/ui';
import { requireSession } from '@/lib/auth';
import { getProfileContacts, listPoles } from '@/lib/data/people';

export const metadata: Metadata = { title: 'Mon profil' };

export default async function ProfilPage() {
  const session = await requireSession();
  const [contacts] = await Promise.all([getProfileContacts(session.viewer.id), listPoles()]);

  return (
    <>
      <PageHeader title="Mon profil" description={`${session.profile.email} · ${session.viewer.isBureau ? 'Bureau' : 'Membre'}`} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardTitle>Identité</CardTitle>
          <ActionForm action={updateOwnProfileAction} className="grid gap-4">
            <TextField name="fullName" label="Nom complet" required minLength={2} maxLength={120} defaultValue={session.profile.full_name} />
            <TextAreaField name="bio" label="Présentation" maxLength={500} defaultValue={session.profile.bio} />
            <CardTitle>Coordonnées professionnelles</CardTitle>
            <p className="-mt-2 text-xs text-[var(--c-ink-faint)]">Visibles seulement de vous et du bureau.</p>
            <TextField name="professionalEmail" label="E-mail professionnel" type="email" defaultValue={contacts?.professional_email ?? ''} />
            <TextField name="phone" label="Téléphone" type="tel" defaultValue={contacts?.phone ?? ''} />
            <SubmitButton>Enregistrer</SubmitButton>
          </ActionForm>
        </Card>
        <Card>
          <CardTitle>Mes pôles</CardTitle>
          {session.poles.length === 0 ? (
            <p className="text-sm text-[var(--c-ink-faint)]">Vous n’êtes rattaché à aucun pôle pour l’instant.</p>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {session.poles.map((p) => (
                <li key={p.id}>
                  {p.name} <span className="text-xs text-[var(--c-ink-faint)]">· {p.role === 'responsable' ? 'Responsable' : 'Membre'}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
