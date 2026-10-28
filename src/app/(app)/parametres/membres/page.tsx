import type { Metadata } from 'next';
import { assignPoleFormAction, inviteMemberAction, savePoleAction, setMemberActiveAction, setMemberGlobalRoleAction } from '@/app/actions/members';
import { ActionButton, ActionForm, SelectField, SubmitButton, TextAreaField, TextField } from '@/components/forms';
import { Badge, Card, CardTitle, PageHeader } from '@/components/ui';
import { requireBureau } from '@/lib/auth';
import { listMembers, listPendingInvitations, listPoles } from '@/lib/data/people';
import { LABELS } from '@/lib/domain/constants';
import { formatDate } from '@/lib/domain/format';

export const metadata: Metadata = { title: 'Membres et pôles' };

export default async function MembresAdminPage() {
  const session = await requireBureau();
  const [members, poles, pending] = await Promise.all([listMembers(), listPoles(), listPendingInvitations()]);
  const poleOptions = poles.map((p) => ({ value: p.id, label: p.name }));
  const waiting = members.filter((m) => !m.is_active);

  return (
    <>
      <PageHeader title="Membres et pôles" description="Invitez, validez les comptes, attribuez les rôles. Seul le bureau modifie les rôles globaux." />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          {waiting.length > 0 ? (
            <Card>
              <CardTitle>En attente de validation <Badge tone="warning">{waiting.length}</Badge></CardTitle>
              <ul className="divide-y divide-[var(--c-line)] text-sm">
                {waiting.map((m) => (
                  <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                    <span>{m.full_name} <span className="text-[var(--c-ink-faint)]">· {m.email}</span></span>
                    <ActionButton action={setMemberActiveAction.bind(null, m.id, true)}>Valider le compte</ActionButton>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          <Card>
            <CardTitle>Membres</CardTitle>
            <ul className="flex flex-col gap-6">
              {members.map((m) => (
                <li key={m.id} className="flex flex-col gap-3 border-b border-[var(--c-line)] pb-6 last:border-0 last:pb-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">{m.full_name}</p>
                      <p className="text-xs text-[var(--c-ink-faint)]">{m.email}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={m.is_active ? 'success' : 'warning'}>{m.is_active ? 'Actif' : 'En attente'}</Badge>
                      <Badge>{LABELS.globalRole[m.role]}</Badge>
                      {m.id !== session.viewer.id ? (
                        <>
                          <ActionButton action={setMemberGlobalRoleAction.bind(null, m.id, m.role === 'bureau' ? 'membre' : 'bureau')}>
                            {m.role === 'bureau' ? 'Retirer le bureau' : 'Passer au bureau'}
                          </ActionButton>
                          <ActionButton action={setMemberActiveAction.bind(null, m.id, !m.is_active)}>
                            {m.is_active ? 'Désactiver' : 'Valider'}
                          </ActionButton>
                        </>
                      ) : null}
                    </div>
                  </div>
                  <p className="text-xs text-[var(--c-ink-soft)]">
                    Pôles : {m.pole_memberships.filter((pm) => pm.pole).map((pm) => `${pm.pole!.name} (${LABELS.poleRole[pm.role].toLowerCase()})`).join(' · ') || 'aucun'}
                  </p>
                  <ActionForm action={assignPoleFormAction} resetOnSuccess className="grid gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-end">
                    <input type="hidden" name="profileId" value={m.id} />
                    <SelectField name="poleId" label="Affecter à un pôle" options={poleOptions} placeholder="Choisir un pôle" required />
                    <SelectField
                      name="role"
                      label="Rôle"
                      options={[
                        { value: 'membre', label: 'Membre' },
                        { value: 'responsable', label: 'Responsable' },
                        { value: 'retirer', label: 'Retirer du pôle' },
                      ]}
                      defaultValue="membre"
                    />
                    <SubmitButton variant="secondary">Enregistrer</SubmitButton>
                  </ActionForm>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardTitle>Invitations envoyées</CardTitle>
            {pending.length === 0 ? (
              <p className="text-sm text-[var(--c-ink-faint)]">Aucune invitation en attente d’acceptation.</p>
            ) : (
              <ul className="divide-y divide-[var(--c-line)] text-sm">
                {pending.map((i) => (
                  <li key={i.email} className="flex justify-between py-2">
                    <span>{i.email}</span>
                    <span className="text-xs text-[var(--c-ink-faint)]">{LABELS.globalRole[i.role]} · {formatDate(i.created_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <aside className="flex flex-col gap-6">
          <Card>
            <CardTitle>Inviter un membre</CardTitle>
            <ActionForm action={inviteMemberAction} resetOnSuccess className="grid gap-3">
              <TextField name="email" label="Adresse e-mail" type="email" required autoComplete="off" />
              <SelectField
                name="role"
                label="Rôle global"
                options={[
                  { value: 'membre', label: 'Membre' },
                  { value: 'bureau', label: 'Bureau' },
                ]}
                defaultValue="membre"
              />
              <SelectField name="poleId" label="Pôle (facultatif)" options={poleOptions} placeholder="Aucun" />
              <SelectField
                name="poleRole"
                label="Rôle dans le pôle"
                options={[
                  { value: 'membre', label: 'Membre' },
                  { value: 'responsable', label: 'Responsable' },
                ]}
                defaultValue="membre"
              />
              <SubmitButton>Envoyer l’invitation</SubmitButton>
            </ActionForm>
            <p className="mt-3 text-xs text-[var(--c-ink-faint)]">La personne reçoit un lien pour choisir son mot de passe. Le responsable de pôle nommé ici doit être accepté par le bureau.</p>
          </Card>

          <Card id="poles">
            <CardTitle>Créer ou renommer un pôle</CardTitle>
            <ActionForm action={savePoleAction.bind(null, null)} resetOnSuccess className="grid gap-3">
              <TextField name="name" label="Nom du pôle" required minLength={2} maxLength={80} />
              <TextField name="slug" label="Identifiant (URL)" required pattern="[a-z0-9-]{2,60}" hint="Lettres minuscules, chiffres et tirets." />
              <TextAreaField name="description" label="Description" maxLength={1000} />
              <SubmitButton>Créer le pôle</SubmitButton>
            </ActionForm>
          </Card>
        </aside>
      </div>
    </>
  );
}
