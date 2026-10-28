import type { Metadata } from 'next';
import { regenerateCalendarTokenAction, updateMailPreferenceAction, updateOwnProfileAction } from '@/app/actions/members';
import { ActionForm, ConfirmButton, SelectField, SubmitButton, TextAreaField, TextField } from '@/components/forms';
import { Card, CardTitle, PageHeader } from '@/components/ui';
import { requireSession } from '@/lib/auth';
import { getProfileContacts } from '@/lib/data/people';
import { createClient } from '@/lib/supabase/server';
import { siteOrigin } from '@/lib/site';

export const metadata: Metadata = { title: 'Mon profil' };

export default async function ProfilPage() {
  const session = await requireSession();
  const supabase = await createClient();
  const [contacts, prefs, origin] = await Promise.all([
    getProfileContacts(session.viewer.id),
    supabase.from('profiles').select('email_digest, calendar_token').eq('id', session.viewer.id).single(),
    siteOrigin(),
  ]);
  const calendarToken = (prefs.data as { calendar_token: string } | null)?.calendar_token ?? '';
  const digest = (prefs.data as { email_digest: string } | null)?.email_digest ?? 'quotidien';
  const calendarUrl = `${origin}/api/calendrier?token=${calendarToken}`;

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

        <div className="flex flex-col gap-6">
          <Card>
            <CardTitle>Mes équipes</CardTitle>
            {session.poles.length === 0 ? (
              <p className="text-sm text-[var(--c-ink-faint)]">Vous n’êtes rattaché à aucun équipe pour l’instant.</p>
            ) : (
              <ul className="flex flex-col gap-2 text-sm">
                {session.poles.map((p) => (
                  <li key={p.id}>
                    {p.name}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardTitle>E-mails</CardTitle>
            <ActionForm action={updateMailPreferenceAction} className="grid gap-3">
              <SelectField
                name="digest"
                label="Synthèse par e-mail"
                hint="Vos échéances, annonces et notifications, regroupées."
                options={[
                  { value: 'quotidien', label: 'Chaque jour' },
                  { value: 'hebdomadaire', label: 'Chaque lundi' },
                  { value: 'desactive', label: 'Aucun e-mail' },
                ]}
                defaultValue={digest}
              />
              <SubmitButton>Enregistrer</SubmitButton>
            </ActionForm>
          </Card>

          <Card>
            <CardTitle>Calendrier personnel</CardTitle>
            <p className="text-sm text-[var(--c-ink-soft)]">
              Ajoutez ce lien à Google Agenda, Outlook ou Apple Agenda (« s’abonner à une agenda par URL ») pour voir vos échéances et les événements.
            </p>
            <p className="mt-3 break-all rounded-lg bg-[var(--c-surface-muted)] p-3 font-mono text-xs">{calendarUrl}</p>
            <p className="mt-2 text-xs text-[var(--c-ink-faint)]">Ce lien est personnel : ne le partagez pas. Régénérez-le si vous pensez qu’il a fuité.</p>
            <div className="mt-3">
              <ConfirmButton message="Régénérer le lien ? L’ancien cessera de fonctionner." action={regenerateCalendarTokenAction}>
                Régénérer le lien
              </ConfirmButton>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
