import type { Metadata } from 'next';
import {
  bulkMembersAction,
  deleteMemberAction,
  inviteMemberAction,
  updateMemberAction,
  savePoleAction,
  setMemberGlobalRoleAction,
  setTeamArchivedAction,
} from '@/app/actions/members';
import { ActionButton, ActionForm, ConfirmButton, SelectField, SubmitButton, TextAreaField, TextField } from '@/components/forms';
import { SelectAll } from '@/components/members/SelectAll';
import { Badge, Card, CardTitle, PageHeader } from '@/components/ui';
import { requireSiteAdmin } from '@/lib/auth';
import { listMembers, listPendingInvitations } from '@/lib/data/people';
import { formatDate } from '@/lib/domain/format';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Membres et équipes' };

const BULK_ACTIONS = [
  { value: 'valider', label: 'Valider les comptes' },
  { value: 'desactiver', label: 'Désactiver les comptes' },
  { value: 'affecter', label: 'Ajouter à une équipe' },
  { value: 'retirer', label: 'Retirer d’une équipe' },
];

export default async function MembresAdminPage() {
  const session = await requireSiteAdmin();
  const supabase = await createClient();
  const [members, pending, teamResult] = await Promise.all([
    listMembers(),
    listPendingInvitations(),
    supabase.from('poles').select('id, slug, name, description, archived_at').order('position'),
  ]);
  const teams = (teamResult.data ?? []) as { id: string; slug: string; name: string; description: string; archived_at: string | null }[];
  const teamOptions = teams.filter((t) => !t.archived_at).map((t) => ({ value: t.id, label: t.name }));
  const waiting = members.filter((m) => !m.is_active).length;

  return (
    <>
      <PageHeader
        title="Membres et équipes"
        description="Validez les comptes, affectez les membres aux équipes et gérez les équipes. Réservé à l’administrateur du site."
      />

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-6 xl:col-span-2">
          <Card>
            <CardTitle action={waiting > 0 ? <Badge tone="warning">{waiting} en attente</Badge> : undefined}>Membres</CardTitle>

            <ActionForm action={bulkMembersAction} className="flex flex-col gap-4">
              <div className="grid gap-3 rounded-xl bg-[var(--c-surface-muted)] p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                <SelectField name="action" label="Action groupée" options={BULK_ACTIONS} defaultValue="valider" />
                <SelectField name="poleId" label="Équipe (si besoin)" options={teamOptions} placeholder="Aucune" />
                <SubmitButton>Appliquer</SubmitButton>
              </div>

              <div className="-mx-2 overflow-x-auto px-2">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide text-[var(--c-ink-faint)]">
                    <tr className="border-b border-[var(--c-line)]">
                      <th className="w-10 py-2"><SelectAll /></th>
                      <th className="py-2 font-medium">Membre</th>
                      <th className="py-2 font-medium">Statut</th>
                      <th className="py-2 font-medium">Rôle</th>
                      <th className="py-2 font-medium">Équipes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--c-line)]">
                    {members.map((m) => {
                      const teamNames = m.pole_memberships.filter((pm) => pm.pole && !pm.pole.archived_at).map((pm) => pm.pole!.name);
                      return (
                        <tr key={m.id} className="align-top">
                          <td className="py-3">
                            <input
                              type="checkbox"
                              name="profileIds"
                              value={m.id}
                              aria-label={`Sélectionner ${m.full_name}`}
                              className="size-4"
                              disabled={m.id === session.viewer.id}
                            />
                          </td>
                          <td className="py-3">
                            <p className="font-medium">
                              {m.full_name}
                              {m.id === session.viewer.id ? ' (vous)' : ''}
                            </p>
                            <p className="text-xs text-[var(--c-ink-faint)]">{m.email}</p>
                          </td>
                          <td className="py-3">
                            <Badge tone={m.is_active ? 'success' : 'warning'}>{m.is_active ? 'Actif' : 'En attente'}</Badge>
                          </td>
                          <td className="py-3">
                            <Badge>{m.is_site_admin ? 'Administrateur' : m.role === 'bureau' ? 'Bureau' : 'Membre'}</Badge>
                            {session.profile.is_site_admin && m.id !== session.viewer.id && !m.is_site_admin ? (
                              <div className="mt-2">
                                <ActionButton action={setMemberGlobalRoleAction.bind(null, m.id, m.role === 'bureau' ? 'membre' : 'bureau')}>
                                  {m.role === 'bureau' ? 'Retirer du bureau' : 'Nommer au bureau'}
                                </ActionButton>
                              </div>
                            ) : null}
                          </td>
                          <td className="py-3 text-[var(--c-ink-soft)]">{teamNames.join(', ') || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </ActionForm>
          </Card>

          <Card>
            <CardTitle>Modifier un membre</CardTitle>
            <p className="mb-4 text-sm text-[var(--c-ink-soft)]">
              {session.profile.is_site_admin
                ? 'En tant qu’administrateur du site, vous modifiez le nom, le rôle et les équipes, et vous pouvez supprimer un compte.'
                : 'Vous modifiez le nom et les équipes. Seul l’administrateur du site change le rôle ou supprime un compte.'}
            </p>
            <ul className="flex flex-col divide-y divide-[var(--c-line)]">
              {members.map((m) => {
                const memberTeams = new Set(m.pole_memberships.filter((pm) => pm.pole && !pm.pole.archived_at).map((pm) => pm.pole!.id));
                const isSelf = m.id === session.viewer.id;
                return (
                  <li key={m.id}>
                    <details className="group py-3">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                        <span className="min-w-0">
                          <span className="font-medium">{m.full_name}</span>
                          <span className="block truncate text-xs text-[var(--c-ink-faint)]">{m.email}</span>
                        </span>
                        <span className="shrink-0 text-sm text-[var(--c-accent)] group-open:hidden">Modifier</span>
                        <span className="hidden shrink-0 text-sm text-[var(--c-ink-faint)] group-open:inline">Fermer</span>
                      </summary>
                      <div className="mt-4">
                        <ActionForm action={updateMemberAction.bind(null, m.id)} className="grid gap-4">
                          <TextField name="fullName" label="Nom complet" required minLength={2} maxLength={120} defaultValue={m.full_name} />
                          {session.profile.is_site_admin && !isSelf ? (
                            <SelectField
                              name="role"
                              label="Rôle"
                              options={[
                                { value: 'membre', label: 'Membre' },
                                { value: 'bureau', label: 'Bureau' },
                              ]}
                              defaultValue={m.role}
                            />
                          ) : (
                            <p className="text-sm text-[var(--c-ink-soft)]">Rôle : {m.is_site_admin ? 'Administrateur du site' : m.role === 'bureau' ? 'Bureau' : 'Membre'}</p>
                          )}
                          <fieldset>
                            <legend className="text-sm font-medium">Équipes</legend>
                            <div className="mt-2 grid gap-2 sm:grid-cols-2">
                              {teamOptions.map((t) => (
                                <label key={t.value} className="inline-flex items-center gap-2 text-sm">
                                  <input type="checkbox" name="poleIds" value={t.value} defaultChecked={memberTeams.has(t.value)} className="size-4" />
                                  {t.label}
                                </label>
                              ))}
                            </div>
                          </fieldset>
                          <div>
                            <SubmitButton>Enregistrer</SubmitButton>
                          </div>
                        </ActionForm>
                        {session.profile.is_site_admin && !isSelf ? (
                          <div className="mt-4 border-t border-[var(--c-line)] pt-4">
                            <ConfirmButton
                              variant="danger"
                              message={`Supprimer définitivement le compte de ${m.full_name} ? Cette action est irréversible.`}
                              action={deleteMemberAction.bind(null, m.id)}
                            >
                              Supprimer ce compte
                            </ConfirmButton>
                          </div>
                        ) : null}
                      </div>
                    </details>
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card>
            <CardTitle>Invitations envoyées</CardTitle>
            {pending.length === 0 ? (
              <p className="text-sm text-[var(--c-ink-faint)]">Aucune invitation en attente d’acceptation.</p>
            ) : (
              <ul className="divide-y divide-[var(--c-line)] text-sm">
                {pending.map((i) => (
                  <li key={i.email} className="flex flex-wrap justify-between gap-2 py-2.5">
                    <span className="min-w-0 truncate">{i.email}</span>
                    <span className="text-xs text-[var(--c-ink-faint)]">
                      {i.role === 'bureau' ? 'Bureau' : 'Membre'} · {formatDate(i.created_at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <aside className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardTitle>Inviter un membre</CardTitle>
            <ActionForm action={inviteMemberAction} resetOnSuccess className="grid gap-3">
              <TextField name="email" label="Adresse e-mail" type="email" required autoComplete="off" />
              <SelectField
                name="role"
                label="Rôle"
                options={[
                  { value: 'membre', label: 'Membre' },
                  { value: 'bureau', label: 'Bureau' },
                ]}
                defaultValue="membre"
              />
              <SelectField name="poleId" label="Équipe (facultatif)" options={teamOptions} placeholder="Aucune" />
              <SubmitButton>Envoyer l’invitation</SubmitButton>
            </ActionForm>
          </Card>

          <Card id="equipes">
            <CardTitle>Équipes</CardTitle>
            <ul className="flex flex-col gap-5">
              {teams.map((t) => {
                const count = members.filter((m) => m.pole_memberships.some((pm) => pm.pole?.id === t.id)).length;
                return (
                  <li key={t.id} className="flex flex-col gap-3 border-b border-[var(--c-line)] pb-5 last:border-0 last:pb-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className={`font-medium ${t.archived_at ? 'text-[var(--c-ink-faint)] line-through' : ''}`}>{t.name}</p>
                      <span className="text-xs text-[var(--c-ink-faint)]">
                        {count} membre(s){t.archived_at ? ' · archivée' : ''}
                      </span>
                    </div>
                    <ActionForm action={savePoleAction.bind(null, t.id)} className="grid gap-2">
                      <input type="hidden" name="slug" value={t.slug} />
                      <TextField name="name" label="Nom" required minLength={2} maxLength={80} defaultValue={t.name} />
                      <TextAreaField name="description" label="Description" maxLength={1000} defaultValue={t.description} />
                      <SubmitButton variant="secondary">Enregistrer</SubmitButton>
                    </ActionForm>
                    {t.archived_at ? (
                      <ActionButton action={setTeamArchivedAction.bind(null, t.id, false)}>Réactiver l’équipe</ActionButton>
                    ) : (
                      <ConfirmButton
                        message={`Archiver l’équipe « ${t.name} » ? Elle ne sera plus proposée pour les affectations.`}
                        action={setTeamArchivedAction.bind(null, t.id, true)}
                      >
                        Archiver l’équipe
                      </ConfirmButton>
                    )}
                  </li>
                );
              })}
            </ul>

            <details className="mt-5">
              <summary className="cursor-pointer text-sm font-medium text-[var(--c-accent)]">Créer une équipe</summary>
              <ActionForm action={savePoleAction.bind(null, null)} resetOnSuccess className="mt-4 grid gap-3">
                <TextField name="name" label="Nom de l’équipe" required minLength={2} maxLength={80} />
                <TextField name="slug" label="Identifiant (adresse)" required pattern="[a-z0-9-]{2,60}" hint="Lettres minuscules, chiffres et tirets." />
                <TextAreaField name="description" label="Description" maxLength={1000} />
                <SubmitButton>Créer l’équipe</SubmitButton>
              </ActionForm>
            </details>
          </Card>
        </aside>
      </div>
    </>
  );
}
